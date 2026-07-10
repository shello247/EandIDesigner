import { CircuitBoard, ClipboardList } from "lucide-react";
import type { ReactNode } from "react";
import type {
  DetailedPanelDrawingContextView,
  PanelDiscoveryIndex
} from "../../api/public";

export function PanelDrawingSummary({
  context,
  warning,
  discovery,
  onOpenWorkQueue,
  headerAction
}: {
  context?: DetailedPanelDrawingContextView;
  warning?: string;
  discovery?: PanelDiscoveryIndex;
  onOpenWorkQueue?: () => void;
  headerAction?: ReactNode;
}) {
  const assetRows = discovery ? [...discovery.assetsById.values()] : [];
  const terminationRows = discovery
    ? [...discovery.terminationsById.values()]
    : [];
  const representedCount = assetRows.filter(
    (row) => row.status === "represented"
  ).length;

  return (
    <section className="tool-panel overflow-hidden">
      <div className="flex items-start gap-3 border-b border-slate-200 px-4 py-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-700">
          <CircuitBoard aria-hidden="true" size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold">Detailed Panel Drawing</h2>
          <p className="mt-0.5 text-xs font-medium text-slate-500">
            Electrical detail workspace
          </p>
        </div>
        {headerAction}
      </div>
      <div className="space-y-3 p-4 text-xs">
        {context ? (
          <>
            <div>
              <p className="text-[11px] font-bold uppercase text-slate-500">Panel / enclosure</p>
              <p className="mt-1 font-bold text-slate-950">{context.tag}</p>
              <p className="mt-0.5 text-slate-600">{context.title}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[10px] font-bold uppercase text-slate-500">Type</p>
                <p className="mt-1 font-semibold text-slate-800">
                  {context.type === "junction_box" ? "Junction Box" : "Panel"}
                </p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[10px] font-bold uppercase text-slate-500">Purpose</p>
                <p className="mt-1 font-semibold text-slate-800">Detailed wiring</p>
              </div>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase text-slate-500">Source sheets</p>
              {context.sourceSheets.length > 0 ? (
                <div className="mt-2 space-y-1.5">
                  {context.sourceSheets.map((sheet) => (
                    <div key={sheet.sheetId} className="rounded-md border border-slate-200 px-2.5 py-2 text-slate-600">
                      <span className="font-semibold text-slate-800">Sheet {sheet.sheetNumber}</span>
                      {` - ${sheet.name}`}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-slate-500">Not referenced on another sheet yet.</p>
              )}
            </div>
            {discovery && onOpenWorkQueue ? (
              <div className="space-y-2 border-t border-slate-200 pt-3">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-2">
                    <p className="font-bold text-slate-900">{assetRows.length}</p>
                    <p className="mt-0.5 text-[10px] text-slate-500">Assets</p>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-2">
                    <p className="font-bold text-slate-900">{terminationRows.length}</p>
                    <p className="mt-0.5 text-[10px] text-slate-500">Field terms</p>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-2">
                    <p className="font-bold text-slate-900">{representedCount}</p>
                    <p className="mt-0.5 text-[10px] text-slate-500">Placed</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="icon-button icon-button-primary w-full"
                  onClick={onOpenWorkQueue}
                >
                  <ClipboardList aria-hidden="true" size={14} />
                  Open Panel Work Queue
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
            {warning ?? "The referenced panel context could not be resolved."}
          </div>
        )}
        <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 leading-5 text-sky-800">
          Existing assets can be represented here. Field terminations remain
          authoritative on their source sheets.
        </div>
      </div>
    </section>
  );
}
