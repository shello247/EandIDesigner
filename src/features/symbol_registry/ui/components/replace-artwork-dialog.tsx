"use client";

import { useEffect, useState } from "react";
import { EngineeringDialog } from "@/shared/ui/engineering-dialog";
import { ARTWORK_MAX_BYTES, type ArtworkInput, type ArtworkPreview } from "../../data/artwork-schema";
import { previewSymbolArtworkAction, replaceSymbolArtworkAction } from "../../api/artwork-actions";

export function ReplaceArtworkDialog({ symbolId, versionId, originalSvg, onClose, onSaved }: {
  symbolId: string; versionId: string; originalSvg: string; onClose: () => void; onSaved: (versionNumber: number) => void;
}) {
  const [input, setInput] = useState<ArtworkInput | null>(null);
  const [preview, setPreview] = useState<ArtworkPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => {
    if (!selected && !busy) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [selected, busy]);
  const cancel = () => {
    if (!busy && (!selected || window.confirm("Discard unsaved changes to this entry?"))) onClose();
  };
  async function choose(file?: File) {
    setInput(null); setPreview(null); setError(null); setConfirmed(false); setSelected(Boolean(file));
    if (!file) return;
    if (file.size > ARTWORK_MAX_BYTES) { setError("SVG must be 50 KB or smaller."); return; }
    setBusy(true);
    try {
      const request = { symbolId, versionId, fileName: file.name, svg: await file.text() };
      setInput(request);
      const result = await previewSymbolArtworkAction(request);
      if (result.ok) setPreview(result.data); else setError(result.error);
    } catch { setError("Could not preview the file. Select it again to retry."); }
    finally { setBusy(false); }
  }
  async function save() {
    if (!input || !preview || busy || !confirmed) return;
    setBusy(true); setError(null);
    try {
      const result = await replaceSymbolArtworkAction({ ...input, token: preview.token });
      if (!result.ok) { setError(result.error); return; }
      onSaved(result.data.versionNumber);
    } catch { setError("Save could not be confirmed. Your file is retained. Reload to check the current version before retrying."); }
    finally { setBusy(false); }
  }
  return <EngineeringDialog title="Replace artwork" subtitle="Colours and line weights only" compact dirty={selected} busy={busy} onClose={onClose}>
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
      <p className="text-xs text-slate-600">Creates a new version. Terminals, dimensions and the Item link stay unchanged. Existing drawings keep their pinned artwork.</p>
      <label className="block text-xs font-semibold">Revised SVG (maximum 50 KB)
        <input type="file" accept=".svg,image/svg+xml" disabled={busy} onChange={event => void choose(event.target.files?.[0])} className="mt-2 block w-full text-xs" />
      </label>
      {busy ? <p role="status" className="text-xs text-teal-700">Processing artwork…</p> : null}
      {error ? <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">{error}</p> : null}
      {preview ? <>
        <div className="grid grid-cols-2 gap-3">
          {[{ title: "Current", svg: originalSvg }, { title: "Replacement", svg: preview.svg }].map(item => <section key={item.title} className="min-w-0 rounded-lg border border-slate-200 bg-white p-2">
            <h3 className="mb-2 text-xs font-semibold">{item.title}</h3>
            <div data-testid={`artwork-${item.title.toLowerCase()}`} className="flex h-36 items-center justify-center overflow-hidden [&>svg]:max-h-full [&>svg]:max-w-full" dangerouslySetInnerHTML={{ __html: item.svg }} />
          </section>)}
        </div>
        <p className="text-xs text-teal-800">Geometry checked · {preview.terminalCount} terminals preserved</p>
        <label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} />I have reviewed the replacement artwork.</label>
      </> : null}
    </div>
    <footer className="flex shrink-0 justify-end gap-2 border-t border-slate-200 px-5 py-3">
      <button type="button" className="icon-button" disabled={busy} onClick={cancel}>Cancel</button>
      <button type="button" className="icon-button icon-button-primary" disabled={!preview || !confirmed || busy} onClick={() => void save()}>Save artwork</button>
    </footer>
  </EngineeringDialog>;
}
