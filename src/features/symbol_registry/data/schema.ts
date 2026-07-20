import { z } from "zod";

export const symbolStatusSchema = z.enum([
  "draft",
  "needs_review",
  "approved",
  "archived"
]);

export const symbolCategorySchema = z.enum([
  "instrument",
  "monitor",
  "network_device",
  "terminal_block",
  "cable_assembly",
  "gland",
  "other"
]);

export function isDrawingSymbolCategory(category: string): boolean {
  return category !== "network_device";
}

export function isNetworkSymbolCategory(category: string): boolean {
  return category === "network_device";
}

export const anchorKindSchema = z.enum([
  "terminal",
  "network_port",
  "ground",
  "shield",
  "label",
  "mounting",
  "other"
]);

export const validationIssueSeveritySchema = z.enum([
  "blocking",
  "warning",
  "info"
]);

export const symbolLayoutUsageSchema = z.enum([
  "wiring",
  "panel_layout",
  "both"
]);

export const symbolPanelMountingTypeSchema = z.enum([
  "din_rail",
  "backplate",
  "wire_duct",
  "door",
  "free"
]);

export const symbolPanelCategorySchema = z.enum([
  "protection",
  "termination",
  "controller",
  "power",
  "ducting",
  "rail",
  "label",
  "other"
]);

export const networkDeviceTypeSchema = z.enum([
  "switch",
  "router_firewall",
  "controller_plc",
  "hmi_workstation",
  "server",
  "wireless_radio",
  "field_device",
  "patch_point",
  "media_converter"
]);

export const networkPortMediaSchema = z.enum([
  "copper",
  "fiber",
  "wireless",
  "serial",
  "virtual",
  "other"
]);

const NETWORK_PORT_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;

export function normalizeNetworkPortKey(value: string): string {
  return value.trim().toUpperCase();
}

export const networkPortKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(
    NETWORK_PORT_KEY_PATTERN,
    "Network port keys may contain only letters, numbers, periods, underscores, and hyphens."
  )
  .transform(normalizeNetworkPortKey);

export const viewBoxSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().positive(),
  height: z.number().positive()
});

export const symbolAnchorSchema = z
  .object({
    key: z.string().trim().min(1).max(80),
    x: z.number().finite(),
    y: z.number().finite(),
    kind: anchorKindSchema
  })
  .superRefine((anchor, context) => {
    if (
      anchor.kind === "network_port" &&
      !networkPortKeySchema.safeParse(anchor.key).success
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Network port anchor keys may contain only letters, numbers, periods, underscores, and hyphens.",
        path: ["key"]
      });
    }
  })
  .transform((anchor) =>
    anchor.kind === "network_port"
      ? { ...anchor, key: normalizeNetworkPortKey(anchor.key) }
      : anchor
  );

export const symbolTerminalPanelSideSchema = z.enum([
  "external",
  "internal",
  "single"
]);

export const symbolElectricalDomainSchema = z.enum([
  "signal",
  "power",
  "neutral",
  "shield",
  "protective_earth",
  "signal_ground"
]);

export const symbolPanelWiringAssetTypeSchema = z.enum([
  "instrument",
  "controller",
  "terminal_block",
  "breaker",
  "fuse",
  "relay",
  "power_supply",
  "isolator",
  "converter",
  "io_module",
  "earth_bar",
  "other"
]);

export const symbolPanelWiringCapabilitySchema = z.object({
  assetType: symbolPanelWiringAssetTypeSchema,
  tagPrefix: z.string().trim().min(1).max(24),
  schematicScale: z.number().positive().optional()
});

export const symbolTerminalBlockModuleSchema = z.object({
  kind: z.literal("feed_through"),
  defaultForGeneratedGroups: z.boolean().default(false)
});

export const symbolTerminalSchema = z.object({
  key: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(120),
  function: z.string().trim().max(200).optional(),
  anchorKey: z.string().trim().min(1).max(80),
  panelSide: symbolTerminalPanelSideSchema.optional(),
  electricalDomains: z.array(symbolElectricalDomainSchema).optional(),
  requiredForWiring: z.boolean()
});

export const symbolLayoutMetadataSchema = z.object({
  layoutUsage: symbolLayoutUsageSchema.default("wiring"),
  physicalWidthMm: z.number().positive().optional(),
  physicalHeightMm: z.number().positive().optional(),
  mountingType: symbolPanelMountingTypeSchema.optional(),
  panelCategory: symbolPanelCategorySchema.optional(),
  resizable: z.boolean().default(false),
  terminalBlockModule: symbolTerminalBlockModuleSchema.optional()
});

export const symbolNetworkPortSchema = z.object({
  key: networkPortKeySchema,
  label: z.string().trim().min(1).max(120),
  anchorKey: networkPortKeySchema,
  media: networkPortMediaSchema,
  speedMbps: z.number().int().positive().optional(),
  protocolHints: z.array(z.string().trim().min(1).max(80)).default([])
});

export const symbolNetworkProfileSchema = z.object({
  deviceType: networkDeviceTypeSchema,
  managed: z.boolean().optional(),
  ports: z.array(symbolNetworkPortSchema).default([])
});

export const symbolMetadataSchema = z
  .object({
    symbolKey: z.string().trim().min(1).max(120),
    displayName: z.string().trim().min(1).max(200),
    manufacturer: z.string().trim().max(160).optional(),
    model: z.string().trim().max(160).optional(),
    category: symbolCategorySchema,
    layoutUsage: symbolLayoutUsageSchema.optional(),
    physicalWidthMm: z.number().positive().optional(),
    physicalHeightMm: z.number().positive().optional(),
    mountingType: symbolPanelMountingTypeSchema.optional(),
    panelCategory: symbolPanelCategorySchema.optional(),
    resizable: z.boolean().optional(),
    terminalBlockModule: symbolTerminalBlockModuleSchema.optional(),
    panelWiring: symbolPanelWiringCapabilitySchema.optional(),
    networkProfile: symbolNetworkProfileSchema.optional(),
    viewBox: viewBoxSchema,
    terminals: z.array(symbolTerminalSchema),
    anchors: z.array(symbolAnchorSchema)
  })
  .superRefine((metadata, context) => {
    if (metadata.category === "network_device" && !metadata.networkProfile) {
      context.addIssue({
        code: "custom",
        message: "Network device symbols require a network profile.",
        path: ["networkProfile"]
      });
      return;
    }

    if (metadata.category !== "network_device" && metadata.networkProfile) {
      context.addIssue({
        code: "custom",
        message: "Network profile is only valid for network device symbols.",
        path: ["networkProfile"]
      });
      return;
    }

    if (!metadata.networkProfile) {
      return;
    }

    const anchorsByKey = new Map(
      metadata.anchors.map((anchor) => [anchor.key, anchor])
    );
    const portKeys = new Set<string>();

    metadata.networkProfile.ports.forEach((port, index) => {
      if (portKeys.has(port.key)) {
        context.addIssue({
          code: "custom",
          message: `Network port key "${port.key}" is duplicated.`,
          path: ["networkProfile", "ports", index, "key"]
        });
      }
      portKeys.add(port.key);

      const anchor = anchorsByKey.get(port.anchorKey);

      if (!anchor) {
        context.addIssue({
          code: "custom",
          message: `Network port "${port.key}" references a missing anchor.`,
          path: ["networkProfile", "ports", index, "anchorKey"]
        });
        return;
      }

      if (anchor.kind !== "network_port") {
        context.addIssue({
          code: "custom",
          message: `Network port "${port.key}" must reference a network port anchor.`,
          path: ["networkProfile", "ports", index, "anchorKey"]
        });
      }
    });
  });

export const validationIssueSchema = z.object({
  severity: validationIssueSeveritySchema,
  code: z.string().trim().min(1).max(80),
  message: z.string().trim().min(1).max(400),
  path: z.string().trim().max(240).optional()
});

export const symbolSourceAssetInputSchema = z.object({
  fileName: z.string().trim().min(1).max(240),
  mimeType: z.string().trim().min(1).max(120),
  sizeBytes: z.number().int().nonnegative(),
  dataUrl: z.string().trim().optional()
});

export const saveSymbolDraftInputSchema = z.object({
  svg: z.string().trim().min(1),
  metadata: symbolMetadataSchema,
  sourceInputSummary: z.string().trim().max(2000).optional(),
  aiResponseId: z.string().trim().max(200).optional(),
  sourceAsset: symbolSourceAssetInputSchema.optional()
});

export const terminalMapUpdateInputSchema = z.object({
  versionId: z.string().trim().min(1),
  terminals: z.array(symbolTerminalSchema)
});

export const symbolLayoutMetadataUpdateInputSchema =
  symbolLayoutMetadataSchema.extend({
    versionId: z.string().trim().min(1)
  });

export const updateSymbolNetworkProfileInputSchema = z.object({
  versionId: z.string().trim().min(1),
  manufacturer: z.string().trim().max(160).optional(),
  model: z.string().trim().max(160).optional(),
  networkProfile: symbolNetworkProfileSchema
});

export const approvedNetworkVersionIdsSchema = z
  .array(z.string().trim().min(1).max(120))
  .max(5000)
  .transform((versionIds) => [...new Set(versionIds)]);

export const symbolPanelWiringCapabilityUpdateInputSchema = z.object({
  versionId: z.string().trim().min(1),
  panelWiring: symbolPanelWiringCapabilitySchema.optional()
});

export const terminalMapVerificationIssueSchema = z.object({
  severity: validationIssueSeveritySchema,
  terminalKey: z.string().trim().max(80).optional(),
  message: z.string().trim().min(1).max(400),
  evidence: z.string().trim().max(500).optional(),
  suggestedFix: z.string().trim().max(500).optional()
});

export const terminalMapVerificationResultSchema = z.object({
  confidence: z.enum(["low", "medium", "high"]),
  summary: z.string().trim().min(1).max(600),
  issues: z.array(terminalMapVerificationIssueSchema),
  suggestedTerminals: z.array(symbolTerminalSchema),
  reviewNotes: z.array(z.string().trim().min(1).max(400))
});

export const engineerNoteImageInputSchema = z.object({
  fileName: z.string().trim().min(1).max(240),
  mimeType: z.string().trim().min(1).max(120),
  sizeBytes: z.number().int().nonnegative(),
  dataUrl: z.string().trim().min(1)
});

export const createEngineerNoteInputSchema = z.object({
  symbolId: z.string().trim().min(1),
  versionId: z.string().trim().min(1).optional(),
  notes: z.string().trim().min(1).max(20000),
  image: engineerNoteImageInputSchema.optional()
});

export const uploadSymbolDocumentInputSchema = z.object({
  symbolId: z.string().trim().min(1),
  versionId: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1).max(240),
  fileName: z.string().trim().min(1).max(240),
  mimeType: z.string().trim().min(1).max(120),
  sizeBytes: z.number().int().positive(),
  dataUrl: z.string().trim().min(1)
});

export const terminalMapVerificationJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "confidence",
    "summary",
    "issues",
    "suggestedTerminals",
    "reviewNotes"
  ],
  properties: {
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    summary: { type: "string" },
    issues: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "severity",
          "terminalKey",
          "message",
          "evidence",
          "suggestedFix"
        ],
        properties: {
          severity: { type: "string", enum: ["blocking", "warning", "info"] },
          terminalKey: { type: "string" },
          message: { type: "string" },
          evidence: { type: "string" },
          suggestedFix: { type: "string" }
        }
      }
    },
    suggestedTerminals: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["key", "label", "function", "anchorKey", "requiredForWiring"],
        properties: {
          key: { type: "string" },
          label: { type: "string" },
          function: { type: "string" },
          anchorKey: { type: "string" },
          requiredForWiring: { type: "boolean" }
        }
      }
    },
    reviewNotes: {
      type: "array",
      items: { type: "string" }
    }
  }
} as const;

export type SymbolStatus = z.infer<typeof symbolStatusSchema>;
export type SymbolCategory = z.infer<typeof symbolCategorySchema>;
export type AnchorKind = z.infer<typeof anchorKindSchema>;
export type NetworkDeviceType = z.infer<typeof networkDeviceTypeSchema>;
export type NetworkPortMedia = z.infer<typeof networkPortMediaSchema>;
export type SymbolLayoutUsage = z.infer<typeof symbolLayoutUsageSchema>;
export type SymbolPanelMountingType = z.infer<
  typeof symbolPanelMountingTypeSchema
>;
export type SymbolPanelCategory = z.infer<typeof symbolPanelCategorySchema>;
export type SymbolPanelWiringAssetType = z.infer<
  typeof symbolPanelWiringAssetTypeSchema
>;
export type SymbolPanelWiringCapability = z.infer<
  typeof symbolPanelWiringCapabilitySchema
>;
export type SymbolLayoutMetadata = z.infer<typeof symbolLayoutMetadataSchema>;
export type SymbolNetworkPort = z.infer<typeof symbolNetworkPortSchema>;
export type SymbolNetworkProfile = z.infer<typeof symbolNetworkProfileSchema>;
export type SymbolMetadata = z.infer<typeof symbolMetadataSchema>;
export type SymbolAnchor = z.infer<typeof symbolAnchorSchema>;
export type SymbolTerminal = z.infer<typeof symbolTerminalSchema>;
export type SymbolTerminalPanelSide = z.infer<
  typeof symbolTerminalPanelSideSchema
>;
export type SymbolElectricalDomain = z.infer<
  typeof symbolElectricalDomainSchema
>;
export type ValidationIssue = z.infer<typeof validationIssueSchema>;
export type SaveSymbolDraftInput = z.infer<typeof saveSymbolDraftInputSchema>;
export type TerminalMapUpdateInput = z.infer<
  typeof terminalMapUpdateInputSchema
>;
export type SymbolLayoutMetadataUpdateInput = z.infer<
  typeof symbolLayoutMetadataUpdateInputSchema
>;
export type UpdateSymbolNetworkProfileInput = z.infer<
  typeof updateSymbolNetworkProfileInputSchema
>;
export type ApprovedNetworkVersionIds = z.infer<
  typeof approvedNetworkVersionIdsSchema
>;
export type SymbolPanelWiringCapabilityUpdateInput = z.infer<
  typeof symbolPanelWiringCapabilityUpdateInputSchema
>;
export type TerminalMapVerificationIssue = z.infer<
  typeof terminalMapVerificationIssueSchema
>;
export type TerminalMapVerificationResult = z.infer<
  typeof terminalMapVerificationResultSchema
>;
export type CreateEngineerNoteInput = z.infer<
  typeof createEngineerNoteInputSchema
>;
export type UploadSymbolDocumentInput = z.infer<
  typeof uploadSymbolDocumentInputSchema
>;

export function parseMetadataJson(metadataJson: string): SymbolMetadata {
  return symbolMetadataSchema.parse(JSON.parse(metadataJson));
}

export function stringifyMetadata(metadata: SymbolMetadata): string {
  return JSON.stringify(symbolMetadataSchema.parse(metadata), null, 2);
}
