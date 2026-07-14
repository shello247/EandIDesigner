import {
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  MapPinned,
  Unplug
} from "lucide-react";
import type {
  PanelAssetWorkflowRow,
  PanelGuidedWorkflowSnapshot
} from "../../api/public";

const STATUS_PRESENTATION: Record<
  PanelAssetWorkflowRow["status"],
  { label: string; className: string; icon: typeof CheckCircle2 }
> = {
  blocked: {
    label: "Blocked",
    className: "border-red-200 bg-red-50 text-red-800",
    icon: AlertTriangle
  },
  not_placed: {
    label: "Not added",
    className: "border-slate-200 bg-slate-50 text-slate-700",
    icon: MapPinned
  },
  needs_mapping: {
    label: "Needs mapping",
    className: "border-amber-200 bg-amber-50 text-amber-900",
    icon: CircleDot
  },
  needs_internal_wiring: {
    label: "Needs wiring",
    className: "border-sky-200 bg-sky-50 text-sky-800",
    icon: Unplug
  },
  ready: {
    label: "Ready",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    icon: CheckCircle2
  }
};

export function PanelWorkflowEquipmentList({
  snapshot,
  onSelectAsset
}: {
  snapshot: PanelGuidedWorkflowSnapshot;
  onSelectAsset: (assetId: string) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col border-r border-slate-200 bg-slate-50/70">
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-bold text-slate-950">Equipment queue</h3>
            <p className="mt-1 text-[11px] text-slate-500">
              Work through one panel asset at a time.
            </p>
          </div>
          <span className="whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-600">
            {snapshot.readyAssetCount}/{snapshot.totalAssetCount} ready
          </span>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
        {snapshot.assets.map((asset) => {
          const presentation = STATUS_PRESENTATION[asset.status];
          const Icon = presentation.icon;
          const selected = asset.assetId === snapshot.focusAssetId;

          return (
            <button
              key={asset.assetId}
              type="button"
              className={[
                "w-full border-l-2 px-3 py-2.5 text-left transition",
                selected
                  ? "border-l-teal-600 bg-white shadow-sm"
                  : "border-l-transparent hover:bg-white"
              ].join(" ")}
              aria-pressed={selected}
              onClick={() => onSelectAsset(asset.assetId)}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="min-w-0">
                  <span className="block truncate text-xs font-bold text-slate-950">
                    {asset.tag}
                  </span>
                  <span className="mt-0.5 block truncate text-[10px] text-slate-500">
                    {asset.title}
                  </span>
                </span>
                <span
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${presentation.className}`}
                >
                  <Icon aria-hidden="true" size={10} />
                  {presentation.label}
                </span>
              </span>
              {asset.blockingReason ? (
                <span className="mt-1.5 block line-clamp-2 text-[10px] leading-4 text-red-700">
                  {asset.blockingReason}
                </span>
              ) : null}
            </button>
          );
        })}
        {snapshot.assets.length === 0 ? (
          <div className="px-3 py-8 text-center text-xs leading-5 text-slate-500">
            No associated electrical assets were discovered for this panel.
          </div>
        ) : null}
      </div>
    </div>
  );
}
