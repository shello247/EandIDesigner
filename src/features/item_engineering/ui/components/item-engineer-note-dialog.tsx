"use client";
import { useEffect, useRef, useState, type ClipboardEvent } from "react";
import { ClipboardPaste, ImageIcon } from "lucide-react";
import { EngineeringDialog } from "@/shared/ui/engineering-dialog";
import type { SaveItemEngineerNoteInput } from "../../api/public";
import { loadItemEngineerNoteAction, loadItemEngineeringRevisionAction, saveItemEngineerNoteAction } from "../../api/actions";
import { ItemWorkspaceMessage, readItemImage, useItemSectionDraft, useItemWorkspace } from "./item-workspace-context";

export type ItemNoteDetail = Extract<Awaited<ReturnType<typeof loadItemEngineerNoteAction>>, { ok: true }>["data"];
type Draft = Pick<SaveItemEngineerNoteInput, "notes" | "image" | "replaceNoteId">;
export function ItemEngineerNoteDialog({ initial, onSaved, onClose, inline = false, disabled = false }: { initial: ItemNoteDetail | null; onSaved: (id: string) => Promise<void>; onClose: () => void; inline?: boolean; disabled?: boolean }) {
  const { itemId, busy, readOnly, mutate, reviewRevision } = useItemWorkspace();
  const draft = useItemSectionDraft<Draft>(inline ? "notes" : "note-edit", { notes: initial?.notes ?? "", image: initial?.image ?? null, replaceNoteId: initial?.id });
  const [pending, setPending] = useState(false); const [readingImage, setReadingImage] = useState(false);
  const imageGeneration = useRef(0); const reading = useRef(false); const alive = useRef(true);
  const [message, setMessage] = useState<string | null>(null); const [kind, setKind] = useState<"info" | "error" | "success">("info");
  const [conflict, setConflict] = useState(false); const [reviewing, setReviewing] = useState(false);
  const text = useRef<HTMLTextAreaElement>(null); const pasteArea = useRef<HTMLDivElement>(null);
  useEffect(() => { alive.current = true; if (!inline) pasteArea.current?.focus(); return () => { alive.current = false; }; }, [inline]);
  const locked = busy || pending || readingImage || disabled;
  const close = () => { if (!locked && (!draft.dirty || window.confirm("Discard unsaved note changes?"))) onClose(); };
  const selectImage = async (file: File) => {
    if (readOnly || disabled) return;
    const generation = ++imageGeneration.current; reading.current = true; setReadingImage(true);
    try { const image = await readItemImage(file); if (alive.current && generation === imageGeneration.current) { draft.change({ ...draft.snapshot(), image }); setMessage(null); } }
    catch (error) { if (alive.current && generation === imageGeneration.current) { setKind("error"); setMessage(error instanceof Error ? error.message : "The image could not be loaded."); } }
    finally { if (alive.current && generation === imageGeneration.current) { reading.current = false; setReadingImage(false); } }
  };
  const paste = (event: ClipboardEvent<HTMLFormElement>) => {
    const files = Array.from(event.clipboardData.files);
    if (!files.length) for (const item of Array.from(event.clipboardData.items)) {
      if (item.kind === "file") { const file = item.getAsFile(); if (file) files.push(file); }
    }
    if (!files.length) return; // Plain text keeps normal textarea paste behavior.
    event.preventDefault();
    if (readOnly || disabled) return;
    if (files.length !== 1) { setKind("error"); setMessage("Paste one snippet at a time. Save this note before adding another."); return; }
    void selectImage(files[0]);
  };
  const form = <form noValidate onPaste={paste} className="flex min-h-0 flex-1 flex-col text-[12px]" onSubmit={async event => {
      event.preventDefault(); if (locked || readOnly || conflict) return;
      if ((!draft.snapshot().notes.trim() && !draft.snapshot().image) || !text.current?.checkValidity()) { setKind("error"); setMessage("Paste an image or enter some text."); text.current?.focus(); return; }
      const submitted = draft.snapshot(); setPending(true); setMessage(null);
      try {
        const saved = await mutate(async revisionId => {
          const response = await saveItemEngineerNoteAction({ ...submitted, itemId, expectedLatestRevisionId: revisionId });
          if (!response.ok) { if (response.code === "REVISION_CONFLICT") setConflict(true); throw new Error(response.error); }
          return { value: response.data, revisionId: response.data.revision?.id ?? null };
        });
        await onSaved(saved.note.id);
        const latest = draft.snapshot(); const unchanged = !reading.current && JSON.stringify(latest) === JSON.stringify(submitted);
        draft.acknowledge(submitted, { ...submitted, replaceNoteId: saved.note.id });
        if (unchanged) onClose(); else { draft.change({ ...latest, replaceNoteId: saved.note.id }); setKind("success"); setMessage("Note saved. Your later edits remain unsaved."); }
      } catch (error) { setKind("error"); setMessage(error instanceof Error ? error.message : "Save failed. Your note and image are retained."); }
      finally { setPending(false); }
    }}>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        <div ref={pasteArea} role="group" aria-label="Paste snippet image" tabIndex={readOnly || disabled ? -1 : 0} aria-disabled={readOnly || disabled}
          onClick={() => pasteArea.current?.focus()}
          className={`flex ${inline ? "min-h-28" : "min-h-36"} cursor-text flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-teal-300 bg-teal-50/30 p-3 text-center outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100`}>
          {draft.draft.image ? <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={draft.draft.image.dataUrl} alt={draft.draft.image.fileName} className="max-h-52 max-w-full rounded object-contain" />
            <span className="text-slate-500">Ctrl+V to replace the snippet</span>
          </> : <><ClipboardPaste size={24} className="text-teal-700" aria-hidden="true" /><span className="text-[13px] font-semibold text-slate-800">Click here, then press Ctrl+V</span><span className="text-slate-500">Paste a screenshot or image snippet</span></>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1 text-teal-700 underline decoration-teal-200 underline-offset-4"><ImageIcon size={13} aria-hidden="true" />Choose image instead<input aria-label="Optional image snippet" className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" disabled={readOnly || disabled || readingImage} onChange={event => { const file = event.target.files?.[0]; if (file) void selectImage(file); event.target.value = ""; }} /></label>
          {draft.draft.image && <button type="button" className="text-slate-500 hover:text-rose-700" disabled={readOnly || disabled || readingImage} onClick={() => draft.change({ ...draft.snapshot(), image: null })}>Remove snippet</button>}
        </div>
        {readingImage && <p role="status">Reading image…</p>}
        <label className="block"><span className="font-bold text-slate-700">Text <span className="font-normal text-slate-500">(optional)</span></span><textarea ref={text} aria-label="Engineer note text" placeholder="Add a short note if needed…" rows={2} className="field-input mt-1 w-full resize-y" maxLength={20000} disabled={readOnly} value={draft.draft.notes} onChange={event => draft.change({ ...draft.snapshot(), notes: event.target.value })} /></label>
        <ItemWorkspaceMessage message={message} kind={kind} />
        {conflict && <button type="button" className="icon-button" disabled={locked || reviewing} onClick={async () => {
          setReviewing(true); try {
            const latest = await loadItemEngineeringRevisionAction({ itemId }); if (!latest.ok) throw new Error(latest.error);
            if (window.confirm("Use latest saved engineering revision " + (latest.data?.revisionNumber ?? "(none)") + " for retry? Your note draft is retained; existing specifications and guidance are preserved.")) { await reviewRevision(latest.data?.id ?? null); setConflict(false); setKind("info"); setMessage("Revision reviewed. Retry saving your note."); }
          } catch (error) { setKind("error"); setMessage(error instanceof Error ? error.message : "Latest revision could not be loaded. Retry."); } finally { setReviewing(false); }
        }}>{reviewing ? "Loading revision…" : "Refresh revision for retry"}</button>}
      </div>
      <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-white px-4 py-3">
        {draft.dirty && <span className="mr-auto text-[11px] text-slate-500">Unsaved changes</span>}
        {(!inline || draft.dirty) && <button type="button" className="icon-button" disabled={locked} onClick={close}>{inline ? "Clear" : "Cancel"}</button>}<button className="icon-button icon-button-primary" disabled={locked || readOnly || conflict || !draft.dirty || (!draft.draft.notes.trim() && !draft.draft.image)}>{pending ? "Saving…" : "Save note"}</button>
      </footer>
    </form>;
  return inline ? <section aria-label="New engineer note" className="overflow-hidden rounded-[10px] border border-slate-200 bg-white"><h3 className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-3 text-[13px] font-semibold"><ClipboardPaste size={15} className="text-teal-700" aria-hidden="true" />Add snippet</h3>{form}</section> :
    <EngineeringDialog title={initial ? "Edit note" : "Add note"} compact dirty={draft.dirty} busy={locked} onClose={onClose}>{form}</EngineeringDialog>;
}
