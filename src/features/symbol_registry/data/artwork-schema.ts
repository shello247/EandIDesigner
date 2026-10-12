import { z } from "zod";

export const ARTWORK_MAX_BYTES = 50 * 1024;
export const artworkInputSchema = z.object({
  symbolId: z.string().min(1).max(128),
  versionId: z.string().min(1).max(128),
  fileName: z.string().min(1).max(180).regex(/^[^\\/\x00-\x1f]+\.svg$/i, "Choose an SVG file."),
  svg: z.string().min(1).max(ARTWORK_MAX_BYTES)
}).strict();
export const artworkSaveSchema = artworkInputSchema.extend({ token: z.string().regex(/^[a-f0-9]{64}$/) });
export type ArtworkInput = z.infer<typeof artworkInputSchema>;
export type ArtworkSaveInput = z.infer<typeof artworkSaveSchema>;
export type ArtworkPreview = { svg: string; token: string; versionNumber: number; terminalCount: number };
