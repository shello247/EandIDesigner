import { describe, expect, it } from "vitest";
import { ensureStandardsStorage } from "../data/storage";
import { testDatabase } from "./test-database";
describe("standards additive storage", () => {
  it("creates thirteen tables and reruns without changing existing data", async () => {
    const db = await testDatabase();
    try {
      await db.$executeRawUnsafe('CREATE TABLE LegacyProbe (id TEXT PRIMARY KEY, value TEXT)');
      await db.$executeRawUnsafe('INSERT INTO LegacyProbe VALUES (?, ?)', "original", "preserved");
      await ensureStandardsStorage(db);
      const tables = await db.$queryRawUnsafe<Array<{ name: string }>>("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'Standard%'");
      expect(tables).toHaveLength(13);
      expect(await db.$queryRawUnsafe("SELECT * FROM LegacyProbe")).toEqual([{ id: "original", value: "preserved" }]);
    } finally { await db.$disconnect(); }
  });
  it("rejects rewriting and deleting historical evidence", async () => {
    const db = await testDatabase();
    try {
      await db.standardAuditEvent.create({ data: { id: "a", operationId: "op", requestHash: "h", kind: "seed", targetId: "x", resultJson: "{}" } });
      await expect(db.standardAuditEvent.update({ where: { id: "a" }, data: { resultJson: "changed" } })).rejects.toThrow();
      await expect(db.standardAuditEvent.delete({ where: { id: "a" } })).rejects.toThrow();
      expect(await db.standardAuditEvent.count()).toBe(1);
    } finally { await db.$disconnect(); }
  });
  it("rejects an incompatible pre-existing standards table", async () => {
    const db = await testDatabase();
    try {
      await db.$executeRawUnsafe('ALTER TABLE StandardReference ADD COLUMN unexpected TEXT');
      await expect(ensureStandardsStorage(db)).rejects.toThrow("Unexpected standards schema");
    } finally { await db.$disconnect(); }
  });
});

