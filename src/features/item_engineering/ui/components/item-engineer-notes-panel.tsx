"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Archive, CircleCheck, GripVertical, ImageIcon, NotebookPen, Pencil, Trash2 } from "lucide-react";
import { WorkspaceEmpty, WorkspaceHeading } from "@/shared/ui/item-workspace-presentation";
import { loadItemEngineerNoteAction, loadItemEngineerNotePageAction, loadItemEngineeringRevisionAction, reorderItemEngineerNoteAction } from "../../api/actions";
import { moveNoteBefore } from "../../logic/services/item-note-order";
import { resolveNoteSelection } from "../../logic/services/item-workspace-state";
import { ItemWorkspaceMessage, useItemWorkspace, itemWorkspaceDate } from "./item-workspace-context";
import type { ItemNoteDetail } from "./item-engineer-note-dialog";
import type { NoteRemovalTarget } from "./item-note-delete-dialog";
const NoteDialog = dynamic(() => import("./item-engineer-note-dialog").then(module => module.ItemEngineerNoteDialog));
const NoteDeleteDialog = dynamic(() => import("./item-note-delete-dialog").then(module => module.ItemNoteDeleteDialog));

type NotePage = Extract<Awaited<ReturnType<typeof loadItemEngineerNotePageAction>>, { ok: true }>["data"];

function LibraryOrderToast() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), 2000);
    return () => window.clearTimeout(timer);
  }, []);
  if (!visible || typeof document === "undefined") return null;
  return createPortal(<div role="status" aria-live="polite" aria-atomic="true"
    className="pointer-events-none fixed left-4 top-4 z-[70] flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-lg border border-teal-200 bg-white px-4 py-3 text-[13px] text-teal-950 shadow-lg">
    <CircleCheck size={18} className="shrink-0 text-teal-600" aria-hidden="true" />
    Library order saved.
  </div>, document.body);
}

export function ItemEngineerNotesPanel() {
  const { itemId, readOnly, busy, mutate, reviewRevision } = useItemWorkspace();
  const orderHelpId = useId();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; after: boolean } | null>(null);
  const [orderPending, setOrderPending] = useState(false);
  const [orderConflict, setOrderConflict] = useState(false);
  const [orderToast, setOrderToast] = useState<number | null>(null);
  const orderToastSequence = useRef(0);
  const orderLock = useRef(false); const orderFocus = useRef<string | null>(null);
  const [editor, setEditor] = useState<ItemNoteDetail | null>(null);
  const [removal, setRemoval] = useState<NoteRemovalTarget | null>(null);
  const removalTrigger = useRef<HTMLButtonElement | null>(null);
  const [composerVersion, setComposerVersion] = useState(0);
  const [page, setPage] = useState(1); const [archived, setArchived] = useState(false); const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<NotePage | null>(null);
  const [loading, setLoading] = useState(true); const [stale, setStale] = useState(false); const [listError, setListError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [opened, setOpened] = useState<Record<string, ItemNoteDetail>>({});
  const [detailError, setDetailError] = useState<{ id: string; message: string } | null>(null);
  const [detailAttempt, setDetailAttempt] = useState(0);
  const [message, setMessage] = useState<string | null>(null); const [kind, setKind] = useState<"info" | "success" | "error">("info");
  const request = useRef(0); const alive = useRef(true); const composer = useRef<HTMLDivElement>(null); const library = useRef<HTMLDivElement>(null); const focusNote = useRef<string | null>(null);
  const detailRequests = useRef(new Map<string, Promise<ItemNoteDetail>>());
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const fetchPage = useCallback(async (target: number, history: boolean, preferred?: string, keepSelection = false) => {
    const serial = ++request.current;
    try {
      const response = await loadItemEngineerNotePageAction({ itemId, page: target, includeArchived: history, ...(preferred ? { focusNoteId: preferred } : {}) });
      if (!alive.current || serial !== request.current) return;
      if (!response.ok) throw new Error(response.error);
      setResult(response.data); setPage(response.data.page);
      setSelectedId(current => (keepSelection || !preferred) && current && response.data.activeOrder.includes(current) ? current : resolveNoteSelection(response.data.items.map(note => note.id), current, preferred));
      setListError(null); setStale(false); setLoading(false);
    } catch (error) {
      if (alive.current && serial === request.current) { setLoading(false); setStale(true); setListError(error instanceof Error ? error.message : "Notes could not be refreshed. Retry before making further changes."); }
    }
  }, [itemId]);
  // Queries reconcile only after their awaited response; visited tabs stay mounted.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchPage(page, archived); }, [fetchPage, page, archived, attempt]);
  const selected = result?.items.find(note => note.id === selectedId) ?? (selectedId && result?.activeOrder.includes(selectedId) ? opened[selectedId] : undefined);
  const detail = selected ? opened[selected.id] : undefined;
  const previewError = detailError?.id === selectedId ? detailError.message : null;
  useEffect(() => {
    if (!selectedId || detail || loading || stale) return;
    let current = true;
    let pending = detailRequests.current.get(selectedId);
    if (!pending) {
      pending = loadItemEngineerNoteAction({ itemId, noteId: selectedId }).then(response => {
        if (!response.ok) throw new Error(response.error);
        return response.data;
      });
      detailRequests.current.set(selectedId, pending);
    }
    void pending.then(value => {
      if (current && alive.current) { setOpened(cache => ({ ...cache, [value.id]: value })); setDetailError(null); }
    }).catch(error => {
      detailRequests.current.delete(selectedId);
      if (current && alive.current) setDetailError({ id: selectedId, message: error instanceof Error ? error.message : "The note could not be loaded." });
    });
    return () => { current = false; };
  }, [selectedId, itemId, detail, loading, stale, detailAttempt]);
  const disabled = busy || loading || stale || orderPending;
  const reorderDisabled = disabled || readOnly || archived || !!editor || !!removal || orderConflict;
  const actionDisabled = disabled || !detail || !!removal;
  useEffect(() => {
    if (editor || removal || disabled || !focusNote.current) return;
    const noteId = focusNote.current;
    if (noteId !== "library" && noteId !== "removal-cancel" && selectedId && !detail) return;
    const buttons = Array.from(library.current?.querySelectorAll<HTMLButtonElement>("button[data-note-id], button[data-note-choice]") ?? []);
    const button = noteId === "removal-cancel" && removalTrigger.current?.isConnected ? removalTrigger.current :
      noteId === "library" ? buttons.find(node => node.dataset.noteChoice === selectedId && !node.disabled) : buttons.find(node => node.dataset.noteId === noteId && !node.disabled);
    (button ?? composer.current?.querySelector<HTMLElement>('[role="group"]'))?.focus(); focusNote.current = null;
  }, [editor, removal, disabled, detail, selectedId]);
  useEffect(() => {
    if (disabled || !orderFocus.current) return;
    const handle = Array.from(library.current?.querySelectorAll<HTMLButtonElement>("button[data-note-move]") ?? []).find(node => node.dataset.noteMove === orderFocus.current);
    handle?.focus(); orderFocus.current = null;
  }, [disabled, result]);
  const reorder = async (noteId: string, beforeNoteId: string | null) => {
    setDraggedId(null); setDropTarget(null);
    if (!result || reorderDisabled || orderLock.current) return;
    const next = moveNoteBefore(result.activeOrder, noteId, beforeNoteId);
    if (next.every((id, index) => id === result.activeOrder[index])) return;
    orderLock.current = true; setOrderPending(true); setOrderToast(null); setKind("info"); setMessage("Saving Library order…");
    try {
      await mutate(async revisionId => {
        const response = await reorderItemEngineerNoteAction({ itemId, noteId, beforeNoteId, expectedOrderToken: result.orderToken, expectedLatestRevisionId: revisionId });
        if (!response.ok) { if (response.code === "REVISION_CONFLICT") setOrderConflict(true); throw new Error(response.error); }
        return { value: response.data, revisionId: response.data.revisionId };
      });
      setLoading(true); setStale(true);
      await fetchPage(Math.floor(next.indexOf(noteId) / 25) + 1, false, undefined, true);
      orderFocus.current = noteId; setMessage(null); setOrderToast(++orderToastSequence.current);
    } catch (error) { setKind("error"); setMessage(error instanceof Error ? error.message : "Library order could not be saved. Try the move again."); }
    finally { orderLock.current = false; setOrderPending(false); }
  };
  const saved = async (noteId: string) => {
    if (editor) focusNote.current = noteId;
    setStale(true); setLoading(true); setKind("success"); setMessage("Note saved.");
    await fetchPage(1, archived, noteId);
  };
  const number = selected && result ? archived ? (result.page - 1) * result.pageSize + result.items.findIndex(note => note.id === selected.id) + 1 : result.activeOrder.indexOf(selected.id) + 1 : null;
  return <div className="space-y-4">
    <WorkspaceHeading title="Engineer Notes" icon={NotebookPen} detail="Your snippet and note library" />
    {orderToast !== null && <LibraryOrderToast key={orderToast} />}
    <ItemWorkspaceMessage message={message} kind={kind} />
    {orderConflict && <button className="icon-button" disabled={disabled} onClick={async () => {
      setOrderPending(true);
      try {
        const latest = await loadItemEngineeringRevisionAction({ itemId }); if (!latest.ok) throw new Error(latest.error);
        await reviewRevision(latest.data?.id ?? null); setLoading(true); setStale(true); await fetchPage(page, archived);
        setOrderConflict(false); setKind("info"); setMessage("Library refreshed. Review its order, then move the note again.");
      } catch (error) { setKind("error"); setMessage(error instanceof Error ? error.message : "The Library could not be refreshed."); }
      finally { setOrderPending(false); }
    }}>Refresh Library before reordering</button>}
    <ItemWorkspaceMessage message={listError} kind="error" />
    {listError && <button className="icon-button" disabled={loading} onClick={() => { setLoading(true); setAttempt(value => value + 1); }}>Retry loading notes</button>}
    <div ref={library} className={"grid min-w-0 items-start gap-4 lg:grid-cols-[220px_minmax(0,1fr)] " + (!readOnly ? "min-[75rem]:grid-cols-[220px_minmax(0,1fr)_280px]" : "")}>
        <section className="min-w-0 overflow-hidden rounded-[10px] border border-slate-200 bg-white lg:row-span-2 min-[75rem]:row-span-1" aria-label="Saved notes">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/70 px-3 py-3"><h3 className="text-[13px] font-semibold">Library</h3><span className="text-[12px] text-slate-500">{result ? result.totalItems + (result.totalItems === 1 ? " note" : " notes") : "Loading…"}</span></header>
          <p id={orderHelpId} className="sr-only">Drag the grip to reorder. With the grip focused, use Up or Down to move one position, or Home and End to move to the start or end. Order saves automatically. Turn off archived history to reorder.</p>
          <div className="max-h-64 space-y-1 overflow-y-auto p-2 lg:max-h-[65vh]" aria-busy={loading || stale}>
            {result?.items.length === 0 && !loading && <p className="px-2 py-3 text-[12px] text-slate-500">Your saved notes will appear here.</p>}
            {result?.items.map((note, index) => {
              const noteNumber = (result.page - 1) * result.pageSize + index + 1;
              const image = opened[note.id]?.image;
              return <div key={note.id} data-note-row={note.id}
                onDragOver={event => { if (!draggedId || reorderDisabled) return; event.preventDefault(); event.dataTransfer.dropEffect = "move"; const rect = event.currentTarget.getBoundingClientRect(); setDropTarget({ id: note.id, after: event.clientY > rect.top + rect.height / 2 }); }}
                onDrop={event => { if (!draggedId || reorderDisabled) return; event.preventDefault(); const rect = event.currentTarget.getBoundingClientRect(); const after = event.clientY > rect.top + rect.height / 2; const before = after ? result.activeOrder[result.activeOrder.indexOf(note.id) + 1] ?? null : note.id; void reorder(draggedId, before); }}
                className={"relative rounded-lg border " + (selectedId === note.id ? "border-teal-300 bg-teal-50" : "border-transparent hover:border-slate-200 hover:bg-slate-50") + (draggedId === note.id ? " opacity-50" : "")}>
                {dropTarget?.id === note.id && draggedId !== note.id && <span aria-hidden="true" className={"pointer-events-none absolute inset-x-0 z-10 h-0.5 rounded bg-teal-500 " + (dropTarget.after ? "-bottom-1" : "-top-1")} />}
                <button type="button" aria-label={"View note " + noteNumber} aria-pressed={selectedId === note.id} data-note-choice={note.id} tabIndex={selectedId === note.id ? 0 : -1} disabled={disabled}
                className={"flex w-full min-w-0 items-center gap-2 rounded-lg p-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-teal-500 " + (!readOnly && !note.archivedAt ? "pr-9" : "") + (!readOnly && !archived ? " pl-6" : "")}
                onClick={() => setSelectedId(note.id)} onKeyDown={event => {
                  const next = event.key === "ArrowDown" ? Math.min(index + 1, result.items.length - 1) : event.key === "ArrowUp" ? Math.max(index - 1, 0) : event.key === "Home" ? 0 : event.key === "End" ? result.items.length - 1 : null;
                  if (next === null) return; event.preventDefault(); setSelectedId(result.items[next].id);
                  const buttons = event.currentTarget.parentElement?.parentElement?.querySelectorAll<HTMLButtonElement>("button[data-note-choice]"); buttons?.[next]?.focus();
                }}>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded border border-slate-200 bg-white text-teal-700">{image ?
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image.dataUrl} alt="" draggable={false} className="h-full w-full object-contain" /> : note.hasImage ? <ImageIcon size={19} aria-hidden="true" /> : <NotebookPen size={19} aria-hidden="true" />}</span>
                <span className="min-w-0"><span className="block text-[12px] font-semibold text-slate-800">Note {noteNumber}{note.archivedAt ? " · Archived" : ""}</span><span className="line-clamp-2 break-words text-[12px] text-slate-500">{note.notes || "Image snippet"}</span></span>
                </button>
                {!readOnly && !archived && <button type="button" aria-label={"Move note " + noteNumber} aria-describedby={orderHelpId} data-note-move={note.id} title="Drag to reorder · Up/Down or Home/End" disabled={reorderDisabled || result.activeOrder.length < 2} draggable={!reorderDisabled && result.activeOrder.length > 1}
                  className="absolute bottom-1 left-0 top-1 flex w-6 cursor-grab items-center justify-center rounded text-slate-400 outline-none hover:text-teal-700 focus-visible:ring-2 focus-visible:ring-teal-500 active:cursor-grabbing disabled:cursor-default disabled:opacity-40"
                  onDragStart={event => { if (reorderDisabled) { event.preventDefault(); return; } setDraggedId(note.id); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", note.id); }}
                  onDragEnd={() => { setDraggedId(null); setDropTarget(null); }}
                  onKeyDown={event => {
                    if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key) || reorderDisabled) return;
                    event.preventDefault(); const current = result.activeOrder.indexOf(note.id);
                    const target = event.key === "Home" ? 0 : event.key === "End" ? result.activeOrder.length - 1 : current + (event.key === "ArrowUp" ? -1 : 1);
                    if (target < 0 || target >= result.activeOrder.length || target === current) return;
                    void reorder(note.id, target < current ? result.activeOrder[target] : result.activeOrder[target + 1] ?? null);
                  }}><GripVertical size={14} aria-hidden="true" /></button>}
                {!readOnly && !note.archivedAt && <button type="button" aria-label={"Delete note " + noteNumber} title={"Delete note " + noteNumber} disabled={disabled || !!editor || !!removal}
                  className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-md text-slate-400 outline-none transition-colors hover:bg-rose-50 hover:text-rose-700 focus-visible:bg-rose-50 focus-visible:text-rose-700 focus-visible:ring-2 focus-visible:ring-rose-400 disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={event => { removalTrigger.current = event.currentTarget; setRemoval({ ...note, label: "Note " + noteNumber, mode: "delete" }); }}><Trash2 size={13} aria-hidden="true" /></button>}
              </div>;
            })}
          </div>
          {result && result.totalPages > 1 && <div className="flex items-center justify-between gap-2 border-t border-slate-100 p-2 text-[12px] text-slate-500">
            <button className="icon-button" aria-label="Previous notes" disabled={disabled || result.page <= 1} onClick={() => { setPage(result.page - 1); setLoading(true); }}>Previous</button><span>{result.page} / {result.totalPages}</span><button className="icon-button" aria-label="Next notes" disabled={disabled || result.page >= result.totalPages} onClick={() => { setPage(result.page + 1); setLoading(true); }}>Next</button>
          </div>}
          <label className="flex items-center gap-2 border-t border-slate-100 px-3 py-2 text-[12px] text-slate-500"><input type="checkbox" checked={archived} disabled={busy} onChange={event => { setArchived(event.target.checked); setPage(1); setLoading(true); }} />Include archived history</label>
        </section>
      <article aria-label="Selected engineer note" aria-busy={loading || stale || (!!selected && !detail && !previewError)} className="min-w-0 overflow-hidden rounded-[10px] border border-slate-200 bg-white">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-3">
          <div className="min-w-0"><h3 className="flex items-center gap-2 text-[14px] font-semibold text-slate-800"><ImageIcon size={16} className="text-teal-700" aria-hidden="true" />{selected ? "Note " + number : "Note preview"}{selected?.archivedAt && <span className="rounded bg-slate-200/60 px-2 py-0.5 text-[11px] font-normal">Archived</span>}</h3>
            {selected && <time dateTime={selected.createdAt} className="mt-1 block text-[12px] text-slate-500">{itemWorkspaceDate(selected.createdAt)}</time>}
          </div>
          {selected && !readOnly && !selected.archivedAt && <div className="flex items-center gap-2">
            <button className="icon-button" data-note-id={selected.id} disabled={actionDisabled} onClick={() => { if (detail) { focusNote.current = selected.id; setEditor(detail); } }}><Pencil size={13} aria-hidden="true" />Edit note</button>
            <button className="icon-button text-rose-700" disabled={actionDisabled} onClick={event => { removalTrigger.current = event.currentTarget; setRemoval({ ...selected, label: "Note " + number, mode: "archive" }); }}><Archive size={13} aria-hidden="true" />Archive note</button>
          </div>}
        </header>
        {!selected ? <div className="flex min-h-64 items-center justify-center p-5">{loading ? <p role="status" className="text-[13px] text-slate-500">Loading note library…</p> : <WorkspaceEmpty title="No saved notes yet." description={readOnly ? "No saved notes for this Item." : "Paste a snippet in the Add snippet pad to start your library."} icon={NotebookPen} />}</div> :
          !detail ? <div className="flex min-h-64 flex-col items-center justify-center gap-3 p-5">{previewError ? <><ItemWorkspaceMessage message={previewError} kind="error" /><button className="icon-button" onClick={() => { setDetailError(null); setDetailAttempt(value => value + 1); }}>Retry loading note</button></> : <p role="status" className="text-[13px] text-slate-500">Loading selected note…</p>}</div> : <>
            {detail.image && <div className="flex min-h-64 items-center justify-center bg-slate-50/50 p-3 sm:p-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={detail.image.dataUrl} alt={detail.image.fileName} className="max-h-[65vh] max-w-full rounded object-contain" />
            </div>}
            {detail.notes && <div className={"p-5 " + (detail.image ? "border-t border-slate-100" : "min-h-64")}><p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-slate-700">{detail.notes}</p></div>}
          </>}
      </article>
      {!readOnly && <div ref={composer} className="min-w-0 lg:col-start-2 min-[75rem]:col-auto"><NoteDialog key={composerVersion} inline initial={null} disabled={loading || stale} onSaved={saved} onClose={() => { setComposerVersion(value => value + 1); }} /></div>}
    </div>
    {editor && <NoteDialog initial={editor} onSaved={saved} onClose={() => setEditor(null)} />}
    {removal && <NoteDeleteDialog target={removal} onClose={() => { focusNote.current = "removal-cancel"; setRemoval(null); }} onRemoved={async () => {
      setLoading(true); setStale(true); setKind("success"); setMessage(removal.mode === "delete" ? "Note removed from the library. Archived history is preserved." : "Note archived.");
      await fetchPage(page, archived); focusNote.current = "library"; setRemoval(null);
    }} />}
  </div>;
}
