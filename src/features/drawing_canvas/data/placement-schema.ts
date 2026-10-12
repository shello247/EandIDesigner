import { z } from "zod";

/** Transient input only: never embed a placement session in the drawing model. */
export const placementCommitInputSchema = z.object({
  sessionId: z.string().min(1),
  sheetId: z.string().min(1),
  targetId: z.string().min(1).optional(),
  point: z.object({ x: z.number().finite(), y: z.number().finite() }),
  rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)])
});

export type PlacementCommitInput = z.infer<typeof placementCommitInputSchema>;
export type PlacementTool = "symbol" | "panel" | "backplane" | "helper" | "dimension" |
  "terminal-strip" | "reference" | "note" | "schedule" | "clipboard";
export type PlacementIdentity =
  | { mode: "create"; tagMode: "automatic" | "manual"; tag?: string }
  | { mode: "reference"; assetId: string }
  | { mode: "helper" };
export type PlacementTargetKind = "sheet" | "backplane" | "panel" | "connection-view";
