import { projectItemProfileV3 } from "../logic/services/profile-v3-adapter";
import { profileEvidence, validateProfileEvidence } from "../logic/services/attribute-evidence";
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getAttributeTypeRevisions } from "@/features/engineering_attributes/api/server";
import { attributeTypeSnapshotSchema } from "@/features/engineering_attributes/api/public";
import { itemEngineeringRevisionSchema, saveItemEngineeringRevisionInputSchema } from "./schema";
import { getLatestItemEngineeringRevision, itemRevisionSelect, projectItemEngineeringRevision } from "./queries";
import { hashItemDocumentContent, hashItemEngineeringContent, hashItemRevision, ItemEngineeringError } from "../logic/services/item-engineering-revision";

// Workspace profile edits cannot submit guidance membership. Resolve it in the
// same transaction as the revision write, including guidance authored before a profile.
export async function saveItemWorkspaceProfile(input: unknown, db: PrismaClient = prisma) {
  const shape = saveItemEngineeringRevisionInputSchema.shape;
  const parsed = z.strictObject({ itemId: shape.itemId, expectedLatestRevisionId: shape.expectedLatestRevisionId, profile: shape.profile }).parse(input);
  return db.$transaction(async tx => {
    const latest = await getLatestItemEngineeringRevision(parsed.itemId, tx);
    const [notes, documents] = latest ? [null, null] : await Promise.all([
      tx.bomItemEngineerNote.findMany({ where: { itemId: parsed.itemId, archivedAt: null }, select: { id: true } }),
      tx.bomItemDocument.findMany({ where: { itemId: parsed.itemId, archivedAt: null }, select: { id: true } })
    ]);
    return createItemEngineeringRevisionInTransaction({ ...parsed,
      noteIds: latest?.noteIds ?? notes!.map(row => row.id),
      documentIds: latest?.documentIds ?? documents!.map(row => row.id)
    }, tx);
  });
}

export async function getItemEngineeringRevisionToken(itemId: string, db: Prisma.TransactionClient = prisma) {
  const id = z.string().trim().min(1).parse(itemId);
  const row = await db.bomItemEngineeringRevision.findFirst({ where: { itemId: id }, orderBy: { revisionNumber: "desc" }, select: { id: true } });
  return row?.id ?? null;
}

// Caller owns the transaction so identity/profile/guidance changes can commit together.
export async function createItemEngineeringRevisionInTransaction(input: unknown, tx: Prisma.TransactionClient) {
  const parsed = saveItemEngineeringRevisionInputSchema.parse(input);
  const item = await tx.bomItem.findUnique({ where: { id: parsed.itemId }, select: {
    itemKey: true, displayName: true, manufacturer: true, model: true, partNumber: true, status: true,
    category: true, updatedAt: true
  } });
  if (!item) throw new ItemEngineeringError("NOT_FOUND", "Item was not found.");
  if (item.status !== "active") throw new ItemEngineeringError("ARCHIVED", "Restore the Item before changing engineering data.");
  const latest = await getLatestItemEngineeringRevision(parsed.itemId, tx);
  if ((latest?.id ?? null) !== parsed.expectedLatestRevisionId) {
    throw new ItemEngineeringError("REVISION_CONFLICT", "Item engineering data changed. Reload before saving again.");
  }
  if (parsed.profile.version !== 1) {
    const types = new Map((await getAttributeTypeRevisions(parsed.profile.entries.map(e => e.type.revisionId), tx)).map(t => [t.revisionId, t]));
    const oldEntries = latest ? projectItemProfileV3(latest.profile).entries : [];
    for (const entry of parsed.profile.entries) {
      const authoritative = types.get(entry.type.revisionId);
      if (!authoritative) throw new ItemEngineeringError("INTEGRITY", "Attribute type revision is unavailable.");
      const retained = oldEntries.some(old => old.id === entry.id && old.type.revisionId === entry.type.revisionId);
      if (!retained && (authoritative.status !== "active" || authoritative.currentRevision !== authoritative.revisionNumber))
        throw new ItemEngineeringError("VALIDATION", "New specifications require an active current type revision.");
      const snapshot = attributeTypeSnapshotSchema.parse({
        typeId: authoritative.typeId, revisionId: authoritative.revisionId, revisionNumber: authoritative.revisionNumber,
        analysisKey: authoritative.analysisKey, definition: authoritative.definition
      });
      if (hashItemEngineeringContent(snapshot) !== hashItemEngineeringContent(entry.type)) {
        throw new ItemEngineeringError("INTEGRITY", "Attribute definition snapshots must match their exact library revision.");
      }
    }
  }
  const identity = itemEngineeringRevisionSchema.shape.identity.parse({
    itemKey: item.itemKey, displayName: item.displayName, manufacturer: item.manufacturer,
    model: item.model, partNumber: item.partNumber
  });
  const notes = await tx.bomItemEngineerNote.findMany({ where: {
    id: { in: parsed.noteIds }, itemId: parsed.itemId
  } });
  const documents = await tx.bomItemDocument.findMany({ where: {
    id: { in: parsed.documentIds }, itemId: parsed.itemId
  } });
  if (notes.length !== parsed.noteIds.length || documents.length !== parsed.documentIds.length ||
      notes.some(note => note.archivedAt && !latest?.noteIds.includes(note.id)) ||
      documents.some(doc => doc.archivedAt && !latest?.documentIds.includes(doc.id))) {
    throw new ItemEngineeringError("INVALID_GUIDANCE", "Guidance must belong to this Item; newly linked guidance must be active.");
  }
  for (const note of notes) {
    const actual = hashItemEngineeringContent({ notes: note.notes, imageFileName: note.imageFileName,
      imageMimeType: note.imageMimeType, imageSizeBytes: note.imageSizeBytes, imageDataUrl: note.imageDataUrl });
    if (actual !== note.contentHash) throw new ItemEngineeringError("INTEGRITY", "Item note content does not match its hash.");
  }
  const hashedDocuments = [];
  for (const doc of documents) {
    const contentHash = hashItemDocumentContent(doc);
    if (doc.contentHash && doc.contentHash !== contentHash) {
      throw new ItemEngineeringError("INTEGRITY", "Item document content does not match its hash.");
    }
    if (!doc.contentHash) {
      // Preserve existing document timestamps and content while establishing its first immutable reference.
      await tx.$executeRaw`UPDATE "BomItemDocument" SET "contentHash" = ${contentHash} WHERE "id" = ${doc.id} AND "contentHash" IS NULL`;
    }
    hashedDocuments.push({ id: doc.id, contentHash });
  }
  if (parsed.profile.version === 3) validateProfileEvidence(parsed.profile, { notes, documents: hashedDocuments });
  const contentHash = hashItemRevision({ identity, profile: parsed.profile, notes, documents: hashedDocuments });
  // Catalogue grouping is a projection of the engineer's selected Device Type,
  // not an independently editable classification. Reconcile only on an explicit
  // successful engineering mutation; historical revisions remain untouched.
  if (item.category !== parsed.profile.deviceType) {
    const mirrored = await tx.bomItem.updateMany({
      where: { id: parsed.itemId, status: "active", category: item.category },
      data: { category: parsed.profile.deviceType,
        updatedAt: new Date(Math.max(Date.now(), item.updatedAt.getTime() + 1)) }
    });
    if (mirrored.count !== 1) throw new ItemEngineeringError("REVISION_CONFLICT", "Item changed. Review and retry.");
  }
  if (latest?.contentHash === contentHash) return { revision: latest, created: false };
  const row = await tx.bomItemEngineeringRevision.create({ data: {
    itemId: parsed.itemId, revisionNumber: (latest?.revisionNumber ?? 0) + 1,
    identityJson: JSON.stringify(identity), profileJson: JSON.stringify(parsed.profile), contentHash
  }, select: { id: true } });
  if (notes.length) await tx.bomItemRevisionNote.createMany({ data: notes.map(note => ({
    itemId: parsed.itemId, revisionId: row.id, noteId: note.id
  })) });
  if (documents.length) await tx.bomItemRevisionDocument.createMany({ data: documents.map(doc => ({
    itemId: parsed.itemId, revisionId: row.id, documentId: doc.id
  })) });
  const saved = await tx.bomItemEngineeringRevision.findUniqueOrThrow({ where: { id: row.id }, select: itemRevisionSelect });
  return { revision: projectItemEngineeringRevision(saved), created: true };
}

export async function createItemEngineeringRevision(input: unknown, db: PrismaClient = prisma) {
  try {
    return await db.$transaction(tx => createItemEngineeringRevisionInTransaction(input, tx));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034", "P1008"].includes(error.code)) {
      throw new ItemEngineeringError("REVISION_CONFLICT", "Item engineering data changed or is busy. Reload before saving again.");
    }
    throw error;
  }
}

export async function synchronizeItemEngineeringIdentity(
  itemId: string, expectedLatestRevisionId: string | null | undefined, tx: Prisma.TransactionClient
) {
  const latest = await getLatestItemEngineeringRevision(itemId, tx);
  if (!latest) return; // Legacy commercial edits do not invent an electrical classification/profile.
  const item = await tx.bomItem.findUniqueOrThrow({ where: { id: itemId }, select: {
    itemKey: true, displayName: true, manufacturer: true, model: true, partNumber: true
  } });
  if (hashItemEngineeringContent(itemEngineeringRevisionSchema.shape.identity.parse(item)) === hashItemEngineeringContent(latest.identity)) return;
  if (expectedLatestRevisionId !== latest.id) {
    throw new ItemEngineeringError("REVISION_CONFLICT", "Item engineering data changed. Reload before changing product identity.");
  }
  await createItemEngineeringRevisionInTransaction({ itemId, expectedLatestRevisionId,
    profile: latest.profile, noteIds: latest.noteIds, documentIds: latest.documentIds }, tx);
}

export async function synchronizeItemGuidance(input: {
  itemId: string; expectedLatestRevisionId: string | null | undefined;
  addNoteId?: string; removeNoteId?: string; addDocumentId?: string; removeDocumentId?: string;
}, tx: Prisma.TransactionClient) {
  const latest = await getLatestItemEngineeringRevision(input.itemId, tx);
  if (!latest) {
    if (input.expectedLatestRevisionId) throw new ItemEngineeringError("REVISION_CONFLICT", "Item revision is no longer current.");
    return null; // Notes/documents may be authored before the first classified profile.
  }
  if (latest.id !== input.expectedLatestRevisionId) {
    throw new ItemEngineeringError("REVISION_CONFLICT", "Item guidance changed. Reload before saving again.");
  }
  // Archiving/replacing a source does not change the evidence behind existing facts.
  const retained = latest.profile.version === 3 ? profileEvidence(latest.profile) : [];
  const replace = (ids: string[], kind: "note" | "document", remove?: string, add?: string) =>
    [...new Set([...ids.filter(id => id !== remove || retained.some(e => e.kind === kind && e.id === id)), ...(add ? [add] : [])])];
  return (await createItemEngineeringRevisionInTransaction({
    itemId: input.itemId, expectedLatestRevisionId: latest.id, profile: latest.profile,
    noteIds: replace(latest.noteIds, "note", input.removeNoteId, input.addNoteId),
    documentIds: replace(latest.documentIds, "document", input.removeDocumentId, input.addDocumentId)
  }, tx)).revision;
}
