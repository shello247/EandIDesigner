export type {
  PanelAnalysisAffectedRecord,
  PanelAnalysisBomPanel,
  PanelAnalysisBomRequest,
  PanelAnalysisBomResult,
  PanelAnalysisCategory,
  PanelAnalysisCoverage,
  PanelAnalysisCoverageStatus,
  PanelAnalysisEvidence,
  PanelAnalysisEvidenceLevel,
  PanelAnalysisFinding,
  PanelAnalysisFindingGroup,
  PanelAnalysisLocation,
  PanelAnalysisNavigationTarget,
  PanelAnalysisNotEvaluatedReason,
  PanelAnalysisPanelSummary,
  PanelAnalysisPanelSchedules,
  PanelAnalysisResult,
  PanelAnalysisRuleOutcome,
  PanelAnalysisRuleStatus,
  PanelAnalysisSeverity,
  PanelAnalysisSourceRevision,
  PanelAnalysisSummary
} from "../data/schema";

export type PanelAnalysisActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: string;
      code: "validation" | "not_found" | "conflict" | "unavailable";
    };
