"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { FileText, Files, Plus, Trash2, ExternalLink } from "lucide-react";
import { WorkspaceEmpty, WorkspaceHeading, WorkspaceHelp } from "@/shared/ui/item-workspace-presentation";
import { ItemWorkspaceMessage, useItemWorkspace, itemWorkspaceDate } from "@/features/item_engineering/ui/public";
import { loadItemEngineeringRevisionAction } from "@/features/item_engineering/api/actions";
import type { BomItemDocumentMetadata } from "../../data/schema";
import { loadItemWorkspaceDocumentsAction } from "../../api/item-workspace-actions";
import { deleteBomItemDocumentAction } from "../../api/actions";
import { formatItemDocumentSize } from "../../logic/services/item-workspace-presentation";
const UploadDialog = dynamic(() => import("./item-document-upload-dialog").then(module => module.ItemDocumentUploadDialog));
export function ItemWorkspaceDocuments() {
  const { itemId, readOnly, busy, mutate, reviewRevision } = useItemWorkspace();
  const [documents, setDocuments] = useState<BomItemDocumentMetadata[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [kind, setKind] = useState<"info" | "success" | "error">("info");
  const [listError, setListError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0); const [loading, setLoading] = useState(true);
  const trigger = useRef<HTMLButtonElement>(null);
  const wasUploading = useRef(false);
  useEffect(() => {
    if (uploading) { wasUploading.current = true; return; }
    if (!wasUploading.current) return;
    const frame = requestAnimationFrame(() => trigger.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [uploading]);
  useEffect(() => {
    let active = true;
    loadItemWorkspaceDocumentsAction(itemId).then(result => {
      if (!active) return; setLoading(false); if (result.ok) { setDocuments(result.data); setListError(null); } else setListError(result.error);
    }).catch(() => { if (active) { setLoading(false); setListError("Documents could not be loaded. Retry."); } });
    return () => { active = false; };
  }, [itemId, attempt]);
  const add = <button ref={trigger} className="icon-button icon-button-primary" disabled={busy || loading || !!listError || documents === null} onClick={() => setUploading(true)}><Plus size={14} aria-hidden="true" />Upload Document</button>;
  return <div className="space-y-4">
    <WorkspaceHeading title="Documents" icon={Files} detail={documents ? documents.length + (documents.length === 1 ? " product PDF" : " product PDFs") : "Product PDFs"} action={!readOnly && documents?.length !== 0 ? add : undefined} />
    <ItemWorkspaceMessage message={listError} kind="error" />
    {listError && <button className="icon-button" disabled={loading} onClick={() => { setLoading(true); setAttempt(value => value + 1); }}>Retry document list</button>}
    <ItemWorkspaceMessage message={message} kind={kind} />
    {kind === "error" && message && !readOnly && <button className="icon-button" disabled={busy} onClick={async () => {
      try { const result = await loadItemEngineeringRevisionAction({ itemId }); if (!result.ok) throw new Error(result.error);
        if (window.confirm("Use the latest saved engineering revision " + (result.data?.revisionNumber ?? "(none)") + " for retry? Current specifications and guidance will be retained.")) {
          await reviewRevision(result.data?.id ?? null); setKind("info"); setMessage("Revision reviewed. Retry your document operation.");
        }
      } catch (error) { setKind("error"); setMessage(error instanceof Error ? error.message : "Revision could not be loaded. Retry."); }
    }}>Refresh revision for retry</button>}
    {loading && <p role="status" className="rounded-lg border border-slate-200 bg-white p-4 text-[13px] text-slate-500">Loading document summaries…</p>}
    {documents?.length === 0 && !loading && <WorkspaceEmpty title="No documents attached." description="Keep product datasheets and installation PDFs with this Item." icon={Files} action={!readOnly ? add : undefined} />}
    {!!documents?.length && <ul className="divide-y divide-slate-100 overflow-hidden rounded-[10px] border border-slate-200 bg-white">{documents.map(document => <li key={document.id} className="flex flex-wrap items-center justify-between gap-4 p-4 hover:bg-slate-50/50">
      <div className="flex min-w-0 flex-1 items-center gap-3"><span className="rounded-lg border border-teal-100 bg-teal-50 p-3 text-teal-700"><FileText size={22} aria-hidden="true" /></span>
        <div className="min-w-0"><h3 className="break-words text-[13px] font-semibold text-slate-900">{document.title}</h3><p className="mt-1 break-words text-[12px] text-slate-500">{document.fileName} · {formatItemDocumentSize(document.sizeBytes)} · {itemWorkspaceDate(document.createdAt)}</p></div>
      </div>
      <div className="flex flex-wrap gap-2"><a className="icon-button" href={document.documentUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} aria-hidden="true" />Open / Download</a>
        {!readOnly && <button className="icon-button text-rose-700" disabled={busy || loading} onClick={async () => {
          if (!window.confirm("Remove this PDF from the active Item? Referenced historical content remains available.")) return;
          try { await mutate(async revisionId => { const result = await deleteBomItemDocumentAction({ itemId, documentId: document.id, expectedEngineeringRevisionId: revisionId });
            if (!result.ok) throw new Error(result.error); return { value: result.data, revisionId: result.data.revisionId }; });
            setDocuments(current => current?.filter(row => row.id !== document.id) ?? null); setKind("success"); setMessage("Document removed from the active Item.");
          } catch (error) { setKind("error"); setMessage(error instanceof Error ? error.message : "Removal failed."); }
        }}><Trash2 size={14} aria-hidden="true" />Remove document</button>}
      </div>
    </li>)}</ul>}
    <WorkspaceHelp title="Document history">Removing a referenced document archives it. Exact downloads remain available to historical Item revisions.</WorkspaceHelp>
    {uploading && <UploadDialog onUploaded={saved => { setDocuments(current => [saved, ...(current ?? []).filter(row => row.id !== saved.id)]); setKind("success"); setMessage("PDF uploaded."); }} onClose={() => setUploading(false)} />}
  </div>;
}
