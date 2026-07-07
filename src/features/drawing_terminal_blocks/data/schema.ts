import { z } from "zod";

export const terminalBlockOrientationSchema = z.literal("horizontal");

export const terminalBlockPlacementSchema = z.object({
  kind: z.literal("modular_terminal_strip"),
  count: z.number().int().min(1).max(80),
  startNumber: z.number().int().min(1).max(9999),
  orientation: terminalBlockOrientationSchema.default("horizontal"),
  modulePitch: z.number().positive(),
  moduleWidth: z.number().positive(),
  moduleHeight: z.number().positive()
});

export type TerminalBlockOrientation = z.infer<
  typeof terminalBlockOrientationSchema
>;
export type TerminalBlockPlacement = z.infer<typeof terminalBlockPlacementSchema>;
