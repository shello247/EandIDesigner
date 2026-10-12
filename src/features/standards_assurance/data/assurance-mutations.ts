import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { evidenceSchema, reviewSchema, snapshotInputSchema, localReviewNotice, provenanceNotice } from "./schema";
import { operation } from "./mutations";
import { getCurrent, getRevision, iso } from "./queries";
import { getStandardsContext } from "./context";
import { StandardsError } from "../logic/services/standards-errors";
import { contentHash, stableJson } from "../logic/services/standards-hash";
import { standardsBuildId } from "../logic/services/standards-build";
import type { Evidence, ReviewNote, Snapshot } from "../types";
export async function recordEvidence(input: unknown, db: PrismaClient = prisma): Promise<Evidence> {
  const parsed = evidenceSchema.parse(input);
  return operation(parsed.operationId, parsed, "record_evidence", async tx => {
    const requirement = await getRevision("requirement", parsed.requirementRevisionId, tx);
    if (parsed.implementationRevisionId) {
      const implementation = await getRevision("implementation", parsed.implementationRevisionId, tx);
      if (implementation.content.requirementRevisionId !== requirement.id) throw new StandardsError("inconsistent_reference", "Evidence implementation must address the selected requirement revision.");
    }
    const { operationId: _operationId, ...data } = parsed;
    void _operationId;
    const payload = { ...data, provenance: "declared" as const };
    const row = await tx.standardEvidence.create({ data: { id: randomUUID(), requirementRevisionId: requirement.id, implementationRevisionId: parsed.implementationRevisionId, sourceRevisionId: requirement.content.sourceRevisionId, payloadJson: stableJson(payload), contentHash: contentHash(payload) } });
    return { ...payload, id: row.id, sourceRevisionId: row.sourceRevisionId, contentHash: row.contentHash, createdAt: iso(row.createdAt) };
  }, db);
}
export async function recordLocalReview(input: unknown, db: PrismaClient = prisma): Promise<ReviewNote> {
  const parsed = reviewSchema.parse(input);
  return operation(parsed.operationId, parsed, "record_review", async tx => {
    const target = await getRevision(parsed.targetKind, parsed.targetRevisionId, tx);
    let requirementIds: string[];
    if (parsed.targetKind === "requirement") requirementIds = [target.id];
    else if (parsed.targetKind === "implementation") requirementIds = [(await getRevision("implementation", target.id, tx)).content.requirementRevisionId];
    else requirementIds = (await getRevision("profile", target.id, tx)).content.entries.map(e => e.requirementRevisionId);
    const evidence = await tx.standardEvidence.findMany({ where: { id: { in: parsed.evidenceIds } } });
    if (new Set(parsed.evidenceIds).size !== parsed.evidenceIds.length || evidence.length !== parsed.evidenceIds.length || evidence.some(e => !requirementIds.includes(e.requirementRevisionId))) throw new StandardsError("inconsistent_reference", "Reviewed evidence must belong to the exact target requirement revisions.");
    const { operationId: _operationId, ...data } = parsed;
    void _operationId;
    const payload = { ...data, identity: "self_declared" as const };
    const row = await tx.standardReviewNote.create({ data: { id: randomUUID(), targetKind: parsed.targetKind, targetRevisionId: parsed.targetRevisionId, payloadJson: stableJson(payload) } });
    return { ...payload, id: row.id, createdAt: iso(row.createdAt) };
  }, db);
}
export async function createReportSnapshot(input: unknown, db: PrismaClient = prisma, buildId = standardsBuildId()) {
  const parsed = snapshotInputSchema.parse(input);
  return operation(parsed.operationId, parsed, "snapshot", async tx => {
    const profile = await getRevision("profile", parsed.profileRevisionId, tx);
    const current = await getCurrent("profile", profile.entityId, tx);
    if (current?.id !== parsed.expectedCurrentRevisionId || profile.id !== current.id) throw new StandardsError("conflict", "The profile changed. Reopen it before creating a new snapshot.", current?.id);
    const context = await getStandardsContext(profile.id, tx, buildId);
    if (context.assessmentHash !== parsed.expectedAssessmentHash) throw new StandardsError("conflict", "Evidence, review or application state changed. Refresh the profile and review the current assessment before freezing it.", current.id);
    const id = randomUUID(), createdAt = new Date();
    const snapshot: Snapshot = {
      schemaVersion: 1, id, createdAt: createdAt.toISOString(), context, localReviewNotice, provenanceNotice,
      notices: [
        "Scoped documentation and implementation evidence. This report is not IEC certification or authenticated engineering sign-off.",
        "Sources and candidate requirements require authoritative technical review. All exclusions and unresolved findings remain visible.",
        "A content digest supports integrity comparison; it is not a digital signature.",
        "Source references do not grant permission to reproduce standards. This dossier contains recorded summaries and metadata only."
      ]
    };
    const hash = contentHash(snapshot);
    await tx.standardSnapshot.create({ data: { id, profileRevisionId: profile.id, payloadJson: stableJson(snapshot), contentHash: hash, createdAt } });
    return { id, profileRevisionId: profile.id, createdAt: createdAt.toISOString(), contentHash: hash };
  }, db);
}
