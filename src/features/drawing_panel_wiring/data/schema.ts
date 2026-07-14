import { z } from "zod";

const identifierSchema = z.string().trim().min(1);

export const panelTerminalSideSchema = z.enum([
  "external",
  "internal",
  "single"
]);

export const panelElectricalDomainSchema = z.enum([
  "signal",
  "power",
  "neutral",
  "shield",
  "protective_earth",
  "signal_ground",
  "unknown"
]);

export const panelRecordOriginSchema = z.enum([
  "engineer",
  "agent",
  "imported"
]);

export const panelTerminalRefSchema = z.object({
  assetId: identifierSchema,
  terminalKey: identifierSchema
});

export const panelTerminalSideRefSchema = panelTerminalRefSchema.extend({
  side: panelTerminalSideSchema
});

export const panelSourceEndpointRefSchema = z.object({
  sheetId: identifierSchema,
  connectionId: identifierSchema,
  endpointRole: z.enum(["from", "to"]),
  placementId: identifierSchema,
  anchorKey: identifierSchema
});

export const panelDrawingContextSchema = z.object({
  kind: z.literal("detailed_panel_wiring"),
  panelAssetId: identifierSchema,
  workflowFocusAssetId: identifierSchema.optional()
});

export const panelTerminalMappingSchema = z.object({
  id: identifierSchema,
  panelAssetId: identifierSchema,
  source: panelSourceEndpointRefSchema,
  target: panelTerminalSideRefSchema,
  origin: panelRecordOriginSchema
});

export const panelWireAttributesSchema = z.object({
  color: z.string().trim().max(80).optional(),
  size: z.string().trim().max(80).optional(),
  wireType: z.string().trim().max(120).optional(),
  description: z.string().trim().max(240).optional()
});

export const panelWireIdPolicySchema = z.object({
  mode: z.literal("panel_scoped"),
  prefix: z.string().trim().min(1).max(40).optional(),
  digits: z.number().int().min(1).max(6).default(3),
  nextNumber: z.number().int().positive().default(1)
});

export const panelWireSettingsSchema = z.object({
  panelAssetId: identifierSchema,
  wireIdPolicy: panelWireIdPolicySchema,
  defaults: panelWireAttributesSchema.optional()
});

export const panelInternalWireRecordSchema = z.object({
  id: identifierSchema,
  panelAssetId: identifierSchema,
  wireId: z.string().trim().min(1).max(120),
  from: panelTerminalSideRefSchema,
  to: panelTerminalSideRefSchema,
  domain: panelElectricalDomainSchema.optional(),
  ownerPatternId: identifierSchema.optional(),
  attributes: panelWireAttributesSchema.optional(),
  origin: panelRecordOriginSchema
});

export const panelPatternTopologySchema = z.enum([
  "terminal_jumper",
  "bridge_bar",
  "daisy_chain",
  "distribution",
  "fused_distribution"
]);

const orderedPatternMembersSchema = z.array(panelTerminalSideRefSchema).min(2);

export const panelDistributionBranchSchema = z.object({
  id: identifierSchema,
  target: panelTerminalSideRefSchema,
  wireId: identifierSchema
});

export const panelFusedDistributionBranchSchema = z.object({
  id: identifierSchema,
  protectionAssetId: identifierSchema,
  protectionInput: panelTerminalSideRefSchema,
  protectionOutput: panelTerminalSideRefSchema,
  target: panelTerminalSideRefSchema,
  feedWireId: identifierSchema,
  loadWireId: identifierSchema
});

export const panelPatternDefinitionSchema = z.discriminatedUnion("topology", [
  z.object({
    topology: z.literal("terminal_jumper"),
    orderedMembers: orderedPatternMembersSchema
  }),
  z.object({
    topology: z.literal("bridge_bar"),
    orderedMembers: orderedPatternMembersSchema
  }),
  z.object({
    topology: z.literal("daisy_chain"),
    orderedMembers: orderedPatternMembersSchema,
    internalWireIds: z.array(identifierSchema).min(1)
  }),
  z.object({
    topology: z.literal("distribution"),
    source: panelTerminalSideRefSchema,
    branches: z.array(panelDistributionBranchSchema).min(1)
  }),
  z.object({
    topology: z.literal("fused_distribution"),
    source: panelTerminalSideRefSchema,
    branches: z.array(panelFusedDistributionBranchSchema).min(1)
  })
]);

export const panelBridgeRecordSchema = z.object({
  id: identifierSchema,
  patternCode: z.string().trim().min(1).max(80).optional(),
  panelAssetId: identifierSchema,
  kind: z.enum(["jumper", "bridge", "distribution"]),
  members: z.array(panelTerminalSideRefSchema).min(2),
  domain: panelElectricalDomainSchema.optional(),
  definition: panelPatternDefinitionSchema.optional(),
  label: z.string().trim().max(160).optional(),
  description: z.string().trim().max(400).optional(),
  createdOnSheetId: identifierSchema.optional(),
  origin: panelRecordOriginSchema
});

export const panelReferenceEndpointSchema = z.object({
  kind: z.literal("panel_reference"),
  panelAssetId: identifierSchema,
  referenceKind: z.enum([
    "shield",
    "protective_earth",
    "signal_ground"
  ]),
  key: z.string().trim().min(1).max(120).optional()
});

export const panelBondEndpointSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("terminal"),
    terminal: panelTerminalSideRefSchema
  }),
  panelReferenceEndpointSchema
]);

export const panelBondRecordSchema = z.object({
  id: identifierSchema,
  patternCode: z.string().trim().min(1).max(80).optional(),
  panelAssetId: identifierSchema,
  kind: z.enum(["shield", "protective_earth", "signal_ground"]),
  endpoints: z.array(panelBondEndpointSchema).min(1),
  source: panelTerminalSideRefSchema.optional(),
  target: panelBondEndpointSchema.optional(),
  targetDomain: panelElectricalDomainSchema.optional(),
  label: z.string().trim().max(160).optional(),
  description: z.string().trim().max(400).optional(),
  createdOnSheetId: identifierSchema.optional(),
  origin: panelRecordOriginSchema
});

export const panelPatternCountersSchema = z.object({
  terminalJumper: z.number().int().positive().default(1),
  bridgeBar: z.number().int().positive().default(1),
  daisyChain: z.number().int().positive().default(1),
  distribution: z.number().int().positive().default(1),
  fusedDistribution: z.number().int().positive().default(1),
  shield: z.number().int().positive().default(1),
  protectiveEarth: z.number().int().positive().default(1),
  signalGround: z.number().int().positive().default(1)
});

export const panelPatternSettingsSchema = z.object({
  panelAssetId: identifierSchema,
  counters: panelPatternCountersSchema
});

export const panelWiringPackageDataSchema = z.object({
  schemaVersion: z.literal(1),
  terminalMappings: z.array(panelTerminalMappingSchema).default([]),
  internalWires: z.array(panelInternalWireRecordSchema).default([]),
  bridges: z.array(panelBridgeRecordSchema).default([]),
  bonds: z.array(panelBondRecordSchema).default([]),
  panelSettings: z.array(panelWireSettingsSchema).optional(),
  patternSettings: z.array(panelPatternSettingsSchema).optional()
});

export const panelWiringAssetTypeSchema = z.enum([
  "instrument",
  "controller",
  "panel",
  "junction_box",
  "terminal_block",
  "breaker",
  "fuse",
  "relay",
  "power_supply",
  "isolator",
  "converter",
  "io_module",
  "earth_bar",
  "cable",
  "other"
]);

export const panelWiringOccurrenceRoleSchema = z.enum([
  "device",
  "cable_assembly",
  "terminal_block",
  "enclosure",
  "other"
]);

export const panelWiringOccurrenceKindSchema = z.enum([
  "wiring",
  "layout",
  "enclosure_reference"
]);

export const panelTerminalResolutionStatusSchema = z.enum([
  "resolved",
  "ambiguous",
  "missing_symbol",
  "missing_metadata",
  "not_applicable"
]);

export const panelWiringSourceTerminalAnchorSchema = z.object({
  anchorKey: identifierSchema,
  anchorKind: z.enum([
    "terminal",
    "network_port",
    "ground",
    "shield",
    "label",
    "mounting",
    "other"
  ]),
  sideHint: panelTerminalSideSchema.optional(),
  physicalPosition: z.enum(["top", "right", "bottom", "left"]).optional()
});

export const panelWiringSourceTerminalSchema = z.object({
  terminalKey: identifierSchema,
  label: z.string().trim().min(1).max(120),
  function: z.string().trim().max(200).optional(),
  supportedSides: z.array(panelTerminalSideSchema),
  requiredSides: z.array(panelTerminalSideSchema).optional(),
  allowedDomains: z.array(panelElectricalDomainSchema).optional(),
  anchors: z.array(panelWiringSourceTerminalAnchorSchema).min(1),
  status: z.enum(["resolved", "ambiguous"])
});

export const panelWiringSourceAssetSchema = z.object({
  id: identifierSchema,
  tag: z.string().trim().min(1).max(120),
  type: panelWiringAssetTypeSchema,
  title: z.string().trim().min(1).max(160),
  symbolId: identifierSchema.optional(),
  versionId: identifierSchema.optional()
});

export const panelWiringSourceOccurrenceSchema = z.object({
  sheetId: identifierSchema,
  placementId: identifierSchema,
  assetId: identifierSchema.optional(),
  tag: z.string().trim().min(1).max(120),
  role: panelWiringOccurrenceRoleSchema,
  occurrenceKind: panelWiringOccurrenceKindSchema,
  containerAssetId: identifierSchema.optional(),
  symbolId: identifierSchema,
  versionId: identifierSchema,
  availableAnchorKeys: z.array(identifierSchema).optional(),
  terminalResolutionStatus: panelTerminalResolutionStatusSchema,
  terminalResolutionMessage: z.string().trim().max(300).optional(),
  terminals: z.array(panelWiringSourceTerminalSchema)
});

export const panelWiringSourceConnectionEndpointSchema = z.object({
  placementId: identifierSchema,
  anchorKey: identifierSchema
});

export const panelWiringSourceConnectionSchema = z.object({
  id: identifierSchema,
  sheetId: identifierSchema,
  from: panelWiringSourceConnectionEndpointSchema,
  to: panelWiringSourceConnectionEndpointSchema,
  wireId: z.string().trim().max(120).optional(),
  cablePlacementId: identifierSchema.optional(),
  cableAssetId: identifierSchema.optional(),
  cableTag: z.string().trim().max(120).optional(),
  conductorKey: z.string().trim().max(120).optional(),
  panelConnectionId: identifierSchema.optional(),
  panelPatternId: identifierSchema.optional(),
  panelPatternSegmentId: identifierSchema.optional(),
  routeMode: z.enum(["auto", "manual"]).optional(),
  routePointCount: z.number().int().nonnegative().optional()
});

export const panelWiringSourceSheetSchema = z.object({
  id: identifierSchema,
  sheetNumber: z.number().int().positive(),
  name: z.string().trim().min(1).max(120),
  kind: z.enum(["drawing", "section_title"]),
  description: z.string().trim().max(400).optional(),
  panelDrawingContext: panelDrawingContextSchema.optional(),
  occurrences: z.array(panelWiringSourceOccurrenceSchema),
  connections: z.array(panelWiringSourceConnectionSchema)
});

export const panelWiringSourcePackageSchema = z.object({
  assets: z.array(panelWiringSourceAssetSchema),
  sheets: z.array(panelWiringSourceSheetSchema),
  panelWiring: panelWiringPackageDataSchema.optional()
});

export const panelDrawingFindingSeveritySchema = z.enum([
  "blocking_error",
  "warning",
  "information"
]);

export const panelDrawingFindingCategorySchema = z.enum([
  "asset_identity",
  "panel_context",
  "terminal",
  "external_termination",
  "internal_wire",
  "connection_pattern",
  "route",
  "linked_occurrence"
]);

export const panelFindingObjectKindSchema = z.enum([
  "placement",
  "connection",
  "panel_context",
  "terminal_mapping",
  "internal_wire",
  "connection_pattern"
]);

export const panelFindingLocationSchema = z.object({
  sheetId: identifierSchema,
  sheetNumber: z.number().int().positive(),
  sheetName: z.string().trim().min(1).max(120),
  objectKind: panelFindingObjectKindSchema,
  objectId: identifierSchema.optional()
});

export const panelFindingRepairKindSchema = z.enum([
  "remove_orphan_route",
  "remove_duplicate_route",
  "remove_stale_mapping",
  "remove_redundant_mapping",
  "remove_unreferenced_duplicate_occurrence"
]);

export const panelFindingRepairProposalSchema = z.object({
  kind: panelFindingRepairKindSchema,
  label: z.string().trim().min(1).max(120),
  confirmation: z.string().trim().min(1).max(500),
  parameters: z.record(z.string(), z.string())
});

export const panelDrawingQualityFindingSchema = z.object({
  id: identifierSchema,
  code: identifierSchema,
  severity: panelDrawingFindingSeveritySchema,
  category: panelDrawingFindingCategorySchema,
  message: z.string().trim().min(1).max(500),
  panelAssetId: identifierSchema,
  assetId: identifierSchema.optional(),
  assetTag: z.string().trim().min(1).max(120).optional(),
  terminal: panelTerminalSideRefSchema.optional(),
  wireId: z.string().trim().min(1).max(120).optional(),
  internalWireId: identifierSchema.optional(),
  patternId: identifierSchema.optional(),
  locations: z.array(panelFindingLocationSchema),
  sourceFindingIds: z.array(identifierSchema),
  repair: panelFindingRepairProposalSchema.optional()
});

export const panelDrawingQualityCountsSchema = z.object({
  blockingErrors: z.number().int().nonnegative(),
  warnings: z.number().int().nonnegative(),
  information: z.number().int().nonnegative()
});

export const panelDrawingQualityReportSchema = z.object({
  panelAssetId: identifierSchema,
  panelTag: z.string().trim().min(1).max(120),
  status: z.enum(["blocked", "review_required", "clean"]),
  counts: panelDrawingQualityCountsSchema,
  findings: z.array(panelDrawingQualityFindingSchema),
  canApprove: z.boolean()
});

export const packagePanelDrawingQualityReportSchema = z.object({
  reports: z.array(panelDrawingQualityReportSchema),
  counts: panelDrawingQualityCountsSchema,
  canApprove: z.boolean(),
  firstBlockingFinding: panelDrawingQualityFindingSchema.optional()
});

export const panelWiringMutationSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("set-panel-context"),
    sheetId: identifierSchema,
    context: panelDrawingContextSchema
  }),
  z.object({
    kind: z.literal("clear-panel-context"),
    sheetId: identifierSchema
  }),
  z.object({
    kind: z.literal("upsert-terminal-mapping"),
    mapping: panelTerminalMappingSchema
  }),
  z.object({
    kind: z.literal("remove-terminal-mapping"),
    mappingId: identifierSchema
  }),
  z.object({
    kind: z.literal("upsert-internal-wire"),
    wire: panelInternalWireRecordSchema
  }),
  z.object({
    kind: z.literal("remove-internal-wire"),
    wireId: identifierSchema
  }),
  z.object({
    kind: z.literal("upsert-panel-wire-settings"),
    settings: panelWireSettingsSchema
  }),
  z.object({
    kind: z.literal("upsert-bridge"),
    bridge: panelBridgeRecordSchema
  }),
  z.object({
    kind: z.literal("remove-bridge"),
    bridgeId: identifierSchema
  }),
  z.object({
    kind: z.literal("upsert-bond"),
    bond: panelBondRecordSchema
  }),
  z.object({
    kind: z.literal("remove-bond"),
    bondId: identifierSchema
  }),
  z.object({
    kind: z.literal("upsert-panel-pattern-settings"),
    settings: panelPatternSettingsSchema
  })
]);

export type PanelTerminalSide = z.infer<typeof panelTerminalSideSchema>;
export type PanelElectricalDomain = z.infer<
  typeof panelElectricalDomainSchema
>;
export type PanelRecordOrigin = z.infer<typeof panelRecordOriginSchema>;
export type PanelTerminalRef = z.infer<typeof panelTerminalRefSchema>;
export type PanelTerminalSideRef = z.infer<
  typeof panelTerminalSideRefSchema
>;
export type PanelSourceEndpointRef = z.infer<
  typeof panelSourceEndpointRefSchema
>;
export type PanelDrawingContext = z.infer<typeof panelDrawingContextSchema>;
export type PanelTerminalMapping = z.infer<typeof panelTerminalMappingSchema>;
export type PanelWireAttributes = z.infer<typeof panelWireAttributesSchema>;
export type PanelWireIdPolicy = z.infer<typeof panelWireIdPolicySchema>;
export type PanelWireSettings = z.infer<typeof panelWireSettingsSchema>;
export type PanelInternalWireRecord = z.infer<
  typeof panelInternalWireRecordSchema
>;
export type PanelPatternTopology = z.infer<typeof panelPatternTopologySchema>;
export type PanelDistributionBranch = z.infer<
  typeof panelDistributionBranchSchema
>;
export type PanelFusedDistributionBranch = z.infer<
  typeof panelFusedDistributionBranchSchema
>;
export type PanelPatternDefinition = z.infer<
  typeof panelPatternDefinitionSchema
>;
export type PanelBridgeRecord = z.infer<typeof panelBridgeRecordSchema>;
export type PanelBondEndpoint = z.infer<typeof panelBondEndpointSchema>;
export type PanelBondRecord = z.infer<typeof panelBondRecordSchema>;
export type PanelPatternCounters = z.infer<typeof panelPatternCountersSchema>;
export type PanelPatternSettings = z.infer<typeof panelPatternSettingsSchema>;
export type PanelWiringPackageData = z.infer<
  typeof panelWiringPackageDataSchema
>;
export type PanelWiringSourceAsset = z.infer<
  typeof panelWiringSourceAssetSchema
>;
export type PanelWiringSourceTerminal = z.infer<
  typeof panelWiringSourceTerminalSchema
>;
export type PanelWiringSourceOccurrence = z.infer<
  typeof panelWiringSourceOccurrenceSchema
>;
export type PanelWiringSourceConnection = z.infer<
  typeof panelWiringSourceConnectionSchema
>;
export type PanelWiringSourceSheet = z.infer<
  typeof panelWiringSourceSheetSchema
>;
export type PanelWiringSourcePackage = z.infer<
  typeof panelWiringSourcePackageSchema
>;
export type PanelDrawingFindingSeverity = z.infer<
  typeof panelDrawingFindingSeveritySchema
>;
export type PanelDrawingFindingCategory = z.infer<
  typeof panelDrawingFindingCategorySchema
>;
export type PanelFindingObjectKind = z.infer<
  typeof panelFindingObjectKindSchema
>;
export type PanelFindingLocation = z.infer<typeof panelFindingLocationSchema>;
export type PanelFindingRepairKind = z.infer<
  typeof panelFindingRepairKindSchema
>;
export type PanelFindingRepairProposal = z.infer<
  typeof panelFindingRepairProposalSchema
>;
export type PanelDrawingQualityFinding = z.infer<
  typeof panelDrawingQualityFindingSchema
>;
export type PanelDrawingQualityCounts = z.infer<
  typeof panelDrawingQualityCountsSchema
>;
export type PanelDrawingQualityReport = z.infer<
  typeof panelDrawingQualityReportSchema
>;
export type PackagePanelDrawingQualityReport = z.infer<
  typeof packagePanelDrawingQualityReportSchema
>;
export type PanelWiringMutation = z.infer<typeof panelWiringMutationSchema>;
