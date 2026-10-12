"use client";

import { Save } from "lucide-react";

export function SymbolSaveBar({
  readOnly,
  metadataDirty,
  metadataSaving,
  metadataMessage,
  onSaveMetadata
}: {
  readOnly: boolean;
  metadataDirty: boolean;
  metadataSaving: boolean;
  metadataMessage: string | null;
  onSaveMetadata: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      {metadataMessage ? (
        <p role="status" className="text-xs text-slate-600">{metadataMessage}</p>
      ) : null}
      {readOnly ? (
        <p className="text-xs text-slate-500">This retained symbol is read-only.</p>
      ) : (
        <button
          type="button"
          className="icon-button icon-button-primary disabled:opacity-50"
          onClick={onSaveMetadata}
          disabled={metadataSaving || !metadataDirty}
        >
          <Save aria-hidden="true" size={15} />
          {metadataSaving ? "Saving…" : "Save changes"}
        </button>
      )}
    </div>
  );
}
