import { afterEach, describe, expect, it } from "vitest";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { classificationUpgradeUrl, upgradeDeviceClassificationStorage } from "../upgrade-device-classification-storage";

const connections: PrismaClient[] = [];
afterEach(async () => { await Promise.all(connections.splice(0).map(db => db.$disconnect())); });
async function fixture() {
  const base = path.resolve("artifacts/device-classification-tests");
  mkdirSync(base, { recursive: true });
  const dir = mkdtempSync(path.join(base, "upgrade-"));
  const databasePath = path.join(dir, "synthetic.db");
  const db = new PrismaClient({ datasourceUrl: classificationUpgradeUrl(databasePath) }); connections.push(db);
  await db.$executeRawUnsafe('CREATE TABLE "SymbolVersion" (id TEXT PRIMARY KEY, symbolId TEXT, versionNumber INTEGER, svg TEXT, metadataJson TEXT)');
  await db.$executeRawUnsafe('CREATE TABLE "ImmutableRevision" (id TEXT PRIMARY KEY, contentHash TEXT, profileJson TEXT)');
  await db.$executeRawUnsafe(`INSERT INTO "SymbolVersion" VALUES ('v1','s1',1,'<svg/>','{"category":"power"}')`);
  await db.$executeRawUnsafe(`INSERT INTO "ImmutableRevision" VALUES ('r1','preserve-hash','{"deviceType":"power_supply"}')`);
  return { db, databasePath, archiveBasePath: path.join(dir, "backups"), sourceCommit: "a".repeat(40) };
}
describe("additive classification storage", () => {
  it("dry-runs, backs up, preserves historic bytes, restores and is idempotent", async () => {
    const input = await fixture();
    expect((await upgradeDeviceClassificationStorage({ ...input, apply: false })).status).toBe("dry-run");
    expect(await input.db.$queryRawUnsafe<Array<{ name: string }>>('PRAGMA table_info("SymbolVersion")')).not.toEqual(expect.arrayContaining([expect.objectContaining({ name: "deviceType" })]));
    const result = await upgradeDeviceClassificationStorage({ ...input, apply: true });
    expect(result.status).toBe("upgraded");
    if (result.status !== "upgraded") throw new Error("Expected backup receipt.");
    const receipt = JSON.parse(readFileSync(path.join(result.archivePath, "verified.json"), "utf8"));
    expect(receipt.before).toEqual(receipt.after);
    expect(await input.db.$queryRawUnsafe('SELECT deviceType FROM "SymbolVersion"')).toEqual([{ deviceType: null }]);
    expect((await upgradeDeviceClassificationStorage({ ...input, apply: true })).status).toBe("current");
    const restorePath = path.join(path.dirname(input.databasePath), "restore-rehearsal.db");
    copyFileSync(result.backupPath, restorePath);
    const restored = new PrismaClient({ datasourceUrl: classificationUpgradeUrl(restorePath) }); connections.push(restored);
    expect(await restored.$queryRawUnsafe('SELECT * FROM "ImmutableRevision"')).toEqual([{ id: "r1", contentHash: "preserve-hash", profileJson: '{"deviceType":"power_supply"}' }]);
    expect(await restored.$queryRawUnsafe('SELECT svg, metadataJson FROM "SymbolVersion"')).toEqual([{ svg: "<svg/>", metadataJson: '{"category":"power"}' }]);
  });
  it("refuses substitute connections and incompatible columns", async () => {
    const a = await fixture(); const b = await fixture();
    await expect(upgradeDeviceClassificationStorage({ ...a, databasePath: b.databasePath, apply: true })).rejects.toThrow("Substitute");
    await a.db.$executeRawUnsafe('ALTER TABLE "SymbolVersion" ADD COLUMN deviceType INTEGER');
    await expect(upgradeDeviceClassificationStorage({ ...a, apply: true })).rejects.toThrow("Unexpected Device Type");
  });
});
