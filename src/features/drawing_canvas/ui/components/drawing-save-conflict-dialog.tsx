"use client";

import { Download, RefreshCw, TriangleAlert, X } from "lucide-react";

export function DrawingSaveConflictDialog({
  latestUpdatedAt,
  onDownloadLocalCopy,
  onReloadLatest,
  onCancel
}: {
  latestUpdatedAt?: string;
  onDownloadLocalCopy: () => void;
  onReloadLatest: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="dialog-backdrop" role="presentation">
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="drawing-save-conflict-title"
        className="dialog-panel w-[min(560px,calc(100vw-32px))]"
      >
        <div className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
          <TriangleAlert aria-hidden="true" size={20} className="mt-0.5 text-amber-700" />
          <div className="min-w-0 flex-1">
            <h2 id="drawing-save-conflict-title" className="text-sm font-semibold text-slate-950">
              Newer drawing revision detected
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              This browser cannot overwrite a drawing saved elsewhere. Download
              your local work before reloading the latest server revision.
            </p>
          </div>
          <button type="button" className="icon-button h-8 w-8 p-0" aria-label="Keep editing" onClick={onCancel}>
            <X aria-hidden="true" size={14} />
          </button>
        </div>
        {latestUpdatedAt ? (
          <p className="mx-5 mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Latest server save: {new Date(latestUpdatedAt).toLocaleString()}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2 px-5 py-4">
          <button type="button" className="icon-button" onClick={onCancel}>
            Keep editing
          </button>
          <button type="button" className="icon-button" onClick={onDownloadLocalCopy}>
            <Download aria-hidden="true" size={14} />
            Download local copy
          </button>
          <button type="button" className="icon-button icon-button-primary" onClick={onReloadLatest}>
            <RefreshCw aria-hidden="true" size={14} />
            Reload latest
          </button>
        </div>
      </section>
    </div>
  );
}
