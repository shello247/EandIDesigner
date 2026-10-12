import { mkdirSync, mkdtempSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ensureItemEngineeringStorage } from "../data/storage";
import { createItemEngineeringRevision, synchronizeItemEngineeringIdentity } from "../data/mutations";
import { getItemEngineeringRevision, getItemEngineeringRevisions, getLatestItemEngineeringRevision } from "../data/queries";
import { hashItemEngineeringContent } from "../logic/services/item-engineering-revision";
import { deleteBomItem } from "@/features/bom_creator/data/mutations";

const clients: PrismaClient[] = [];
const profile = { version: 1, deviceType: "breaker", groups: [], terminalConductorRanges: [] };
const input = (changes: Record<string, unknown> = {}) => ({ itemId: "item-a", expectedLatestRevisionId: null,
  profile, noteIds: [], documentIds: [], ...changes });

async function fixture() {
  const root = realpathSync(process.cwd());
  if (JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).name !== "ei-designer") throw new Error("Wrong application");
  const base = path.join(root, "artifacts/drawing-performance/item-engineering/revision-tests");
  mkdirSync(base, { recursive: true });
  if (realpathSync(base) !== base) throw new Error("Redirected fixture path");
  const database = path.join(mkdtempSync(path.join(base, "run-")), "fixture.db");
  const db = new PrismaClient({ datasourceUrl: "file:" + database.replaceAll("\\", "/") });
  clients.push(db);
  await db.$executeRawUnsafe("PRAGMA foreign_keys = ON");
  await db.$executeRawUnsafe(`CREATE TABLE BomItem(id TEXT PRIMARY KEY, itemKey TEXT NOT NULL,
    displayName TEXT NOT NULL, manufacturer TEXT, model TEXT, partNumber TEXT, status TEXT NOT NULL,
    unitCost REAL, category TEXT NOT NULL DEFAULT 'accessory', updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  await db.$executeRawUnsafe("CREATE TABLE SymbolVersion(id TEXT PRIMARY KEY)");
  await db.$executeRawUnsafe("CREATE TABLE SymbolBomTemplateLine(id TEXT PRIMARY KEY, itemId TEXT NOT NULL)");
  await db.$executeRawUnsafe(`CREATE TABLE BomItemDocument(id TEXT PRIMARY KEY,
    itemId TEXT NOT NULL REFERENCES BomItem(id) ON DELETE CASCADE, title TEXT NOT NULL,
    fileName TEXT NOT NULL, mimeType TEXT NOT NULL, sizeBytes INTEGER NOT NULL,
    dataUrl TEXT NOT NULL, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  await db.$executeRawUnsafe(`INSERT INTO BomItem(id,itemKey,displayName,status) VALUES
    ('item-a','ITEM-001','Breaker A','active'),('item-b','ITEM-002','Breaker B','active')`);
  await ensureItemEngineeringStorage(db);
  const notes = { notes: "Synthetic manufacturer guidance", imageFileName: null,
    imageMimeType: null, imageSizeBytes: null, imageDataUrl: null };
  await db.bomItemEngineerNote.create({ data: { id: "note-a", itemId: "item-a", ...notes,
    contentHash: hashItemEngineeringContent(notes) } });
  await db.bomItemDocument.create({ data: { id: "doc-a", itemId: "item-a", title: "Manual",
    fileName: "manual.pdf", mimeType: "application/pdf", sizeBytes: 3, dataUrl: "data:application/pdf;base64,QUJD" } });
  return db;
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(clients.splice(0).map(client => client.$disconnect()));
});

describe("immutable Item engineering data", () => {
  it("mirrors the selected type on successful saves, including unchanged revisions, without rewriting history", async () => {
    const db = await fixture();
    const before = await db.bomItem.findUniqueOrThrow({ where: { id: "item-a" }, select: { category: true, updatedAt: true } });
    const first = await createItemEngineeringRevision(input(), db);
    const classified = await db.bomItem.findUniqueOrThrow({ where: { id: "item-a" }, select: { category: true, updatedAt: true } });
    expect(classified.category).toBe("breaker");
    expect(classified.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());
    const historical = await db.bomItemEngineeringRevision.findUniqueOrThrow({ where: { id: first.revision.id } });
    await db.bomItem.update({ where: { id: "item-a" }, data: { category: "legacy-protection" }, select: { id: true } });
    const legacy = await db.bomItem.findUniqueOrThrow({ where: { id: "item-a" }, select: { category: true, updatedAt: true } });
    expect((await createItemEngineeringRevision(input({ expectedLatestRevisionId: first.revision.id }), db)).created).toBe(false);
    const reconciled = await db.bomItem.findUniqueOrThrow({ where: { id: "item-a" }, select: { category: true, updatedAt: true } });
    expect(reconciled.category).toBe("breaker");
    expect(reconciled.updatedAt.getTime()).toBeGreaterThan(legacy.updatedAt.getTime());
    await createItemEngineeringRevision(input({ expectedLatestRevisionId: first.revision.id }), db);
    expect(await db.bomItem.findUniqueOrThrow({ where: { id: "item-a" }, select: { category: true, updatedAt: true } })).toEqual(reconciled);
    expect(await db.bomItemEngineeringRevision.findUniqueOrThrow({ where: { id: first.revision.id } })).toEqual(historical);
    expect(await db.bomItemEngineeringRevision.count()).toBe(1);
  });

  it("does not reconcile catalogue data when stale tokens or invalid guidance reject the mutation", async () => {
    const db = await fixture();
    const first = await createItemEngineeringRevision(input(), db);
    await db.bomItem.update({ where: { id: "item-a" }, data: { category: "legacy-protection" }, select: { id: true } });
    const before = await db.bomItem.findUniqueOrThrow({ where: { id: "item-a" }, select: { category: true, updatedAt: true } });
    await expect(createItemEngineeringRevision(input(), db)).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
    await expect(createItemEngineeringRevision(input({ expectedLatestRevisionId: first.revision.id, noteIds: ["missing-note"] }), db)).rejects.toMatchObject({ code: "INVALID_GUIDANCE" });
    expect(await db.bomItem.findUniqueOrThrow({ where: { id: "item-a" }, select: { category: true, updatedAt: true } })).toEqual(before);
    expect(await getLatestItemEngineeringRevision("item-a", db)).toEqual(first.revision);
  });

  it("creates an exact revision and does not revise for unchanged content or commercial price", async () => {
    const db = await fixture();
    const first = await createItemEngineeringRevision(input(), db);
    expect(first.created).toBe(true);
    expect(first.revision).toMatchObject({ itemId: "item-a", revisionNumber: 1, identity: { displayName: "Breaker A" } });
    await db.$executeRawUnsafe("UPDATE BomItem SET unitCost=450 WHERE id='item-a'");
    const second = await createItemEngineeringRevision(input({ expectedLatestRevisionId: first.revision.id }), db);
    expect(second).toEqual({ revision: first.revision, created: false });
  });

  it("updates identity and revision atomically without changing the historical selection", async () => {
    const db = await fixture();
    const first = await createItemEngineeringRevision(input(), db);
    await db.$transaction(async tx => {
      await tx.$executeRawUnsafe("UPDATE BomItem SET partNumber='TRIPLE-20A' WHERE id='item-a'");
      await synchronizeItemEngineeringIdentity("item-a", first.revision.id, tx);
    });
    expect(await getItemEngineeringRevision(first.revision.id, db)).toEqual(first.revision);
    expect(await getLatestItemEngineeringRevision("item-a", db)).toMatchObject({ revisionNumber: 2, identity: { partNumber: "TRIPLE-20A" } });
  });

  it("rejects stale writers and rolls back identity changes", async () => {
    const db = await fixture();
    const first = await createItemEngineeringRevision(input(), db);
    await expect(createItemEngineeringRevision(input(), db)).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
    await expect(db.$transaction(async tx => {
      await tx.$executeRawUnsafe("UPDATE BomItem SET partNumber='STALE' WHERE id='item-a'");
      await synchronizeItemEngineeringIdentity("item-a", "old-revision", tx);
    })).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
    expect(await db.bomItem.findUnique({ where: { id: "item-a" }, select: { partNumber: true } })).toEqual({ partNumber: null });
    expect(await getLatestItemEngineeringRevision("item-a", db)).toEqual(first.revision);
  });

  it("rejects unknown Items, cross-Item guidance and duplicated guidance references", async () => {
    const db = await fixture();
    await expect(createItemEngineeringRevision(input({ itemId: "missing" }), db)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(createItemEngineeringRevision(input({ itemId: "item-b", noteIds: ["note-a"] }), db)).rejects.toMatchObject({ code: "INVALID_GUIDANCE" });
    await expect(createItemEngineeringRevision(input({ itemId: "item-b", documentIds: ["doc-a"] }), db)).rejects.toMatchObject({ code: "INVALID_GUIDANCE" });
    await expect(createItemEngineeringRevision(input({ noteIds: ["note-a", "note-a"] }), db)).rejects.toThrow();
    expect(await db.bomItemEngineeringRevision.count()).toBe(0);
  });

  it("archives a referenced Item and keeps historical guidance resolvable", async () => {
    const db = await fixture();
    const result = await createItemEngineeringRevision(input({ noteIds: ["note-a"], documentIds: ["doc-a"] }), db);
    expect(await deleteBomItem("item-a", db)).toEqual({ id: "item-a", mode: "archived" });
    expect(await getItemEngineeringRevision(result.revision.id, db)).toEqual(result.revision);
    await expect(createItemEngineeringRevision(input({ expectedLatestRevisionId: result.revision.id }), db)).rejects.toMatchObject({ code: "ARCHIVED" });
  });

  it("preserves legacy unreferenced deletion and archives Items with notes or fixed BOM usage", async () => {
    const db = await fixture();
    expect(await deleteBomItem("item-b", db)).toEqual({ id: "item-b", mode: "deleted" });
    expect(await deleteBomItem("item-a", db)).toEqual({ id: "item-a", mode: "archived" });
    await db.$executeRawUnsafe("INSERT INTO BomItem(id,itemKey,displayName,status) VALUES('item-c','ITEM-003','Legacy','active')");
    await db.$executeRawUnsafe("INSERT INTO SymbolBomTemplateLine VALUES('line-c','item-c')");
    expect(await deleteBomItem("item-c", db)).toEqual({ id: "item-c", mode: "archived" });
  });

  it("rolls back a partially created revision and first document hash when a later link fails", async () => {
    const db = await fixture();
    const before = await db.bomItem.findUniqueOrThrow({ where: { id: "item-a" }, select: { category: true, updatedAt: true } });
    await db.$executeRawUnsafe(`CREATE TRIGGER synthetic_link_failure BEFORE INSERT ON BomItemRevisionNote
      BEGIN SELECT RAISE(ABORT, 'Synthetic link failure'); END`);
    await expect(createItemEngineeringRevision(input({ noteIds: ["note-a"], documentIds: ["doc-a"] }), db)).rejects.toThrow();
    expect(await db.bomItemEngineeringRevision.count()).toBe(0);
    expect(await db.bomItemRevisionDocument.count()).toBe(0);
    expect((await db.bomItemDocument.findUniqueOrThrow({ where: { id: "doc-a" } })).contentHash).toBeNull();
    expect(await db.bomItem.findUniqueOrThrow({ where: { id: "item-a" }, select: { category: true, updatedAt: true } })).toEqual(before);
  });

  it("pins document bytes without changing timestamps; archival does not break old references", async () => {
    const db = await fixture();
    const before = await db.bomItemDocument.findUniqueOrThrow({ where: { id: "doc-a" } });
    const first = await createItemEngineeringRevision(input({ documentIds: ["doc-a"] }), db);
    const after = await db.bomItemDocument.findUniqueOrThrow({ where: { id: "doc-a" } });
    expect({ ...after, contentHash: null }).toEqual(before);
    await db.bomItemDocument.update({ where: { id: "doc-a" }, data: { archivedAt: new Date() } });
    expect(await getItemEngineeringRevision(first.revision.id, db)).toEqual(first.revision);
    expect((await createItemEngineeringRevision(input({ expectedLatestRevisionId: first.revision.id, documentIds: ["doc-a"] }), db)).created).toBe(false);
  });

  it("rejects newly attaching archived guidance", async () => {
    const db = await fixture();
    await db.bomItemEngineerNote.update({ where: { id: "note-a" }, data: { archivedAt: new Date() } });
    await expect(createItemEngineeringRevision(input({ noteIds: ["note-a"] }), db)).rejects.toMatchObject({ code: "INVALID_GUIDANCE" });
  });

  it("detects an unauthorized late link instead of silently changing a historical revision", async () => {
    const db = await fixture();
    const first = await createItemEngineeringRevision(input(), db);
    await db.bomItemRevisionNote.create({ data: { revisionId: first.revision.id, itemId: "item-a", noteId: "note-a" } });
    await expect(getItemEngineeringRevision(first.revision.id, db)).rejects.toMatchObject({ code: "INTEGRITY" });
  });

  it("batches exact revisions without fetching attachment bodies or falling back for missing IDs", async () => {
    const db = await fixture();
    const first = await createItemEngineeringRevision(input({ noteIds: ["note-a"], documentIds: ["doc-a"] }), db);
    const spy = vi.spyOn(db.bomItemEngineeringRevision, "findMany");
    const result = await getItemEngineeringRevisions([first.revision.id, first.revision.id, "missing"], db);
    expect(result).toEqual([first.revision]);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(spy.mock.calls)).not.toMatch(/dataUrl|imageDataUrl/);
    expect(JSON.stringify(result)).not.toContain("base64");
    expect(await getItemEngineeringRevision("missing", db)).toBeNull();
  });
});
