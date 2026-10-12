import type { Coverage, Evidence, ProfileRow, Revision, Trace } from "../../types";
export function evidenceFreshness(evidence: Evidence, trace: Trace, implementation: Revision<"implementation"> | null, buildId: string, implementationCurrentRevisionId = implementation?.id ?? null) {
  const reasons: string[] = [];
  if (evidence.requirementRevisionId !== trace.requirement.id || trace.requirementCurrentRevisionId !== trace.requirement.id) reasons.push("Requirement revision changed");
  if (evidence.sourceRevisionId !== trace.source.id || trace.sourceCurrentRevisionId !== trace.source.id) reasons.push("Source revision changed");
  if (evidence.implementationRevisionId !== (implementation?.id ?? null) || implementationCurrentRevisionId !== (implementation?.id ?? null)) reasons.push("Implementation revision changed");
  if (evidence.buildId && evidence.buildId !== buildId) reasons.push("Application build changed");
  return { ...evidence, stale: reasons.length > 0, reasons };
}
export function calculateCoverage(rows: ProfileRow[]): Coverage {
  const result: Coverage = { total: rows.length, sourceChecked: 0, candidates: 0, implemented: 0, planned: 0, notPlanned: 0, evidenceRecorded: 0, evidenceStale: 0, evidenceMissing: 0, failedEvidence: 0, applies: 0, excluded: 0, unresolved: 0, reviewRecorded: 0, changesRequested: 0, empty: rows.length === 0, gaps: [] };
  if (!rows.length) result.gaps.push("No requirements selected. An empty profile cannot demonstrate coverage.");
  for (const row of rows) {
    const name = row.trace.requirement.content.title;
    result[row.entry.applicability]++;
    if (row.trace.requirement.content.sourceStatus === "source_checked") result.sourceChecked++;
    else { result.candidates++; result.gaps.push(name + ": authoritative source review is pending."); }
    const status = row.implementation?.content.implementationStatus;
    if (status === "implemented" && row.implementation?.content.status === "active") result.implemented++;
    else if (status === "planned") result.planned++;
    else result.notPlanned++;
    const fresh = row.evidence.filter(e => !e.stale);
    if (fresh.length) result.evidenceRecorded++;
    else if (row.evidence.length) { result.evidenceStale++; result.gaps.push(name + ": evidence dependencies changed."); }
    else { result.evidenceMissing++; result.gaps.push(name + ": no evidence recorded."); }
    if (fresh.some(e => e.result === "fail")) { result.failedEvidence++; result.gaps.push(name + ": a recorded check failed."); }
    if (fresh.some(e => e.result === "inconclusive")) result.gaps.push(name + ": recorded evidence is inconclusive.");
    if (!row.implementation) result.gaps.push(name + ": application implementation has not been mapped.");
    if (row.entry.applicability === "unresolved") result.gaps.push(name + ": applicability is unresolved. " + row.entry.rationale);
    if (row.entry.applicability === "excluded") result.gaps.push(name + ": excluded from this profile. " + row.entry.rationale);
    if (row.entry.conflict) result.gaps.push(name + ": unresolved conflict. " + row.entry.conflict);
    if (row.trace.requirementCurrentRevisionId !== row.trace.requirement.id) result.gaps.push(name + ": profile pins an earlier requirement revision.");
    if (row.trace.sourceCurrentRevisionId !== row.trace.source.id) result.gaps.push(name + ": profile pins an earlier source revision.");
    if (row.trace.requirement.content.status === "retired" || row.trace.source.content.status === "retired") result.gaps.push(name + ": a pinned record is retired.");
    const latestReview = row.trace.reviews[0];
    if (latestReview?.outcome === "changes_requested" || row.implementationReviews[0]?.outcome === "changes_requested") { result.changesRequested++; result.gaps.push(name + ": local reviewer requested changes."); }
    else if (latestReview) result.reviewRecorded++;
  }
  return result;
}
