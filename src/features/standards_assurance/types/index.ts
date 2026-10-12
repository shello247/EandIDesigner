import type { ContentByKind, EntityKind, EvidenceInput, ReviewInput, ProfileEntry } from "../data/schema";
export type Revision<K extends EntityKind = EntityKind> = {
  id: string; entityId: string; number: number; createdAt: string; hash: string; content: ContentByKind[K];
};
export type Summary = { id: string; kind: EntityKind; title: string; key: string; referenceLabel?: string; status: string; contentStatus?: string; revisionId: string; revision: number; updatedAt: string };
export type Evidence = Omit<EvidenceInput, "operationId"> & {
  id: string; sourceRevisionId: string; createdAt: string; contentHash: string; provenance: "declared";
};
export type ReviewNote = Omit<ReviewInput, "operationId"> & { id: string; createdAt: string; identity: "self_declared" };
export type Trace = {
  requirement: Revision<"requirement">; source: Revision<"reference">;
  implementations: Revision<"implementation">[]; evidence: Evidence[]; reviews: ReviewNote[];
  sourceCurrentRevisionId: string; requirementCurrentRevisionId: string;
};
export type ProfileRow = { entry: ProfileEntry; trace: Trace; implementation: Revision<"implementation"> | null; implementationReviews: ReviewNote[]; evidence: Array<Evidence & { stale: boolean; reasons: string[] }> };
export type Coverage = {
  total: number; sourceChecked: number; candidates: number; implemented: number; planned: number; notPlanned: number;
  evidenceRecorded: number; evidenceStale: number; evidenceMissing: number; failedEvidence: number;
  applies: number; excluded: number; unresolved: number; reviewRecorded: number; changesRequested: number;
  empty: boolean; gaps: string[];
};
export type StandardsContext = { profile: Revision<"profile">; rows: ProfileRow[]; coverage: Coverage; buildId: string; reviews: ReviewNote[]; assessmentHash: string };
export type Snapshot = {
  schemaVersion: 1; id: string; createdAt: string; context: StandardsContext;
  notices: string[]; localReviewNotice: string; provenanceNotice: string;
};
export type ActionResult<T> = { ok: true; data: T } | {
  ok: false; code: string; error: string; fieldErrors?: Record<string, string[]>; latestRevisionId?: string | null;
};
