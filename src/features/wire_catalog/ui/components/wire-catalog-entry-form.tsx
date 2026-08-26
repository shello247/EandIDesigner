"use client";

import type { WireCatalogEntry } from "../../data/schema";

export type WireCatalogEntryDraft = {
  entryId?: string;
  name: string;
  wireType: string;
  size: string;
  color: string;
  notes: string;
  makeDefault: boolean;
};

export const emptyWireCatalogEntryDraft: WireCatalogEntryDraft = {
  name: "",
  wireType: "",
  size: "",
  color: "",
  notes: "",
  makeDefault: false
};

export function draftFromWireCatalogEntry(
  entry: WireCatalogEntry
): WireCatalogEntryDraft {
  return {
    entryId: entry.id,
    name: entry.name,
    wireType: entry.wireType,
    size: entry.size,
    color: entry.color,
    notes: entry.notes ?? "",
    makeDefault: entry.isDefault
  };
}

export function WireCatalogEntryForm({
  draft,
  pending,
  onChange,
  onSave,
  onReset
}: {
  draft: WireCatalogEntryDraft;
  pending: boolean;
  onChange: (draft: WireCatalogEntryDraft) => void;
  onSave: () => void;
  onReset: () => void;
}) {
  const valid =
    draft.name.trim() &&
    draft.wireType.trim() &&
    draft.size.trim() &&
    draft.color.trim();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">
          {draft.entryId ? "Edit specification" : "New specification"}
        </h3>
        {draft.entryId ? (
          <button
            type="button"
            className="text-xs font-semibold text-teal-700"
            disabled={pending}
            onClick={onReset}
          >
            Add new
          </button>
        ) : null}
      </div>
      {[
        ["name", "Name", 120],
        ["wireType", "Wire type", 120],
        ["size", "Size", 80],
        ["color", "Color", 80]
      ].map(([key, label, length]) => (
        <label key={key} className="grid gap-1">
          <span className="field-label">{label}</span>
          <input
            className="field-input"
            value={draft[key as keyof Pick<WireCatalogEntryDraft, "name" | "wireType" | "size" | "color">]}
            maxLength={Number(length)}
            disabled={pending}
            onChange={(event) => {
              const value = event.currentTarget.value;
              onChange({ ...draft, [key]: value });
            }}
          />
        </label>
      ))}
      <label className="grid gap-1">
        <span className="field-label">Catalog notes</span>
        <textarea
          className="field-input min-h-20 resize-y"
          value={draft.notes}
          maxLength={240}
          disabled={pending}
          onChange={(event) => {
            const value = event.currentTarget.value;
            onChange({ ...draft, notes: value });
          }}
        />
      </label>
      <label className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-xs">
        <input
          type="checkbox"
          checked={draft.makeDefault}
          disabled={pending}
          onChange={(event) =>
            onChange({ ...draft, makeDefault: event.currentTarget.checked })
          }
        />
        Use as the default for new internal wires
      </label>
      <button
        type="button"
        className="icon-button icon-button-primary w-full justify-center"
        disabled={pending || !valid}
        onClick={onSave}
      >
        {pending
          ? "Saving..."
          : draft.entryId
            ? "Save specification"
            : "Create specification"}
      </button>
    </div>
  );
}
