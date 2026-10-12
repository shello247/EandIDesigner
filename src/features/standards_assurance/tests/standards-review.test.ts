import { getStandardsContext } from "../data/context";
import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { testDatabase } from "./test-database";
import { seedStandards } from "../data/seeds";
import { saveContent } from "../data/mutations";
import { getRevision, getSnapshot, listContent } from "../data/queries";
import { recordEvidence, recordLocalReview, createReportSnapshot } from "../data/assurance-mutations";
describe("declared evidence, local reviews and snapshots", () => {
  it("preserves incomplete snapshot content after later edits and replays operations", async () => {
    const db = await testDatabase();
    try {
      await seedStandards(db);
      const requirement = (await listContent({ kind: "requirement" }, db)).rows[0];
      const evidence = await recordEvidence({ operationId: randomUUID(), requirementRevisionId: requirement.revisionId, implementationRevisionId: null, type: "manual_check", description: "Examined UI example", result: "inconclusive", artifactReference: "/standards", buildId: "", producer: "Declared author", recordedAt: new Date().toISOString(), notes: "Authoritative source unavailable" }, db);
      expect(evidence.provenance).toBe("declared");
      const review = await recordLocalReview({ operationId: randomUUID(), targetKind: "requirement", targetRevisionId: requirement.revisionId, reviewer: "Engineer", reviewedAt: new Date().toISOString(), outcome: "changes_requested", comments: "Resolve source access", evidenceIds: [evidence.id] }, db);
      expect(review.identity).toBe("self_declared");
      const profile = (await listContent({ kind: "profile" }, db)).rows[0];
      const input = { operationId: randomUUID(), profileRevisionId: profile.revisionId, expectedCurrentRevisionId: profile.revisionId, expectedAssessmentHash: (await getStandardsContext(profile.revisionId, db, "build-1")).assessmentHash };
      const saved = await createReportSnapshot(input, db, "build-1");
      expect((await createReportSnapshot(input, db, "build-1")).id).toBe(saved.id);
      expect((await createReportSnapshot(input, db, "build-2")).id).toBe(saved.id);
      const original = await getSnapshot(saved.id, db);
      await expect(createReportSnapshot({ ...input, operationId: randomUUID(), expectedAssessmentHash: "b".repeat(64) }, db, "build-1")).rejects.toMatchObject({ code: "conflict" });
      expect(original.context.coverage).toMatchObject({ candidates: 6, unresolved: 6, changesRequested: 1 });
      const revision = await getRevision("requirement", requirement.revisionId, db);
      await saveContent({ kind: "requirement", entityId: revision.entityId, expectedRevisionId: revision.id, operationId: randomUUID(), content: { ...revision.content, status: "retired" } }, db);
      expect(await getSnapshot(saved.id, db)).toEqual(original);
      await expect(db.standardSnapshot.update({ where: { id: saved.id }, data: { payloadJson: "{}" } })).rejects.toThrow();
      await expect(db.standardRequirementRevision.delete({ where: { id: revision.id } })).rejects.toThrow();
    } finally { await db.$disconnect(); }
  });
  it("refuses evidence from an unrelated requirement and stale profile snapshot requests", async () => {
    const db = await testDatabase();
    try {
      await seedStandards(db);
      const requirements = (await listContent({ kind: "requirement" }, db)).rows;
      const evidence = await recordEvidence({ operationId: randomUUID(), requirementRevisionId: requirements[0].revisionId, implementationRevisionId: null, type: "example", description: "Example", result: "pass", artifactReference: "Example 1", buildId: "", producer: "Engineer", recordedAt: new Date().toISOString(), notes: "" }, db);
      await expect(recordLocalReview({ operationId: randomUUID(), targetKind: "requirement", targetRevisionId: requirements[1].revisionId, reviewer: "Engineer", reviewedAt: new Date().toISOString(), outcome: "review_recorded", comments: "Review", evidenceIds: [evidence.id] }, db)).rejects.toMatchObject({ code: "inconsistent_reference" });
      const profile = (await listContent({ kind: "profile" }, db)).rows[0];
      await expect(createReportSnapshot({ operationId: randomUUID(), profileRevisionId: profile.revisionId, expectedCurrentRevisionId: "stale", expectedAssessmentHash: "a".repeat(64) }, db, "build")).rejects.toMatchObject({ code: "conflict" });
      expect(await db.standardReviewNote.count()).toBe(0);
    } finally { await db.$disconnect(); }
  });
});
