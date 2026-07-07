"use client";

import { useEffect, useId, useRef } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";

export function DeleteSheetConfirmationDialog({
  sheetName,
  sheetNumber,
  sheetCount,
  onCancel,
  onConfirm
}: {
  sheetName: string;
  sheetNumber: number;
  sheetCount: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    cancelButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/20 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onCancel();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="w-full max-w-md overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
            <AlertTriangle aria-hidden="true" size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-sm font-semibold text-slate-950">
              Delete sheet
            </h2>
            <p id={descriptionId} className="mt-1 text-xs leading-5 text-slate-600">
              Remove{" "}
              <span className="font-semibold text-slate-900">{sheetName}</span>{" "}
              from this drawing package. This is Sheet {sheetNumber} of{" "}
              {sheetCount} and includes its placements, wiring, notes, and sheet
              metadata.
            </p>
          </div>
          <button
            type="button"
            className="icon-button h-8 w-8 p-0"
            onClick={onCancel}
            aria-label="Close delete sheet dialog"
          >
            <X aria-hidden="true" size={14} />
          </button>
        </div>

        <div className="border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs leading-5 text-slate-600">
          You can use Ctrl+Z immediately after deleting if you need to restore
          the sheet in this editing session.
        </div>

        <div className="flex justify-end gap-2 px-5 py-4">
          <button
            ref={cancelButtonRef}
            type="button"
            className="icon-button"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="icon-button icon-button-danger"
            onClick={onConfirm}
          >
            <Trash2 aria-hidden="true" size={14} />
            Delete sheet
          </button>
        </div>
      </div>
    </div>
  );
}
