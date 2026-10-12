import { resolveDeviceClassification, type ClassificationLookup, type ClassificationResolution } from "@/shared/device-classification/classification-resolution";
import type { DeviceType } from "@/shared/device-classification/device-types";
import { isGeneratedDrawingAssetReference } from "@/features/drawing_canvas/api/generated-reference-contracts";

export type ClassifiedAsset = {
  id: string; type: DeviceType; symbolId?: string; versionId?: string;
  metadata?: { generatedKind?: string };
  terminalStrip?: unknown;
  productSelection?: { status: "unassigned" } | { status: "selected"; itemId: string; itemEngineeringRevisionId: string };
};
export type ClassificationBatch = { symbols: Record<string, ClassificationLookup>; items: Record<string, ClassificationLookup> };
export function resolveAssetClassification(asset: ClassifiedAsset, batch: ClassificationBatch): ClassificationResolution {
  const unavailable = (recordId: string, revisionId: string): ClassificationLookup => ({ state: "unavailable", recordId, revisionId, reason: "The exact source has not been loaded. Retry classification." });
  const exact = (lookup: ClassificationLookup | undefined, recordId: string, revisionId: string): ClassificationLookup =>
    lookup?.state === "available" && (lookup.source.recordId !== recordId || lookup.source.revisionId !== revisionId)
      ? { state: "unavailable", recordId, revisionId, reason: "Pinned source identity does not match this asset." }
      : lookup ?? unavailable(recordId, revisionId);
  const product = asset.productSelection?.status === "selected" ? asset.productSelection : undefined;
  const generated = isGeneratedDrawingAssetReference(asset);
  const linked = Boolean(asset.symbolId && asset.versionId && !generated);
  return resolveDeviceClassification({
    item: product ? exact(batch.items[product.itemEngineeringRevisionId], product.itemId, product.itemEngineeringRevisionId) : undefined,
    symbol: linked ? exact(batch.symbols[asset.versionId!], asset.symbolId!, asset.versionId!) : undefined,
    unlinkedAsset: !linked && !product ? { kind: "managed_asset", recordId: asset.id, revisionId: "current-draft", deviceType: asset.type } : undefined,
    evidence: linked || product ? [{ kind: "drawing_snapshot", recordId: asset.id, revisionId: "current-draft", deviceType: asset.type }] : []
  });
}

export function classificationGroup(result: ClassificationResolution): DeviceType | "needs_classification" {
  return result.status === "resolved" && result.deviceType ? result.deviceType : "needs_classification";
}
