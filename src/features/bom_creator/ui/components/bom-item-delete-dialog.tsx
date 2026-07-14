"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { deleteBomItemAction } from "../../api/actions";
import type { BomItemSummary } from "../../data/schema";

export function BomItemDeleteDialog({
  item,
  onClose,
  onDeleted
}: {
  item: BomItemSummary;
  onClose: () => void;
  onDeleted: (result: { id: string; mode: "deleted" | "archived" }) => void;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isUsed = item.templateLineCount > 0;

  const confirmDelete = () => {
    startTransition(async () => {
      setMessage(null);
      const result = await deleteBomItemAction(item.id);

      if (!result.ok) {
        setMessage(result.error);
        return;
      }

      onDeleted(result.data);
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4"
      role="presentation"
    >
      <div
        aria-labelledby="bom-delete-title"
        aria-modal="true"
        className="w-full max-w-lg overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div className="flex min-w-0 gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-red-50 text-red-700">
              <AlertTriangle aria-hidden="true" size={18} />
            </span>
            <div className="min-w-0">
              <h2
                id="bom-delete-title"
                className="text-base font-semibold text-slate-950"
              >
                Delete {item.displayName}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {isUsed
                  ? "This item is used by symbol mini BOMs, so it will be archived and preserved for existing references."
                  : "This item is not used by any symbol mini BOMs, so it will be permanently deleted."}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="icon-button h-8 w-8 shrink-0 p-0"
            aria-label="Close delete confirmation"
            title="Close"
            onClick={onClose}
            disabled={isPending}
          >
            <X aria-hidden="true" size={16} />
          </button>
        </div>

        <div className="px-5 py-4 text-sm text-slate-700">
          {message ? (
            <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
              {message}
            </div>
          ) : null}
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="font-semibold text-slate-950">{item.displayName}</div>
            <div className="mt-1 text-xs text-slate-500">{item.itemKey}</div>
          </div>
          <p className="mt-4">
            {isUsed
              ? `It appears in ${item.templateLineCount} mini BOM line${
                  item.templateLineCount === 1 ? "" : "s"
                }. Archiving keeps generated BOMs and symbol templates intact.`
              : "Permanent deletion removes the library record and its stored images."}
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4">
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            disabled={isPending}
          >
            Cancel
          </button>
          <button
            type="button"
            className="icon-button icon-button-danger"
            onClick={confirmDelete}
            disabled={isPending}
          >
            <Trash2 aria-hidden="true" size={14} />
            {isPending ? "Working..." : isUsed ? "Archive item" : "Delete item"}
          </button>
        </div>
      </div>
    </div>
  );
}
