"use client";

import { Settings2 } from "lucide-react";
import type {
  WireCatalogEntry,
  WireSpecificationSnapshot
} from "../../data/schema";

export function WireCatalogPicker({
  entries,
  value,
  snapshot,
  disabled,
  onChange,
  onManage
}: {
  entries: readonly WireCatalogEntry[];
  value: string;
  snapshot?: WireSpecificationSnapshot;
  disabled?: boolean;
  onChange: (entryId: string) => void;
  onManage: () => void;
}) {
  const selected = entries.find((entry) => entry.id === value);
  const displaySpecification = selected ?? snapshot;

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2">
        <label className="min-w-0 flex-1">
          <span className="field-label">Wire specification</span>
          <select
            className="field-input"
            value={value}
            disabled={disabled}
            onChange={(event) => onChange(event.currentTarget.value)}
          >
            <option value="">
              {entries.length ? "Select wire specification" : "Catalog setup required"}
            </option>
            {!selected && snapshot ? (
              <option value={snapshot.catalogEntryId}>
                {snapshot.catalogEntryName} (Saved snapshot)
              </option>
            ) : null}
            {entries.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
                {entry.isDefault ? " (Default)" : ""}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="icon-button h-9 w-9 shrink-0 p-0"
          aria-label="Manage Wire Catalog"
          title="Manage Wire Catalog"
          disabled={disabled}
          onClick={onManage}
        >
          <Settings2 aria-hidden="true" size={16} />
        </button>
      </div>
      {displaySpecification ? (
        <div className="grid grid-cols-3 gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs">
          <span><b className="block text-[10px] uppercase text-slate-500">Type</b>{displaySpecification.wireType}</span>
          <span><b className="block text-[10px] uppercase text-slate-500">Size</b>{displaySpecification.size}</span>
          <span><b className="block text-[10px] uppercase text-slate-500">Color</b>{displaySpecification.color}</span>
        </div>
      ) : null}
    </div>
  );
}
