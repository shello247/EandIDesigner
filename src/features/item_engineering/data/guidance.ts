import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { archiveItemEngineerNoteInputSchema, itemEngineerNoteDetailSchema,
  itemEngineerNoteMetadataSchema, itemEngineerNotePageInputSchema, saveItemEngineerNoteInputSchema, reorderItemEngineerNoteInputSchema,
  ITEM_NOTE_MAX_ACTIVE, ITEM_NOTE_MAX_TOTAL_IMAGE_BYTES } from "./schema";
import { synchronizeItemGuidance, getItemEngineeringRevisionToken } from "./mutations";
import { moveNoteBefore } from "../logic/services/item-note-order";
import { hashItemEngineeringContent, ItemEngineeringError } from "../logic/services/item-engineering-revision";
import { validateItemNoteImage } from "../logic/services/item-note-image";

const metadataSelect = { id: true, itemId: true, notes: true, imageSizeBytes: true,
  supersedesId: true, createdAt: true, archivedAt: true } satisfies Prisma.BomItemEngineerNoteSelect;
type MetadataRow = Prisma.BomItemEngineerNoteGetPayload<{ select: typeof metadataSelect }>;
function metadata(row: MetadataRow) {
  return itemEngineerNoteMetadataSchema.parse({ id: row.id, itemId: row.itemId, notes: row.notes,
    hasImage: row.imageSizeBytes !== null, supersedesId: row.supersedesId,
    createdAt: row.createdAt.toISOString(), archivedAt: row.archivedAt?.toISOString() ?? null });
}
async function activeItem(itemId: string, db: Prisma.TransactionClient) {
  const item = await db.bomItem.findUnique({ where: { id: itemId }, select: { status: true } });
  if (!item) throw new ItemEngineeringError("NOT_FOUND", "Item was not found.");
  if (item.status !== "active") throw new ItemEngineeringError("ARCHIVED", "Restore the Item before editing its guidance.");
}

export async function saveItemEngineerNote(input: unknown, db: PrismaClient = prisma) {
  const parsed = saveItemEngineerNoteInputSchema.parse(input);
  const image = parsed.image ? validateItemNoteImage(parsed.image) : null;
  return db.$transaction(async tx => {
    await activeItem(parsed.itemId, tx);
    const current = await tx.bomItemEngineerNote.findMany({ where: { itemId: parsed.itemId, archivedAt: null },
      select: { id: true, imageSizeBytes: true, libraryPosition: true } });
    if (parsed.replaceNoteId && !current.some(note => note.id === parsed.replaceNoteId)) {
      throw new ItemEngineeringError("INVALID_GUIDANCE", "The note is no longer active or does not belong to this Item.");
    }
    const retained = current.filter(note => note.id !== parsed.replaceNoteId);
    if (retained.length >= ITEM_NOTE_MAX_ACTIVE ||
      retained.reduce((sum, note) => sum + (note.imageSizeBytes ?? 0), image?.sizeBytes ?? 0) > ITEM_NOTE_MAX_TOTAL_IMAGE_BYTES) {
      throw new ItemEngineeringError("INVALID_GUIDANCE", "Items support at most 128 active notes and 20 MB of active note images.");
    }
    const content = { notes: parsed.notes, imageFileName: image?.fileName ?? null,
      imageMimeType: image?.mimeType ?? null, imageSizeBytes: image?.sizeBytes ?? null, imageDataUrl: image?.dataUrl ?? null };
    const previous = current.find(note => note.id === parsed.replaceNoteId);
    const manual = await tx.bomItemEngineerNote.aggregate({ where: { itemId: parsed.itemId }, _max: { libraryPosition: true } });
    const libraryPosition = previous ? previous.libraryPosition : manual._max.libraryPosition === null ? null : manual._max.libraryPosition + 1;
    const row = await tx.bomItemEngineerNote.create({ data: { ...content, itemId: parsed.itemId, libraryPosition,
      supersedesId: parsed.replaceNoteId, contentHash: hashItemEngineeringContent(content) }, select: metadataSelect });
    const revision = await synchronizeItemGuidance({ itemId: parsed.itemId,
      expectedLatestRevisionId: parsed.expectedLatestRevisionId, addNoteId: row.id, removeNoteId: parsed.replaceNoteId }, tx);
    if (parsed.replaceNoteId) await tx.bomItemEngineerNote.update({ where: { id: parsed.replaceNoteId }, data: { archivedAt: new Date() } });
    return { note: metadata(row), revision };
  });
}

export async function archiveItemEngineerNote(input: unknown, db: PrismaClient = prisma) {
  const parsed = archiveItemEngineerNoteInputSchema.parse(input);
  return db.$transaction(async tx => {
    await activeItem(parsed.itemId, tx);
    const row = await tx.bomItemEngineerNote.findFirst({ where: { id: parsed.noteId, itemId: parsed.itemId }, select: metadataSelect });
    if (!row) throw new ItemEngineeringError("NOT_FOUND", "Item note was not found.");
    const revision = await synchronizeItemGuidance({ ...parsed, removeNoteId: row.id }, tx);
    if (!row.archivedAt) await tx.bomItemEngineerNote.update({ where: { id: row.id }, data: { archivedAt: new Date() } });
    return { id: row.id, revision };
  });
}

export async function listItemEngineerNotePage(input: unknown, db: Prisma.TransactionClient = prisma) {
  const parsed = itemEngineerNotePageInputSchema.parse(input);
  const item = await db.bomItem.findUnique({ where: { id: parsed.itemId }, select: { id: true } });
  if (!item) throw new ItemEngineeringError("NOT_FOUND", "Item was not found.");
  const active = await db.bomItemEngineerNote.findMany({ where: { itemId: parsed.itemId, archivedAt: null }, select: { id: true }, orderBy: noteOrderBy });
  const activeOrder = active.map(note => note.id);
  const where = { itemId: parsed.itemId, ...(parsed.includeArchived ? {} : { archivedAt: null }) };
  const totalItems = await db.bomItemEngineerNote.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalItems / 25));
  const focusIndex = parsed.focusNoteId && !parsed.includeArchived ? activeOrder.indexOf(parsed.focusNoteId) : -1;
  const page = focusIndex >= 0 ? Math.floor(focusIndex / 25) + 1 : Math.min(parsed.page, totalPages);
  const rows = await db.bomItemEngineerNote.findMany({ where, select: metadataSelect,
    orderBy: noteOrderBy, skip: (page - 1) * 25, take: 25 });
  return { items: rows.map(row => ({ ...metadata(row), notes: row.notes.length > 280 ? row.notes.slice(0,280) + "…" : row.notes })), totalItems, totalPages, page, pageSize: 25,
    activeOrder, orderToken: hashItemEngineeringContent(activeOrder) };
}

const noteOrderBy: Prisma.BomItemEngineerNoteOrderByWithRelationInput[] = [
  { libraryPosition: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }, { id: "asc" }
];

export async function reorderItemEngineerNote(input: unknown, db: PrismaClient = prisma) {
  const parsed = reorderItemEngineerNoteInputSchema.parse(input);
  return db.$transaction(async tx => {
    await activeItem(parsed.itemId, tx);
    const revisionId = await getItemEngineeringRevisionToken(parsed.itemId, tx);
    if (revisionId !== parsed.expectedLatestRevisionId) throw new ItemEngineeringError("REVISION_CONFLICT", "Item guidance changed. Refresh the Library and move the note again.");
    const rows = await tx.bomItemEngineerNote.findMany({ where: { itemId: parsed.itemId, archivedAt: null }, select: { id: true }, orderBy: noteOrderBy });
    const ids = rows.map(row => row.id);
    if (hashItemEngineeringContent(ids) !== parsed.expectedOrderToken) throw new ItemEngineeringError("REVISION_CONFLICT", "Library order or notes changed. Refresh the Library and move the note again.");
    if (!ids.includes(parsed.noteId) || (parsed.beforeNoteId !== null && !ids.includes(parsed.beforeNoteId))) throw new ItemEngineeringError("INVALID_GUIDANCE", "Only active notes belonging to this Item can be reordered.");
    const order = moveNoteBefore(ids, parsed.noteId, parsed.beforeNoteId);
    if (order.some((id, index) => id !== ids[index])) {
      for (const [libraryPosition, id] of order.entries()) await tx.bomItemEngineerNote.update({ where: { id }, data: { libraryPosition }, select: { id: true } });
    }
    return { itemId: parsed.itemId, activeOrder: order, orderToken: hashItemEngineeringContent(order), revisionId };
  });
}

export async function getItemEngineerNote(itemId: string, noteId: string, db: Prisma.TransactionClient = prisma) {
  const row = await db.bomItemEngineerNote.findFirst({ where: { itemId, id: noteId } });
  if (!row) return null;
  const content = { notes: row.notes, imageFileName: row.imageFileName, imageMimeType: row.imageMimeType,
    imageSizeBytes: row.imageSizeBytes, imageDataUrl: row.imageDataUrl };
  if (hashItemEngineeringContent(content) !== row.contentHash) throw new ItemEngineeringError("INTEGRITY", "Item note content has changed.");
  const image = row.imageDataUrl ? validateItemNoteImage({ fileName: row.imageFileName, mimeType: row.imageMimeType,
    sizeBytes: row.imageSizeBytes, dataUrl: row.imageDataUrl }) : null;
  return itemEngineerNoteDetailSchema.parse({ ...metadata(row), image });
}
