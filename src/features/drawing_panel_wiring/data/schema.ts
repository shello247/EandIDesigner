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
  panelAssetId: identifierSchema
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

export const panelInternalWireRecordSchema = z.object({
  id: identifierSchema,
  panelAssetId: identifierSchema,
  wireId: z.string().trim().min(1).max(120),
  from: panelTerminalSideRefSchema,
  to: panelTerminalSideRefSchema,
  attributes: panelWireAttributesSchema.optional(),
  origin: panelRecordOriginSchema
});

export const panelBridgeRecordSchema = z.object({
  id: identifierSchema,
  panelAssetId: identifierSchema,
  kind: z.enum(["jumper", "bridge", "distribution"]),
  members: z.array(panelTerminalSideRefSchema).min(2),
  domain: panelElectricalDomainSchema.optional(),
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
  panelAssetId: identifierSchema,
  kind: z.enum(["shield", "protective_earth", "signal_ground"]),
  endpoints: z.array(panelBondEndpointSchema).min(1),
  origin: panelRecordOriginSchema
});

export const panelWiringPackageDataSchema = z.object({
  schemaVersion: z.literal(1),
  terminalMappings: z.array(panelTerminalMappingSchema).default([]),
  internalWires: z.array(panelInternalWireRecordSchema).default([]),
  bridges: z.array(panelBridgeRecordSchema).default([]),
  bonds: z.array(panelBondRecordSchema).default([])
});

export const panelWiringAssetTypeSchema = z.enum([
  "instrument",
  "controller",
  "panel",
  "junction_box",
  "terminal_block",
  "breaker",
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
  sideHint: panelTerminalSideSchema.optional()
});

export const panelWiringSourceTerminalSchema = z.object({
  terminalKey: identifierSchema,
  label: z.string().trim().min(1).max(120),
  function: z.string().trim().max(200).optional(),
  supportedSides: z.array(panelTerminalSideSchema),
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
  panelConnectionId: identifierSchema.optional()
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
export type PanelInternalWireRecord = z.infer<
  typeof panelInternalWireRecordSchema
>;
export type PanelBridgeRecord = z.infer<typeof panelBridgeRecordSchema>;
export type PanelBondEndpoint = z.infer<typeof panelBondEndpointSchema>;
export type PanelBondRecord = z.infer<typeof panelBondRecordSchema>;
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
export type PanelWiringMutation = z.infer<typeof panelWiringMutationSchema>;
