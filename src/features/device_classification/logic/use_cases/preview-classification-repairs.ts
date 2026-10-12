import { z } from "zod";
import { deviceTypeSchema } from "@/shared/device-classification/device-types";
import type { ClassificationResolution } from "@/shared/device-classification/classification-resolution";
import type { ClassifiedAsset } from "../services/asset-classification";

export const classificationRepairPreviewSchema = z.strictObject({
  assetId: z.string().min(1), before: deviceTypeSchema, after: deviceTypeSchema,
  expectedAsset: z.string().min(1), sourceKind: z.enum(["item_revision", "symbol_version", "managed_asset", "drawing_snapshot", "legacy_metadata"]),
  sourceId: z.string().min(1), sourceRevisionId: z.string().min(1)
});
export type ClassificationRepairPreview = z.infer<typeof classificationRepairPreviewSchema>;
export function assetClassificationSnapshot(asset: ClassifiedAsset) {
  return JSON.stringify([asset.id, asset.type, asset.symbolId ?? null, asset.versionId ?? null, asset.productSelection ?? null]);
}
export function previewClassificationRepair(asset: ClassifiedAsset, resolution: ClassificationResolution): ClassificationRepairPreview | null {
  if (!resolution.source || !resolution.deviceType || asset.type === resolution.deviceType ||
    resolution.status === "unavailable" || resolution.status === "needs_classification" ||
    resolution.issues.some(issue => issue.code === "source_unavailable" || issue.code === "conflicting_types" && issue.source?.kind !== "drawing_snapshot")) return null;
  return classificationRepairPreviewSchema.parse({ assetId: asset.id, before: asset.type, after: resolution.deviceType,
    expectedAsset: assetClassificationSnapshot(asset), sourceKind: resolution.source.kind,
    sourceId: resolution.source.recordId, sourceRevisionId: resolution.source.revisionId });
}
