"use client";

import { Cable, X } from "lucide-react";
import { useState } from "react";
import type {
  PanelTerminalSideRef,
  PanelWireAttributes
} from "../../api/contracts";

export type InternalWireDialogSubmission = {
  wireId: string;
  attributes?: PanelWireAttributes;
};

export function InternalWireDialog({
  from,
  to,
  proposedWireId,
  defaults,
  onCancel,
  onConfirm
}: {
  from: { ref: PanelTerminalSideRef; label: string };
  to: { ref: PanelTerminalSideRef; label: string };
  proposedWireId: string;
  defaults?: PanelWireAttributes;
  onCancel: () => void;
  onConfirm: (submission: InternalWireDialogSubmission) => void;
}) {
  const [wireId, setWireId] = useState(proposedWireId);
  const [color, setColor] = useState(defaults?.color ?? "");
  const [size, setSize] = useState(defaults?.size ?? "");
  const [wireType, setWireType] = useState(defaults?.wireType ?? "");
  const [description, setDescription] = useState(defaults?.description ?? "");
  const titleId = "internal-wire-dialog-title";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/25 p-4 backdrop-blur-[2px]">
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="w-full max-w-2xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-800"><Cable size={18} /></div>
          <div className="flex-1"><h2 id={titleId} className="text-sm font-bold">Create internal wire</h2><p className="mt-1 text-xs text-slate-500">Confirm canonical terminal endpoints and engineering identification.</p></div>
          <button type="button" className="icon-button h-8 w-8 p-0" onClick={onCancel} aria-label="Close internal wire dialog"><X size={14} /></button>
        </div>
        <div className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase text-slate-500">Source</p><p className="mt-1 font-bold">{from.label}</p><p className="mt-1 text-slate-500">{from.ref.terminalKey} / {from.ref.side}</p></div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase text-slate-500">Destination</p><p className="mt-1 font-bold">{to.label}</p><p className="mt-1 text-slate-500">{to.ref.terminalKey} / {to.ref.side}</p></div>
          </div>
          <div><label className="field-label" htmlFor="internal-wire-id">Wire ID</label><input id="internal-wire-id" className="field-input" value={wireId} onChange={(event) => setWireId(event.currentTarget.value)} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="field-label" htmlFor="internal-wire-color">Color</label><input id="internal-wire-color" className="field-input" value={color} onChange={(event) => setColor(event.currentTarget.value)} /></div>
            <div><label className="field-label" htmlFor="internal-wire-size">Size</label><input id="internal-wire-size" className="field-input" value={size} onChange={(event) => setSize(event.currentTarget.value)} /></div>
            <div><label className="field-label" htmlFor="internal-wire-type">Wire type</label><input id="internal-wire-type" className="field-input" value={wireType} onChange={(event) => setWireType(event.currentTarget.value)} /></div>
          </div>
          <div><label className="field-label" htmlFor="internal-wire-description">Description</label><input id="internal-wire-description" className="field-input" value={description} onChange={(event) => setDescription(event.currentTarget.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3"><button type="button" className="icon-button" onClick={onCancel}>Cancel</button><button type="button" className="icon-button icon-button-primary" disabled={!wireId.trim()} onClick={() => onConfirm({ wireId: wireId.trim(), attributes: { color: color.trim() || undefined, size: size.trim() || undefined, wireType: wireType.trim() || undefined, description: description.trim() || undefined } })}><Cable size={14} />Create wire</button></div>
      </div>
    </div>
  );
}
