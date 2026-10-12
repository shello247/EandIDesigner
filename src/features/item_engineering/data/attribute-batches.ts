import { z } from "zod";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAttributeTypeRevisions } from "@/features/engineering_attributes/api/server";
import { itemAttributeBatchSchema } from "./attribute-batch-schema";
import { getLatestItemEngineeringRevision } from "./queries";
import { projectItemProfileV3 } from "../logic/services/profile-v3-adapter";
import { applyAttributeBatch } from "../logic/services/attribute-batch-validation";
import { profileEvidence, validateProfileEvidence } from "../logic/services/attribute-evidence";
import { createItemEngineeringRevisionInTransaction } from "./mutations";
import { hashItemDocumentContent, hashItemEngineeringContent, ItemEngineeringError } from "../logic/services/item-engineering-revision";

export async function loadSpecificationWorkspace(itemId: string, db: Prisma.TransactionClient = prisma) {
  const item = await db.bomItem.findUnique({ where: { id: z.string().min(1).parse(itemId) }, select: { displayName: true, status: true } });
  if (!item) throw new ItemEngineeringError("NOT_FOUND", "Item was not found.");
  const revision = await getLatestItemEngineeringRevision(itemId, db);
  return { itemName: item.displayName, status: item.status, revisionId: revision?.id ?? null, revisionNumber: revision?.revisionNumber ?? null,
    updatedAt: revision?.createdAt ?? null, profile: projectItemProfileV3(revision?.profile ?? null) };
}

async function prepare(input: unknown, tx: Prisma.TransactionClient) {
  const batch = itemAttributeBatchSchema.parse(input);
  const workspace = await loadSpecificationWorkspace(batch.itemId, tx);
  if (workspace.status !== "active") throw new ItemEngineeringError("ARCHIVED", "Archived Items are read-only.");
  if (workspace.revisionId !== batch.expectedLatestRevisionId) throw new ItemEngineeringError("REVISION_CONFLICT", "Saved specifications changed. Review the comparison; your draft has been retained.");
  const types = await getAttributeTypeRevisions([...batch.additions,...batch.updates].map(row => row.typeRevisionId), tx);
  for (const row of [...batch.additions,...batch.updates]) {
    const type = types.find(t => t.revisionId === row.typeRevisionId);
    const retained = workspace.profile.entries.find(e => e.id === row.id)?.type.revisionId === row.typeRevisionId;
    if (type && !retained && type.currentRevision !== type.revisionNumber) throw new z.ZodError([{ code: "custom", path: ["rows",row.id,"type"], message: "This attribute type has a newer revision. Select its current version." }]);
  }
  const proposed = applyAttributeBatch(workspace.profile, batch, types);
  const latest = await getLatestItemEngineeringRevision(batch.itemId, tx);
  const references = profileEvidence(proposed.profile);
  const [notes, documents] = await Promise.all([
    tx.bomItemEngineerNote.findMany({ where: { itemId: batch.itemId, OR: [{ archivedAt: null }, { id: { in: latest?.noteIds ?? [] } }] }, select: { id: true, contentHash: true } }),
    tx.bomItemDocument.findMany({ where: { itemId: batch.itemId, OR: [{ archivedAt: null }, { id: { in: latest?.documentIds ?? [] } }] }, select: { id: true, contentHash: true } })
  ]);
  const selectedDocuments = [];
  for (const doc of documents) {
    if (doc.contentHash) selectedDocuments.push({ id: doc.id, contentHash: doc.contentHash });
    else if (references.some(ref => ref.kind === "document" && ref.id === doc.id)) {
      const full = await tx.bomItemDocument.findUniqueOrThrow({ where: { id: doc.id } });
      selectedDocuments.push({ id: doc.id, contentHash: hashItemDocumentContent(full) });
    }
  }
  validateProfileEvidence(proposed.profile, { notes, documents: selectedDocuments });
  const referenceIds = (kind: "document" | "note") => references.filter(ref => ref.kind === kind).map(ref => "id" in ref ? ref.id : "");
  const noteIds = [...new Set([...(latest?.noteIds ?? notes.map(n => n.id)), ...referenceIds("note")])];
  const documentIds = [...new Set([...(latest?.documentIds ?? documents.map(d => d.id)), ...referenceIds("document")])];
  return { batch, proposed, noteIds, documentIds, unchanged: workspace.revisionId !== null && hashItemEngineeringContent(workspace.profile) === hashItemEngineeringContent(proposed.profile) };
}
export async function previewItemAttributeBatch(input: unknown, db: PrismaClient = prisma) {
  return db.$transaction(async tx => { const { proposed } = await prepare(input, tx); return { valid: true as const, ...proposed }; }, { timeout: 20000 });
}
export async function saveItemAttributeBatch(input: unknown, db: PrismaClient = prisma) {
  return db.$transaction(async tx => {
    const { batch, proposed, noteIds, documentIds, unchanged } = await prepare(input, tx);
    if (unchanged) return { ...await loadSpecificationWorkspace(batch.itemId, tx), created: false, warnings: proposed.warnings, summary: proposed.summary };
    const result = await createItemEngineeringRevisionInTransaction({ itemId: batch.itemId, expectedLatestRevisionId: batch.expectedLatestRevisionId,
      profile: proposed.profile, noteIds, documentIds }, tx);
    return { ...await loadSpecificationWorkspace(batch.itemId, tx), created: result.created, warnings: proposed.warnings, summary: proposed.summary };
  }, { timeout: 20000 });
}
