import { z } from "zod";
import { drawingClientIdSchema } from "@/features/drawing_clients/api/public";

const optionalTrimmedString = (maximum: number) =>
  z.string().trim().max(maximum).optional();

export const drawingProjectStatusSchema = z.enum(["active", "archived"]);

export const drawingProjectIdSchema = z
  .string()
  .trim()
  .min(1, "Choose a valid Project.")
  .max(120, "Choose a valid Project.");

export const drawingProjectIdentitySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter a Project name.")
    .max(160, "Project name must be 160 characters or fewer."),
  clientId: drawingClientIdSchema.optional(),
  description: optionalTrimmedString(1000)
});

export const createDrawingProjectInputSchema = drawingProjectIdentitySchema;

export const updateDrawingProjectInputSchema = drawingProjectIdentitySchema.extend({
  projectId: drawingProjectIdSchema
});

export const setDrawingProjectStatusInputSchema = z.object({
  projectId: drawingProjectIdSchema,
  status: drawingProjectStatusSchema
});

export const drawingDescriptionSchema = z
  .string()
  .trim()
  .max(500, "Drawing description must be 500 characters or fewer.")
  .optional();

export const drawingProjectAssignmentSchema = drawingProjectIdSchema.optional();

export type DrawingProjectStatus = z.infer<typeof drawingProjectStatusSchema>;
export type DrawingProjectIdentityInput = z.infer<
  typeof drawingProjectIdentitySchema
>;
export type CreateDrawingProjectInput = z.infer<
  typeof createDrawingProjectInputSchema
>;
export type UpdateDrawingProjectInput = z.infer<
  typeof updateDrawingProjectInputSchema
>;
export type SetDrawingProjectStatusInput = z.infer<
  typeof setDrawingProjectStatusInputSchema
>;
