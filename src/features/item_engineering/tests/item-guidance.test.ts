import { mkdirSync, mkdtempSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ensureItemEngineeringStorage } from "../data/storage";
import { saveItemEngineerNote, archiveItemEngineerNote, listItemEngineerNotePage, getItemEngineerNote, reorderItemEngineerNote } from "../data/guidance";
import { moveNoteBefore } from "../logic/services/item-note-order";
import { createItemEngineeringRevision, saveItemWorkspaceProfile } from "../data/mutations";
import { getItemEngineeringRevision, getLatestItemEngineeringRevision } from "../data/queries";
import { validateItemNoteImage } from "../logic/services/item-note-image";
import { itemEngineeringActionResult } from "../logic/services/item-engineering-action-result";
import { ItemEngineeringError } from "../logic/services/item-engineering-revision";
import { uploadBomItemDocument, deleteBomItemDocument } from "@/features/bom_creator/data/mutations";
import { getBomItemDocumentPayload } from "@/features/bom_creator/data/queries";

const clients: PrismaClient[] = [];
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=", "base64");
const image = { fileName: "snippet.png", mimeType: "image/png" as const, sizeBytes: png.length, dataUrl: "data:image/png;base64," + png.toString("base64") };
const pdf = Buffer.from("%PDF-1.4\n%%EOF\n");
const document = { itemId: "item-a", title: "Manufacturer manual", fileName: "manual.pdf", mimeType: "application/pdf" as const,
  sizeBytes: pdf.length, dataUrl: "data:application/pdf;base64," + pdf.toString("base64") };
const noteInput = (changes: Record<string, unknown> = {}) => ({ itemId: "item-a", expectedLatestRevisionId: null,
  notes: "Manufacturer wiring guidance", image: null, ...changes });
async function fixture() {
  const root = realpathSync(process.cwd());
  if (JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).name !== "ei-designer") throw new Error("Wrong application");
  const base = path.join(root, "artifacts/drawing-performance/item-engineering/guidance-tests");
  mkdirSync(base, { recursive: true });
  if (realpathSync(base) !== base) throw new Error("Redirected fixture path");
  const file = path.join(mkdtempSync(path.join(base, "run-")), "fixture.db");
  const db = new PrismaClient({ datasourceUrl: "file:" + file.replaceAll("\\", "/") });
  clients.push(db);
  await db.$executeRawUnsafe("PRAGMA foreign_keys = ON");
  await db.$executeRawUnsafe(`CREATE TABLE BomItem(id TEXT PRIMARY KEY,itemKey TEXT NOT NULL,displayName TEXT NOT NULL,
    manufacturer TEXT,model TEXT,partNumber TEXT,status TEXT NOT NULL,category TEXT NOT NULL DEFAULT 'accessory',updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  await db.$executeRawUnsafe("CREATE TABLE SymbolVersion(id TEXT PRIMARY KEY)");
  await db.$executeRawUnsafe(`CREATE TABLE BomItemDocument(id TEXT PRIMARY KEY,itemId TEXT NOT NULL REFERENCES BomItem(id),
    title TEXT NOT NULL,fileName TEXT NOT NULL,mimeType TEXT NOT NULL,sizeBytes INTEGER NOT NULL,dataUrl TEXT NOT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  await db.$executeRawUnsafe("INSERT INTO BomItem(id,itemKey,displayName,status) VALUES('item-a','ITEM-001','Breaker','active'),('item-b','ITEM-002','Other','active')");
  await ensureItemEngineeringStorage(db);
  return db;
}
async function profile(db: PrismaClient) {
  return (await createItemEngineeringRevision({ itemId: "item-a", expectedLatestRevisionId: null,
    profile: { version: 1, deviceType: "breaker", groups: [], terminalConductorRanges: [] }, noteIds: [], documentIds: [] }, db)).revision;
}
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(clients.splice(0).map(db => db.$disconnect()));
});

describe("Item-owned guidance", () => {
  it("reorders active notes without changing content, revisions or documents; append and replacement retain manual order", async () => {
    const db = await fixture(); const initial = await profile(db);
    const a = await saveItemEngineerNote(noteInput({ notes: "A", image, expectedLatestRevisionId: initial.id }), db);
    const b = await saveItemEngineerNote(noteInput({ notes: "B", expectedLatestRevisionId: a.revision!.id }), db);
    await saveItemEngineerNote(noteInput({ notes: "C", expectedLatestRevisionId: b.revision!.id }), db);
    const page = await listItemEngineerNotePage({ itemId: "item-a" }, db);
    const before = await db.bomItemEngineerNote.findMany({ orderBy: { id: "asc" } });
    const revision = await getLatestItemEngineeringRevision("item-a", db);
    const moved = await reorderItemEngineerNote({ itemId: "item-a", noteId: a.note.id, beforeNoteId: page.activeOrder[0], expectedOrderToken: page.orderToken, expectedLatestRevisionId: revision!.id }, db);
    expect(moved.activeOrder[0]).toBe(a.note.id);
    expect((await listItemEngineerNotePage({ itemId: "item-a" }, db)).items.map(note => note.id)).toEqual(moved.activeOrder);
    expect(await getLatestItemEngineeringRevision("item-a", db)).toEqual(revision);
    const after = await db.bomItemEngineerNote.findMany({ orderBy: { id: "asc" } });
    expect(after.map(row => ({ ...row, libraryPosition: null }))).toEqual(before.map(row => ({ ...row, libraryPosition: null })));
    expect((await getItemEngineerNote("item-a", a.note.id, db))?.image).toEqual(image);
    const d = await saveItemEngineerNote(noteInput({ notes: "D", expectedLatestRevisionId: revision!.id }), db);
    expect((await listItemEngineerNotePage({ itemId: "item-a" }, db)).activeOrder).toEqual([...moved.activeOrder, d.note.id]);
    const replacement = await saveItemEngineerNote(noteInput({ replaceNoteId: a.note.id, notes: "A edited", expectedLatestRevisionId: d.revision!.id }), db);
    expect((await listItemEngineerNotePage({ itemId: "item-a" }, db)).activeOrder[0]).toBe(replacement.note.id);
    await archiveItemEngineerNote({ itemId: "item-a", noteId: replacement.note.id, expectedLatestRevisionId: replacement.revision!.id }, db);
    expect((await listItemEngineerNotePage({ itemId: "item-a" }, db)).activeOrder).toEqual([...moved.activeOrder.slice(1), d.note.id]);
    expect((await getItemEngineeringRevision(revision!.id, db))?.noteIds).toContain(a.note.id);
  });
  it("rejects stale order tokens, invalid targets, archived Items and no-profile membership races", async () => {
    const db = await fixture();
    const a = await saveItemEngineerNote(noteInput({ notes: "A" }), db);
    const b = await saveItemEngineerNote(noteInput({ notes: "B" }), db);
    const page = await listItemEngineerNotePage({ itemId: "item-a" }, db);
    const command = { itemId: "item-a", noteId: a.note.id, beforeNoteId: b.note.id, expectedOrderToken: page.orderToken, expectedLatestRevisionId: null };
    await expect(reorderItemEngineerNote({ ...command, beforeNoteId: "wrong-item-note" }, db)).rejects.toMatchObject({ code: "INVALID_GUIDANCE" });
    const changed = await reorderItemEngineerNote(command, db);
    await expect(reorderItemEngineerNote(command, db)).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
    await saveItemEngineerNote(noteInput({ notes: "Concurrent new note" }), db);
    await expect(reorderItemEngineerNote({ ...command, expectedOrderToken: changed.orderToken }, db)).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
    const refreshed = await listItemEngineerNotePage({ itemId: "item-a" }, db);
    await db.bomItem.update({ where: { id: "item-a" }, data: { status: "archived" }, select: { id: true } });
    await expect(reorderItemEngineerNote({ ...command, expectedOrderToken: refreshed.orderToken }, db)).rejects.toMatchObject({ code: "ARCHIVED" });
  });
  it("moves stable IDs before a target or to the end, preserving no-ops and rejecting missing identities", () => {
    expect(moveNoteBefore(["a", "b", "c"], "c", "a")).toEqual(["c", "a", "b"]);
    expect(moveNoteBefore(["a", "b", "c"], "a", null)).toEqual(["b", "c", "a"]);
    expect(moveNoteBefore(["a", "b"], "a", "a")).toEqual(["a", "b"]);
    expect(() => moveNoteBefore(["a"], "missing", null)).toThrow();
  });
  it("saves image-only notes and retains exact image history through replacement and archive", async () => {
    const db = await fixture();
    const original = await profile(db);
    const first = await saveItemEngineerNote(noteInput({ notes: "  ", image, expectedLatestRevisionId: original.id }), db);
    expect(first.note).toMatchObject({ notes: "", hasImage: true });
    expect((await listItemEngineerNotePage({ itemId: "item-a" }, db)).items[0]).toMatchObject({ notes: "", hasImage: true });
    expect((await getItemEngineerNote("item-a", first.note.id, db))?.image).toEqual(image);
    const second = await saveItemEngineerNote(noteInput({ notes: "Optional caption", image,
      replaceNoteId: first.note.id, expectedLatestRevisionId: first.revision!.id }), db);
    expect((await getItemEngineerNote("item-a", first.note.id, db))?.notes).toBe("");
    expect((await getItemEngineeringRevision(first.revision!.id, db))?.noteIds).toEqual([first.note.id]);
    await archiveItemEngineerNote({ itemId: "item-a", noteId: second.note.id, expectedLatestRevisionId: second.revision!.id }, db);
    expect((await getItemEngineerNote("item-a", second.note.id, db))?.image).toEqual(image);
  });
  it("rejects an empty note and removing the only image without adding text", async () => {
    const db = await fixture();
    for (const notes of ["", "   "]) await expect(saveItemEngineerNote(noteInput({ notes }), db)).rejects.toThrow("Paste an image or enter some text.");
    const saved = await saveItemEngineerNote(noteInput({ notes: "", image }), db);
    await expect(saveItemEngineerNote(noteInput({ notes: "", image: null, replaceNoteId: saved.note.id }), db)).rejects.toThrow();
    expect(await db.bomItemEngineerNote.count()).toBe(1);
    expect((await getItemEngineerNote("item-a", saved.note.id, db))?.image).toEqual(image);
  });
  it("profile-only saves retain guidance authored before and after the first profile", async () => {
    const db = await fixture();
    const note = await saveItemEngineerNote(noteInput(), db);
    const doc = await uploadBomItemDocument(document, db);
    const initial = await saveItemWorkspaceProfile({ itemId: "item-a", expectedLatestRevisionId: null,
      profile: { version: 1, deviceType: "breaker", groups: [], terminalConductorRanges: [] } }, db);
    expect(initial.revision.noteIds).toEqual([note.note.id]);
    expect(initial.revision.documentIds).toEqual([doc!.id]);
    const added = await saveItemEngineerNote(noteInput({ expectedLatestRevisionId: initial.revision.id, notes: "Second note" }), db);
    const saved = await saveItemWorkspaceProfile({ itemId: "item-a", expectedLatestRevisionId: added.revision!.id,
      profile: { ...initial.revision.profile, deviceType: "relay" } }, db);
    expect(saved.revision.noteIds.sort()).toEqual([note.note.id, added.note.id].sort());
    expect(saved.revision.documentIds).toEqual([doc!.id]);
    await expect(saveItemWorkspaceProfile({ itemId: "item-a", expectedLatestRevisionId: initial.revision.id,
      profile: initial.revision.profile }, db)).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
    await expect(saveItemWorkspaceProfile({ itemId: "item-a", expectedLatestRevisionId: saved.revision.id,
      profile: saved.revision.profile, noteIds: [] }, db)).rejects.toThrow();
  });
  it("starts empty and accepts 20,000 characters and a snippet without legacy Symbol storage", async () => {
    const db = await fixture();
    expect((await listItemEngineerNotePage({ itemId: "item-a" }, db)).items).toEqual([]);
    const saved = await saveItemEngineerNote(noteInput({ notes: "N".repeat(20_000), image }), db);
    expect(saved.revision).toBeNull();
    expect(saved.note.notes).toHaveLength(20_000);
    expect(JSON.stringify(saved)).not.toContain("base64");
    expect((await getItemEngineerNote("item-a", saved.note.id, db))?.image).toEqual(image);
    expect(await db.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE name IN ('SymbolEngineerNote','SymbolDocument','LegacyDocumentTransfer')")).toEqual([]);
  });

  it("replaces and archives notes while old Item revisions retain the exact content", async () => {
    const db = await fixture();
    const original = await profile(db);
    const first = await saveItemEngineerNote(noteInput({ expectedLatestRevisionId: original.id, image }), db);
    const firstRevision = first.revision!;
    const second = await saveItemEngineerNote(noteInput({ expectedLatestRevisionId: firstRevision.id,
      replaceNoteId: first.note.id, notes: "Updated instructions", image: null }), db);
    expect(second.revision?.revisionNumber).toBe(3);
    expect(second.note.supersedesId).toBe(first.note.id);
    expect(await getItemEngineeringRevision(firstRevision.id, db)).toEqual(firstRevision);
    expect((await getItemEngineerNote("item-a", first.note.id, db))?.image).toEqual(image);
    expect((await listItemEngineerNotePage({ itemId: "item-a" }, db)).items.map(n => n.id)).toEqual([second.note.id]);
    await archiveItemEngineerNote({ itemId: "item-a", noteId: second.note.id, expectedLatestRevisionId: second.revision!.id }, db);
    expect((await getLatestItemEngineeringRevision("item-a", db))?.noteIds).toEqual([]);
    expect((await getItemEngineerNote("item-a", second.note.id, db))?.notes).toBe("Updated instructions");
  });

  it("rejects wrong ownership, missing and already-replaced notes and rolls back stale saves", async () => {
    const db = await fixture();
    const first = await saveItemEngineerNote(noteInput(), db);
    await expect(saveItemEngineerNote(noteInput({ itemId: "item-b", replaceNoteId: first.note.id }), db)).rejects.toMatchObject({ code: "INVALID_GUIDANCE" });
    await expect(saveItemEngineerNote(noteInput({ replaceNoteId: "missing" }), db)).rejects.toThrow();
    await profile(db);
    const count = await db.bomItemEngineerNote.count();
    await expect(saveItemEngineerNote(noteInput(), db)).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
    expect(await db.bomItemEngineerNote.count()).toBe(count);
    expect(await getItemEngineerNote("item-b", first.note.id, db)).toBeNull();
  });

  it("validates size, type, signature and encoded bytes before writing", async () => {
    const db = await fixture();
    for (const invalid of [{ ...image, sizeBytes: image.sizeBytes + 1 }, { ...image, mimeType: "image/svg+xml" },
      { ...image, dataUrl: "data:image/png;base64,QUJD", sizeBytes: 3 }, { ...image, dataUrl: "data:image/png;base64,%%%" }]) {
      await expect(saveItemEngineerNote(noteInput({ image: invalid }), db)).rejects.toThrow();
    }
    await expect(saveItemEngineerNote(noteInput({ notes: "x".repeat(20_001) }), db)).rejects.toThrow();
    expect(await db.bomItemEngineerNote.count()).toBe(0);
    expect(validateItemNoteImage(image)).toEqual(image);
  });

  it("paginates metadata without image bodies and clamps an out-of-range page", async () => {
    const db = await fixture();
    await db.bomItemEngineerNote.createMany({ data: Array.from({ length: 26 }, (_, i) => ({
      id: `note-${String(i).padStart(2, "0")}`, itemId: "item-a", notes: "Synthetic", contentHash: "a".repeat(64)
    })) });
    const spy = vi.spyOn(db.bomItemEngineerNote, "findMany");
    const first = await listItemEngineerNotePage({ itemId: "item-a" }, db);
    const last = await listItemEngineerNotePage({ itemId: "item-a", page: 999 }, db);
    expect(first.items).toHaveLength(25);
    expect(last).toMatchObject({ page: 2, totalItems: 26, totalPages: 2 });
    expect(last.items).toHaveLength(1);
    expect(JSON.stringify(spy.mock.calls)).not.toContain("imageDataUrl");
  });

  it("rejects active-note budget overflow and editing archived Items", async () => {
    const db = await fixture();
    await db.bomItemEngineerNote.createMany({ data: Array.from({ length: 128 }, (_, i) => ({
      id: `note-${i}`, itemId: "item-a", notes: "Synthetic", contentHash: "a".repeat(64)
    })) });
    await expect(saveItemEngineerNote(noteInput(), db)).rejects.toMatchObject({ code: "INVALID_GUIDANCE" });
    await db.$executeRawUnsafe("UPDATE BomItem SET status='archived' WHERE id='item-b'");
    await expect(saveItemEngineerNote(noteInput({ itemId: "item-b" }), db)).rejects.toMatchObject({ code: "ARCHIVED" });
  });

  it("enforces individual and combined image budgets before committing", async () => {
    const db = await fixture();
    await expect(saveItemEngineerNote(noteInput({ image: { ...image, sizeBytes: 10 * 1024 * 1024 + 1 } }), db)).rejects.toThrow();
    // Budget-only rows model two already validated 10 MB images; bodies are not loaded for this check.
    await db.bomItemEngineerNote.createMany({ data: ["large-a", "large-b"].map(id => ({
      id, itemId: "item-a", notes: "Budget fixture", contentHash: "a".repeat(64), imageSizeBytes: 10 * 1024 * 1024
    })) });
    await expect(saveItemEngineerNote(noteInput({ image }), db)).rejects.toMatchObject({ code: "INVALID_GUIDANCE" });
    expect(await db.bomItemEngineerNote.count()).toBe(2);
  });

  it("uploads and archives a pinned PDF with exact historical download bytes", async () => {
    const db = await fixture();
    const original = await profile(db);
    const saved = await uploadBomItemDocument({ ...document, expectedEngineeringRevisionId: original.id }, db);
    expect(saved).not.toBeNull();
    const linked = (await getLatestItemEngineeringRevision("item-a", db))!;
    expect(linked.documentIds).toEqual([saved!.id]);
    const removed = await deleteBomItemDocument({ itemId: "item-a", documentId: saved!.id, expectedEngineeringRevisionId: linked.id }, db);
    expect(removed.mode).toBe("archived");
    expect((await getLatestItemEngineeringRevision("item-a", db))?.documentIds).toEqual([]);
    expect(await getItemEngineeringRevision(linked.id, db)).toEqual(linked);
    expect(Buffer.from((await getBomItemDocumentPayload(saved!.id, db))!.bytes)).toEqual(pdf);
  });

  it("rolls back a stale PDF upload and retains unreferenced document deletion", async () => {
    const db = await fixture();
    const saved = await uploadBomItemDocument(document, db);
    expect((await deleteBomItemDocument({ itemId: "item-a", documentId: saved!.id }, db)).mode).toBe("deleted");
    await profile(db);
    await expect(uploadBomItemDocument(document, db)).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
    expect(await db.bomItemDocument.count()).toBe(0);
  });

  it("returns stable action errors without exposing internal failure details", async () => {
    expect(await itemEngineeringActionResult(async () => { throw new ItemEngineeringError("ARCHIVED", "Restore the Item."); }))
      .toEqual({ ok: false, code: "ARCHIVED", error: "Restore the Item." });
    const invalid = await itemEngineeringActionResult(() => saveItemEngineerNote({}));
    expect(invalid).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(await itemEngineeringActionResult(async () => { throw new Error("private filesystem details"); }))
      .toEqual({ ok: false, code: "UNEXPECTED", error: "The Item engineering operation could not be completed. Please retry." });
  });
});
