import { describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { mkdirSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { upgradeStandardsStorage, standardsUpgradeDatabaseUrl, parseStandardsUpgradeArguments } from "../data/storage-upgrade";
import { seedStandards } from "../data/seeds";

describe("guarded additive storage upgrade", () => {
  it("backs up and preserves legacy records, rehearses recovery and repeats safely", async () => {
    const directory = path.resolve("artifacts/standards-assurance/tests", randomUUID());
    mkdirSync(directory, { recursive: true });
    const databasePath = path.join(directory, "synthetic.db");
    const db = new PrismaClient({ datasourceUrl: standardsUpgradeDatabaseUrl(databasePath) });
    try {
      for (const table of ["Drawing", "BomItem", "SymbolVersion"]) {
        await db.$executeRawUnsafe('CREATE TABLE "' + table + '" (id TEXT PRIMARY KEY, payload TEXT)');
        await db.$executeRawUnsafe('INSERT INTO "' + table + '" VALUES (?,?)', "fixture", "original data");
      }
      const input = { prisma: db, databasePath, archiveBasePath: path.join(directory, "backups"), sourceCommit: "a".repeat(40), apply: false };
      expect((await upgradeStandardsStorage(input)).status).toBe("dry-run");
      const result = await upgradeStandardsStorage({ ...input, apply: true });
      expect(result.status).toBe("upgraded");
      if (result.status !== "upgraded") throw new Error("Upgrade failed");
      const manifest = JSON.parse(readFileSync(path.join(result.archivePath, "manifest.json"), "utf8"));
      expect(manifest.before).toEqual(manifest.after);
      const restored = new PrismaClient({ datasourceUrl: standardsUpgradeDatabaseUrl(path.join(result.archivePath, "pre-upgrade.db")) });
      try {
        expect(await restored.$queryRawUnsafe('SELECT * FROM "Drawing"')).toEqual([{ id: "fixture", payload: "original data" }]);
        expect(await restored.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE name='StandardSnapshot'")).toEqual([]);
      } finally { await restored.$disconnect(); }
      await seedStandards(db);
      const again = await upgradeStandardsStorage({ ...input, apply: true, now: new Date(Date.now() + 1000) });
      expect(again.status).toBe("upgraded");
      expect(await db.standardRequirement.count()).toBe(6);
      expect(await db.$queryRawUnsafe('SELECT * FROM "Drawing"')).toEqual([{ id: "fixture", payload: "original data" }]);
      expect(() => parseStandardsUpgradeArguments(["--database", "other.db"])).toThrow();
    } finally { await db.$disconnect(); }
  });
});
