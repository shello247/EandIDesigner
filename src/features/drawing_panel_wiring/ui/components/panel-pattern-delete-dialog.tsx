"use client";

import { Trash2 } from "lucide-react";

export function PanelPatternDeleteDialog({
  patternCode,
  canRemoveRepresentation,
  ownedWireCount,
  onCancel,
  onRemoveRepresentation,
  onDeletePattern
}: {
  patternCode: string;
  canRemoveRepresentation: boolean;
  ownedWireCount: number;
  onCancel: () => void;
  onRemoveRepresentation: () => void;
  onDeletePattern: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/25 p-4 backdrop-blur-[2px]">
      <section role="dialog" aria-modal="true" aria-labelledby="panel-pattern-delete-title" className="w-full max-w-lg rounded-lg border border-slate-200 bg-white shadow-2xl">
        <header className="border-b border-slate-200 px-5 py-4">
          <h2 id="panel-pattern-delete-title" className="text-sm font-bold">Remove connection pattern</h2>
          <p className="mt-1 text-xs text-slate-500">{patternCode} is a physical package relationship.</p>
        </header>
        <div className="space-y-2 p-5 text-xs text-slate-600">
          {canRemoveRepresentation ? <p><strong>Remove representation only</strong> keeps the physical pattern and its terminal occupancy.</p> : <p>This pattern is not represented on the active sheet.</p>}
          <p><strong>Delete physical pattern</strong> removes every route occurrence and {ownedWireCount} owned wire{ownedWireCount === 1 ? "" : "s"}. Unrelated wires are preserved.</p>
        </div>
        <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button type="button" className="icon-button" onClick={onCancel}>Cancel</button>
          {canRemoveRepresentation ? <button type="button" className="icon-button icon-button-primary" onClick={onRemoveRepresentation}>Remove representation only</button> : null}
          <button type="button" className="icon-button border-rose-200 text-rose-700" onClick={onDeletePattern}><Trash2 aria-hidden="true" size={14} />Delete physical pattern</button>
        </footer>
      </section>
    </div>
  );
}
