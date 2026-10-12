import { z } from "zod";

const id = z.string().min(1).max(240);
const canonicalTerminalSchema = z.object({ assetId: id, terminalKey: id, side: z.enum(["single", "internal", "external"]) });
export const previewEndpointSchema = z.object({ placementId: id, anchorKey: id, canonical: canonicalTerminalSchema.optional() });
export const previewSourceSchema = z.object({
  id, title: z.string().max(240), provenance: z.enum(["example", "drawing"]),
  revision: z.string().max(240),
  limitations: z.array(z.string().max(1000)).default([]),
  scopeNotes: z.array(z.string().max(1000)).optional(),
  integrityIssues: z.array(z.string().max(1000)).optional(),
  devices: z.array(z.object({
    id, assetId: id.optional(), versionId: id, tag: z.string().max(160), title: z.string().max(400),
    kind: z.enum(["power_supply", "terminal_block", "generic"]),
    x: z.number().finite(), y: z.number().finite(),
    terminals: z.array(z.object({
      key: id, anchorKey: id, label: z.string().max(240),
      role: z.string().max(80).optional(), x: z.number().finite(), y: z.number().finite(),
      canonical: canonicalTerminalSchema.optional()
    })).max(160),
    continuity: z.array(z.object({ id, terminalKeys: z.array(id).min(2).max(160) })).max(160)
  })).max(100),
  wires: z.array(z.object({ id, label: z.string().max(240), from: previewEndpointSchema, to: previewEndpointSchema,
    canonicalWireId: id.optional(), validationIssue: z.string().max(1000).optional()
  })).max(600)
});
export type PreviewSource = z.infer<typeof previewSourceSchema>;
export type PreviewEndpoint = z.infer<typeof previewEndpointSchema>;
