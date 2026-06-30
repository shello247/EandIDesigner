import { z } from "zod";
import { validationIssueSeveritySchema } from "@/features/symbol_registry/data/schema";

export const drawingStatusSchema = z.enum([
  "draft",
  "needs_review",
  "approved",
  "archived"
]);

export const placementRoleSchema = z.enum([
  "device",
  "cable_assembly",
  "terminal_block",
  "other"
]);

export const drawingEndpointSchema = z.object({
  placementId: z.string().trim().min(1),
  anchorKey: z.string().trim().min(1)
});

export const drawingRoutePointSchema = z.object({
  id: z.string().trim().min(1),
  x: z.number().finite(),
  y: z.number().finite(),
  kind: z.enum(["endpoint", "elbow", "control"])
});

export const drawingConnectionRouteSchema = z.object({
  mode: z.enum(["manual", "auto"]),
  style: z.literal("orthogonal"),
  points: z.array(drawingRoutePointSchema).min(2),
  labelPosition: z
    .object({
      x: z.number().finite(),
      y: z.number().finite()
    })
    .optional(),
  locked: z.boolean().optional()
});

export const drawingPlacementSchema = z.object({
  id: z.string().trim().min(1),
  symbolId: z.string().trim().min(1),
  versionId: z.string().trim().min(1),
  role: placementRoleSchema,
  tag: z.string().trim().min(1).max(120),
  x: z.number().finite(),
  y: z.number().finite(),
  rotation: z.number().finite(),
  scale: z.number().positive()
});

export const drawingConnectionSchema = z.object({
  id: z.string().trim().min(1),
  from: drawingEndpointSchema,
  to: drawingEndpointSchema,
  label: z.string().trim().max(160).optional(),
  wireId: z.string().trim().max(80).optional(),
  cablePlacementId: z.string().trim().min(1).optional(),
  conductorKey: z.string().trim().max(80).optional(),
  route: drawingConnectionRouteSchema.optional()
});

export const drawingAnnotationSchema = z.object({
  id: z.string().trim().min(1),
  text: z.string().trim().min(1).max(400),
  x: z.number().finite(),
  y: z.number().finite(),
  kind: z.enum(["note", "callout", "title"])
});

export const drawingTitleBlockSchema = z.object({
  client: z.string().trim().max(160).optional(),
  project: z.string().trim().max(200).optional(),
  drawingNumber: z.string().trim().max(120).optional(),
  revision: z.string().trim().max(40).optional(),
  preparedBy: z.string().trim().max(120).optional(),
  checkedBy: z.string().trim().max(120).optional(),
  date: z.string().trim().max(40).optional()
});

export const drawingModelSchema = z.object({
  version: z.literal(1),
  sheet: z.object({
    size: z.literal("A3_LANDSCAPE"),
    width: z.number().positive(),
    height: z.number().positive(),
    gridSize: z.number().positive(),
    titleBlock: drawingTitleBlockSchema
  }),
  placements: z.array(drawingPlacementSchema),
  connections: z.array(drawingConnectionSchema),
  annotations: z.array(drawingAnnotationSchema)
});

export const drawingValidationIssueSchema = z.object({
  severity: validationIssueSeveritySchema,
  code: z.string().trim().min(1).max(80),
  message: z.string().trim().min(1).max(500),
  path: z.string().trim().max(240).optional()
});

export const createDrawingInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  drawingKey: z.string().trim().min(1).max(120).optional()
});

export const saveDrawingInputSchema = z.object({
  drawingId: z.string().trim().min(1),
  title: z.string().trim().min(1).max(200),
  model: drawingModelSchema
});

export type DrawingStatus = z.infer<typeof drawingStatusSchema>;
export type DrawingPlacementRole = z.infer<typeof placementRoleSchema>;
export type DrawingEndpoint = z.infer<typeof drawingEndpointSchema>;
export type DrawingRoutePoint = z.infer<typeof drawingRoutePointSchema>;
export type DrawingConnectionRoute = z.infer<
  typeof drawingConnectionRouteSchema
>;
export type DrawingPlacement = z.infer<typeof drawingPlacementSchema>;
export type DrawingConnection = z.infer<typeof drawingConnectionSchema>;
export type DrawingAnnotation = z.infer<typeof drawingAnnotationSchema>;
export type DrawingModel = z.infer<typeof drawingModelSchema>;
export type DrawingValidationIssue = z.infer<
  typeof drawingValidationIssueSchema
>;
export type CreateDrawingInput = z.infer<typeof createDrawingInputSchema>;
export type SaveDrawingInput = z.infer<typeof saveDrawingInputSchema>;

export function createDefaultDrawingModel(): DrawingModel {
  return {
    version: 1,
    sheet: {
      size: "A3_LANDSCAPE",
      width: 420,
      height: 297,
      gridSize: 10,
      titleBlock: {
        revision: "A",
        date: new Date().toISOString().slice(0, 10)
      }
    },
    placements: [],
    connections: [],
    annotations: []
  };
}

export function parseDrawingModelJson(modelJson: string): DrawingModel {
  return drawingModelSchema.parse(JSON.parse(modelJson));
}

export function stringifyDrawingModel(model: DrawingModel): string {
  return JSON.stringify(drawingModelSchema.parse(model), null, 2);
}
