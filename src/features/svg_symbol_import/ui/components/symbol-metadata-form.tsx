"use client";

import type { SymbolCategory } from "@/features/symbol_registry/data/schema";

export type SymbolMetadataFormState = {
  symbolKey: string;
  displayName: string;
  manufacturer: string;
  model: string;
  category: SymbolCategory;
};

const categoryOptions: Array<{ value: SymbolCategory; label: string }> = [
  { value: "instrument", label: "Instrument" },
  { value: "monitor", label: "Monitor" },
  { value: "terminal_block", label: "Terminal block" },
  { value: "cable_assembly", label: "Cable assembly" },
  { value: "gland", label: "Gland" },
  { value: "other", label: "Other" }
];

export function SymbolMetadataForm({
  form,
  disabled,
  onChange
}: {
  form: SymbolMetadataFormState;
  disabled: boolean;
  onChange: (updates: Partial<SymbolMetadataFormState>) => void;
}) {
  return (
    <section className="tool-panel overflow-hidden">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-bold">Symbol Metadata</h2>
      </div>
      <div className="grid gap-4 p-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="display-name">
            Display name
          </label>
          <input
            id="display-name"
            className="field-input"
            value={form.displayName}
            disabled={disabled}
            onChange={(event) => onChange({ displayName: event.currentTarget.value })}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="symbol-key">
            Symbol key
          </label>
          <input
            id="symbol-key"
            className="field-input"
            value={form.symbolKey}
            disabled={disabled}
            onChange={(event) => onChange({ symbolKey: event.currentTarget.value })}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="category">
            Category
          </label>
          <select
            id="category"
            className="field-input"
            value={form.category}
            disabled={disabled}
            onChange={(event) =>
              onChange({ category: event.currentTarget.value as SymbolCategory })
            }
          >
            {categoryOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="manufacturer">
            Manufacturer
          </label>
          <input
            id="manufacturer"
            className="field-input"
            value={form.manufacturer}
            disabled={disabled}
            onChange={(event) => onChange({ manufacturer: event.currentTarget.value })}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="model">
            Model
          </label>
          <input
            id="model"
            className="field-input"
            value={form.model}
            disabled={disabled}
            onChange={(event) => onChange({ model: event.currentTarget.value })}
          />
        </div>
      </div>
    </section>
  );
}
