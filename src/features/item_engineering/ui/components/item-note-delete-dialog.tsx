"use client";
import { useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { EngineeringDialog } from "@/shared/ui/engineering-dialog";
import { archiveItemEngineerNoteAction, loadItemEngineeringRevisionAction } from "../../api/actions";
import { ItemWorkspaceMessage, useItemWorkspace } from "./item-workspace-context";

export type NoteRemovalTarget = { id: string; label: string; notes: string; hasImage: boolean; mode: "delete" | "archive" };

export function ItemNoteDeleteDialog({ target, onClose, onRemoved }: {
  target: NoteRemovalTarget; onClose: () => void; onRemoved: () => Promise<void>;
}) {
  const { itemId, readOnly, busy, mutate, reviewRevision } = useItemWorkspace();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [latest, setLatest] = useState<{ id: string | null; number: number | null } | null>(null);
  const action = target.mode === "delete" ? "Delete" : "Archive";
  const locked = busy || pending || reviewing;
  return <EngineeringDialog title={action + " note?"} compact contentSized busy={locked} onClose={onClose}>
    <div className="space-y-3 overflow-y-auto px-5 py-4 text-[13px] text-slate-600">
      <div className="flex items-start gap-3"><span className="rounded-lg bg-rose-50 p-2 text-rose-700"><AlertTriangle size={18} aria-hidden="true" /></span><div className="min-w-0"><p className="font-semibold text-slate-900">{target.label}</p><p className="mt-1">This removes {target.hasImage ? "the snippet and any accompanying text" : "this note"} from the active library.</p></div></div>
      {target.notes && <p className="line-clamp-3 whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-slate-50 p-3">{target.notes}</p>}
      <p>It remains available under <strong>Include archived history</strong>. Earlier engineering revisions are preserved.</p>
      <ItemWorkspaceMessage message={error} kind="error" />
      {conflict && <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
        {latest ? <><p>Latest saved engineering revision: {latest.number ?? "none"}. Review it before retrying {target.label}.</p><button className="icon-button" disabled={locked} onClick={async () => {
          setReviewing(true);
          try { await reviewRevision(latest.id); setLatest(null); setConflict(false); setError(null); }
          catch (cause) { setError(cause instanceof Error ? cause.message : "The revision could not be adopted. Retry."); }
          finally { setReviewing(false); }
        }}>Use latest revision for retry</button></> : <button className="icon-button" disabled={locked} onClick={async () => {
          setReviewing(true);
          try { const response = await loadItemEngineeringRevisionAction({ itemId }); if (!response.ok) throw new Error(response.error); setLatest({ id: response.data?.id ?? null, number: response.data?.revisionNumber ?? null }); }
          catch (cause) { setError(cause instanceof Error ? cause.message : "The latest revision could not be loaded. Retry."); }
          finally { setReviewing(false); }
        }}>{reviewing ? "Loading revision…" : "Review latest revision"}</button>}
      </div>}
    </div>
    <footer className="flex shrink-0 justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
      <button className="icon-button" disabled={locked} onClick={onClose}>Cancel</button>
      <button className="icon-button icon-button-danger" disabled={locked || readOnly || conflict} onClick={async () => {
        if (locked || readOnly || conflict) return;
        setPending(true); setError(null);
        try {
          await mutate(async revisionId => {
            const response = await archiveItemEngineerNoteAction({ itemId, noteId: target.id, expectedLatestRevisionId: revisionId });
            if (!response.ok) { if (response.code === "REVISION_CONFLICT") setConflict(true); throw new Error(response.error); }
            return { value: response.data, revisionId: response.data.revision?.id ?? null };
          });
          await onRemoved();
        } catch (cause) { setError(cause instanceof Error ? cause.message : "The note could not be removed. Please retry."); }
        finally { setPending(false); }
      }}><Trash2 size={14} aria-hidden="true" />{pending ? "Removing…" : action + " note"}</button>
    </footer>
  </EngineeringDialog>;
}
