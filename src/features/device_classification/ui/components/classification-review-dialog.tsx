"use client";

import { useEffect, useRef, useState } from "react";
import { EngineeringDialog } from "@/shared/ui/engineering-dialog";
import { DEVICE_TYPE_OPTIONS, getDeviceTypeLabel, type DeviceType } from "@/shared/device-classification/device-types";
import { getSymbolClassificationReviewAction, saveSymbolClassificationAction } from "../../api/actions";

type Review = Extract<Awaited<ReturnType<typeof getSymbolClassificationReviewAction>>, { ok: true }>["data"];
export function ClassificationReviewDialog({ versionId, onClose, onSaved }: {
  versionId: string; onClose: () => void; onSaved: (type: DeviceType) => void;
}) {
  const [review, setReview] = useState<Review | null>(null);
  const [type, setType] = useState<DeviceType | "">("");
  const [evidence, setEvidence] = useState("");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<{ url: string; deviceType: DeviceType } | null>(null);
  const submitting = useRef(false);
  useEffect(() => () => { if (receipt) URL.revokeObjectURL(receipt.url); }, [receipt]);
  useEffect(() => {
    let current = true;
    void getSymbolClassificationReviewAction(versionId).then(result => {
      if (!current) return;
      if (!result.ok) { setError(result.error); return; }
      setReview(result.data); setType(result.data.deviceType ?? ""); setError("");
    }).catch(error => { if (current) setError(error instanceof Error ? error.message : "Classification unavailable."); });
    return () => { current = false; };
  }, [versionId, attempt]);
  const dirty = !receipt && (Boolean(evidence.trim()) || Boolean(review && type !== (review.deviceType ?? "")));
  const close = () => { if (receipt) onSaved(receipt.deviceType); else onClose(); };
  const save = async () => {
    if (!review || !type || submitting.current || review.archived) return;
    if (!evidence.trim()) { setError("Record the manufacturer document, page and applicable variant supporting this classification."); return; }
    submitting.current = true; setBusy(true); setError("");
    try {
      const result = await saveSymbolClassificationAction({ versionId, expectedToken: review.token, deviceType: type, evidence });
      if (!result.ok) { setError(result.error); return; }
      // Keep the receipt available for explicit download until the review closes.
      const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: "application/json" });
      setReceipt({ url: URL.createObjectURL(blob), deviceType: type });
    } catch (error) { setError(error instanceof Error ? error.message : "Classification could not be saved."); }
    finally { submitting.current = false; setBusy(false); }
  };
  return <EngineeringDialog compact title="Review classification" subtitle={review ? `${review.title} · Symbol version ${review.versionNumber}` : "Loading the exact Symbol version"}
    dirty={dirty} busy={busy} onClose={close}>
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4 text-sm">
      {error ? <p role="alert" className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">{error}</p> : null}
      {receipt ? <div className="space-y-3"><p role="status">Classification saved as <strong>{getDeviceTypeLabel(receipt.deviceType)}</strong>.</p>
        <p className="text-xs text-slate-600">Download the before/after receipt and keep it with the audit evidence. Existing drawing snapshots are unchanged. Classification is not engineering approval.</p>
      </div> : !review ? <button className="icon-button" onClick={() => setAttempt(value => value + 1)}>Retry loading</button> : <>
        <p className="text-xs text-slate-600">Current: <strong>{getDeviceTypeLabel(review.deviceType)}</strong>. This changes classification only, not artwork, terminals, product selections or saved drawing snapshots.</p>
        <label className="grid gap-1.5"><span className="field-label">Device Type</span><select className="field-input" value={type} disabled={busy || review.archived}
          onChange={event => setType(event.currentTarget.value as DeviceType | "")}><option value="">Choose Device Type</option>
          {DEVICE_TYPE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select></label>
        <label className="grid gap-1.5"><span className="field-label">Evidence and applicability</span><textarea className="field-input resize-y" rows={3} maxLength={2000}
          value={evidence} disabled={busy || review.archived} onChange={event => setEvidence(event.currentTarget.value)}
          placeholder="Manufacturer document, edition, page, URL and exact variant" /></label>
        <p className="text-xs text-slate-500">A before/after receipt will be available to download after saving. Classification is not engineering approval.</p>
        {review.archived ? <p role="status">Archived record: retain a historical-review finding; this form cannot change it.</p> : null}
      </>}
    </div>
    <footer className="flex shrink-0 justify-end gap-2 border-t border-slate-200 px-5 py-3">
      {receipt ? <>
        <a className="icon-button" href={receipt.url} download={`classification-${versionId}.json`}>Download receipt</a>
        <button className="icon-button icon-button-primary" onClick={close}>Done</button>
      </> : <>
        <button className="icon-button" disabled={busy} onClick={() => { if (!dirty || window.confirm("Discard unsaved changes to this entry?")) close(); }}>Cancel</button>
        <button className="icon-button icon-button-primary" disabled={!review || !type || busy || review.archived || type === review.deviceType} onClick={() => void save()}>{busy ? "Saving…" : "Save classification"}</button>
      </>}
    </footer>
  </EngineeringDialog>;
}
