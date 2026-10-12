import { existsSync, mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterEach, describe, expect, it } from "vitest";
import { toPrismaSqliteFileUrl } from "../development-runtime";
import {
  parseDrawingProjectUpgradeArguments,
  upgradeDrawingProjectStorage
} from "../upgrade-drawing-project-storage";

const clients: PrismaClient[] = [];

async function legacyFixture() {
  const root = mkdtempSync(path.join(tmpdir(), "ei-drawing-project-upgrade-"));
  const databasePath = path.join(root, "fixture.db");
  const prisma = new PrismaClient({
    datasourceUrl: toPrismaSqliteFileUrl(databasePath)
  });
  clients.push(prisma);
  await prisma.$executeRawUnsafe("PRAGMA foreign_keys = ON");
  await prisma.$executeRawUnsafe(`
    CREATE TABLE "Drawing" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "drawingKey" TEXT NOT NULL UNIQUE,
      "title" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'draft',
      "modelJson" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )
  `);
  await prisma.$executeRawUnsafe(
    'INSERT INTO "Drawing" ("id", "drawingKey", "title", "modelJson", "updatedAt") VALUES (?, ?, ?, ?, ?)',
    "drawing_1",
    "preserved_key",
    "Preserved drawing",
    JSON.stringify({ version: 2, sheets: [] }),
    new Date("2026-09-02T09:00:00.000Z")
  );
  return { root, databasePath, prisma };
}

async function projectStorageV1Fixture() {
  const fixture = await legacyFixture();
  await fixture.prisma.$executeRawUnsafe(`
    CREATE TABLE "Project" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "projectNumber" TEXT,
      "normalizedProjectNumber" TEXT,
      "client" TEXT,
      "description" TEXT,
      "status" TEXT NOT NULL DEFAULT 'active',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )
  `);
  await fixture.prisma.$executeRawUnsafe(
    `INSERT INTO "Project"
       ("id", "name", "projectNumber", "normalizedProjectNumber", "client", "description", "status", "updatedAt")
     VALUES (?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?)`,
    "project_1",
    "Existing Project",
    "PRJ-000042",
    "prj-000042",
    "Water Authority",
    "Preserve this description",
    "active",
    new Date("2026-09-02T09:15:00.000Z"),
    "project_2",
    "Case Variant Client",
    "LEGACY-7",
    "legacy-7",
    " water authority ",
    null,
    "archived",
    new Date("2026-09-02T09:16:00.000Z")
  );
  return fixture;
}

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.$disconnect()));
});

describe("Drawing Project storage upgrade", () => {
  it("accepts only the explicit apply flag", () => {
    expect(parseDrawingProjectUpgradeArguments([])).toEqual({ apply: false });
    expect(parseDrawingProjectUpgradeArguments(["--apply"])).toEqual({
      apply: true
    });
    expect(() =>
      parseDrawingProjectUpgradeArguments(["--database=other.db"])
    ).toThrow("Unsupported argument");
  });

  it("performs a non-mutating dry run", async () => {
    const { root, databasePath, prisma } = await legacyFixture();
    const result = await upgradeDrawingProjectStorage({
      prisma,
      databasePath,
      archiveBasePath: path.join(root, "archives"),
      sourceCommit: "a".repeat(40),
      apply: false
    });
    expect(result).toEqual({ status: "dry-run", drawingCount: 1 });
    expect(existsSync(path.join(root, "archives"))).toBe(false);
    const project = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='Project'"
    );
    expect(project).toHaveLength(0);
  });

  it("backs up, upgrades, verifies, and remains idempotent", async () => {
    const { root, databasePath, prisma } = await legacyFixture();
    const result = await upgradeDrawingProjectStorage({
      prisma,
      databasePath,
      archiveBasePath: path.join(root, "archives"),
      sourceCommit: "b".repeat(40),
      apply: true,
      now: new Date("2026-09-02T10:20:30.000Z")
    });
    expect(result.status).toBe("upgraded");
    expect(result.archivePath).toBeTruthy();
    const manifest = JSON.parse(
      readFileSync(path.join(result.archivePath!, "manifest.json"), "utf8")
    );
    expect(manifest).toMatchObject({
      state: "upgraded-and-verified",
      drawingCount: 1
    });
    expect(existsSync(path.join(result.archivePath!, "pre-upgrade-dev.db"))).toBe(
      true
    );
    const row = await prisma.$queryRawUnsafe<
      Array<{ drawingKey: string; description: string | null; projectId: string | null }>
    >('SELECT "drawingKey", "description", "projectId" FROM "Drawing"');
    expect(row).toEqual([
      { drawingKey: "preserved_key", description: null, projectId: null }
    ]);
    expect(
      await prisma.$queryRawUnsafe<Array<{ name: string }>>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('Client', 'ProjectNumberSequence') ORDER BY name"
      )
    ).toEqual([{ name: "Client" }, { name: "ProjectNumberSequence" }]);
    expect(
      await upgradeDrawingProjectStorage({
        prisma,
        databasePath,
        archiveBasePath: path.join(root, "archives"),
        sourceCommit: "b".repeat(40),
        apply: true
      })
    ).toEqual({ status: "current", drawingCount: 1 });
  });

  it("materializes legacy Clients and seeds numbering without changing Project identity", async () => {
    const { root, databasePath, prisma } = await projectStorageV1Fixture();
    const before = await prisma.$queryRawUnsafe<
      Array<Record<string, string | null>>
    >(`
      SELECT "id", "name", "projectNumber", "normalizedProjectNumber",
             "client", "description", "status", "updatedAt"
      FROM "Project" ORDER BY "id"
    `);
    const result = await upgradeDrawingProjectStorage({
      prisma,
      databasePath,
      archiveBasePath: path.join(root, "archives"),
      sourceCommit: "f".repeat(40),
      apply: true,
      now: new Date("2026-09-02T11:20:30.000Z")
    });
    expect(result.status).toBe("upgraded");
    const clients = await prisma.$queryRawUnsafe<
      Array<{ id: string; name: string; normalizedName: string }>
    >('SELECT "id", "name", "normalizedName" FROM "Client"');
    expect(clients).toHaveLength(1);
    expect(clients[0]).toMatchObject({
      name: "Water Authority",
      normalizedName: "water authority"
    });
    const linkedProjects = await prisma.$queryRawUnsafe<
      Array<{ id: string; clientId: string | null }>
    >('SELECT "id", "clientId" FROM "Project" ORDER BY "id"');
    expect(linkedProjects).toEqual([
      { id: "project_1", clientId: clients[0]!.id },
      { id: "project_2", clientId: clients[0]!.id }
    ]);
    const after = await prisma.$queryRawUnsafe<
      Array<Record<string, string | null>>
    >(`
      SELECT "id", "name", "projectNumber", "normalizedProjectNumber",
             "client", "description", "status", "updatedAt"
      FROM "Project" ORDER BY "id"
    `);
    expect(after).toEqual(before);
    expect(
      await prisma.$queryRawUnsafe<
        Array<{ scope: string; lastValue: number }>
      >('SELECT "scope", "lastValue" FROM "ProjectNumberSequence"')
    ).toEqual([{ scope: "drawing-project", lastValue: 42 }]);
    expect(
      await upgradeDrawingProjectStorage({
        prisma,
        databasePath,
        archiveBasePath: path.join(root, "archives"),
        sourceCommit: "f".repeat(40),
        apply: true
      })
    ).toEqual({ status: "current", drawingCount: 1 });
  });

  it("rolls back schema and data together when a legacy uniqueness check fails", async () => {
    const { root, databasePath, prisma } = await projectStorageV1Fixture();
    await prisma.$executeRawUnsafe('UPDATE "Project" SET "normalizedProjectNumber" = ? WHERE "id" = ?', "prj-000042", "project_2");
    await expect(upgradeDrawingProjectStorage({
      prisma, databasePath, archiveBasePath: path.join(root, "archives"),
      sourceCommit: "9".repeat(40), apply: true
    })).rejects.toThrow();
    expect(await prisma.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('Client', 'ProjectNumberSequence')")).toEqual([]);
    const columns = await prisma.$queryRawUnsafe<Array<{ name: string }>>('PRAGMA table_info("Project")');
    expect(columns.some(column => column.name === "clientId")).toBe(false);
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>('SELECT "id" FROM "Project" ORDER BY "id"');
    expect(rows).toEqual([{ id: "project_1" }, { id: "project_2" }]);
  });

  it("refuses an existing archive destination", async () => {
    const { root, databasePath, prisma } = await legacyFixture();
    const archiveBasePath = path.join(root, "archives");
    mkdirSync(
      path.join(archiveBasePath, "20260902T102030000Z-cccccccccccc"),
      { recursive: true }
    );
    await expect(
      upgradeDrawingProjectStorage({
        prisma,
        databasePath,
        archiveBasePath,
        sourceCommit: "c".repeat(40),
        apply: true,
        now: new Date("2026-09-02T10:20:30.000Z")
      })
    ).rejects.toThrow("Refusing unsafe or existing archive destination");
  });

  it("refuses a locked database before creating an archive", async () => {
    const { root, databasePath, prisma } = await legacyFixture();
    const locker = new PrismaClient({
      datasourceUrl: toPrismaSqliteFileUrl(databasePath)
    });
    clients.push(locker);
    await locker.$executeRawUnsafe("BEGIN EXCLUSIVE");
    try {
      await expect(
        upgradeDrawingProjectStorage({
          prisma,
          databasePath,
          archiveBasePath: path.join(root, "archives"),
          sourceCommit: "d".repeat(40),
          apply: true
        })
      ).rejects.toThrow();
      expect(existsSync(path.join(root, "archives"))).toBe(false);
    } finally {
      await locker.$executeRawUnsafe("ROLLBACK");
    }
  });

  it("rejects an invalid Drawing schema", async () => {
    const { root, databasePath, prisma } = await legacyFixture();
    await prisma.$executeRawUnsafe('ALTER TABLE "Drawing" RENAME TO "OldDrawing"');
    await prisma.$executeRawUnsafe(
      'CREATE TABLE "Drawing" ("id" TEXT NOT NULL PRIMARY KEY)'
    );
    await expect(
      upgradeDrawingProjectStorage({
        prisma,
        databasePath,
        archiveBasePath: path.join(root, "archives"),
        sourceCommit: "e".repeat(40),
        apply: true
      })
    ).rejects.toThrow("Drawing schema is invalid");
  });
});
