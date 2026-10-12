"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { FileUp } from "lucide-react";
import { EngineeringDialog } from "@/shared/ui/engineering-dialog";
import { ItemWorkspaceMessage, useItemSectionDraft, useItemWorkspace } from "@/features/item_engineering/ui/public";
import { loadItemEngineeringRevisionAction } from "@/features/item_engineering/api/actions";
import { uploadBomItemDocumentAction } from "../../api/actions";
import type { BomItemDocumentMetadata } from "../../data/schema";

type Revision = Extract<Awaited<ReturnType<typeof loadItemEngineeringRevisionAction>>, { ok: true }>["data"];
export function ItemDocumentUploadDialog({ onUploaded, onClose }: { onUploaded: (document: BomItemDocumentMetadata) => void; onClose: () => void }) {
  const { itemId, busy, readOnly, mutate, setDirty, reviewRevision } = useItemWorkspace();
  const draft = useItemSectionDraft("document-title", "");
  const [file, setFile] = useState<File | null>(null); const latestFile = useRef(file);
  useLayoutEffect(() => { latestFile.current = file; }, [file]);
  const [inputKey, setInputKey] = useState(0);
  const [message, setMessage] = useState<string | null>(null); const [kind, setKind] = useState<"info" | "success" | "error">("info");
  const [failed, setFailed] = useState(false); const [review, setReview] = useState<{ revision: Revision } | null>(null); const [reviewing, setReviewing] = useState(false);
  const dirty = !!file || draft.dirty;
  useEffect(() => { setDirty("documents", dirty); return () => setDirty("documents", false); }, [dirty, setDirty]);
  const close = () => { if (!busy && (!dirty || window.confirm("Discard this unsaved document upload?"))) onClose(); };
  return <EngineeringDialog title="Upload Document" compact contentSized dirty={dirty} busy={busy} onClose={onClose}>
    <form className="flex min-h-0 flex-1 flex-col text-[12px]" onSubmit={async event => {
      event.preventDefault(); if (!file || busy || readOnly) return;
      const submittedFile = file; const submittedTitle = draft.snapshot(); setMessage(null); setReview(null); setFailed(false);
      try {
        const saved = await mutate(async revisionId => {
          const form = new FormData(); form.set("itemId", itemId); form.set("expectedEngineeringRevisionId", revisionId ?? ""); form.set("title", submittedTitle); form.set("documentFile", submittedFile);
          const result = await uploadBomItemDocumentAction(form); if (!result.ok) throw new Error(result.error);
          return { value: result.data, revisionId: result.data.revisionId };
        });
        onUploaded(saved);
        const unchanged = latestFile.current === submittedFile && draft.snapshot() === submittedTitle;
        if (latestFile.current === submittedFile) { setFile(null); setInputKey(value => value + 1); }
        draft.acknowledge(submittedTitle, "");
        if (unchanged) onClose(); else { setKind("success"); setMessage("PDF uploaded. Your later upload edits remain unsaved."); }
      } catch (error) { setFailed(true); setKind("error"); setMessage(error instanceof Error ? error.message : "Upload failed. Your selected PDF and title are retained."); }
    }}>
      <div className="min-h-0 space-y-4 overflow-y-auto px-5 py-4">
        <label className="block"><span className="font-bold text-slate-700">Document title</span><input className="field-input mt-1 block w-full" maxLength={240} placeholder="Defaults to the filename" value={draft.draft} onChange={event => draft.change(event.target.value)} /></label>
        <div className="rounded-lg border border-dashed border-teal-200 bg-teal-50/30 p-4">
          <div className="mb-3 flex items-center gap-2 font-bold text-slate-700"><FileUp size={18} className="text-teal-700" aria-hidden="true" />Choose a product PDF</div>
          <label className="block"><span className="sr-only">PDF document</span><input key={inputKey} className="block w-full min-w-0 text-[12px] file:mr-3 file:rounded-md file:border file:border-slate-200 file:bg-white file:px-3 file:py-2 file:text-teal-700" type="file" accept="application/pdf,.pdf" onChange={event => {
            const selected = event.target.files?.[0] ?? null;
            if (selected && (selected.size > 25 * 1024 * 1024 || !selected.size || !selected.name.toLowerCase().endsWith(".pdf"))) { setKind("error"); setMessage("Choose a non-empty PDF up to 25 MB."); event.target.value = ""; return; }
            setFile(selected); setMessage(null);
          }} /></label>
          <p className="mt-3 break-words text-slate-600">{file ? file.name : "No PDF selected"}</p><p className="mt-1 text-slate-500">Maximum 25 MB per PDF</p>
        </div>
        <ItemWorkspaceMessage message={message} kind={kind} />
        {failed && <button type="button" className="icon-button" disabled={busy || reviewing} onClick={async () => {
          setReviewing(true); try { const result = await loadItemEngineeringRevisionAction({ itemId }); if (result.ok) setReview({ revision: result.data }); else throw new Error(result.error); }
          catch (error) { setKind("error"); setMessage(error instanceof Error ? error.message : "The latest revision could not be loaded. Retry."); } finally { setReviewing(false); }
        }}>{reviewing ? "Loading revision…" : "Review latest revision"}</button>}
        {review && <div className="space-y-2 rounded-lg border border-slate-200 p-3"><p>Latest saved engineering revision: {review.revision?.revisionNumber ?? "None"}. Your upload is unchanged; existing specifications and guidance will be retained.</p>
          <button type="button" className="icon-button" disabled={busy} onClick={async () => { await reviewRevision(review.revision?.id ?? null); setReview(null); setFailed(false); setKind("info"); setMessage("Revision reviewed. Retry your upload."); }}>Use reviewed revision for retry</button></div>}
      </div>
      <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 bg-white px-5 py-3">
        {dirty && <span className="mr-auto text-[11px] text-slate-500">Unsaved changes</span>}
        <button type="button" className="icon-button" disabled={busy} onClick={close}>Cancel upload</button><button className="icon-button icon-button-primary" disabled={busy || readOnly || !file}>{busy ? "Uploading…" : "Upload PDF"}</button>
      </footer>
    </form>
  </EngineeringDialog>;
}
