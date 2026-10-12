export {
  panelAnalysisAffectedRecordSchema,
  panelAnalysisBomPanelSchema,
  panelAnalysisBomRequestSchema,
  panelAnalysisBomResultSchema,
  panelAnalysisCategorySchema,
  panelAnalysisCoverageSchema,
  panelAnalysisCoverageStatusSchema,
  panelAnalysisEvidenceLevelSchema,
  panelAnalysisEvidenceSchema,
  panelAnalysisFindingGroupSchema,
  panelAnalysisFindingSchema,
  panelAnalysisLocationSchema,
  panelAnalysisNavigationTargetSchema,
  panelAnalysisNotEvaluatedReasonSchema,
  panelAnalysisPanelSummarySchema,
  panelAnalysisPanelSchedulesSchema,
  panelAnalysisResultSchema,
  panelAnalysisRuleOutcomeSchema,
  panelAnalysisRuleStatusSchema,
  panelAnalysisSeveritySchema,
  panelAnalysisSourceRevisionSchema,
  panelAnalysisSummarySchema
} from "../data/schema";

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
} from "../types";

export {
  buildPanelAnalysisCoverage,
  buildPanelAnalysisSummary
} from "../logic/services/panel-analysis-coverage";
export {
  runPanelAnalysisRules,
  type PanelAnalysisFindingDraft,
  type PanelAnalysisRule,
  type PanelAnalysisRuleApplicability,
  type PanelAnalysisRuleEvaluation,
  type PanelAnalysisRuleRun
} from "../logic/services/panel-analysis-rules";
export {
  createPanelAnalysisRules,
  type PanelAnalysisRuleContext
} from "../logic/services/panel-analysis-rule-set";
export {
  adaptPanelQualityFindings,
  type AdaptedPanelQualityFinding
} from "../logic/services/panel-quality-finding-adapter";
export { groupPanelAnalysisFindings } from "../logic/services/panel-analysis-grouping";
export {
  comparePanelTerminalElectricalRoles,
  PANEL_ANALYSIS_SIGNAL_INFERENCE_VERSION,
  resolvePanelTerminalElectricalRole,
  type PanelTerminalRoleCompatibility,
  type PanelTerminalRoleResolution
} from "../logic/services/panel-analysis-signal-semantics";
export {
  buildSavedPanelAnalysis,
  type BuildSavedPanelAnalysisDependencies,
  type BuildSavedPanelAnalysisInput
} from "../logic/use_cases/build-panel-analysis";
export {
  filterPanelAnalysisFindingGroups,
  panelAnalysisFindingMatchesFilters,
  type FilteredPanelAnalysisFindingGroup,
  type PanelAnalysisFindingFilters
} from "../logic/services/panel-analysis-filtering";
export {
  resolvePanelAnalysisNavigation,
  type PanelAnalysisNavigationSearchParams
} from "../logic/services/panel-analysis-navigation";

export {productConnectionIndex} from "../logic/services/product-connections";
export type {ProductConnection} from "../logic/services/product-connections";
