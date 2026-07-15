"use client";

import { Link2, PackagePlus, X } from "lucide-react";
import { useState } from "react";
import type {
  CompatiblePanelComponentAssetOption,
  PanelComponentPaletteRow
} from "../../api/public";

export type PanelComponentPlacementSubmission =
  | { mode: "create"; tag: string; title: string }
  | { mode: "reference"; assetId: string };

export function PanelComponentPlacementDialog({
  row,
  proposedTag,
  compatibleAssets,
  onCancel,
  onPlace
}: {
  row: PanelComponentPaletteRow;
  proposedTag: string;
  compatibleAssets: CompatiblePanelComponentAssetOption[];
  onCancel: () => void;
  onPlace: (submission: PanelComponentPlacementSubmission) => void;
}) {
  const titleId = "panel-component-placement-dialog-title";
  const [mode, setMode] = useState<"create" | "reference">(
    compatibleAssets.length > 0 ? "reference" : "create"
  );
  const [tag, setTag] = useState(proposedTag);
  const [title, setTitle] = useState(row.displayName);
  const [assetId, setAssetId] = useState(compatibleAssets[0]?.assetId ?? "");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (mode === "reference") {
      if (!assetId) {
        setError("Choose an existing panel asset.");
        return;
      }
      onPlace({ mode, assetId });
      return;
    }
    if (!tag.trim() || !title.trim()) {
      setError("Enter an asset tag and title.");
      return;
    }
    onPlace({ mode, tag: tag.trim(), title: title.trim() });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/20 p-4 backdrop-blur-[2px]">
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="w-full max-w-xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-700">
            <PackagePlus aria-hidden="true" size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-sm font-semibold text-slate-950">Place panel component</h2>
            <p className="mt-1 text-xs text-slate-600">{row.displayName}</p>
          </div>
          <button type="button" className="icon-button h-8 w-8 p-0" onClick={onCancel} aria-label="Close panel component dialog">
            <X aria-hidden="true" size={14} />
          </button>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={`rounded-md border px-3 py-2 text-left text-xs ${mode === "create" ? "border-sky-300 bg-sky-50" : "border-slate-200"}`} onClick={() => setMode("create")}>
              <span className="flex items-center gap-2 font-bold"><PackagePlus size={14} />Create new</span>
              <span className="mt-1 block text-slate-500">Create one package asset.</span>
            </button>
            <button type="button" disabled={compatibleAssets.length === 0} className={`rounded-md border px-3 py-2 text-left text-xs disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 ${mode === "reference" ? "border-sky-300 bg-sky-50" : "border-slate-200"}`} onClick={() => setMode("reference")}>
              <span className="flex items-center gap-2 font-bold"><Link2 size={14} />Reference existing</span>
              <span className="mt-1 block text-slate-500">Reuse an asset assigned to this panel.</span>
            </button>
          </div>
          {mode === "create" ? (
            <div className="grid grid-cols-2 gap-3">
              <div><label className="field-label" htmlFor="panel-component-tag">Asset tag</label><input id="panel-component-tag" className="field-input" value={tag} onChange={(event) => { setTag(event.currentTarget.value); setError(null); }} /></div>
              <div><label className="field-label" htmlFor="panel-component-title">Title</label><input id="panel-component-title" className="field-input" value={title} onChange={(event) => { setTitle(event.currentTarget.value); setError(null); }} /></div>
            </div>
          ) : (
            <div className="space-y-2">
              {compatibleAssets.map((asset) => (
                <label key={asset.assetId} className={`flex cursor-pointer gap-3 rounded-md border px-3 py-2 text-xs ${assetId === asset.assetId ? "border-sky-300 bg-sky-50" : "border-slate-200"}`}>
                  <input type="radio" checked={assetId === asset.assetId} onChange={() => setAssetId(asset.assetId)} />
                  <span><span className="block font-bold text-slate-950">{asset.tag} / {asset.title}</span><span className="mt-0.5 block text-slate-500">{asset.sourceSheets.map((sheet) => `Sheet ${sheet.number}`).join(", ")}</span></span>
                </label>
              ))}
            </div>
          )}
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            {row.terminals.length} electrical terminal{row.terminals.length === 1 ? "" : "s"} ready. {row.warnings[0] ?? "Physical layout metadata is available."}
          </div>
          {error ? <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div> : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button type="button" className="icon-button" onClick={onCancel}>Cancel</button>
          <button type="button" className="icon-button icon-button-primary" onClick={submit}><PackagePlus size={14} />Place component</button>
        </div>
      </div>
    </div>
  );
}
