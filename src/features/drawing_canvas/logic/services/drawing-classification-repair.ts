import { assetClassificationSnapshot, classificationRepairPreviewSchema, type ClassificationRepairPreview } from "@/features/device_classification/api/contracts";
import type { DrawingModel, DrawingStatus } from "../../data/schema";

/** Drawing-owned, classification-only command. The shell commits one history entry. */
export function applyDrawingClassificationRepair(model: DrawingModel, status: DrawingStatus, input: ClassificationRepairPreview): DrawingModel {
  if (status === "approved" || status === "archived") throw new Error("Approved or archived drawings are review-only for classification repairs.");
  const preview = classificationRepairPreviewSchema.parse(input);
  const asset = model.assets.find(entry => entry.id === preview.assetId);
  if (!asset || assetClassificationSnapshot(asset) !== preview.expectedAsset || asset.type !== preview.before) throw new Error("This asset changed. Review its classification again.");
  if (asset.type === preview.after) return model;
  return { ...model, assets: model.assets.map(entry => entry.id === asset.id ? { ...entry, type: preview.after } : entry) };
}
