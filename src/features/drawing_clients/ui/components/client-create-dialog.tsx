"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Building2, Plus, X } from "lucide-react";
import { createDrawingClientAction } from "../../api/actions";
import type { DrawingClientSummary } from "../../types";

export function ClientCreateDialog({
  onCancel,
  onCreated
}: {
  onCancel: () => void;
  onCreated: (client: DrawingClientSummary) => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    nameInputRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/25 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isPending) onCancel();
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="client-create-dialog-title"
        aria-describedby="client-create-dialog-description"
        className="w-full max-w-md overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
        onSubmit={(event) => {
          event.preventDefault();
          setError(undefined);
          startTransition(async () => {
            const formData = new FormData();
            formData.set("name", name);
            const result = await createDrawingClientAction(formData);
            if (!result.ok) {
              setError(result.fieldErrors?.name ?? result.error);
              return;
            }
            onCreated(result.data);
          });
        }}
      >
        <div className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700">
            <Building2 aria-hidden="true" size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="client-create-dialog-title" className="text-sm font-semibold">
              Add Client
            </h2>
            <p
              id="client-create-dialog-description"
              className="mt-1 text-xs leading-5 text-slate-600"
            >
              Create a reusable Client for Project assignment.
            </p>
          </div>
          <button
            type="button"
            className="dialog-close"
            aria-label="Close Add Client"
            disabled={isPending}
            onClick={onCancel}
          >
            <X aria-hidden="true" size={18} />
          </button>
        </div>
        <div className="p-5">
          <label className="field-label" htmlFor="new-client-name">
            Client name
          </label>
          <input
            ref={nameInputRef}
            id="new-client-name"
            className="field-input"
            value={name}
            maxLength={160}
            required
            disabled={isPending}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "new-client-name-error" : undefined}
            onChange={(event) => {
              setName(event.currentTarget.value);
              setError(undefined);
            }}
          />
          {error ? (
            <p
              id="new-client-name-error"
              className="mt-2 text-xs text-red-700"
              role="alert"
            >
              {error}
            </p>
          ) : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button
            type="button"
            className="icon-button"
            disabled={isPending}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="icon-button icon-button-primary"
            disabled={isPending || !name.trim()}
          >
            <Plus aria-hidden="true" size={16} />
            {isPending ? "Adding…" : "Add Client"}
          </button>
        </div>
      </form>
    </div>
  );
}
