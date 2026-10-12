"use client";

import { useEffect, useMemo, useState } from "react";
import { isGeneratedDrawingAssetReference } from "@/features/drawing_canvas/api/generated-reference-contracts";
import { readClassificationBatchAction } from "../api/actions";
import { resolveAssetClassification, type ClassifiedAsset, type ClassificationBatch } from "../logic/services/asset-classification";

export function useAssetClassifications(assets: readonly ClassifiedAsset[]) {
  const key = JSON.stringify({
    symbols: [...new Set(assets.flatMap(asset => asset.versionId && !isGeneratedDrawingAssetReference(asset) ? [asset.versionId] : []))].sort(),
    items: [...new Set(assets.flatMap(asset => asset.productSelection?.status === "selected" ? [asset.productSelection.itemEngineeringRevisionId] : []))].sort()
  });
  const [loaded, setLoaded] = useState<{ key: string; batch: ClassificationBatch; error: string }>({ key: "", batch: { symbols: {}, items: {} }, error: "" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    const ids = JSON.parse(key) as { symbols: string[]; items: string[] };
    void (async () => {
      const batch: ClassificationBatch = { symbols: {}, items: {} };
      try {
        for (let i = 0; i < Math.max(ids.symbols.length, ids.items.length); i += 500) {
          const result = await readClassificationBatchAction({ symbolVersionIds: ids.symbols.slice(i, i + 500), itemRevisionIds: ids.items.slice(i, i + 500) });
          if (!current) return;
          if (!result.ok) throw new Error(result.error);
          Object.assign(batch.symbols, result.data.symbols); Object.assign(batch.items, result.data.items);
        }
        if (current) setLoaded({ key, batch, error: "" });
      } catch (error) {
        if (current) setLoaded({ key, batch: { symbols: {}, items: {} }, error: error instanceof Error ? error.message : "Classification unavailable." });
      }
    })();
    return () => { current = false; };
  }, [key, attempt]);
  const results = useMemo(() => {
    const batch = loaded.key === key ? loaded.batch : { symbols: {}, items: {} };
    return new Map(assets.map(asset => [asset.id, resolveAssetClassification(asset, batch)]));
  }, [assets, key, loaded]);
  return { results, loading: loaded.key !== key, error: loaded.key === key ? loaded.error : "", retry: () => setAttempt(value => value + 1) };
}
