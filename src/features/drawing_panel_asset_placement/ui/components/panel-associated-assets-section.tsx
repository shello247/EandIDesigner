"use client";

import { CheckCircle2, Plus } from "lucide-react";
import type { AssociatedPanelAssetCatalogItem } from "../../logic/services/panel-associated-assets";

const ASSET_TYPE_LABELS: Record<string, string> = {
  breaker: "Breaker",
  terminal_block: "Terminal Block",
  controller: "Controller",
  instrument: "Instrument",
  other: "Asset"
};

export function PanelAssociatedAssetsSection({
  panelLabel,
  items,
  onPlaceAsset
}: {
  panelLabel: string;
  items: AssociatedPanelAssetCatalogItem[];
  onPlaceAsset: (assetId: string) => void;
}) {
  const visibleItems = items.filter((item) => item.status !== "placed");
  const placedCount = items.length - visibleItems.length;

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="tool-panel overflow-hidden">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-bold">Associated Panel Assets</h2>
        <p className="mt-1 truncate text-xs text-slate-500">{panelLabel}</p>
      </div>
      <div className="max-h-[360px] space-y-2 overflow-auto p-4">
        {visibleItems.length === 0 ? (
          <div className="flex items-start gap-2 rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
            <CheckCircle2 aria-hidden="true" size={14} className="mt-0.5 shrink-0" />
            <span>All associated assets are placed on this backplane.</span>
          </div>
        ) : null}
        {visibleItems.map((item) => {
          const disabled = item.status === "disabled";

          return (
            <button
              key={item.assetId}
              type="button"
              className={[
                "w-full rounded-md border px-3 py-2 text-left text-xs transition",
                disabled
                  ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
                  : "border-slate-200 bg-white hover:border-teal-200 hover:bg-teal-50"
              ].join(" ")}
              disabled={disabled}
              onClick={() => onPlaceAsset(item.assetId)}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="min-w-0">
                  <span className="block truncate text-[12px] font-semibold leading-snug text-slate-950">
                    {item.tag}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] font-medium text-slate-500">
                    {item.title}
                  </span>
                  <span className="mt-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    {ASSET_TYPE_LABELS[item.type] ?? "Asset"}
                  </span>
                  {item.disabledReason ? (
                    <span className="mt-1 block text-[11px] font-medium text-amber-700">
                      {item.disabledReason}
                    </span>
                  ) : null}
                </span>
                {!disabled ? (
                  <Plus
                    aria-hidden="true"
                    size={14}
                    className="mt-0.5 shrink-0 text-teal-700"
                  />
                ) : null}
              </span>
            </button>
          );
        })}
        {placedCount > 0 ? (
          <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
            {placedCount} associated {placedCount === 1 ? "asset is" : "assets are"} already
            placed on this backplane.
          </p>
        ) : null}
      </div>
    </section>
  );
}
