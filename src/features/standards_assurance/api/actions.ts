"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { entityKindSchema, idSchema } from "../data/schema";
import { getCurrent, getHistory, getRequirementTrace, getRevision, getReviews, listContent, listSnapshots } from "../data/queries";
import { getStandardsContext } from "../data/context";
import { saveContent } from "../data/mutations";
import { createReportSnapshot, recordEvidence, recordLocalReview } from "../data/assurance-mutations";
import { seedStandards } from "../data/seeds";
import { getDashboard } from "../data/dashboard";
import { StandardsError } from "../logic/services/standards-errors";
import type { ActionResult } from "../types";
async function result<T>(run: () => Promise<T>, mutation = false): Promise<ActionResult<T>> {
  try {
    const data = await run();
    if (mutation) revalidatePath("/standards", "layout");
    return { ok: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of error.issues) (fieldErrors[issue.path.join(".")] ??= []).push(issue.message);
      return { ok: false, code: "validation", error: error.issues.map(i => i.message).join(" "), fieldErrors };
    }
    if (error instanceof StandardsError) return { ok: false, code: error.code, error: error.message, latestRevisionId: error.latestRevisionId };
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2021", "P2022"].includes(error.code)) return { ok: false, code: "storage_unavailable", error: "Standards storage is not ready. Run the guarded Standards & Assurance upgrade, then retry." };
    const correlationId = randomUUID();
    console.error("Standards request failed", correlationId, error instanceof Prisma.PrismaClientKnownRequestError ? error.code : "unexpected");
    return { ok: false, code: "unavailable", error: "The request could not be completed. Your draft is retained. Retry or report reference " + correlationId + "." };
  }
}
export async function listStandardsAction(input: unknown) { return result(() => listContent(input)); }
export async function getStandardsDashboardAction() { return result(() => getDashboard()); }
export async function getStandardsDetailAction(input: unknown) {
  return result(async () => {
    const parsed = z.strictObject({ kind: entityKindSchema, entityId: idSchema, revisionId: idSchema.optional(), historyPage: z.number().int().min(1).default(1) }).parse(input);
    const current = await getCurrent(parsed.kind, parsed.entityId);
    if (!current) throw new StandardsError("not_found", "The record was not found.");
    const revision = parsed.revisionId ? await getRevision(parsed.kind, parsed.revisionId) : current;
    if (revision.entityId !== parsed.entityId) throw new StandardsError("inconsistent_reference", "The revision does not belong to this record.");
    const [history, reviews] = await Promise.all([getHistory(parsed.kind, parsed.entityId, parsed.historyPage), getReviews(parsed.kind, revision.id)]);
    return { revision, current, history, reviews };
  });
}
export async function getRequirementAction(revisionId: unknown) { return result(() => getRequirementTrace(idSchema.parse(revisionId))); }
export async function getStandardsRevisionAction(input: unknown) {
  return result(() => {
    const parsed = z.strictObject({ kind: entityKindSchema, revisionId: idSchema }).parse(input);
    return getRevision(parsed.kind, parsed.revisionId);
  });
}
export async function getProfileAction(revisionId: unknown) { return result(() => getStandardsContext(idSchema.parse(revisionId))); }
export async function listStandardsSnapshotsAction(input: unknown) {
  return result(() => {
    const parsed = z.strictObject({ profileId: idSchema, page: z.number().int().min(1).default(1) }).parse(input);
    return listSnapshots(parsed.profileId, parsed.page);
  });
}
export async function saveStandardsContentAction(input: unknown) { return result(() => saveContent(input), true); }
export async function recordStandardsEvidenceAction(input: unknown) { return result(() => recordEvidence(input), true); }
export async function recordStandardsReviewAction(input: unknown) { return result(() => recordLocalReview(input), true); }
export async function createStandardsSnapshotAction(input: unknown) { return result(() => createReportSnapshot(input), true); }
export async function seedStandardsAction() { return result(() => seedStandards(), true); }
