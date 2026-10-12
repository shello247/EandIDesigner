import { mkdirSync, mkdtempSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({ client: null as PrismaClient | null }));
vi.mock("@/lib/prisma", () => ({ prisma: new Proxy({}, {
  get(_target, key) {
    if (!database.client) throw new Error("Synthetic Item fixture is not initialized.");
    const value = Reflect.get(database.client, key);
    return typeof value === "function" ? value.bind(database.client) : value;
  }
}) }));

import { createBomItem, updateBomItem } from "../data/mutations";
import { bomItemInputSchema, bomItemUpdateInputSchema } from "../data/schema";
import { ensureItemEngineeringStorage, getLatestItemEngineeringRevision } from "@/features/item_engineering/api/server";

async function fixture() {
  const root = realpathSync(process.cwd());
  if (JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).name !== "ei-designer") throw new Error("Wrong application");
  const base = path.join(root, "artifacts/drawing-performance/item-engineering/device-type-mutation-tests");
  mkdirSync(base, { recursive: true });
  if (realpathSync(base) !== base) throw new Error("Redirected fixture");
  const file = path.join(mkdtempSync(path.join(base, "run-")), "fixture.db");
  const db = new PrismaClient({ datasourceUrl: "file:" + file.replaceAll("\\", "/") });
  database.client = db;
  await db.$executeRawUnsafe("PRAGMA foreign_keys=ON");
  const bootstrap = readFileSync(path.join(root, "scripts/bootstrap-sqlite.ts"), "utf8");
  for (const table of ["SymbolCategory", "Symbol", "SymbolVersion", "BomItem", "BomItemKeySequence", "BomItemImage", "BomItemDocument", "SymbolBomTemplate", "SymbolBomTemplateLine"]) {
    const start = bootstrap.indexOf('CREATE TABLE IF NOT EXISTS "' + table + '"');
    const end = bootstrap.indexOf(");", start);
    if (start < 0 || end < 0) throw new Error("Bootstrap schema missing");
    await db.$executeRawUnsafe(bootstrap.slice(start, end + 2));
  }
  await ensureItemEngineeringStorage(db);
  await db.bomItemKeySequence.create({ data: { scope: "bom_item", lastValue: 0 } });
  return db;
}

const newItem = (patch: Record<string, unknown> = {}) => bomItemInputSchema.parse({
  displayName: "Synthetic three-pole breaker", category: "legacy-accessory", unit: "each", images: [], ...patch
});

afterEach(async () => { await database.client?.$disconnect(); database.client = null; });

describe("single Device Type through legacy Item mutation boundaries", () => {
  it("creates a selected Device Type and catalogue grouping atomically without importing an independent category", async () => {
    const db = await fixture();
    const result = (await createBomItem(newItem({ deviceType: "breaker", manufacturer: "Synthetic manufacturer" })))!;
    const row = await db.bomItem.findUniqueOrThrow({ where: { id: result.id } });
    const revision = (await getLatestItemEngineeringRevision(result.id, db))!;
    expect(row.category).toBe("breaker"); expect(result.category).toBe("breaker");
    expect(row.itemKey).toBe("BOM-000001");
    expect(revision.profile.deviceType).toBe("breaker"); expect(revision.revisionNumber).toBe(1);
    expect(revision.identity.manufacturer).toBe("Synthetic manufacturer");
    expect(revision.noteIds).toEqual([]); expect(revision.documentIds).toEqual([]);
    expect(await db.bomItemEngineeringRevision.count()).toBe(1);
  });

  it("keeps old creation consumers readable without guessing a classification", async () => {
    const db = await fixture();
    const result = (await createBomItem(newItem({ category: "breaker" })))!;
    expect(result.category).toBe("unclassified");
    expect((await db.bomItem.findUniqueOrThrow({ where: { id: result.id } })).category).toBe("breaker");
    expect(await getLatestItemEngineeringRevision(result.id, db)).toBeNull();
  });

  it("rejects unknown Device Types before allocating an Item number", async () => {
    const db = await fixture();
    expect(() => newItem({ deviceType: "protection" })).toThrow();
    expect(await db.bomItem.count()).toBe(0);
    expect((await db.bomItemKeySequence.findUniqueOrThrow({ where: { scope: "bom_item" } })).lastValue).toBe(0);
  });

  it("rolls back Item creation, photographs and number allocation if classification persistence fails", async () => {
    const db = await fixture();
    await db.$executeRawUnsafe("CREATE TRIGGER synthetic_revision_failure BEFORE INSERT ON BomItemEngineeringRevision BEGIN SELECT RAISE(ABORT, 'Synthetic classification failure'); END");
    // Prisma maps SQLite RAISE(ABORT) to P2003; assert the failing write stage
    // rather than relying on SQLite's original trigger message being retained.
    await expect(createBomItem(newItem({ deviceType: "breaker", images: [{ kind: "new", fileName: "fixture.png", mimeType: "image/png", sizeBytes: 3, dataUrl: "data:image/png;base64,QUJD", isPrimary: true, sortOrder: 0 }] }))).rejects.toMatchObject({ code: "P2003", message: expect.stringContaining("bomItemEngineeringRevision.create()") });
    expect(await db.bomItem.count()).toBe(0);
    expect(await db.bomItemImage.count()).toBe(0);
    expect(await db.bomItemEngineeringRevision.count()).toBe(0);
    expect((await db.bomItemKeySequence.findUniqueOrThrow({ where: { scope: "bom_item" } })).lastValue).toBe(0);
  });

  it("blocks independent category or type changes through the old full-Item update route", async () => {
    const db = await fixture();
    const item = (await createBomItem(newItem({ deviceType: "breaker" })))!;
    const original = await db.bomItem.findUniqueOrThrow({ where: { id: item.id } });
    const revision = await getLatestItemEngineeringRevision(item.id, db);
    await expect(updateBomItem({ id: item.id, category: "relay", supplierName: "Must not commit" })).rejects.toMatchObject({ code: "VALIDATION" });
    expect(bomItemUpdateInputSchema.safeParse({ id: item.id, deviceType: "relay" }).success).toBe(false);
    expect(await db.bomItem.findUniqueOrThrow({ where: { id: item.id } })).toEqual(original);
    expect(await getLatestItemEngineeringRevision(item.id, db)).toEqual(revision);
  });

  it("retains unclassified legacy data when older forms echo the visible unclassified value", async () => {
    const db = await fixture();
    const item = (await createBomItem(newItem()))!;
    await updateBomItem({ id: item.id, category: "unclassified", supplierName: "New supplier" });
    const row = await db.bomItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(row.category).toBe("legacy-accessory"); expect(row.supplierName).toBe("New supplier");
    await expect(updateBomItem({ id: item.id, category: "breaker", supplierName: "Must not commit" })).rejects.toMatchObject({ code: "VALIDATION" });
    expect(await db.bomItem.findUniqueOrThrow({ where: { id: item.id } })).toEqual(row);
    expect(await getLatestItemEngineeringRevision(item.id, db)).toBeNull();
  });

  it("preserves classified identity revisions and rejects stale identity edits", async () => {
    const db = await fixture();
    const item = (await createBomItem(newItem({ deviceType: "breaker" })))!;
    const first = (await getLatestItemEngineeringRevision(item.id, db))!;
    await updateBomItem({ id: item.id, category: "breaker", displayName: "Renamed breaker", expectedEngineeringRevisionId: first.id });
    const original = await db.bomItem.findUniqueOrThrow({ where: { id: item.id } });
    const latest = (await getLatestItemEngineeringRevision(item.id, db))!;
    expect(latest.profile.deviceType).toBe("breaker"); expect(latest.identity.displayName).toBe("Renamed breaker");
    await expect(updateBomItem({ id: item.id, displayName: "Stale rename", expectedEngineeringRevisionId: first.id })).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
    expect(await db.bomItem.findUniqueOrThrow({ where: { id: item.id } })).toEqual(original);
    expect(await getLatestItemEngineeringRevision(item.id, db)).toEqual(latest);
    expect((await db.bomItemEngineeringRevision.findUniqueOrThrow({ where: { id: first.id } })).contentHash).toBe(first.contentHash);
  });

  it("rejects edits and implicit restoration of archived Items through the legacy route", async () => {
    const db = await fixture();
    const item = (await createBomItem(newItem({ deviceType: "breaker" })))!;
    const original = await db.bomItem.update({ where: { id: item.id }, data: { status: "archived" } });
    for (const patch of [{ supplierName: "Changed" }, { category: "breaker" }, { status: "active" as const }]) {
      await expect(updateBomItem({ id: item.id, ...patch })).rejects.toMatchObject({ code: "ARCHIVED" });
      expect(await db.bomItem.findUniqueOrThrow({ where: { id: item.id } })).toEqual(original);
    }
  });

  it("preserves the existing explicit active-to-archived transition and keeps its revision readable", async () => {
    const db = await fixture();
    const item = (await createBomItem(newItem({ deviceType: "breaker" })))!;
    const revision = await getLatestItemEngineeringRevision(item.id, db);
    const archived = (await updateBomItem({ id: item.id, status: "archived" }))!;
    expect(archived.status).toBe("archived"); expect(archived.category).toBe("breaker");
    expect(await getLatestItemEngineeringRevision(item.id, db)).toEqual(revision);
  });
});
