"use client";

import { Trash2 } from "lucide-react";

export function InternalWireDeleteDialog({
  wireId,
  canRemoveRoute = true,
  onCancel,
  onRemoveRoute,
  onDeleteWire
}: {
  wireId: string;
  canRemoveRoute?: boolean;
  onCancel: () => void;
  onRemoveRoute: () => void;
  onDeleteWire: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/25 p-4 backdrop-blur-[2px]">
      <div role="dialog" aria-modal="true" aria-labelledby="internal-wire-delete-title" className="w-full max-w-lg rounded-lg border border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-5 py-4"><h2 id="internal-wire-delete-title" className="text-sm font-bold">Remove internal wire</h2><p className="mt-1 text-xs text-slate-500">{wireId} is a physical package wire with a visual route on this sheet.</p></div>
        <div className="space-y-2 p-5 text-xs text-slate-600">
          {canRemoveRoute ? (
            <p><strong>Remove route only</strong> keeps the physical wire and terminal occupancy.</p>
          ) : (
            <p>This wire has no route on the active sheet.</p>
          )}
          <p><strong>Delete physical wire</strong> removes the wire and every route occurrence.</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button type="button" className="icon-button" onClick={onCancel}>Cancel</button>
          {canRemoveRoute ? (
            <button type="button" className="icon-button icon-button-primary" onClick={onRemoveRoute}>Remove route only</button>
          ) : null}
          <button type="button" className="icon-button border-rose-200 text-rose-700" onClick={onDeleteWire}><Trash2 size={14} />Delete physical wire</button>
        </div>
      </div>
    </div>
  );
}
