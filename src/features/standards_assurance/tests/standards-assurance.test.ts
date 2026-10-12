import { describe, expect, it } from "vitest";
import { evidenceSchema, profileEntrySchema, referenceSchema, requirementSchema, reviewSchema } from "../data/schema";
import { candidateSeeds, referenceSeeds } from "../data/standard-reference-seeds";
describe("standards contracts", () => {
  it("seeds bibliographic sources and candidate topics only", () => {
    expect(referenceSeeds).toHaveLength(5);
    for (const seed of referenceSeeds) expect(referenceSchema.parse(seed.content).access).toBe("catalogue_only");
    for (const seed of candidateSeeds) expect(requirementSchema.parse({ ...seed.content, sourceRevisionId: "source" }).sourceStatus).toBe("candidate");
  });
  it("requires a locator and checked material", () => {
    expect(requirementSchema.safeParse({ ...candidateSeeds[0].content, sourceRevisionId: "s", sourceStatus: "source_checked" }).success).toBe(false);
    expect(referenceSchema.safeParse({ ...referenceSeeds[0].content, access: "full_source" }).success).toBe(false);
  });
  it("requires reasons and exposes conflicts", () => {
    const entry = { requirementRevisionId: "r", implementationRevisionId: null, applicability: "excluded", rationale: "", conflict: "" };
    expect(profileEntrySchema.safeParse(entry).success).toBe(false);
    expect(profileEntrySchema.safeParse({ ...entry, applicability: "applies", rationale: "Reason", conflict: "Contradiction" }).success).toBe(false);
  });
  it("rejects claimed authenticated identity and unsafe links", () => {
    expect(reviewSchema.safeParse({ operationId: crypto.randomUUID(), targetKind: "requirement", targetRevisionId: "r", reviewer: "Engineer", reviewedAt: new Date().toISOString(), outcome: "review_recorded", comments: "Reviewed", evidenceIds: [], identity: "authenticated" }).success).toBe(false);
    expect(referenceSchema.safeParse({ ...referenceSeeds[0].content, sourceUrl: "javascript:alert(1)" }).success).toBe(false);
  });
  it("requires build and artifact metadata for declared test reports", () => {
    expect(evidenceSchema.safeParse({ operationId: crypto.randomUUID(), requirementRevisionId: "r", implementationRevisionId: null, type: "test_report", description: "Check", result: "pass", artifactReference: "", buildId: "", producer: "Engineer", recordedAt: new Date().toISOString(), notes: "" }).success).toBe(false);
  });
});

