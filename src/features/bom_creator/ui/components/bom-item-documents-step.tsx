"use client";

import { useRef, useState, useTransition, type ChangeEvent } from "react";
import { Download, FileText, Trash2, Upload, X } from "lucide-react";
import { deleteBomItemDocumentAction } from "../../api/actions";
import type { BomItemDocumentMetadata } from "../../data/schema";
import {
  MAX_BOM_ITEM_DOCUMENTS,
  MAX_BOM_ITEM_TOTAL_DOCUMENT_BYTES,
  validateBomItemDocumentBudget
} from "../../logic/services/bom-item-document-limits";

export type StagedBomItemDocument = {
  clientId: string;
  file: File;
  title: string;
  status: "ready" | "uploading" | "failed";
  error?: string;
};

function formatBytes(value: number): string {
  if (value >= 1024 * 1024) {
    const megabytes = value / (1024 * 1024);
    return `${Number.isInteger(megabytes) ? megabytes : megabytes.toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(value / 1024))} KB`;
}

function titleFromFileName(fileName: string): string {
  return fileName.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim();
}

export function BomItemDocumentsStep({
  disabled,
  existingDocuments,
  itemId,
  onExistingDeleted,
  onStagedDocumentsChange,
  stagedDocuments
}: {
  disabled: boolean;
  existingDocuments: BomItemDocumentMetadata[];
  itemId?: string;
  onExistingDeleted: (documentId: string) => void;
  onStagedDocumentsChange: (documents: StagedBomItemDocument[]) => void;
  stagedDocuments: StagedBomItemDocument[];
}) {
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [deleteDocument, setDeleteDocument] =
    useState<BomItemDocumentMetadata | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();
  const totalBytes = [...existingDocuments, ...stagedDocuments].reduce(
    (total, document) =>
      total + ("file" in document ? document.file.size : document.sizeBytes),
    0
  );
  const totalCount = existingDocuments.length + stagedDocuments.length;
  const hasCapacity =
    totalCount < MAX_BOM_ITEM_DOCUMENTS &&
    totalBytes < MAX_BOM_ITEM_TOTAL_DOCUMENT_BYTES;

  const addFiles = (files: File[]) => {
    setMessage(null);
    if (files.length === 0) {
      return;
    }

    if (
      files.some(
        (file) =>
          (file.type !== "" && file.type !== "application/pdf") ||
          !file.name.toLowerCase().endsWith(".pdf")
      )
    ) {
      setMessage("Only PDF documents are supported.");
      return;
    }

    const budget = validateBomItemDocumentBudget([
      ...existingDocuments,
      ...stagedDocuments.map((document) => ({
        sizeBytes: document.file.size
      })),
      ...files.map((file) => ({ sizeBytes: file.size }))
    ]);

    if (!budget.ok) {
      setMessage(
        budget.violations[0]?.message ?? "The selected documents are invalid."
      );
      return;
    }

    onStagedDocumentsChange([
      ...stagedDocuments,
      ...files.map((file) => ({
        clientId: crypto.randomUUID(),
        file,
        title: titleFromFileName(file.name) || "Document",
        status: "ready" as const
      }))
    ]);
  };

  const handleUpload = (event: ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(event.currentTarget.files ?? []));
    event.currentTarget.value = "";
  };

  const confirmDelete = () => {
    if (!deleteDocument || !itemId) {
      return;
    }

    startDeleteTransition(async () => {
      setMessage(null);
      const result = await deleteBomItemDocumentAction({
        itemId,
        documentId: deleteDocument.id
      });

      if (!result.ok) {
        setMessage(result.error);
        return;
      }

      onExistingDeleted(deleteDocument.id);
      setDeleteDocument(null);
    });
  };

  return (
    <div className="grid gap-4" data-testid="bom-item-documents-step">
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
        <FileText aria-hidden="true" className="mx-auto text-slate-500" size={26} />
        <div className="mt-3 text-sm font-semibold text-slate-950">
          Attach product PDFs
        </div>
        <div className="mt-1 text-xs text-slate-500">
          {totalCount} / {MAX_BOM_ITEM_DOCUMENTS} documents. {formatBytes(totalBytes)} /{" "}
          {formatBytes(MAX_BOM_ITEM_TOTAL_DOCUMENT_BYTES)} used. Each PDF can be up to 25 MB.
        </div>
        <input
          ref={uploadInputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="hidden"
          onChange={handleUpload}
          data-testid="bom-item-document-input"
        />
        <button
          type="button"
          className="icon-button mt-4"
          onClick={() => uploadInputRef.current?.click()}
          disabled={disabled || !hasCapacity}
        >
          <Upload aria-hidden="true" size={14} />
          Add PDFs
        </button>
      </div>

      {message ? (
        <div
          className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800"
          role="alert"
        >
          {message}
        </div>
      ) : null}

      {existingDocuments.length === 0 && stagedDocuments.length === 0 ? (
        <div className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-600">
          No documents added yet.
        </div>
      ) : (
        <div className="divide-y divide-slate-200 overflow-hidden rounded-md border border-slate-200 bg-white">
          {existingDocuments.map((document) => (
            <div
              key={document.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-950">
                  {document.title}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {document.fileName} / {formatBytes(document.sizeBytes)} / Saved
                </div>
              </div>
              <div className="flex gap-1">
                <a
                  className="icon-button h-8 w-8 p-0"
                  href={document.documentUrl}
                  aria-label={`Download ${document.fileName}`}
                  title="Download PDF"
                >
                  <Download aria-hidden="true" size={14} />
                </a>
                <button
                  type="button"
                  className="icon-button icon-button-danger h-8 w-8 p-0"
                  aria-label={`Delete ${document.fileName}`}
                  title="Delete PDF"
                  onClick={() => setDeleteDocument(document)}
                  disabled={disabled || isDeleting}
                >
                  <Trash2 aria-hidden="true" size={14} />
                </button>
              </div>
            </div>
          ))}

          {stagedDocuments.map((document, index) => (
            <div key={document.clientId} className="grid gap-3 px-4 py-3 sm:grid-cols-[1fr_auto]">
              <div className="min-w-0">
                <label
                  className="field-label"
                  htmlFor={`bom-document-title-${document.clientId}`}
                >
                  Document title
                </label>
                <input
                  id={`bom-document-title-${document.clientId}`}
                  className="field-input"
                  value={document.title}
                  disabled={disabled || document.status === "uploading"}
                  onChange={(event) =>
                    onStagedDocumentsChange(
                      stagedDocuments.map((candidate, candidateIndex) =>
                        candidateIndex === index
                          ? { ...candidate, title: event.currentTarget.value }
                          : candidate
                      )
                    )
                  }
                />
                <div className="mt-1 text-xs text-slate-500">
                  {document.file.name} / {formatBytes(document.file.size)} /{" "}
                  {document.status === "uploading"
                    ? "Uploading..."
                    : document.status === "failed"
                      ? "Upload failed"
                      : "Ready to upload"}
                </div>
                {document.error ? (
                  <div className="mt-1 text-xs font-semibold text-red-700">
                    {document.error}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                className="icon-button icon-button-danger h-8 w-8 self-end p-0"
                aria-label={`Remove ${document.file.name}`}
                title="Remove staged PDF"
                disabled={disabled || document.status === "uploading"}
                onClick={() =>
                  onStagedDocumentsChange(
                    stagedDocuments.filter(
                      (candidate) => candidate.clientId !== document.clientId
                    )
                  )
                }
              >
                <X aria-hidden="true" size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {deleteDocument ? (
        <div
          className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/40 p-4"
          role="presentation"
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-bom-document-title"
          >
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 id="delete-bom-document-title" className="text-base font-semibold">
                Delete document?
              </h3>
            </div>
            <div className="px-5 py-4 text-sm text-slate-600">
              <strong className="text-slate-950">{deleteDocument.title}</strong> will be permanently removed from this item.
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4">
              <button
                type="button"
                className="icon-button"
                onClick={() => setDeleteDocument(null)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="icon-button icon-button-danger"
                onClick={confirmDelete}
                disabled={isDeleting}
              >
                <Trash2 aria-hidden="true" size={14} />
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
