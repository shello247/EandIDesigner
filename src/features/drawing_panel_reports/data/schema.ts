import { z } from "zod";
import {
  bomAssemblyProjectionSchema,
  generatedDrawingBomSchema
} from "@/features/bom_creator/data/schema";
import {
  panelDrawingQualityCountsSchema,
  panelElectricalDomainSchema,
  panelTerminalSideRefSchema,
  panelTerminalSideSchema
} from "@/features/drawing_panel_wiring/api/public";

const idSchema = z.string().trim().min(1);
const optionalText = z.string().trim().min(1).optional();

export const panelReportKindSchema = z.enum([
  "terminal_schedule",
  "internal_wire_schedule",
  "panel_asset_schedule",
  "bom"
]);

export const panelDeliverableIssueModeSchema = z.enum(["draft", "issued"]);
export const panelPdfCompositionSchema = z.enum([
  "drawings_only",
  "schedules_only",
  "drawings_and_schedules"
]);

export const panelReportScopeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("active_panel"), panelAssetId: idSchema }),
  z.object({ kind: z.literal("all_panels") })
]);

export const panelDeliverableRequestSchema = z.object({
  scope: panelReportScopeSchema,
  reports: z.array(panelReportKindSchema).min(1),
  issueMode: panelDeliverableIssueModeSchema,
  pdfComposition: panelPdfCompositionSchema.default("schedules_only")
});

export const panelReportSheetRefSchema = z.object({
  sheetId: idSchema,
  sheetNumber: z.number().int().positive(),
  sheetName: z.string().trim().min(1),
  objectId: idSchema.optional()
});

export const panelReportTraceRefSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("sheet_object"),
    sheet: panelReportSheetRefSchema,
    objectKind: z.enum(["placement", "connection"]),
    label: z.string().trim().min(1)
  }),
  z.object({
    kind: z.literal("work_queue"),
    panelAssetId: idSchema,
    tab: z.enum(["terminations", "terminal-map", "internal-wires", "patterns"]),
    objectId: idSchema.optional(),
    label: z.string().trim().min(1)
  }),
  z.object({
    kind: z.literal("asset_manager"),
    assetId: idSchema,
    label: z.string().trim().min(1)
  })
]);

export const panelReportFindingRefSchema = z.object({
  id: idSchema,
  code: idSchema,
  severity: z.enum(["blocking_error", "warning", "information"]),
  message: z.string().trim().min(1)
});

export const panelTerminalOccupantScheduleSchema = z.object({
  id: idSchema,
  kind: z.enum(["external_termination", "internal_wire", "bridge", "bond"]),
  channel: z.enum(["conductor", "structural"]).optional(),
  label: z.string().trim().min(1),
  wireId: optionalText,
  cableTag: optionalText,
  conductorKey: optionalText,
  connectedAssetId: idSchema.optional(),
  connectedAssetTag: optionalText,
  connectedTerminal: panelTerminalSideRefSchema.optional(),
  connectedTerminalLabel: optionalText,
  sourceSheet: panelReportSheetRefSchema.optional(),
  ownerPatternId: idSchema.optional(),
  ownerPatternCode: optionalText
});

export const panelTerminalSideScheduleSchema = z.object({
  side: panelTerminalSideSchema,
  status: z.enum(["available", "occupied", "conflicting", "not_applicable"]),
  occupants: z.array(panelTerminalOccupantScheduleSchema)
});

export const panelPatternMembershipSchema = z.object({
  patternId: idSchema,
  patternCode: z.string().trim().min(1),
  topology: z.string().trim().min(1),
  domain: panelElectricalDomainSchema
});

export const panelTerminalScheduleRowSchema = z.object({
  id: idSchema,
  panelAssetId: idSchema,
  panelTag: z.string().trim().min(1),
  assetId: idSchema,
  assetTag: z.string().trim().min(1),
  assetTitle: z.string().trim().min(1),
  assetType: z.string().trim().min(1),
  terminalKey: z.string().trim().min(1),
  terminalLabel: z.string().trim().min(1),
  function: optionalText,
  external: panelTerminalSideScheduleSchema,
  internal: panelTerminalSideScheduleSchema,
  single: panelTerminalSideScheduleSchema,
  patterns: z.array(panelPatternMembershipSchema),
  sourceSheets: z.array(panelReportSheetRefSchema),
  findings: z.array(panelReportFindingRefSchema),
  traces: z.array(panelReportTraceRefSchema)
});

export const panelWireRouteScheduleSchema = z.object({
  sheetId: idSchema,
  sheetNumber: z.number().int().positive(),
  sheetName: z.string().trim().min(1),
  connectionId: idSchema,
  routeMode: z.enum(["auto", "manual", "unrouted"]),
  pointCount: z.number().int().nonnegative()
});

export const panelWireScheduleRowSchema = z.object({
  id: idSchema,
  panelAssetId: idSchema,
  panelTag: z.string().trim().min(1),
  wireId: z.string().trim().min(1),
  from: panelTerminalSideRefSchema,
  fromLabel: z.string().trim().min(1),
  to: panelTerminalSideRefSchema,
  toLabel: z.string().trim().min(1),
  domain: panelElectricalDomainSchema,
  color: optionalText,
  size: optionalText,
  wireType: optionalText,
  description: optionalText,
  origin: z.enum(["engineer", "agent", "imported"]),
  ownerPatternId: idSchema.optional(),
  ownerPatternCode: optionalText,
  routes: z.array(panelWireRouteScheduleSchema),
  represented: z.boolean(),
  findings: z.array(panelReportFindingRefSchema),
  traces: z.array(panelReportTraceRefSchema)
});

export const panelAssetScheduleRowSchema = z.object({
  id: idSchema,
  panelAssetId: idSchema,
  panelTag: z.string().trim().min(1),
  assetId: idSchema,
  assetTag: z.string().trim().min(1),
  title: z.string().trim().min(1),
  assetType: z.string().trim().min(1),
  symbolId: idSchema.optional(),
  versionId: idSchema.optional(),
  terminalCount: z.number().int().nonnegative(),
  occurrenceCount: z.number().int().nonnegative(),
  conductorTerminationCount: z.number().int().nonnegative(),
  connectionCount: z.number().int().nonnegative(),
  sheetRefs: z.array(panelReportSheetRefSchema),
  findings: z.array(panelReportFindingRefSchema),
  traces: z.array(panelReportTraceRefSchema)
});

export const panelBomProjectionSchema = z.object({
  panelAssetId: idSchema,
  panelTag: z.string().trim().min(1),
  assemblies: z.array(bomAssemblyProjectionSchema),
  information: z.array(z.string().trim().min(1))
});

export const panelReportPanelBundleSchema = z.object({
  panelAssetId: idSchema,
  panelTag: z.string().trim().min(1),
  terminalSchedule: z.array(panelTerminalScheduleRowSchema),
  wireSchedule: z.array(panelWireScheduleRowSchema),
  assetSchedule: z.array(panelAssetScheduleRowSchema),
  bomProjection: panelBomProjectionSchema,
  bom: generatedDrawingBomSchema.optional()
});

export const panelDeliverableManifestSchema = z.object({
  drawingId: idSchema,
  drawingKey: optionalText,
  drawingTitle: z.string().trim().min(1),
  drawingStatus: z.enum(["draft", "needs_review", "approved", "archived"]),
  issueMode: panelDeliverableIssueModeSchema,
  scope: panelReportScopeSchema,
  reports: z.array(panelReportKindSchema),
  qcCounts: panelDrawingQualityCountsSchema,
  canIssue: z.boolean(),
  information: z.array(z.string().trim().min(1))
});

export const panelDeliverableBundleSchema = z.object({
  manifest: panelDeliverableManifestSchema,
  panels: z.array(panelReportPanelBundleSchema)
});

export type PanelReportKind = z.infer<typeof panelReportKindSchema>;
export type PanelDeliverableIssueMode = z.infer<typeof panelDeliverableIssueModeSchema>;
export type PanelPdfComposition = z.infer<typeof panelPdfCompositionSchema>;
export type PanelReportScope = z.infer<typeof panelReportScopeSchema>;
export type PanelDeliverableRequest = z.infer<typeof panelDeliverableRequestSchema>;
export type PanelReportSheetRef = z.infer<typeof panelReportSheetRefSchema>;
export type PanelReportTraceRef = z.infer<typeof panelReportTraceRefSchema>;
export type PanelReportFindingRef = z.infer<typeof panelReportFindingRefSchema>;
export type PanelTerminalOccupantSchedule = z.infer<typeof panelTerminalOccupantScheduleSchema>;
export type PanelTerminalSideSchedule = z.infer<typeof panelTerminalSideScheduleSchema>;
export type PanelPatternMembership = z.infer<typeof panelPatternMembershipSchema>;
export type PanelTerminalScheduleRow = z.infer<typeof panelTerminalScheduleRowSchema>;
export type PanelWireRouteSchedule = z.infer<typeof panelWireRouteScheduleSchema>;
export type PanelWireScheduleRow = z.infer<typeof panelWireScheduleRowSchema>;
export type PanelAssetScheduleRow = z.infer<typeof panelAssetScheduleRowSchema>;
export type PanelBomProjection = z.infer<typeof panelBomProjectionSchema>;
export type PanelReportPanelBundle = z.infer<typeof panelReportPanelBundleSchema>;
export type PanelDeliverableManifest = z.infer<typeof panelDeliverableManifestSchema>;
export type PanelDeliverableBundle = z.infer<typeof panelDeliverableBundleSchema>;
