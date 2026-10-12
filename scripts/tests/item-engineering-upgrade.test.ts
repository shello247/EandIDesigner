import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as storageApi from "../../src/features/item_engineering/api/server";
import { itemEngineeringUpgradeDatabaseUrl, parseItemEngineeringUpgradeArguments, upgradeItemEngineeringStorage } from "../upgrade-item-engineering-storage";

const clients: PrismaClient[] = [];
async function fixture() {
  const root = realpathSync(process.cwd());
  const base = path.join(root, "artifacts/drawing-performance/item-engineering/upgrade-tests");
  mkdirSync(base, { recursive: true });
  if (realpathSync(base) !== base) throw new Error("Redirected test directory");
  const run = mkdtempSync(path.join(base, "run-"));
  const databasePath = path.join(run, "fixture.db");
  const prisma = new PrismaClient({ datasourceUrl: itemEngineeringUpgradeDatabaseUrl(databasePath) });
  clients.push(prisma);
  await prisma.$executeRawUnsafe("PRAGMA foreign_keys = ON");
  await prisma.$executeRawUnsafe("CREATE TABLE BomItem(id TEXT PRIMARY KEY)");
  await prisma.$executeRawUnsafe("CREATE TABLE SymbolVersion(id TEXT PRIMARY KEY)");
  await prisma.$executeRawUnsafe("CREATE TABLE Drawing(id TEXT PRIMARY KEY, modelJson TEXT NOT NULL)");
  await prisma.$executeRawUnsafe("CREATE TABLE BomItemDocument(id TEXT PRIMARY KEY, itemId TEXT NOT NULL, title TEXT NOT NULL, fileName TEXT NOT NULL, mimeType TEXT NOT NULL, sizeBytes INTEGER NOT NULL, dataUrl TEXT NOT NULL, createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL)");
  await prisma.$executeRawUnsafe("INSERT INTO Drawing VALUES(?,?)", "d1", '{"version":2,"wire":"unchanged"}');
  await prisma.$executeRawUnsafe("INSERT INTO BomItem VALUES(?)", "item-a");
  await prisma.$executeRawUnsafe("INSERT INTO BomItemDocument VALUES(?,?,?,?,?,?,?,?,?)",
    "doc-a", "item-a", "Existing manual", "manual.pdf", "application/pdf", 3,
    "data:application/pdf;base64,QUJD", new Date("2026-09-05T00:00:00Z"), new Date("2026-09-05T00:00:00Z"));
  return { prisma, databasePath, archiveBasePath: path.join(run, "archives"), sourceCommit: "a".repeat(40) };
}
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(clients.splice(0).map(db => db.$disconnect()));
});

describe("guarded Item engineering upgrade", () => {
  it("keeps maintenance statements on one SQLite connection after concurrent reads", async () => {
    const input = await fixture();
    expect(itemEngineeringUpgradeDatabaseUrl(input.databasePath)).toMatch(/\?connection_limit=1$/);
    await input.prisma.$executeRawUnsafe("CREATE TEMP TABLE upgrade_connection_probe(value INTEGER)");
    await input.prisma.$executeRawUnsafe("INSERT INTO upgrade_connection_probe VALUES(42)");
    const reads = await Promise.all(Array.from({ length: 16 }, () =>
      input.prisma.$queryRawUnsafe<Array<{ value: bigint }>>("SELECT value FROM upgrade_connection_probe")));
    expect(reads.every(rows => Number(rows[0].value) === 42)).toBe(true);
    expect((await upgradeItemEngineeringStorage({ ...input, apply: false })).status).toBe("dry-run");
  });
  it("accepts only one optional apply flag", () => {
    expect(parseItemEngineeringUpgradeArguments([])).toEqual({ apply: false });
    expect(parseItemEngineeringUpgradeArguments(["--apply"])).toEqual({ apply: true });
    expect(() => parseItemEngineeringUpgradeArguments(["--database=dev.db"])).toThrow();
    expect(() => parseItemEngineeringUpgradeArguments(["--apply", "--apply"])).toThrow();
  });
  it("dry-runs without changing schema or producing an archive", async () => {
    const input = await fixture();
    const before = await input.prisma.$queryRawUnsafe("SELECT name, sql FROM sqlite_master ORDER BY name");
    expect((await upgradeItemEngineeringStorage({ ...input, apply: false })).status).toBe("dry-run");
    expect(await input.prisma.$queryRawUnsafe("SELECT name, sql FROM sqlite_master ORDER BY name")).toEqual(before);
    expect(existsSync(input.archiveBasePath)).toBe(false);
  });
  it("backs up, applies, preserves drawing bytes and reruns idempotently", async () => {
    const input = await fixture();
    const drawing = await input.prisma.$queryRawUnsafe("SELECT * FROM Drawing");
    const result = await upgradeItemEngineeringStorage({ ...input, apply: true });
    expect(result.status).toBe("upgraded");
    if (result.status !== "upgraded") throw new Error("Upgrade not applied");
    expect(existsSync(path.join(result.archivePath, "pre-upgrade.db"))).toBe(true);
    expect(createHash("sha256").update(readFileSync(path.join(result.archivePath, "pre-upgrade.db"))).digest("hex")).toBe(result.backupHash);
    const manifest = JSON.parse(readFileSync(path.join(result.archivePath, "manifest.json"), "utf8"));
    expect(manifest.state).toBe("upgraded-and-verified");
    expect(manifest.before).toEqual(manifest.after);
    expect(await input.prisma.$queryRawUnsafe("SELECT * FROM Drawing")).toEqual(drawing);
    expect((await upgradeItemEngineeringStorage({ ...input, apply: true })).status).toBe("current");
  }, 30_000);
  it("rolls back schema and data when an unrelated record changes during apply", async () => {
    const input = await fixture();
    const before = await input.prisma.$queryRawUnsafe("SELECT * FROM Drawing");
    const original = storageApi.ensureItemEngineeringStorage;
    vi.spyOn(storageApi, "ensureItemEngineeringStorage").mockImplementationOnce(async db => {
      await original(db);
      await db.$executeRawUnsafe("UPDATE Drawing SET modelJson = '{}'");
    });
    await expect(upgradeItemEngineeringStorage({ ...input, apply: true })).rejects.toThrow("Unrelated database content changed");
    expect(await input.prisma.$queryRawUnsafe("SELECT * FROM Drawing")).toEqual(before);
    expect(await input.prisma.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE name='BomItemEngineeringRevision'")).toEqual([]);
  }, 30_000);
  it("refuses unexpected partial schema definitions", async () => {
    const input = await fixture();
    await input.prisma.$executeRawUnsafe("CREATE TABLE BomItemEngineeringRevision(id TEXT)");
    await expect(upgradeItemEngineeringStorage({ ...input, apply: true })).rejects.toThrow("Unexpected schema");
    expect(existsSync(input.archiveBasePath)).toBe(false);
  });
  it("does not apply schema changes if the backup cannot be created", async () => {
    const input = await fixture();
    const before = await input.prisma.$queryRawUnsafe("SELECT name, sql FROM sqlite_master ORDER BY name");
    const execute = input.prisma.$executeRawUnsafe.bind(input.prisma);
    vi.spyOn(input.prisma, "$executeRawUnsafe").mockImplementation((query, ...values) => {
      if (query.startsWith("VACUUM INTO")) throw new Error("Synthetic backup failure");
      return execute(query, ...values);
    });
    await expect(upgradeItemEngineeringStorage({ ...input, apply: true })).rejects.toThrow("Synthetic backup failure");
    expect(await input.prisma.$queryRawUnsafe("SELECT name, sql FROM sqlite_master ORDER BY name")).toEqual(before);
  });
  it("refuses an existing destination", async () => {
    const input = await fixture();
    const now = new Date("2026-09-05T14:00:00Z");
    const destination = path.join(input.archiveBasePath, "20260905T140000000Z-aaaaaaaaaaaa");
    mkdirSync(destination, { recursive: true });
    await expect(upgradeItemEngineeringStorage({ ...input, apply: true, now })).rejects.toThrow("already exists");
  });
  it("refuses a substitute connected database", async () => {
    const first = await fixture();
    const second = await fixture();
    await expect(upgradeItemEngineeringStorage({ ...first, databasePath: second.databasePath, apply: false })).rejects.toThrow("Substitute");
  });
  it("fails closed when another SQLite connection owns a write lock", async () => {
    const input = await fixture();
    await input.prisma.$executeRawUnsafe("BEGIN EXCLUSIVE");
    const other = new PrismaClient({ datasourceUrl: itemEngineeringUpgradeDatabaseUrl(input.databasePath) });
    clients.push(other);
    try {
      await expect(upgradeItemEngineeringStorage({ ...input, prisma: other, apply: true })).rejects.toThrow();
      expect(existsSync(input.archiveBasePath)).toBe(false);
    } finally { await input.prisma.$executeRawUnsafe("ROLLBACK"); }
  });
});
