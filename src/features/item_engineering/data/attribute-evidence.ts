import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getItemEngineeringRevision, getLatestItemEngineeringRevision } from "./queries";
import { hashItemDocumentContent, ItemEngineeringError } from "../logic/services/item-engineering-revision";

export async function loadAttributeEvidence(input: unknown, db: Prisma.TransactionClient = prisma) {
  const request = z.strictObject({ itemId: z.string().min(1), revisionId: z.string().min(1).optional(),
    kind: z.enum(["document", "note"]).optional(), id: z.string().min(1).optional() }).parse(input);
  const item = await db.bomItem.findUnique({ where: { id: request.itemId }, select: { id: true } });
  if (!item) throw new ItemEngineeringError("NOT_FOUND", "Item was not found.");
  const revision = request.revisionId ? await getItemEngineeringRevision(request.revisionId, db) : await getLatestItemEngineeringRevision(request.itemId, db);
  if (request.revisionId && (!revision || revision.itemId !== request.itemId)) throw new ItemEngineeringError("INVALID_GUIDANCE", "The revision does not belong to this Item.");
  const [documents, notes] = await Promise.all([
    db.bomItemDocument.findMany({ where: { itemId: request.itemId,
      ...(request.revisionId ? { id: { in: revision!.documentIds } } : { OR: [{ archivedAt: null }, { id: { in: revision?.documentIds ?? [] } }] }) },
      select: { id: true, title: true, fileName: true, contentHash: true, archivedAt: true } }),
    db.bomItemEngineerNote.findMany({ where: { itemId: request.itemId,
      ...(request.revisionId ? { id: { in: revision!.noteIds } } : { OR: [{ archivedAt: null }, { id: { in: revision?.noteIds ?? [] } }] }) },
      select: { id: true, contentHash: true, createdAt: true, archivedAt: true } })
  ]);
  const sources = [
    ...documents.map(doc => ({ kind: "document" as const, id: doc.id, label: doc.title || doc.fileName, contentHash: doc.contentHash,
      archived: !!doc.archivedAt, href: `/api/bom/items/documents/${encodeURIComponent(doc.id)}` })),
    ...notes.map(note => ({ kind: "note" as const, id: note.id, label: `Engineer note · ${note.createdAt.toISOString().slice(0,10)}`, contentHash: note.contentHash,
      archived: !!note.archivedAt, href: `/bom/items/${encodeURIComponent(request.itemId)}/notes/${encodeURIComponent(note.id)}` }))
  ];
  if (request.id || request.kind) {
    const source = sources.find(s => s.kind === request.kind && s.id === request.id);
    if (!source) throw new ItemEngineeringError("INVALID_GUIDANCE", "Source does not belong to this Item or retained revision.");
    // Only a selected, previously unreferenced document needs its payload read to establish identity.
    if (source.kind === "document" && !source.contentHash) {
      const document = await db.bomItemDocument.findUniqueOrThrow({ where: { id: source.id } });
      source.contentHash = hashItemDocumentContent(document);
    }
    return { sources: [source] };
  }
  return { sources };
}
