import { ChevronRight, CircuitBoard, ClipboardList } from "lucide-react";
import type { ReactNode } from "react";

function nextWorkflowLabel(
  workflow: PanelGuidedWorkflowSnapshot | undefined
): string {
  if (!workflow) return "Choose equipment";
  const action = workflow.nextAction;

  if (action.kind === "open_step") {
    return (
      workflow.steps.find((step) => step.id === action.stepId)?.label ??
      "Continue"
    );
  }
  if (action.kind === "next_asset") {
    return "Choose next equipment";
  }
  if (action.kind === "select_asset") return "Choose equipment";
  return "No pending work";
}
import type {
  DetailedPanelDrawingContextView,
  PanelDiscoveryIndex,
  PanelGuidedWorkflowSnapshot
} from "../../api/public";

export function PanelDrawingSummary({
  context,
  warning,
  discovery,
  workflow,
  onOpenWorkQueue,
  headerAction
}: {
  context?: DetailedPanelDrawingContextView;
  warning?: string;
  discovery?: PanelDiscoveryIndex;
  workflow?: PanelGuidedWorkflowSnapshot;
  onOpenWorkQueue?: () => void;
  headerAction?: ReactNode;
}) {
  const focusedAsset = workflow?.assets.find(
    (asset) => asset.assetId === workflow.focusAssetId
  );
  const nextStep = nextWorkflowLabel(workflow);

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
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
              <span>{context.type === "junction_box" ? "Junction Box" : "Panel"}</span>
              <span aria-hidden="true" className="text-slate-300">/</span>
              <span>Detailed wiring</span>
            </div>
            <details className="group rounded-md border border-slate-200 bg-white">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-[11px] font-bold uppercase text-slate-600 [&::-webkit-details-marker]:hidden">
                <ChevronRight
                  aria-hidden="true"
                  size={14}
                  className="shrink-0 transition-transform group-open:rotate-90"
                />
                <span className="flex-1">Source sheets</span>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                  {context.sourceSheets.length}
                </span>
              </summary>
              <div className="border-t border-slate-200 px-2.5 py-2">
                {context.sourceSheets.length > 0 ? (
                  <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
                    {context.sourceSheets.map((sheet) => (
                      <div
                        key={sheet.sheetId}
                        className="rounded-md border border-slate-200 px-2.5 py-2 text-slate-600"
                      >
                        <span className="font-semibold text-slate-800">
                          Sheet {sheet.sheetNumber}
                        </span>
                        {` - ${sheet.name}`}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500">
                    Not referenced on another sheet yet.
                  </p>
                )}
              </div>
            </details>
            {discovery && workflow && onOpenWorkQueue ? (
              <div className="space-y-2 border-t border-slate-200 pt-3">
                <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-[11px]">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-bold text-slate-500">Working on</span>
                    <span className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">
                        {focusedAsset?.tag ?? "Not selected"}
                      </span>
                      <button
                        type="button"
                        className="font-bold text-teal-700 hover:text-teal-900"
                        onClick={onOpenWorkQueue}
                      >
                        Change
                      </button>
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-bold text-slate-500">Progress</span>
                    <span className="text-slate-700">{workflow.readyAssetCount}/{workflow.totalAssetCount} ready</span>
                  </div>
                  <div className="border-t border-slate-200 pt-2 text-slate-600">
                    <span className="font-bold text-slate-800">Next step: </span>{nextStep}
                  </div>
                </div>
                <button
                  type="button"
                  className="icon-button icon-button-primary w-full"
                  onClick={onOpenWorkQueue}
                >
                  <ClipboardList aria-hidden="true" size={14} />
                  Continue
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
            {warning ?? "The referenced panel context could not be resolved."}
          </div>
        )}
      </div>
    </section>
  );
}
