import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { idSchema, listInputSchema, payloadSchemas, type EntityKind } from "./schema";
import type { Evidence, ReviewNote, Revision, Snapshot, Summary, Trace } from "../types";
import { contentHash } from "../logic/services/standards-hash";
import { StandardsError } from "../logic/services/standards-errors";
export type Db = Prisma.TransactionClient;
export const tables = { reference: "StandardReference", requirement: "StandardRequirement", implementation: "StandardImplementation", profile: "StandardProfile" } as const;
export const iso = (date: Date | string | number) => new Date(date).toISOString();
type StoredRevision = { id: string; entityId: string; revisionNumber: number; payloadJson: string; contentHash: string; createdAt: Date };
export function projectRevision<K extends EntityKind>(kind: K, row: StoredRevision): Revision<K> {
  const content = payloadSchemas[kind].parse(JSON.parse(row.payloadJson));
  if (contentHash(content) !== row.contentHash) throw new StandardsError("integrity", "Stored standards content failed its integrity check.");
  return { id: row.id, entityId: row.entityId, number: Number(row.revisionNumber), content, hash: row.contentHash, createdAt: iso(row.createdAt) } as Revision<K>;
}
export async function getRevision<K extends EntityKind>(kind: K, revisionId: string, db: Db = prisma): Promise<Revision<K>> {
  const [row] = await db.$queryRawUnsafe<StoredRevision[]>('SELECT * FROM "' + tables[kind] + 'Revision" WHERE id = ?', idSchema.parse(revisionId));
  if (!row) throw new StandardsError("not_found", "The requested standards revision was not found.");
  return projectRevision(kind, row);
}
export async function getCurrent<K extends EntityKind>(kind: K, entityId: string, db: Db = prisma): Promise<Revision<K> | null> {
  const [row] = await db.$queryRawUnsafe<StoredRevision[]>('SELECT r.* FROM "' + tables[kind] + 'Revision" r JOIN "' + tables[kind] + '" e ON e.id=r.entityId AND e.currentRevisionNumber=r.revisionNumber WHERE e.id=?', idSchema.parse(entityId));
  return row ? projectRevision(kind, row) : null;
}
export async function listContent(input: unknown, db: Db = prisma) {
  const parsed = listInputSchema.parse(input), table = tables[parsed.kind], pageSize = 20;
  const where = " WHERE (?='all' OR e.status=?) AND instr(lower(e.title || ' ' || e.key), lower(?)) > 0";
  const args = [parsed.status, parsed.status, parsed.query];
  const [counts, rows] = await Promise.all([
    db.$queryRawUnsafe<Array<{ total: number }>>('SELECT COUNT(*) as total FROM "' + table + '" e' + where, ...args),
    db.$queryRawUnsafe<Array<{ id: string; title: string; key: string; status: string; currentRevisionNumber: number; updatedAt: Date; revisionId: string; payloadJson: string }>>('SELECT e.*, r.id as revisionId, r.payloadJson FROM "' + table + '" e JOIN "' + table + 'Revision" r ON r.entityId=e.id AND r.revisionNumber=e.currentRevisionNumber' + where + " ORDER BY e.title COLLATE NOCASE, e.id LIMIT ? OFFSET ?", ...args, pageSize, (parsed.page - 1) * pageSize)
  ]);
  return { total: Number(counts[0].total), page: parsed.page, pageSize, rows: rows.map(row => ({ id: row.id, title: row.title, key: row.key, referenceLabel: parsed.kind === "reference" ? [JSON.parse(row.payloadJson).designation, JSON.parse(row.payloadJson).edition, JSON.parse(row.payloadJson).amendment].filter(Boolean).join(" · ") : row.key, status: row.status, kind: parsed.kind, contentStatus: parsed.kind === "requirement" ? JSON.parse(row.payloadJson).sourceStatus : parsed.kind === "implementation" ? JSON.parse(row.payloadJson).implementationStatus : undefined, revisionId: row.revisionId, revision: Number(row.currentRevisionNumber), updatedAt: iso(row.updatedAt) } satisfies Summary)) };
}
export async function getHistory(kind: EntityKind, entityId: string, page = 1, db: Db = prisma) {
  const validPage = listInputSchema.parse({ kind, page }).page;
  const rows = await db.$queryRawUnsafe<StoredRevision[]>('SELECT * FROM "' + tables[kind] + 'Revision" WHERE entityId=? ORDER BY revisionNumber DESC LIMIT 20 OFFSET ?', idSchema.parse(entityId), (validPage - 1) * 20);
  return rows.map(row => projectRevision(kind, row));
}
export async function getReviews(targetKind: string, targetRevisionId: string, db: Db = prisma): Promise<ReviewNote[]> {
  const rows = await db.standardReviewNote.findMany({ where: { targetKind, targetRevisionId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
  return rows.map(row => ({ ...JSON.parse(row.payloadJson), id: row.id, createdAt: iso(row.createdAt), identity: "self_declared" }));
}
export async function getRequirementTrace(requirementRevisionId: string, db: Db = prisma): Promise<Trace> {
  const requirement = await getRevision("requirement", requirementRevisionId, db);
  const [source, implementations, evidenceRows, reviews, currentRequirement] = await Promise.all([
    getRevision("reference", requirement.content.sourceRevisionId, db),
    db.standardImplementationRevision.findMany({ where: { requirementRevisionId }, orderBy: { revisionNumber: "desc" }, take: 100 }),
    db.standardEvidence.findMany({ where: { requirement: { entityId: requirement.entityId } }, orderBy: { createdAt: "desc" } }),
    getReviews("requirement", requirementRevisionId, db), getCurrent("requirement", requirement.entityId, db)
  ]);
  const currentSource = await getCurrent("reference", source.entityId, db);
  const evidence: Evidence[] = evidenceRows.map(row => ({ ...JSON.parse(row.payloadJson), id: row.id, sourceRevisionId: row.sourceRevisionId, createdAt: iso(row.createdAt), contentHash: row.contentHash, provenance: "declared" }));
  return { requirement, source, implementations: implementations.map(row => projectRevision("implementation", row)), evidence, reviews, sourceCurrentRevisionId: currentSource!.id, requirementCurrentRevisionId: currentRequirement!.id };
}
export async function listSnapshots(profileId: string, page = 1, db: Db = prisma) {
  const validPage = listInputSchema.parse({ kind: "profile", page }).page;
  const where = { profile: { entityId: idSchema.parse(profileId) } };
  const [total, rows] = await Promise.all([db.standardSnapshot.count({ where }), db.standardSnapshot.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 20, skip: (validPage - 1) * 20, select: { id: true, createdAt: true, contentHash: true, profileRevisionId: true } })]);
  return { total, page: validPage, rows: rows.map(row => ({ ...row, createdAt: iso(row.createdAt) })) };
}
export async function getSnapshot(snapshotId: string, db: Db = prisma): Promise<Snapshot> {
  const row = await db.standardSnapshot.findUnique({ where: { id: idSchema.parse(snapshotId) } });
  if (!row) throw new StandardsError("not_found", "Report snapshot was not found.");
  const snapshot = JSON.parse(row.payloadJson) as Snapshot;
  if (contentHash(snapshot) !== row.contentHash) throw new StandardsError("integrity", "Report snapshot failed its integrity check.");
  return snapshot;
}

