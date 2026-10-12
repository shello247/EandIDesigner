import {
  panelAnalysisCoverageSchema,
  panelAnalysisSummarySchema,
  type PanelAnalysisCoverage,
  type PanelAnalysisFinding,
  type PanelAnalysisRuleOutcome,
  type PanelAnalysisSummary
} from "../../data/schema";

export function buildPanelAnalysisCoverage(
  outcomes: readonly PanelAnalysisRuleOutcome[]
): PanelAnalysisCoverage {
  const passedRules = outcomes.filter(
    (outcome) => outcome.status === "passed"
  ).length;
  const findingRules = outcomes.filter(
    (outcome) => outcome.status === "finding"
  ).length;
  const notApplicableRules = outcomes.filter(
    (outcome) =>
      outcome.status === "not_evaluated" &&
      outcome.notEvaluatedReason === "not_applicable"
  ).length;
  const unavailableRules = outcomes.filter(
    (outcome) =>
      outcome.status === "not_evaluated" &&
      outcome.notEvaluatedReason !== "not_applicable"
  ).length;
  const applicableRules = passedRules + findingRules + unavailableRules;
  const partialRules = outcomes.filter(outcome => outcome.status === "finding" && outcome.coverage === "partial").length;
  const evaluatedRules = passedRules + findingRules;
  const status =
    evaluatedRules === 0
      ? "not_evaluated"
      : unavailableRules > 0 || partialRules > 0
        ? "partial"
        : "complete";

  return panelAnalysisCoverageSchema.parse({
    status,
    totalRules: outcomes.length,
    applicableRules,
    passedRules,
    findingRules,
    notApplicableRules,
    unavailableRules
    ,...(partialRules ? {partialRules} : {})
  });
}

export function buildPanelAnalysisSummary(
  findings: readonly PanelAnalysisFinding[],
  outcomes: readonly PanelAnalysisRuleOutcome[]
): PanelAnalysisSummary {
  const count = (severity: PanelAnalysisFinding["severity"]) =>
    findings.filter((finding) => finding.severity === severity).length;

  return panelAnalysisSummarySchema.parse({
    errors: count("error"),
    warnings: count("warning"),
    dataGaps: count("data_gap"),
    information: count("information"),
    checksNotEvaluated: outcomes.filter(
      (outcome) => outcome.status === "not_evaluated"
    ).length,
    totalFindings: findings.length
  });
}
