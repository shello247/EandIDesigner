"use client";

import { Save } from "lucide-react";

export function SvgImportActions({
  canSave,
  isPending,
  onSave
}: {
  canSave: boolean;
  isPending: boolean;
  onSave: () => void;
}) {
  return (
    <div className="tool-panel flex flex-wrap items-center justify-between gap-3 p-4">
      <div>
        <h2 className="text-sm font-bold">Import Device Symbol</h2>
        <p className="mt-1 text-xs text-slate-500">
          Imported symbols start in review before approval.
        </p>
      </div>
      <button
        type="button"
        className="icon-button icon-button-primary"
        onClick={onSave}
        disabled={!canSave || isPending}
      >
        <Save aria-hidden="true" size={14} />
        Save imported symbol
      </button>
    </div>
  );
}
