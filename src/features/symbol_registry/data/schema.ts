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
  "terminal_block",
  "cable_assembly",
  "gland",
  "other"
]);

export const anchorKindSchema = z.enum([
  "terminal",
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

export const viewBoxSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().positive(),
  height: z.number().positive()
});

export const symbolAnchorSchema = z.object({
  key: z.string().trim().min(1).max(80),
  x: z.number().finite(),
  y: z.number().finite(),
  kind: anchorKindSchema
});

export const symbolTerminalSchema = z.object({
  key: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(120),
  function: z.string().trim().max(200).optional(),
  anchorKey: z.string().trim().min(1).max(80),
  requiredForWiring: z.boolean()
});

export const symbolMetadataSchema = z.object({
  symbolKey: z.string().trim().min(1).max(120),
  displayName: z.string().trim().min(1).max(200),
  manufacturer: z.string().trim().max(160).optional(),
  model: z.string().trim().max(160).optional(),
  category: symbolCategorySchema,
  viewBox: viewBoxSchema,
  terminals: z.array(symbolTerminalSchema),
  anchors: z.array(symbolAnchorSchema)
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
export type SymbolMetadata = z.infer<typeof symbolMetadataSchema>;
export type SymbolAnchor = z.infer<typeof symbolAnchorSchema>;
export type SymbolTerminal = z.infer<typeof symbolTerminalSchema>;
export type ValidationIssue = z.infer<typeof validationIssueSchema>;
export type SaveSymbolDraftInput = z.infer<typeof saveSymbolDraftInputSchema>;
export type TerminalMapUpdateInput = z.infer<
  typeof terminalMapUpdateInputSchema
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
