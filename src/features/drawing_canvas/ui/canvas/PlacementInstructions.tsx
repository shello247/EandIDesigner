"use client";

import { memo } from "react";
import { MousePointer2, RotateCw } from "lucide-react";

const keyClass = "inline-flex min-w-6 items-center justify-center rounded border border-slate-200 bg-white px-1.5 py-0.5 font-sans text-xs font-semibold text-slate-700 shadow-sm";

/** Static instructions stay separate from the frame-rate artwork overlay. */
export const PlacementInstructions = memo(function PlacementInstructions({ label, tag, canContinue, canRotate, reason, hint, onRotate, onRetry }: {
  label: string; tag: string; canContinue: boolean; canRotate: boolean;
  reason?: string; hint?: string; onRotate: () => void; onRetry?: () => void;
}) {
  return <section className="pointer-events-auto absolute bottom-3 right-3 z-10 w-[24rem] max-w-[calc(100%-1.5rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-900/10" aria-label="Placement instructions" data-testid="placement-instructions">
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-teal-100 bg-teal-50 text-teal-700"><MousePointer2 size={18} aria-hidden="true" /></span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Place on drawing</p>
        <p className="truncate text-sm font-semibold text-slate-900" title={label} data-testid="placement-tag">{tag}</p>
      </div>
      {canRotate ? <button type="button" className="icon-button shrink-0" aria-label="Rotate placement" title="Rotate (R)" onClick={onRotate}><RotateCw size={15} aria-hidden="true" /><kbd className="font-sans text-xs">R</kbd></button> : null}
    </div>
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 bg-slate-50/80 px-4 py-3 text-xs text-slate-700">
      <span><kbd className={keyClass}>Click</kbd> <span className="font-semibold">Place once</span></span>
      {canContinue ? <span><kbd className={keyClass}>Ctrl + click</kbd> Multiple</span> : null}
      <span><kbd className={keyClass}>Esc</kbd> Cancel</span>
    </div>
    {reason || hint ? <p className={`border-t border-slate-100 px-4 py-2.5 text-xs leading-relaxed ${reason ? "text-amber-800" : "text-slate-600"}`} role="status">{reason ?? hint}</p> : null}
    {onRetry ? <div className="px-4 pb-3"><button type="button" className="icon-button" onClick={onRetry}>Retry preview</button></div> : null}
  </section>;
});
