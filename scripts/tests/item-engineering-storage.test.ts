import { mkdirSync, mkdtempSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterEach, describe, expect, it } from "vitest";
import { ensureItemEngineeringStorage } from "../../src/features/item_engineering/api/server";

const clients: PrismaClient[] = [];

async function fixture() {
  const root = realpathSync(process.cwd());
  if (JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).name !== "ei-designer") {
    throw new Error("Wrong application");
  }
  const directory = path.join(root, "artifacts/drawing-performance/item-engineering/storage-tests");
  mkdirSync(directory, { recursive: true });
  if (realpathSync(directory) !== directory) throw new Error("Redirected test storage");
  const database = path.join(mkdtempSync(path.join(directory, "run-")), "fixture.db");
  const db = new PrismaClient({ datasourceUrl: "file:" + database.replaceAll("\\", "/") });
  clients.push(db);
  await db.$executeRawUnsafe("PRAGMA foreign_keys = ON");
  await db.$executeRawUnsafe('CREATE TABLE "BomItem" (id TEXT PRIMARY KEY, displayName TEXT NOT NULL)');
  await db.$executeRawUnsafe('CREATE TABLE "SymbolVersion" (id TEXT PRIMARY KEY)');
  await db.$executeRawUnsafe(`CREATE TABLE "BomItemDocument" (
    id TEXT PRIMARY KEY, itemId TEXT NOT NULL REFERENCES BomItem(id),
    title TEXT NOT NULL, fileName TEXT NOT NULL, mimeType TEXT NOT NULL,
    sizeBytes INTEGER NOT NULL, dataUrl TEXT NOT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL)`);
  await db.$executeRawUnsafe('CREATE TABLE "Drawing" (id TEXT PRIMARY KEY, modelJson TEXT NOT NULL)');
  await db.$executeRawUnsafe(`INSERT INTO "BomItem" VALUES ('item-a','Breaker A'),('item-b','Breaker B')`);
  await db.$executeRawUnsafe(`INSERT INTO "SymbolVersion" VALUES ('symbol-v1')`);
  await db.$executeRawUnsafe(`INSERT INTO "Drawing" VALUES ('drawing-1','{"version":2,"assets":[]}')`);
  await db.$executeRawUnsafe(`INSERT INTO "BomItemDocument" VALUES
    ('doc-a','item-a','Manual','manual.pdf','application/pdf',3,'data:application/pdf;base64,QUJD',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`);
  await ensureItemEngineeringStorage(db);
  return db;
}

function revisionData(id = "rev-a", itemId = "item-a") {
  return { id, itemId, revisionNumber: 1, identityJson: '{"displayName":"Breaker"}',
    profileJson: '{"version":1}', contentHash: "a".repeat(64) };
}

afterEach(async () => {
  await Promise.all(clients.splice(0).map(db => db.$disconnect()));
});

describe("Item engineering additive storage", () => {
  it("repeats without rewriting old documents or drawings", async () => {
    const db = await fixture();
    const beforeDocs = await db.bomItemDocument.findMany();
    const beforeDrawings = await db.$queryRawUnsafe('SELECT * FROM Drawing');
    await ensureItemEngineeringStorage(db);
    expect(await db.bomItemDocument.findMany()).toEqual(beforeDocs);
    expect(await db.$queryRawUnsafe('SELECT * FROM Drawing')).toEqual(beforeDrawings);
    expect(beforeDocs[0]).toMatchObject({ archivedAt: null, contentHash: null });
    expect(await db.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE name IN ('SymbolEngineerNote','SymbolDocument','LegacyDocumentTransfer')")).toEqual([]);
    expect(await db.$queryRawUnsafe("PRAGMA foreign_key_check")).toEqual([]);
  });
  it("adds a nullable Library position to an existing note table without rewriting content", async () => {
    const db = await fixture();
    await db.$executeRawUnsafe('ALTER TABLE "BomItemEngineerNote" DROP COLUMN "libraryPosition"');
    await db.$executeRawUnsafe(`INSERT INTO "BomItemEngineerNote" (id,itemId,notes,contentHash) VALUES ('legacy-note','item-a','Retain this text','original-hash')`);
    await ensureItemEngineeringStorage(db);
    const note = await db.bomItemEngineerNote.findUniqueOrThrow({ where: { id: "legacy-note" } });
    expect(note).toMatchObject({ notes: "Retain this text", contentHash: "original-hash", libraryPosition: null });
    await db.bomItemEngineerNote.update({ where: { id: note.id }, data: { libraryPosition: 2 } });
    await ensureItemEngineeringStorage(db);
    expect((await db.bomItemEngineerNote.findUniqueOrThrow({ where: { id: note.id } })).libraryPosition).toBe(2);
  });

  it("enforces Item ownership and unique revision numbers", async () => {
    const db = await fixture();
    await db.bomItemEngineeringRevision.create({ data: revisionData() });
    await expect(db.bomItemEngineeringRevision.create({
      data: { ...revisionData(), id: "duplicate" }
    })).rejects.toThrow();
    await expect(db.bomItemEngineeringRevision.create({
      data: revisionData("orphan", "missing-item")
    })).rejects.toThrow();
    await expect(db.$executeRawUnsafe("DELETE FROM BomItem WHERE id='item-a'")).rejects.toThrow();
  });

  it("prevents rewriting/deleting a historical revision", async () => {
    const db = await fixture();
    await db.bomItemEngineeringRevision.create({ data: revisionData() });
    await expect(db.bomItemEngineeringRevision.update({
      where: { id: "rev-a" }, data: { profileJson: "{}" }
    })).rejects.toThrow();
    await expect(db.bomItemEngineeringRevision.delete({ where: { id: "rev-a" } })).rejects.toThrow();
  });

  it("rejects cross-Item note links and permits only archival of note content", async () => {
    const db = await fixture();
    await db.bomItemEngineeringRevision.create({ data: revisionData() });
    await db.bomItemEngineerNote.create({ data: { id: "note-a", itemId: "item-a", notes: "Original", contentHash: "b".repeat(64) } });
    await db.bomItemEngineerNote.create({ data: { id: "note-b", itemId: "item-b", notes: "Other product", contentHash: "c".repeat(64) } });
    await expect(db.bomItemRevisionNote.create({ data: {
      revisionId: "rev-a", itemId: "item-a", noteId: "note-b"
    } })).rejects.toThrow();
    await db.bomItemRevisionNote.create({ data: {
      revisionId: "rev-a", itemId: "item-a", noteId: "note-a"
    } });
    await expect(db.bomItemRevisionNote.delete({
      where: { revisionId_noteId: { revisionId: "rev-a", noteId: "note-a" } }
    })).rejects.toThrow();
    await expect(db.bomItemEngineerNote.delete({ where: { id: "note-a" } })).rejects.toThrow();
    await expect(db.bomItemEngineerNote.update({ where: { id: "note-a" }, data: { notes: "Overwritten" } })).rejects.toThrow();
    await db.bomItemEngineerNote.update({ where: { id: "note-a" }, data: { archivedAt: new Date() } });
    expect((await db.bomItemEngineerNote.findUniqueOrThrow({ where: { id: "note-a" } })).notes).toBe("Original");
  });

  it("pins document ownership and bytes while allowing recoverable archive", async () => {
    const db = await fixture();
    await db.bomItemEngineeringRevision.create({ data: revisionData() });
    await db.bomItemEngineeringRevision.create({ data: revisionData("rev-b", "item-b") });
    await expect(db.bomItemRevisionDocument.create({ data: {
      revisionId: "rev-b", itemId: "item-b", documentId: "doc-a"
    } })).rejects.toThrow();
    await db.bomItemRevisionDocument.create({ data: {
      revisionId: "rev-a", itemId: "item-a", documentId: "doc-a"
    } });
    await expect(db.bomItemDocument.delete({ where: { id: "doc-a" } })).rejects.toThrow();
    await expect(db.bomItemDocument.update({ where: { id: "doc-a" }, data: { dataUrl: "changed" } })).rejects.toThrow();
    await db.bomItemDocument.update({ where: { id: "doc-a" }, data: { archivedAt: new Date() } });
    expect((await db.bomItemDocument.findUniqueOrThrow({ where: { id: "doc-a" } })).dataUrl).toBe("data:application/pdf;base64,QUJD");
  });

  it("keeps alternative products separate and prevents cross-configuration extras", async () => {
    const db = await fixture();
    await db.bomItemEngineeringRevision.create({ data: revisionData() });
    for (const [id, revisionNumber] of [["config-a", 1], ["config-b", 2]] as const) {
      await db.symbolItemConfiguration.create({ data: { id, revisionNumber, symbolVersionId: "symbol-v1", symbolContractHash: "a".repeat(64) } });
    }
    await db.symbolItemConfigurationOption.create({ data: {
      id: "option-a", configurationId: "config-a", itemEngineeringRevisionId: "rev-a", usage: "schematic", evidence: "Synthetic verified map"
    } });
    await expect(db.symbolItemConfigurationPart.create({ data: {
      configurationId: "config-b", optionId: "option-a", itemEngineeringRevisionId: "rev-a", lineKey: "extra", quantityRule: "fixed_per_assembly", quantity: 1
    } })).rejects.toThrow();
    await expect(db.$executeRawUnsafe("DELETE FROM SymbolVersion WHERE id='symbol-v1'")).rejects.toThrow();
    await expect(db.symbolItemConfigurationOption.update({
      where: { id: "option-a" }, data: { evidence: "Rewritten" }
    })).rejects.toThrow();
    expect(await db.$queryRawUnsafe("PRAGMA foreign_key_check")).toEqual([]);
  });
});
