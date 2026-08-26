import { Cable } from "lucide-react";
import { ConnectionEndpointDetails } from "../canvas/ConnectionEndpointDetails";
import type { DrawingAnchorInspection } from "../canvas/types";

export function ConnectionEndpointInspector({
  source,
  hovered
}: {
  source: DrawingAnchorInspection;
  hovered?: DrawingAnchorInspection;
}) {
  return (
    <section
      data-testid="connection-endpoint-inspector"
      className="tool-panel overflow-hidden"
      aria-labelledby="connection-endpoint-inspector-title"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-700">
          <Cable aria-hidden="true" size={14} />
        </span>
        <div className="min-w-0">
          <h2
            id="connection-endpoint-inspector-title"
            className="text-sm font-bold text-slate-950"
          >
            Connection endpoint
          </h2>
          <p className="text-[10px] font-medium text-slate-500">
            Click to add a bend · Backspace to undo · Select a terminal to finish · Esc to cancel
          </p>
        </div>
      </div>

      <div className="space-y-3 p-3 text-[11px] text-slate-700">
        <div
          data-testid="connection-source-summary"
          className="rounded-md border border-sky-200 bg-sky-50/70 px-3 py-2"
        >
          <p className="text-[9px] font-bold uppercase tracking-wide text-sky-700">
            Selected source
          </p>
          <p className="mt-1 truncate text-xs font-bold text-slate-950">
            {source.placementTag} · {source.terminalLabel ?? source.terminalKey ?? source.anchorKey}
          </p>
          <p className="mt-0.5 font-mono text-[10px] text-slate-500">
            {source.anchorKey}
          </p>
        </div>

        {hovered ? (
          <div
            data-testid="connection-hovered-endpoint"
            className="rounded-md border border-teal-200 bg-white p-3"
          >
            <ConnectionEndpointDetails inspection={hovered} />
          </div>
        ) : (
          <div
            data-testid="connection-endpoint-empty-state"
            className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-center text-xs font-medium text-slate-500"
          >
            Hover a terminal to inspect its connection details.
          </div>
        )}
      </div>
    </section>
  );
}
