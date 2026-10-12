import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { itemEngineeringRevisionSchema } from "./schema";
import { hashItemRevision, ItemEngineeringError } from "../logic/services/item-engineering-revision";

export const itemRevisionSelect = {
  id: true, itemId: true, revisionNumber: true, identityJson: true, profileJson: true,
  contentHash: true, createdAt: true,
  notes: { select: { note: { select: { id: true, contentHash: true } } } },
  documents: { select: { document: { select: { id: true, contentHash: true } } } }
} satisfies Prisma.BomItemEngineeringRevisionSelect;

type RevisionRow = Prisma.BomItemEngineeringRevisionGetPayload<{ select: typeof itemRevisionSelect }>;

export function projectItemEngineeringRevision(row: RevisionRow) {
  const revision = itemEngineeringRevisionSchema.parse({
    id: row.id, itemId: row.itemId, revisionNumber: row.revisionNumber,
    identity: JSON.parse(row.identityJson), profile: JSON.parse(row.profileJson),
    noteIds: row.notes.map(link => link.note.id).sort(),
    documentIds: row.documents.map(link => link.document.id).sort(),
    contentHash: row.contentHash, createdAt: row.createdAt.toISOString()
  });
  const documents = row.documents.map(({ document }) => {
    if (!document.contentHash) throw new ItemEngineeringError("INTEGRITY", "Historical document hash is missing.");
    return { id: document.id, contentHash: document.contentHash };
  });
  if (hashItemRevision({ ...revision, notes: row.notes.map(link => link.note), documents }) !== revision.contentHash) {
    throw new ItemEngineeringError("INTEGRITY", "Item revision content or guidance references have changed.");
  }
  return revision;
}

export async function getItemEngineeringRevision(id: string, db: Prisma.TransactionClient = prisma) {
  const row = await db.bomItemEngineeringRevision.findUnique({ where: { id }, select: itemRevisionSelect });
  return row ? projectItemEngineeringRevision(row) : null;
}

export async function getLatestItemEngineeringRevision(itemId: string, db: Prisma.TransactionClient = prisma) {
  const row = await db.bomItemEngineeringRevision.findFirst({ where: { itemId },
    orderBy: { revisionNumber: "desc" }, select: itemRevisionSelect });
  return row ? projectItemEngineeringRevision(row) : null;
}

// Exact batched lookups never fall back to the latest revision or load attachment bodies.
export async function getItemEngineeringRevisions(ids: readonly string[], db: Prisma.TransactionClient = prisma) {
  if (ids.length > 1000) throw new Error("At most 1000 exact Item revisions may be loaded per batch.");
  if (ids.length === 0) return [];
  const rows = await db.bomItemEngineeringRevision.findMany({ where: { id: { in: [...new Set(ids)] } },
    orderBy: { id: "asc" }, select: itemRevisionSelect });
  return rows.map(projectItemEngineeringRevision);
}
export async function listItemEngineeringHistory(itemId:string,page=1,db:Prisma.TransactionClient=prisma){
  const safePage=Math.max(1,Math.min(100000,Math.floor(page)||1));
  const [total,rows]=await Promise.all([db.bomItemEngineeringRevision.count({where:{itemId}}),db.bomItemEngineeringRevision.findMany({where:{itemId},orderBy:{revisionNumber:"desc"},skip:(safePage-1)*25,take:25,select:{id:true,revisionNumber:true,createdAt:true,contentHash:true}})]);
  return {page:safePage,total,rows:rows.map(r=>({...r,createdAt:r.createdAt.toISOString()}))};
}
