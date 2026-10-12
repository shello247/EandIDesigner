import { z } from "zod";
import { powerAnalysisSchema,ioScheduleRowSchema } from "./engineering-checks";
import {attributeEvidenceSchema} from "@/features/item_engineering/api/public";
import { drawingStatusSchema } from "@/features/drawing_canvas/data/schema";
import { panelTerminalSideSchema } from "@/features/drawing_panel_wiring/api/contracts";
import {
  panelAssetScheduleRowSchema,
  panelBomProjectionSchema,
  panelTerminalScheduleRowSchema,
  panelWireScheduleRowSchema
} from "@/features/drawing_panel_reports/api/public";
import { generatedDrawingBomSchema } from "@/features/bom_creator/api/public";

const identifierSchema = z.string().trim().min(1);
const shortTextSchema = z.string().trim().min(1).max(240);
const longTextSchema = z.string().trim().min(1).max(1_000);

export const panelAnalysisSeveritySchema = z.enum([
  "error",
  "warning",
  "data_gap",
  "information"
]);

export const panelAnalysisCategorySchema = z.enum([
  "structural_identity",
  "connectivity",
  "terminal_occupancy",
  "external_termination",
  "internal_wiring",
  "cable_conductor",
  "instrument_loop",
  "signal_compatibility",
  "documentation",
  "shield_earth",
  "engineering_metadata",
  "power_budget",
  "dimension_consistency",
  "analysis_coverage"
]);

export const panelAnalysisEvidenceLevelSchema = z.enum([
  "verified",
  "inferred"
]);

export const panelAnalysisRuleStatusSchema = z.enum([
  "passed",
  "finding",
  "not_evaluated"
]);

export const panelAnalysisCoverageStatusSchema = z.enum([
  "complete",
  "partial",
  "not_evaluated"
]);

export const panelAnalysisNotEvaluatedReasonSchema = z.enum([
  "not_applicable",
  "insufficient_evidence",
  "execution_failed"
]);

export const panelAnalysisLocationSchema = z.object({
  sheetId: identifierSchema,
  sheetNumber: z.number().int().positive(),
  sheetName: z.string().trim().min(1).max(160).optional(),
  objectKind: z.enum([
    "placement",
    "connection",
    "annotation",
    "panel_context"
  ]),
  objectId: identifierSchema.optional()
});

export const panelAnalysisAffectedRecordSchema = z.object({
  kind: z.enum([
    "panel",
    "asset",
    "terminal",
    "connection",
    "internal_wire",
    "cable",
    "conductor",
    "symbol",
    "sheet"
  ]),
  id: identifierSchema,
  label: z.string().trim().min(1).max(240).optional(),
  assetId: identifierSchema.optional(),
  terminalKey: identifierSchema.optional(),
  terminalSide: panelTerminalSideSchema.optional()
});

export const panelAnalysisEvidenceSchema = z.object({
  label: z.string().trim().min(1).max(160),
  value: z.string().trim().min(1).max(1_000),
  productSource:z.object({itemId:identifierSchema,revisionId:identifierSchema,references:z.array(attributeEvidenceSchema)}).optional()
});

export const panelAnalysisFindingSchema = z
  .object({
    id: identifierSchema,
    ruleCode: identifierSchema,
    ruleVersion: identifierSchema,
    category: panelAnalysisCategorySchema,
    severity: panelAnalysisSeveritySchema,
    evidenceLevel: panelAnalysisEvidenceLevelSchema,
    title: shortTextSchema,
    problem: longTextSchema,
    significance: longTextSchema,
    recommendedAction: longTextSchema,
    rootCauseKey: identifierSchema,
    rootCauseTitle: shortTextSchema.optional(),
    rootCauseSummaryItem: shortTextSchema.optional(),
    panelAssetIds: z.array(identifierSchema),
    assetIds: z.array(identifierSchema),
    affectedRecords: z.array(panelAnalysisAffectedRecordSchema),
    evidence: z.array(panelAnalysisEvidenceSchema),
    locations: z.array(panelAnalysisLocationSchema)
  })
  .superRefine((finding, context) => {
    if (
      finding.evidenceLevel === "inferred" &&
      !["warning", "data_gap"].includes(finding.severity)
    ) {
      context.addIssue({
        code: "custom",
        path: ["severity"],
        message: "Inferred findings must be warnings or data gaps."
      });
    }
  });

export const panelAnalysisFindingGroupSchema = z.object({
  id: identifierSchema,
  rootCauseKey: identifierSchema,
  title: shortTextSchema,
  summary: longTextSchema,
  severity: panelAnalysisSeveritySchema,
  category: panelAnalysisCategorySchema,
  findingIds: z.array(identifierSchema).min(1),
  locations: z.array(panelAnalysisLocationSchema)
});

const panelAnalysisRuleOutcomeIdentitySchema = z.object({
  ruleCode: identifierSchema,
  ruleVersion: identifierSchema,
  category: panelAnalysisCategorySchema
});

export const panelAnalysisRuleOutcomeSchema = z.discriminatedUnion("status", [
  panelAnalysisRuleOutcomeIdentitySchema.extend({
    status: z.literal("passed"),
    findingIds: z.array(identifierSchema).length(0),
    message: z.string().trim().min(1).max(500).optional()
  }),
  panelAnalysisRuleOutcomeIdentitySchema.extend({
    status: z.literal("finding"),
    coverage: z.literal("partial").optional(),
    findingIds: z.array(identifierSchema).min(1)
  }),
  panelAnalysisRuleOutcomeIdentitySchema.extend({
    status: z.literal("not_evaluated"),
    findingIds: z.array(identifierSchema).length(0),
    notEvaluatedReason: panelAnalysisNotEvaluatedReasonSchema,
    message: z.string().trim().min(1).max(500)
  })
]);

export const panelAnalysisCoverageSchema = z.object({
  status: panelAnalysisCoverageStatusSchema,
  totalRules: z.number().int().nonnegative(),
  applicableRules: z.number().int().nonnegative(),
  passedRules: z.number().int().nonnegative(),
  findingRules: z.number().int().nonnegative(),
  notApplicableRules: z.number().int().nonnegative(),
  unavailableRules: z.number().int().nonnegative()
  ,partialRules: z.number().int().nonnegative().optional()
});

export const panelAnalysisSummarySchema = z.object({
  errors: z.number().int().nonnegative(),
  warnings: z.number().int().nonnegative(),
  dataGaps: z.number().int().nonnegative(),
  information: z.number().int().nonnegative(),
  checksNotEvaluated: z.number().int().nonnegative(),
  totalFindings: z.number().int().nonnegative()
});

export const panelAnalysisSourceRevisionSchema = z.object({
  drawingId: identifierSchema,
  drawingKey: identifierSchema,
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(500).optional(),
  status: drawingStatusSchema,
  savedAt: z.string().datetime(),
  project: z
    .object({
      id: identifierSchema,
      name: z.string().trim().min(1).max(160),
      projectNumber: z.string().trim().min(1).max(80).optional()
    })
    .nullable()
});

export const panelAnalysisNavigationTargetSchema = z
  .object({
    drawingId: identifierSchema,
    sheetId: identifierSchema,
    objectKind: z
      .enum(["placement", "connection", "annotation"])
      .optional(),
    objectId: identifierSchema.optional()
  })
  .superRefine((target, context) => {
    if (Boolean(target.objectKind) !== Boolean(target.objectId)) {
      context.addIssue({
        code: "custom",
        path: [target.objectKind ? "objectId" : "objectKind"],
        message: "Drawing object kind and identifier must be supplied together."
      });
    }
  });

export const panelAnalysisPanelSummarySchema = z.object({
  assetId: identifierSchema,
  tag: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(160)
});

export const panelAnalysisPanelSchedulesSchema = z.object({
  panelAssetId: identifierSchema,
  panelTag: z.string().trim().min(1).max(120),
  terminals: z.array(panelTerminalScheduleRowSchema),
  internalWires: z.array(panelWireScheduleRowSchema),
  assets: z.array(panelAssetScheduleRowSchema),
  bomProjection: panelBomProjectionSchema
});

export const panelAnalysisBomRequestSchema = z.object({
  drawingId: identifierSchema,
  expectedUpdatedAt: z.string().datetime(),
  panelAssetId: identifierSchema.optional()
});

export const panelAnalysisBomPanelSchema = z.object({
  panelAssetId: identifierSchema,
  panelTag: z.string().trim().min(1).max(120),
  information: z.array(z.string().trim().min(1)),
  bom: generatedDrawingBomSchema
});

export const panelAnalysisBomResultSchema = z.object({
  savedAt: z.string().datetime(),
  panels: z.array(panelAnalysisBomPanelSchema)
});

export const panelAnalysisResultSchema = z.object({
  powerAnalysis: powerAnalysisSchema.optional(),
  ioSchedule:z.array(ioScheduleRowSchema).optional(),
  sourceRevision: panelAnalysisSourceRevisionSchema,
  generatedAt: z.string().datetime(),
  coverage: panelAnalysisCoverageSchema,
  summary: panelAnalysisSummarySchema,
  panels: z.array(panelAnalysisPanelSummarySchema),
  outcomes: z.array(panelAnalysisRuleOutcomeSchema),
  findingGroups: z.array(panelAnalysisFindingGroupSchema),
  findings: z.array(panelAnalysisFindingSchema),
  schedules: z.array(panelAnalysisPanelSchedulesSchema)
});

export type PanelAnalysisSeverity = z.infer<
  typeof panelAnalysisSeveritySchema
>;
export type PanelAnalysisCategory = z.infer<
  typeof panelAnalysisCategorySchema
>;
export type PanelAnalysisEvidenceLevel = z.infer<
  typeof panelAnalysisEvidenceLevelSchema
>;
export type PanelAnalysisRuleStatus = z.infer<
  typeof panelAnalysisRuleStatusSchema
>;
export type PanelAnalysisCoverageStatus = z.infer<
  typeof panelAnalysisCoverageStatusSchema
>;
export type PanelAnalysisNotEvaluatedReason = z.infer<
  typeof panelAnalysisNotEvaluatedReasonSchema
>;
export type PanelAnalysisLocation = z.infer<
  typeof panelAnalysisLocationSchema
>;
export type PanelAnalysisAffectedRecord = z.infer<
  typeof panelAnalysisAffectedRecordSchema
>;
export type PanelAnalysisEvidence = z.infer<
  typeof panelAnalysisEvidenceSchema
>;
export type PanelAnalysisFinding = z.infer<
  typeof panelAnalysisFindingSchema
>;
export type PanelAnalysisFindingGroup = z.infer<
  typeof panelAnalysisFindingGroupSchema
>;
export type PanelAnalysisRuleOutcome = z.infer<
  typeof panelAnalysisRuleOutcomeSchema
>;
export type PanelAnalysisCoverage = z.infer<
  typeof panelAnalysisCoverageSchema
>;
export type PanelAnalysisSummary = z.infer<
  typeof panelAnalysisSummarySchema
>;
export type PanelAnalysisSourceRevision = z.infer<
  typeof panelAnalysisSourceRevisionSchema
>;
export type PanelAnalysisNavigationTarget = z.infer<
  typeof panelAnalysisNavigationTargetSchema
>;
export type PanelAnalysisPanelSummary = z.infer<
  typeof panelAnalysisPanelSummarySchema
>;
export type PanelAnalysisPanelSchedules = z.infer<
  typeof panelAnalysisPanelSchedulesSchema
>;
export type PanelAnalysisBomRequest = z.infer<
  typeof panelAnalysisBomRequestSchema
>;
export type PanelAnalysisBomPanel = z.infer<
  typeof panelAnalysisBomPanelSchema
>;
export type PanelAnalysisBomResult = z.infer<
  typeof panelAnalysisBomResultSchema
>;
export type PanelAnalysisResult = z.infer<typeof panelAnalysisResultSchema>;
