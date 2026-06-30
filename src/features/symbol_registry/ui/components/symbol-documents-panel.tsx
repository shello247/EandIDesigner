"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Download, FileText, Upload } from "lucide-react";
import { uploadSymbolDocumentAction } from "../../api/actions";
import type { SymbolDocumentSummary } from "../../types";

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

export function SymbolDocumentsPanel({
  symbolId,
  versionId,
  documents
}: {
  symbolId: string;
  versionId?: string;
  documents: SymbolDocumentSummary[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const uploadDocument = () => {
    const form = formRef.current;

    if (!form) {
      return;
    }

    startTransition(async () => {
      const formData = new FormData(form);
      formData.set("symbolId", symbolId);
      if (versionId) {
        formData.set("versionId", versionId);
      }

      const result = await uploadSymbolDocumentAction(formData);

      if (!result.ok) {
        setMessage(result.error);
        return;
      }

      form.reset();
      setMessage("Document uploaded.");
      router.refresh();
    });
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
      <section className="tool-panel overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-bold">Documents</h2>
        </div>
        <form ref={formRef} className="space-y-4 p-4">
          <div>
            <label className="field-label" htmlFor="document-title">
              Document title
            </label>
            <input
              id="document-title"
              name="title"
              className="field-input"
              type="text"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="document-file">
              PDF document
            </label>
            <input
              id="document-file"
              name="documentFile"
              className="field-input"
              type="file"
              accept="application/pdf,.pdf"
            />
          </div>

          {message ? <div className="text-xs text-slate-600">{message}</div> : null}

          <button
            type="button"
            className="icon-button icon-button-primary"
            onClick={uploadDocument}
            disabled={isPending}
          >
            <Upload aria-hidden="true" size={14} />
            Upload document
          </button>
        </form>
      </section>

      <section className="tool-panel overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-bold">Device Documents</h2>
        </div>
        {documents.length > 0 ? (
          <div className="divide-y divide-slate-200">
            {documents.map((document) => (
              <div
                key={document.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div className="mt-0.5 rounded-md border border-slate-200 bg-slate-50 p-2 text-slate-500">
                    <FileText aria-hidden="true" size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">
                      {document.title}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {document.fileName} / {formatBytes(document.sizeBytes)} /{" "}
                      {formatDate(document.createdAt)}
                    </div>
                  </div>
                </div>
                <a
                  className="icon-button"
                  href={`/symbols/documents/${document.id}/download`}
                  download={document.fileName}
                >
                  <Download aria-hidden="true" size={14} />
                  Download
                </a>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-5 text-sm text-slate-600">No documents uploaded.</div>
        )}
      </section>
    </div>
  );
}
