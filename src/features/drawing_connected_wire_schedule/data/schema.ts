import { z } from "zod";

export const connectedWireScheduleScopeSchema = z.enum([
  "all_connected",
  "sheet_routes"
]);

const connectedWireScheduleColumnRatioSchema = z
  .number()
  .finite()
  .min(1 / 15)
  .max(2 / 3);

export const connectedWireScheduleColumnRatiosSchema = z
  .object({
    wireNumber: connectedWireScheduleColumnRatioSchema,
    wireId: connectedWireScheduleColumnRatioSchema,
    from: connectedWireScheduleColumnRatioSchema,
    to: connectedWireScheduleColumnRatioSchema,
    specification: connectedWireScheduleColumnRatioSchema,
    description: connectedWireScheduleColumnRatioSchema
  })
  .refine(
    (ratios) =>
      Math.abs(
        Object.values(ratios).reduce((total, ratio) => total + ratio, 0) - 1
      ) < 0.001,
    { message: "Connected wire schedule column ratios must total 1." }
  );

export const connectedWireSchedulePaginationSchema = z.object({
  version: z.literal(1),
  continuationSetId: z.string().trim().min(1).max(160),
  pageIndex: z.number().int().nonnegative(),
  rowsPerPage: z.number().int().min(1).max(100)
});

export const connectedWireScheduleConfigSchema = z.object({
  assetId: z.string().trim().min(1),
  sourcePlacementId: z.string().trim().min(1),
  scope: connectedWireScheduleScopeSchema.default("all_connected"),
  columnRatios: connectedWireScheduleColumnRatiosSchema.optional(),
  pagination: connectedWireSchedulePaginationSchema.optional()
});

export const connectedWireScheduleAnnotationSchema = z.object({
  id: z.string().trim().min(1),
  kind: z.literal("connected_wire_schedule"),
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().positive(),
  schedule: connectedWireScheduleConfigSchema
});

export type ConnectedWireScheduleScope = z.infer<
  typeof connectedWireScheduleScopeSchema
>;
export type ConnectedWireScheduleColumnRatios = z.infer<
  typeof connectedWireScheduleColumnRatiosSchema
>;
export type ConnectedWireSchedulePagination = z.infer<
  typeof connectedWireSchedulePaginationSchema
>;
export type ConnectedWireScheduleConfig = z.infer<
  typeof connectedWireScheduleConfigSchema
>;
export type ConnectedWireScheduleAnnotation = z.infer<
  typeof connectedWireScheduleAnnotationSchema
>;

export function isConnectedWireScheduleAnnotation(
  annotation: { kind: string }
): annotation is ConnectedWireScheduleAnnotation {
  return annotation.kind === "connected_wire_schedule";
}
