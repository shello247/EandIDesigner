import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterEach, describe, expect, it } from "vitest";
import { toPrismaSqliteFileUrl } from "../development-runtime";
import {
  parseRetirementArguments,
  retirementDatabaseUrl,
  retireRequiredForWiringStorage
} from "../retire-required-for-wiring-storage";

const clients: PrismaClient[] = [];
const validSvg =
  '<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="10"/></svg>';

function metadata(requiredValues: boolean[] = [true]) {
  return {
    symbolKey: "test_symbol",
    displayName: "Test Symbol",
    category: "instrument",
    viewBox: { x: 0, y: 0, width: 100, height: 100 },
    anchors: requiredValues.map((_, index) => ({
      key: `T${index + 1}`,
      x: 20 + index * 20,
      y: 50,
      kind: "terminal"
    })),
    terminals: requiredValues.map((requiredForWiring, index) => ({
      key: String(index + 1),
      label: `Terminal ${index + 1}`,
      function: "Signal",
      anchorKey: `T${index + 1}`,
      requiredForWiring
    }))
  };
}

async function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "ei-required-wiring-retirement-"));
  const databasePath = path.join(root, "fixture.db");
  const prisma = new PrismaClient({
    datasourceUrl: retirementDatabaseUrl(databasePath)
  });
  clients.push(prisma);
  await prisma.$executeRawUnsafe(
    'CREATE TABLE "Drawing" ("id" TEXT NOT NULL PRIMARY KEY, "modelJson" TEXT NOT NULL)'
  );
  await prisma.$executeRawUnsafe(
    'INSERT INTO "Drawing" ("id", "modelJson") VALUES (?, ?)',
    "drawing_1",
    '{"version":8,"sheets":[]}'
  );
  await prisma.$executeRawUnsafe(`
    CREATE TABLE "Symbol" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "symbolKey" TEXT NOT NULL,
      "displayName" TEXT NOT NULL
    )
  `);
  await prisma.$executeRawUnsafe(
    'INSERT INTO "Symbol" ("id", "symbolKey", "displayName") VALUES (?, ?, ?)',
    "symbol_1",
    "test_symbol",
    "Test Symbol"
  );
  await prisma.$executeRawUnsafe(`
    CREATE TABLE "SymbolVersion" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "symbolId" TEXT NOT NULL,
      "versionNumber" INTEGER NOT NULL,
      "status" TEXT NOT NULL,
      "svg" TEXT NOT NULL,
      "metadataJson" TEXT NOT NULL,
      "sourceInputSummary" TEXT,
      "aiResponseId" TEXT,
      "createdAt" DATETIME NOT NULL
    )
  `);
  const metadataJson = JSON.stringify(metadata([true, false]));
  await prisma.$executeRawUnsafe(
    'INSERT INTO "SymbolVersion" ("id", "symbolId", "versionNumber", "status", "svg", "metadataJson", "sourceInputSummary", "aiResponseId", "createdAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    "version_1",
    "symbol_1",
    1,
    "approved",
    validSvg,
    metadataJson,
    "Preserve this",
    null,
    new Date("2026-09-02T12:00:00.000Z")
  );
  return { root, databasePath, metadataJson, prisma };
}

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.$disconnect()));
});

describe("requiredForWiring metadata retirement", () => {
  it("pins the offline exclusive-lock command to one SQLite connection", () => {
    expect(retirementDatabaseUrl(path.resolve("synthetic.db"))).toBe(
      toPrismaSqliteFileUrl(path.resolve("synthetic.db")) + "?connection_limit=1"
    );
  });
  it("accepts only the explicit apply flag", () => {
    expect(parseRetirementArguments([])).toEqual({ apply: false });
    expect(parseRetirementArguments(["--apply"])).toEqual({ apply: true });
    expect(() => parseRetirementArguments(["--database=other.db"])).toThrow(
      "Unsupported argument"
    );
  });

  it("performs a validated, non-mutating dry run", async () => {
    const { root, databasePath, metadataJson, prisma } = await fixture();
    const result = await retireRequiredForWiringStorage({
      prisma,
      databasePath,
      archiveBasePath: path.join(root, "archives"),
      sourceCommit: "a".repeat(40),
      apply: false
    });
    expect(result).toEqual({
      status: "dry-run",
      versionCount: 1,
      terminalCount: 2
    });
    const rows = await prisma.$queryRawUnsafe<Array<{ metadataJson: string }>>(
      'SELECT "metadataJson" FROM "SymbolVersion" WHERE "id" = ?',
      "version_1"
    );
    expect(rows[0]?.metadataJson).toBe(metadataJson);
    expect(existsSync(path.join(root, "archives"))).toBe(false);
  });

  it("archives, transforms only metadata, verifies, and remains idempotent", async () => {
    const { root, databasePath, metadataJson, prisma } = await fixture();
    const result = await retireRequiredForWiringStorage({
      prisma,
      databasePath,
      archiveBasePath: path.join(root, "archives"),
      sourceCommit: "b".repeat(40),
      apply: true,
      now: new Date("2026-09-02T12:34:56.000Z")
    });
    expect(result).toMatchObject({
      status: "retired",
      versionCount: 1,
      terminalCount: 2
    });
    const archivePath = result.archivePath!;
    const exported = JSON.parse(
      readFileSync(path.join(archivePath, "affected-symbol-versions.json"), "utf8")
    );
    const manifest = JSON.parse(
      readFileSync(path.join(archivePath, "manifest.json"), "utf8")
    );
    expect(exported.records[0]).toMatchObject({
      versionId: "version_1",
      status: "approved",
      changedTerminalCount: 2,
      metadataJson
    });
    expect(manifest).toMatchObject({
      state: "retired-and-verified",
      affectedVersionCount: 1,
      changedTerminalCount: 2
    });
    expect(manifest.beforeTables.Drawing).toEqual(manifest.afterTables.Drawing);
    expect(manifest.symbolVersionInvariantBefore).toEqual(
      manifest.symbolVersionInvariantAfter
    );
    expect(existsSync(path.join(archivePath, "pre-retirement-dev.db"))).toBe(true);

    const rows = await prisma.$queryRawUnsafe<
      Array<{ metadataJson: string; status: string; sourceInputSummary: string }>
    >('SELECT "metadataJson", "status", "sourceInputSummary" FROM "SymbolVersion"');
    const transformed = JSON.parse(rows[0]!.metadataJson);
    expect(transformed.terminals).toHaveLength(2);
    transformed.terminals.forEach((terminal: Record<string, unknown>) =>
      expect(terminal).not.toHaveProperty("requiredForWiring")
    );
    expect(rows[0]).toMatchObject({
      status: "approved",
      sourceInputSummary: "Preserve this"
    });
    expect(
      await retireRequiredForWiringStorage({
        prisma,
        databasePath,
        archiveBasePath: path.join(root, "archives"),
        sourceCommit: "b".repeat(40),
        apply: true
      })
    ).toEqual({ status: "current", versionCount: 0, terminalCount: 0 });
  });

  it("handles approved and draft versions together", async () => {
    const { root, databasePath, prisma } = await fixture();
    await prisma.$executeRawUnsafe(
      'INSERT INTO "SymbolVersion" ("id", "symbolId", "versionNumber", "status", "svg", "metadataJson", "createdAt") VALUES (?, ?, ?, ?, ?, ?, ?)',
      "version_2",
      "symbol_1",
      2,
      "needs_review",
      validSvg,
      JSON.stringify(metadata([false])),
      new Date("2026-09-02T13:00:00.000Z")
    );
    await expect(
      retireRequiredForWiringStorage({
        prisma,
        databasePath,
        archiveBasePath: path.join(root, "archives"),
        sourceCommit: "c".repeat(40),
        apply: false
      })
    ).resolves.toMatchObject({ versionCount: 2, terminalCount: 3 });
  });

  it("fails closed for invalid JSON, invalid anchors, and misplaced properties", async () => {
    const cases: Array<{ value: string; message: string }> = [
      { value: "{not-json", message: "invalid metadata JSON" },
      {
        value: JSON.stringify({
          ...metadata(),
          terminals: [{ ...metadata().terminals[0], anchorKey: "missing" }]
        }),
        message: "invalid original metadata or SVG"
      },
      {
        value: JSON.stringify({ ...metadata(), requiredForWiring: true }),
        message: "invalid requiredForWiring property"
      }
    ];

    for (const [index, testCase] of cases.entries()) {
      const { root, databasePath, prisma } = await fixture();
      await prisma.$executeRawUnsafe(
        'UPDATE "SymbolVersion" SET "metadataJson" = ? WHERE "id" = ?',
        testCase.value,
        "version_1"
      );
      await expect(
        retireRequiredForWiringStorage({
          prisma,
          databasePath,
          archiveBasePath: path.join(root, `archives-${index}`),
          sourceCommit: "d".repeat(40),
          apply: true
        })
      ).rejects.toThrow(testCase.message);
      expect(existsSync(path.join(root, `archives-${index}`))).toBe(false);
    }
  });

  it("refuses an existing archive destination", async () => {
    const { root, databasePath, prisma } = await fixture();
    const archiveBasePath = path.join(root, "archives");
    mkdirSync(
      path.join(archiveBasePath, "20260902T123456000Z-eeeeeeeeeeee"),
      { recursive: true }
    );
    await expect(
      retireRequiredForWiringStorage({
        prisma,
        databasePath,
        archiveBasePath,
        sourceCommit: "e".repeat(40),
        apply: true,
        now: new Date("2026-09-02T12:34:56.000Z")
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
        retireRequiredForWiringStorage({
          prisma,
          databasePath,
          archiveBasePath: path.join(root, "archives"),
          sourceCommit: "f".repeat(40),
          apply: true
        })
      ).rejects.toThrow();
      expect(existsSync(path.join(root, "archives"))).toBe(false);
    } finally {
      await locker.$executeRawUnsafe("ROLLBACK");
    }
  });
});
