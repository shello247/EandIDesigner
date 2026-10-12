import { describe, expect, it } from "vitest";
import { calculateCoverage, evidenceFreshness } from "../logic/services/standards-coverage";
import { getStandardsContext } from "../data/context";
import { listContent } from "../data/queries";
import { seedStandards } from "../data/seeds";
import { testDatabase } from "./test-database";
import type { Evidence } from "../types";
describe("honest profile coverage", () => {
  it("never gives an empty profile a complete result", () => {
    const coverage = calculateCoverage([]);
    expect(coverage.empty).toBe(true);
    expect(coverage.gaps).not.toHaveLength(0);
    expect(coverage).not.toHaveProperty("compliant");
  });
  it("keeps candidate source, missing implementation and unresolved applicability visible", async () => {
    const db = await testDatabase();
    try {
      await seedStandards(db);
      const profile = (await listContent({ kind: "profile" }, db)).rows[0];
      const context = await getStandardsContext(profile.revisionId, db, "test-build");
      expect(context.coverage).toMatchObject({ total: 6, candidates: 6, unresolved: 6, evidenceMissing: 6, implemented: 0 });
      const row = context.rows[0];
      const evidence: Evidence = { id: "e", requirementRevisionId: row.trace.requirement.id, sourceRevisionId: row.trace.source.id, implementationRevisionId: null, type: "test_report", description: "Declared check", result: "fail", artifactReference: "report", buildId: "test-build", producer: "Engineer", recordedAt: new Date().toISOString(), createdAt: new Date().toISOString(), contentHash: "hash", provenance: "declared", notes: "" };
      expect(evidenceFreshness(evidence, row.trace, null, "test-build").stale).toBe(false);
      expect(evidenceFreshness(evidence, row.trace, null, "new-build").reasons).toContain("Application build changed");
      const excluded = { ...row, entry: { ...row.entry, applicability: "excluded" as const, rationale: "Outside this scope" }, evidence: [evidenceFreshness(evidence, row.trace, null, "test-build")] };
      expect(calculateCoverage([excluded])).toMatchObject({ excluded: 1, failedEvidence: 1, evidenceRecorded: 1, sourceChecked: 0 });
      expect(evidenceFreshness({ ...evidence, requirementRevisionId: "old", sourceRevisionId: "old", implementationRevisionId: "old" }, row.trace, null, "test-build").reasons).toHaveLength(3);
    } finally { await db.$disconnect(); }
  });
});

