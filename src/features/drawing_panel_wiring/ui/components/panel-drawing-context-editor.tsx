import type {
  CompatiblePanelOption,
  DetailedPanelDrawingContextView
} from "../../api/public";
import type { ReactNode } from "react";

export function PanelDrawingContextEditor({
  context,
  options,
  warning,
  headerAction,
  onPanelAssetChange
}: {
  context?: DetailedPanelDrawingContextView;
  options: CompatiblePanelOption[];
  warning?: string;
  headerAction?: ReactNode;
  onPanelAssetChange: (panelAssetId: string) => void;
}) {
  return (
    <section className="tool-panel overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <h2 className="text-sm font-bold">Panel Drawing Context</h2>
          <p className="mt-0.5 text-xs font-medium text-slate-500">
            Physical asset referenced by this sheet
          </p>
        </div>
        {headerAction}
      </div>
      <div className="space-y-3 p-4">
        {warning ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {warning}
          </div>
        ) : null}
        <div>
          <label className="field-label" htmlFor="panel-drawing-context-asset">
            Panel / enclosure
          </label>
          <select
            id="panel-drawing-context-asset"
            className="field-input"
            value={context?.panelAssetId ?? ""}
            onChange={(event) => onPanelAssetChange(event.currentTarget.value)}
            disabled={options.length === 0}
          >
            {!context ? <option value="">Select a compatible asset</option> : null}
            {options.map((option) => (
              <option key={option.assetId} value={option.assetId}>
                {option.tag} / {option.title}
              </option>
            ))}
          </select>
        </div>
        {context ? (
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <p className="font-semibold text-slate-800">
              {context.type === "junction_box" ? "Junction Box" : "Panel"}
            </p>
            <p className="mt-1">
              {context.sourceSheets.length} source sheet{context.sourceSheets.length === 1 ? "" : "s"}
            </p>
          </div>
        ) : null}
        <p className="text-xs leading-5 text-slate-500">
          Relinking changes only this sheet context. It does not rename, copy, or delete the physical asset.
        </p>
      </div>
    </section>
  );
}
