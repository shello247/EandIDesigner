import { z } from "zod";

export const drawingClientIdSchema = z
  .string()
  .trim()
  .min(1, "Choose a valid Client.")
  .max(120, "Choose a valid Client.");

export const drawingClientNameSchema = z
  .string()
  .trim()
  .min(1, "Enter a Client name.")
  .max(160, "Client name must be 160 characters or fewer.");

export const createDrawingClientInputSchema = z.object({
  name: drawingClientNameSchema
});

export type CreateDrawingClientInput = z.infer<
  typeof createDrawingClientInputSchema
>;
