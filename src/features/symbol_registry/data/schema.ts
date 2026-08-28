import { z } from "zod";
import { symbolComponentPositionsSchema } from "@/features/symbol_components/api/public";
import { symbolCategorySummarySchema } from "@/features/symbol_categories/api/public";

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
  "protection",
  "termination",
  "controller",
  "power",
  "ducting",
  "rail",
  "label",
  "other"
]);

export const symbolTechnicalKindSchema = symbolCategorySchema;

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
  "network_device",
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

export const symbolTerminalStripMemberRoleSchema = z.enum([
  "electrical",
  "end_bracket",
  "accessory"
]);

export const symbolTerminalStripCapabilitySchema = z.object({
  role: symbolTerminalStripMemberRoleSchema,
  railDatumMm: z.number().nonnegative(),
  defaultForNewStrips: z.boolean().optional()
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

export const symbolPermanentContinuityGroupSchema = z.object({
  key: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(160).optional(),
  terminalKeys: z.array(z.string().trim().min(1).max(80)).min(2)
});

export const symbolElectricalTopologySchema = z.object({
  version: z.literal(1),
  permanentContinuityGroups: z.array(symbolPermanentContinuityGroupSchema)
});

export const symbolLayoutMetadataSchema = z.object({
  layoutUsage: symbolLayoutUsageSchema.default("wiring"),
  physicalWidthMm: z.number().positive().optional(),
  physicalHeightMm: z.number().positive().optional(),
  mountingType: symbolPanelMountingTypeSchema.optional(),
  panelCategory: symbolPanelCategorySchema.optional(),
  resizable: z.boolean().default(false),
  terminalBlockModule: symbolTerminalBlockModuleSchema.optional(),
  terminalStripCapability: symbolTerminalStripCapabilitySchema.optional()
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
    description: z.string().trim().max(400).optional(),
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
    terminalStripCapability: symbolTerminalStripCapabilitySchema.optional(),
    panelWiring: symbolPanelWiringCapabilitySchema.optional(),
    electricalTopology: symbolElectricalTopologySchema.optional(),
    networkProfile: symbolNetworkProfileSchema.optional(),
    viewBox: viewBoxSchema,
    terminals: z.array(symbolTerminalSchema),
    anchors: z.array(symbolAnchorSchema),
    componentPositions: symbolComponentPositionsSchema.optional()
  })
  .superRefine((metadata, context) => {
    if (metadata.electricalTopology) {
      const logicalTerminalKeys = new Set(
        metadata.terminals.map((terminal) => terminal.key)
      );
      const domainsByTerminalKey = new Map<
        string,
        Set<z.infer<typeof symbolElectricalDomainSchema>>
      >();
      for (const terminal of metadata.terminals) {
        const domains = domainsByTerminalKey.get(terminal.key) ?? new Set();
        for (const domain of terminal.electricalDomains ?? []) {
          domains.add(domain);
        }
        domainsByTerminalKey.set(terminal.key, domains);
      }
      const groupKeys = new Set<string>();
      const assignedTerminalKeys = new Map<string, string>();

      metadata.electricalTopology.permanentContinuityGroups.forEach(
        (group, groupIndex) => {
          if (groupKeys.has(group.key)) {
            context.addIssue({
              code: "custom",
              message: `Continuity group key "${group.key}" is duplicated.`,
              path: ["electricalTopology", "permanentContinuityGroups", groupIndex, "key"]
            });
          }
          groupKeys.add(group.key);

          const uniqueTerminalKeys = new Set<string>();
          for (const [terminalIndex, terminalKey] of group.terminalKeys.entries()) {
            if (uniqueTerminalKeys.has(terminalKey)) {
              context.addIssue({
                code: "custom",
                message: `Terminal "${terminalKey}" is duplicated in continuity group "${group.key}".`,
                path: ["electricalTopology", "permanentContinuityGroups", groupIndex, "terminalKeys", terminalIndex]
              });
            }
            uniqueTerminalKeys.add(terminalKey);

            if (!logicalTerminalKeys.has(terminalKey)) {
              context.addIssue({
                code: "custom",
                message: `Continuity group "${group.key}" references missing terminal "${terminalKey}".`,
                path: ["electricalTopology", "permanentContinuityGroups", groupIndex, "terminalKeys", terminalIndex]
              });
            }

            const previousGroup = assignedTerminalKeys.get(terminalKey);
            if (previousGroup && previousGroup !== group.key) {
              context.addIssue({
                code: "custom",
                message: `Terminal "${terminalKey}" belongs to both "${previousGroup}" and "${group.key}".`,
                path: ["electricalTopology", "permanentContinuityGroups", groupIndex, "terminalKeys", terminalIndex]
              });
            } else {
              assignedTerminalKeys.set(terminalKey, group.key);
            }
          }

          const explicitDomainSets = [...uniqueTerminalKeys]
            .map((terminalKey) => domainsByTerminalKey.get(terminalKey) ?? new Set())
            .filter((domains) => domains.size > 0);
          if (explicitDomainSets.length > 1) {
            const sharedDomains = new Set(explicitDomainSets[0]);
            for (const domains of explicitDomainSets.slice(1)) {
              for (const domain of [...sharedDomains]) {
                if (!domains.has(domain)) sharedDomains.delete(domain);
              }
            }
            if (sharedDomains.size === 0) {
              context.addIssue({
                code: "custom",
                message: `Continuity group "${group.key}" joins terminals with incompatible electrical domains.`,
                path: ["electricalTopology", "permanentContinuityGroups", groupIndex, "terminalKeys"]
              });
            }
          }
        }
      );
    }

    if (metadata.terminalStripCapability) {
      if (
        metadata.layoutUsage === "wiring" ||
        metadata.mountingType !== "din_rail" ||
        !metadata.physicalWidthMm ||
        !metadata.physicalHeightMm
      ) {
        context.addIssue({
          code: "custom",
          message:
            "Terminal-strip members require panel-layout use, positive physical dimensions, and DIN-rail mounting.",
          path: ["terminalStripCapability"]
        });
      } else if (
        metadata.terminalStripCapability.railDatumMm >
        metadata.physicalHeightMm
      ) {
        context.addIssue({
          code: "custom",
          message: "The DIN-rail datum must fall within the physical height.",
          path: ["terminalStripCapability", "railDatumMm"]
        });
      }

      if (
        metadata.terminalStripCapability.role === "electrical" &&
        metadata.terminals.length === 0
      ) {
        context.addIssue({
          code: "custom",
          message: "Electrical terminal-strip members require at least one terminal.",
          path: ["terminalStripCapability", "role"]
        });
      }

      if (
        metadata.terminalStripCapability.role !== "electrical" &&
        metadata.terminals.length > 0
      ) {
        context.addIssue({
          code: "custom",
          message:
            "End brackets and terminal-strip accessories cannot expose wiring terminals.",
          path: ["terminalStripCapability", "role"]
        });
      }
    }

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
  categoryId: z.string().trim().min(1).max(120).optional(),
  sourceInputSummary: z.string().trim().max(2000).optional(),
  aiResponseId: z.string().trim().max(200).optional(),
  sourceAsset: symbolSourceAssetInputSchema.optional()
});

export const saveSymbolMetadataChangesInputSchema = z.object({
  symbolId: z.string().trim().min(1).max(120),
  versionId: z.string().trim().min(1).max(120),
  categoryId: z.string().trim().min(1).max(120).optional(),
  registryDetails: z.object({
    displayName: z.string().trim().min(1).max(200),
    description: z.string().trim().max(400).optional()
  }),
  layout: symbolLayoutMetadataSchema,
  panelWiring: symbolPanelWiringCapabilitySchema.optional(),
  electricalTopology: symbolElectricalTopologySchema.optional(),
  terminals: z.array(symbolTerminalSchema),
  componentPositions: symbolComponentPositionsSchema.optional(),
  networkProfile: symbolNetworkProfileSchema.optional(),
  networkIdentity: z
    .object({
      manufacturer: z.string().trim().max(160).optional(),
      model: z.string().trim().max(160).optional()
    })
    .optional()
});

export const drawingSymbolVersionIdsSchema = z
  .array(z.string().trim().min(1).max(120))
  .max(5000)
  .transform((versionIds) => [...new Set(versionIds)]);

export const drawingSymbolCatalogCapabilitiesSchema = z.object({
  layoutUsage: symbolLayoutUsageSchema.optional(),
  physicalWidthMm: z.number().positive().optional(),
  physicalHeightMm: z.number().positive().optional(),
  mountingType: symbolPanelMountingTypeSchema.optional(),
  panelCategory: symbolPanelCategorySchema.optional(),
  terminalBlockModule: symbolTerminalBlockModuleSchema.optional(),
  terminalStripCapability: symbolTerminalStripCapabilitySchema.optional()
});

export const drawingSymbolCatalogSummarySchema = z.object({
  symbolId: z.string().trim().min(1).max(120),
  symbolKey: z.string().trim().min(1).max(120),
  displayName: z.string().trim().min(1).max(200),
  manufacturer: z.string().trim().max(160).nullable().optional(),
  model: z.string().trim().max(160).nullable().optional(),
  technicalKind: symbolTechnicalKindSchema,
  managedCategory: symbolCategorySummarySchema,
  versionId: z.string().trim().min(1).max(120),
  versionNumber: z.number().int().positive(),
  capabilities: drawingSymbolCatalogCapabilitiesSchema
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
export type SymbolTechnicalKind = SymbolCategory;
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
export type SymbolPermanentContinuityGroup = z.infer<
  typeof symbolPermanentContinuityGroupSchema
>;
export type SymbolElectricalTopology = z.infer<
  typeof symbolElectricalTopologySchema
>;
export type SymbolTerminalStripMemberRole = z.infer<
  typeof symbolTerminalStripMemberRoleSchema
>;
export type SymbolTerminalStripCapability = z.infer<
  typeof symbolTerminalStripCapabilitySchema
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
export type SaveSymbolMetadataChangesInput = z.infer<
  typeof saveSymbolMetadataChangesInputSchema
>;
export type DrawingSymbolVersionIds = z.infer<
  typeof drawingSymbolVersionIdsSchema
>;
export type DrawingSymbolCatalogCapabilities = z.infer<
  typeof drawingSymbolCatalogCapabilitiesSchema
>;
export type DrawingSymbolCatalogSummary = z.infer<
  typeof drawingSymbolCatalogSummarySchema
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
