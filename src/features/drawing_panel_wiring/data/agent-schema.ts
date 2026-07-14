import { z } from "zod";
import {
  panelSourceEndpointRefSchema,
  panelTerminalSideRefSchema,
  panelWireAttributesSchema,
  panelWiringMutationSchema
} from "./schema";

const identifierSchema = z.string().trim().min(1);
const revisionSchema = z.string().trim().refine(
  (value) => !Number.isNaN(Date.parse(value)),
  "A valid drawing revision timestamp is required."
);

export const panelAgentEndpointSchema = z.object({
  terminal: panelTerminalSideRefSchema,
  placementId: identifierSchema,
  anchorKey: identifierSchema
});

export const panelAgentOperationSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("external_termination_mapping"),
    terminationId: identifierSchema,
    source: panelSourceEndpointRefSchema,
    target: panelTerminalSideRefSchema
  }),
  z.object({
    kind: z.literal("internal_wire"),
    sheetId: identifierSchema,
    from: panelAgentEndpointSchema,
    to: panelAgentEndpointSchema,
    wireId: z.string().trim().min(1).max(120).optional(),
    attributes: panelWireAttributesSchema.optional()
  })
]);

export const panelAgentPlanWarningSchema = z.object({
  code: identifierSchema,
  message: z.string().trim().min(1).max(500)
});

export const panelAgentPlanSchema = z.object({
  schemaVersion: z.literal(1),
  drawingId: identifierSchema,
  panelAssetId: identifierSchema,
  baseUpdatedAt: revisionSchema,
  operation: panelAgentOperationSchema,
  mutationPreview: z.array(panelWiringMutationSchema),
  warnings: z.array(panelAgentPlanWarningSchema),
  affectedIds: z.array(identifierSchema),
  digest: z.string().regex(/^[a-f0-9]{64}$/)
});

export const panelAgentPlanValidationSchema = z.object({
  valid: z.boolean(),
  errors: z.array(z.string()),
  warnings: z.array(panelAgentPlanWarningSchema),
  mutations: z.array(panelWiringMutationSchema),
  affectedIds: z.array(identifierSchema)
});

export const panelAgentApplicationContextSchema = z.object({
  drawingStatus: z.enum([
    "draft",
    "needs_review",
    "approved",
    "archived"
  ]),
  currentUpdatedAt: revisionSchema,
  saved: z.boolean(),
  detailedPanelDrawingsEnabled: z.boolean().default(true),
  approvedDigest: z.string().regex(/^[a-f0-9]{64}$/)
});

export const panelAgentApplicationResultSchema = z.object({
  mutations: z.array(panelWiringMutationSchema),
  warnings: z.array(panelAgentPlanWarningSchema),
  affectedIds: z.array(identifierSchema),
  requiredStatus: z.literal("needs_review")
});

export const panelAgentContextSchema = z.object({
  panelAssetId: identifierSchema,
  panelTag: z.string(),
  panelTitle: z.string(),
  detailedSheetIds: z.array(identifierSchema),
  associatedAssetIds: z.array(identifierSchema),
  terminalCount: z.number().int().nonnegative(),
  externalTerminationCount: z.number().int().nonnegative(),
  unresolvedTerminationCount: z.number().int().nonnegative(),
  internalWireCount: z.number().int().nonnegative(),
  findingCount: z.number().int().nonnegative()
});

export const unresolvedPanelTerminationSchema = z.object({
  terminationId: identifierSchema,
  source: panelSourceEndpointRefSchema,
  sourceSheetId: identifierSchema,
  sourceSheetNumber: z.number().int().positive(),
  sourceSheetName: z.string(),
  wireId: z.string().optional(),
  cableTag: z.string().optional(),
  conductorKey: z.string().optional(),
  reason: z.string()
});

export type PanelAgentEndpoint = z.infer<typeof panelAgentEndpointSchema>;
export type PanelAgentOperation = z.infer<typeof panelAgentOperationSchema>;
export type PanelAgentPlan = z.infer<typeof panelAgentPlanSchema>;
export type PanelAgentPlanWarning = z.infer<
  typeof panelAgentPlanWarningSchema
>;
export type PanelAgentPlanValidation = z.infer<
  typeof panelAgentPlanValidationSchema
>;
export type PanelAgentApplicationContext = z.infer<
  typeof panelAgentApplicationContextSchema
>;
export type PanelAgentApplicationResult = z.infer<
  typeof panelAgentApplicationResultSchema
>;
export type PanelAgentContext = z.infer<typeof panelAgentContextSchema>;
export type UnresolvedPanelTermination = z.infer<
  typeof unresolvedPanelTerminationSchema
>;
