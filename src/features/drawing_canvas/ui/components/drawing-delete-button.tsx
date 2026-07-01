"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { deleteDrawingAction } from "../../api/actions";

export function DrawingDeleteButton({
  drawingId,
  title
}: {
  drawingId: string;
  title: string;
}) {
  const router = useRouter();
  const titleId = useId();
  const descriptionId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const openDialog = () => {
    setError(null);
    setIsOpen(true);
  };

  const closeDialog = () => {
    if (isPending) {
      return;
    }

    setError(null);
    setIsOpen(false);
  };

  const deleteDrawing = () => {
    startTransition(async () => {
      const result = await deleteDrawingAction(drawingId);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setIsOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <button
        type="button"
        className="icon-button icon-button-danger min-h-7 px-2 py-1 text-[12px]"
        disabled={isPending}
        onClick={openDialog}
        aria-label={`Delete ${title}`}
      >
        <Trash2 aria-hidden="true" size={13} />
        Delete
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/20 p-4 backdrop-blur-[2px]"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeDialog();
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
                  Delete drawing
                </h2>
                <p id={descriptionId} className="mt-1 text-xs leading-5 text-slate-600">
                  This will permanently delete{" "}
                  <span className="font-semibold text-slate-900">{title}</span>.
                  This action cannot be undone.
                </p>
              </div>
              <button
                type="button"
                className="icon-button h-8 w-8 p-0"
                disabled={isPending}
                onClick={closeDialog}
                aria-label="Close delete drawing dialog"
              >
                <X aria-hidden="true" size={14} />
              </button>
            </div>

            {error ? (
              <div className="mx-5 mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                {error}
              </div>
            ) : null}

            <div className="flex justify-end gap-2 px-5 py-4">
              <button
                type="button"
                className="icon-button"
                disabled={isPending}
                onClick={closeDialog}
              >
                Cancel
              </button>
              <button
                type="button"
                className="icon-button icon-button-danger"
                disabled={isPending}
                onClick={deleteDrawing}
              >
                <Trash2 aria-hidden="true" size={14} />
                {isPending ? "Deleting..." : "Delete drawing"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
