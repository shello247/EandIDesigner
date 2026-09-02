import { existsSync, mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterEach, describe, expect, it } from "vitest";
import {
  parseRetirementArguments,
  retireNetworkMapStorage
} from "../retire-network-map-storage";
import { toPrismaSqliteFileUrl } from "../development-runtime";

const clients: PrismaClient[] = [];

async function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "ei-network-retirement-"));
  const databasePath = path.join(root, "fixture.db");
  const prisma = new PrismaClient({
    datasourceUrl: toPrismaSqliteFileUrl(databasePath)
  });
  clients.push(prisma);
  await prisma.$executeRawUnsafe(
    'CREATE TABLE "Drawing" ("id" TEXT NOT NULL PRIMARY KEY, "title" TEXT NOT NULL)'
  );
  await prisma.$executeRawUnsafe(
    'INSERT INTO "Drawing" ("id", "title") VALUES (\'drawing_1\', \'Preserved drawing\')'
  );
  await prisma.$executeRawUnsafe(`
    CREATE TABLE "NetworkMap" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "mapKey" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "status" TEXT NOT NULL,
      "modelJson" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL,
      "updatedAt" DATETIME NOT NULL
    )
  `);
  const modelJson = JSON.stringify({
    version: 1,
    titleBlock: { revision: "A" },
    sheets: [
      {
        id: "sheet_1",
        name: "Network Topology",
        page: { size: "A3_LANDSCAPE", width: 420, height: 297, gridSize: 10 },
        zones: [],
        nodes: [],
        links: [],
        annotations: []
      }
    ]
  });
  await prisma.$executeRawUnsafe(
    'INSERT INTO "NetworkMap" ("id", "mapKey", "title", "status", "modelJson", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?)',
    "map_1",
    "test_map",
    "Test map",
    "draft",
    modelJson,
    new Date("2026-08-28T12:00:00.000Z"),
    new Date("2026-08-28T12:00:00.000Z")
  );
  return { root, databasePath, prisma };
}

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.$disconnect()));
});

describe("NetworkMap storage retirement", () => {
  it("accepts only the explicit apply flag", () => {
    expect(parseRetirementArguments([])).toEqual({ apply: false });
    expect(parseRetirementArguments(["--apply"])).toEqual({ apply: true });
    expect(() => parseRetirementArguments(["--database=other.db"])).toThrow(
      "Unsupported argument"
    );
  });

  it("performs a non-mutating dry run", async () => {
    const { root, databasePath, prisma } = await fixture();
    const result = await retireNetworkMapStorage({
      prisma,
      databasePath,
      archiveBasePath: path.join(root, "archives"),
      sourceCommit: "a".repeat(40),
      apply: false
    });
    expect(result).toEqual({ status: "dry-run", recordCount: 1 });
    const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*) AS count FROM "NetworkMap"'
    );
    expect(Number(rows[0]?.count)).toBe(1);
  });

  it("archives, drops, verifies, and remains idempotent", async () => {
    const { root, databasePath, prisma } = await fixture();
    const result = await retireNetworkMapStorage({
      prisma,
      databasePath,
      archiveBasePath: path.join(root, "archives"),
      sourceCommit: "b".repeat(40),
      apply: true,
      now: new Date("2026-08-28T12:34:56.000Z")
    });
    expect(result.status).toBe("retired");
    expect(result.archivePath).toBeTruthy();
    const archivePath = result.archivePath!;
    const exported = JSON.parse(
      readFileSync(path.join(archivePath, "network-maps.json"), "utf8")
    );
    const manifest = JSON.parse(
      readFileSync(path.join(archivePath, "manifest.json"), "utf8")
    );
    expect(exported.records).toHaveLength(1);
    expect(manifest).toMatchObject({
      state: "retired-and-verified",
      recordCount: 1
    });
    expect(manifest.afterTables.NetworkMap).toBeUndefined();
    expect(manifest.beforeTables.Drawing).toEqual(manifest.afterTables.Drawing);
    expect(
      await retireNetworkMapStorage({
        prisma,
        databasePath,
        archiveBasePath: path.join(root, "archives"),
        sourceCommit: "b".repeat(40),
        apply: true
      })
    ).toEqual({ status: "absent", recordCount: 0 });
  });

  it("rejects invalid historical models before writing an archive", async () => {
    const { root, databasePath, prisma } = await fixture();
    await prisma.$executeRawUnsafe(
      'UPDATE "NetworkMap" SET "modelJson" = ?',
      '{"version":99}'
    );
    await expect(
      retireNetworkMapStorage({
        prisma,
        databasePath,
        archiveBasePath: path.join(root, "archives"),
        sourceCommit: "c".repeat(40),
        apply: true
      })
    ).rejects.toThrow();
    const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*) AS count FROM "NetworkMap"'
    );
    expect(Number(rows[0]?.count)).toBe(1);
  });

  it("refuses an existing archive destination", async () => {
    const { root, databasePath, prisma } = await fixture();
    const archiveBasePath = path.join(root, "archives");
    mkdirSync(
      path.join(
        archiveBasePath,
        "20260828T123456000Z-dddddddddddd"
      ),
      { recursive: true }
    );

    await expect(
      retireNetworkMapStorage({
        prisma,
        databasePath,
        archiveBasePath,
        sourceCommit: "d".repeat(40),
        apply: true,
        now: new Date("2026-08-28T12:34:56.000Z")
      })
    ).rejects.toThrow("Refusing unsafe or existing archive destination");
  });

  it("refuses a locked database without creating an archive", async () => {
    const { root, databasePath, prisma } = await fixture();
    const locker = new PrismaClient({
      datasourceUrl: toPrismaSqliteFileUrl(databasePath)
    });
    clients.push(locker);
    await locker.$executeRawUnsafe("BEGIN EXCLUSIVE");
    try {
      await expect(
        retireNetworkMapStorage({
          prisma,
          databasePath,
          archiveBasePath: path.join(root, "archives"),
          sourceCommit: "e".repeat(40),
          apply: true
        })
      ).rejects.toThrow();
      expect(existsSync(path.join(root, "archives"))).toBe(false);
    } finally {
      await locker.$executeRawUnsafe("ROLLBACK");
    }
  });
});
