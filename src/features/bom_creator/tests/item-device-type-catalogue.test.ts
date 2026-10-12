import { mkdirSync, mkdtempSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createItemEngineeringRevision, ensureItemEngineeringStorage } from "@/features/item_engineering/api/server";
import { listBomItemFilterOptions, listBomItemRows } from "../data/list-queries";
import { bomItemListInputSchema } from "../data/schema";
import { itemDeviceTypeRevisionSelect, projectItemDeviceTypes } from "../data/item-device-types";
import { bomItemImageMetadataSelect, toBomItemImageMetadata } from "../data/queries";

const clients: PrismaClient[] = [];
async function fixture() {
  const root = realpathSync(process.cwd());
  if (JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).name !== "ei-designer") throw new Error("Wrong application");
  const base = path.join(root, "artifacts/drawing-performance/item-engineering/device-type-tests");
  mkdirSync(base, { recursive: true });
  if (realpathSync(base) !== base) throw new Error("Redirected fixture");
  const file = path.join(mkdtempSync(path.join(base, "run-")), "fixture.db");
  const db = new PrismaClient({ datasourceUrl: "file:" + file.replaceAll("\\", "/") });
  clients.push(db);
  const bootstrap = readFileSync(path.join(root, "scripts/bootstrap-sqlite.ts"), "utf8");
  for (const table of ["BomItem", "BomItemImage", "BomItemDocument"]) {
    const start = bootstrap.indexOf('CREATE TABLE IF NOT EXISTS "' + table + '"');
    const end = bootstrap.indexOf(");", start);
    if (start < 0 || end < 0) throw new Error("Bootstrap schema missing");
    await db.$executeRawUnsafe(bootstrap.slice(start, end + 2));
  }
  await db.$executeRawUnsafe("CREATE TABLE SymbolVersion(id TEXT PRIMARY KEY)");
  await db.$executeRawUnsafe("CREATE TABLE SymbolBomTemplateLine(id TEXT PRIMARY KEY, itemId TEXT NOT NULL)");
  await ensureItemEngineeringStorage(db);
  return db;
}
async function item(db: PrismaClient, id: string, category: string) {
  return db.bomItem.create({ data: { id, itemKey: id, displayName: id, category, unit: "each", status: "active", manufacturer: "Example" } });
}
async function classify(db: PrismaClient, itemId: string, deviceType: string, expectedLatestRevisionId: string | null = null) {
  return createItemEngineeringRevision({ itemId, expectedLatestRevisionId,
    profile: { version: 1, deviceType, groups: [], terminalConductorRanges: [] }, noteIds: [], documentIds: [] }, db);
}
afterEach(async () => { vi.restoreAllMocks(); await Promise.all(clients.splice(0).map(db => db.$disconnect())); });

describe("single Device Type catalogue projection", () => {
  it("selects each owner's latest revision across a batched full catalogue", async () => {
    const db = await fixture();
    await db.bomItem.createMany({ data: Array.from({ length: 1100 }, (_, index) => ({
      id: `batch-${index}`, itemKey: `batch-${index}`, displayName: `Batch ${index}`,
      category: "accessory", unit: "each", status: "active"
    })) });
    const first = await classify(db, "batch-0", "breaker");
    const latest = await classify(db, "batch-0", "relay", first.revision.id);
    const other = await classify(db, "batch-1099", "breaker");
    await db.bomItemImage.createMany({ data: [0, 1].map(index => ({
      id: `batch-image-${index}`, itemId: "batch-0", fileName: `image-${index}.png`, mimeType: "image/png",
      sizeBytes: 3, dataUrl: "data:image/png;base64,QUJD", isPrimary: index === 1, sortOrder: index
    })) });
    const rows = await db.bomItem.findMany({ select: { id: true, category: true, engineeringRevisions: itemDeviceTypeRevisionSelect,
      images: { select: bomItemImageMetadataSelect, orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }], take: 1 }
    } });
    expect(rows).toHaveLength(1100);
    expect(rows.find(row => row.id === "batch-0")?.engineeringRevisions.map(row => row.id)).toEqual([latest.revision.id]);
    expect(rows.find(row => row.id === "batch-1099")?.engineeringRevisions.map(row => row.id)).toEqual([other.revision.id]);
    const result = await projectItemDeviceTypes(rows, db);
    expect(result.find(row => row.id === "batch-0")).toMatchObject({ id: "batch-0", category: "relay" });
    expect(result.find(row => row.id === "batch-1099")).toMatchObject({ id: "batch-1099", category: "breaker" });
    const images = rows.find(row => row.id === "batch-0")!.images.map(toBomItemImageMetadata);
    expect(images.map(row => row.id)).toEqual(["batch-image-1"]);
    expect(JSON.stringify(images)).not.toMatch(/data:image|itemId|createdAt/);
    expect(JSON.stringify(result)).not.toContain("engineeringRevisions");
  });
  it("shares one read transaction across typed counts, pages and verified revision projection", async () => {
    const db = await fixture();
    await item(db, "consistent-breaker", "accessory");
    await classify(db, "consistent-breaker", "breaker");
    const transaction = vi.spyOn(db, "$transaction");
    const result = await listBomItemRows(bomItemListInputSchema.parse({ category: "breaker" }), db);
    expect(result.items).toHaveLength(1);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(transaction.mock.calls[0][0]).toEqual(expect.any(Function));
    // Existing transaction callers reuse their snapshot instead of nesting transactions.
    transaction.mockClear();
    await db.$transaction(async tx => {
      const repeated = await listBomItemRows(bomItemListInputSchema.parse({ category: "breaker" }), tx);
      expect(repeated).toEqual(result);
    });
    expect(transaction).toHaveBeenCalledTimes(1);
  });
  it("never guesses engineering meaning from any legacy catalogue label and does not mutate records", async () => {
    const db = await fixture();
    for (const value of ["accessory", "breaker", "panel", "plc"]) await item(db, `legacy-${value}`, value);
    const before = await db.bomItem.findMany({ orderBy: { id: "asc" } });
    const result = await listBomItemRows(bomItemListInputSchema.parse({}), db);
    expect(result.items.map(row => row.category)).toEqual(Array(4).fill("unclassified"));
    expect(await listBomItemFilterOptions(db)).toMatchObject({ categories: [{ value: "unclassified", label: "Needs classification" }] });
    expect(await db.bomItem.findMany({ orderBy: { id: "asc" } })).toEqual(before);
    expect(await db.bomItemEngineeringRevision.count()).toBe(0);
  });

  it("filters the latest saved profile, not a historical revision or a contradictory category", async () => {
    const db = await fixture();
    await item(db, "changed-device", "accessory");
    await item(db, "current-breaker", "panel");
    await item(db, "unselected-relay-label", "relay");
    const first = await classify(db, "changed-device", "breaker");
    await classify(db, "changed-device", "relay", first.revision.id);
    await classify(db, "current-breaker", "breaker");
    await db.bomItem.updateMany({ data: { category: "breaker" } });
    const breaker = await listBomItemRows(bomItemListInputSchema.parse({ category: "breaker" }), db);
    expect(breaker.totalItems).toBe(1);
    expect(breaker.items[0]).toMatchObject({ id: "current-breaker", category: "breaker" });
    const relay = await listBomItemRows(bomItemListInputSchema.parse({ category: "relay", query: "changed", manufacturer: "Example" }), db);
    expect(relay.items.map(row => row.id)).toEqual(["changed-device"]);
    expect(relay.items[0].category).toBe("relay");
    expect((await listBomItemFilterOptions(db)).categories).toEqual([
      { value: "breaker", label: "Circuit Breaker" }, { value: "relay", label: "Relay" }, { value: "unclassified", label: "Needs classification" }
    ]);
    expect((await listBomItemRows(bomItemListInputSchema.parse({ category: "relay", query: "%' OR 1=1 --" }), db)).totalItems).toBe(0);
  });

  it("clamps typed pages and keeps profile content outside the lean catalogue DTO", async () => {
    const db = await fixture();
    for (let index = 0; index < 26; index++) await item(db, `item-${String(index).padStart(2, "0")}`, "breaker");
    const result = await listBomItemRows(bomItemListInputSchema.parse({ category: "unclassified", page: 99, pageSize: 25 }), db);
    expect(result).toMatchObject({ page: 2, totalPages: 2, totalItems: 26 });
    expect(result.items.map(row => row.id)).toEqual(["item-25"]);
    expect(JSON.stringify(result)).not.toContain("profileJson");
    expect(JSON.stringify(result)).not.toContain("engineeringRevisions");
    const unsupported = await listBomItemRows(bomItemListInputSchema.parse({ category: "accessory" }), db);
    expect(unsupported).toMatchObject({ page: 1, totalItems: 0, items: [] });
  });

  it("verifies the exact selected revision before displaying a type", async () => {
    const db = await fixture();
    await item(db, "tampered", "breaker");
    const revision = await classify(db, "tampered", "breaker");
    // Isolated corruption fixture: production storage correctly forbids this update.
    await db.$executeRawUnsafe('DROP TRIGGER "BomItemEngineeringRevision_immutable_update"');
    await db.bomItemEngineeringRevision.update({ where: { id: revision.revision.id }, data: {
      profileJson: JSON.stringify({ version: 1, deviceType: "relay", groups: [], terminalConductorRanges: [] })
    } });
    const rows = await db.bomItem.findMany({ select: { id: true, category: true, engineeringRevisions: itemDeviceTypeRevisionSelect } });
    await expect(projectItemDeviceTypes(rows, db)).rejects.toMatchObject({ code: "INTEGRITY" });
    await expect(listBomItemRows(bomItemListInputSchema.parse({}), db)).rejects.toMatchObject({ code: "INTEGRITY" });
  });
});
