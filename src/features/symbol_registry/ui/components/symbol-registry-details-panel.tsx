"use client";

import type { SymbolMetadata } from "../../data/schema";
import type { SymbolCategoryRecord } from "@/features/symbol_categories/api/public";
import {
  SymbolCategoryManager,
  type SymbolCategoryManagerUpdate
} from "@/features/symbol_categories/ui/components/symbol-category-manager";

export function SymbolRegistryDetailsPanel({
  metadata,
  categories,
  categoryId,
  readOnly,
  onChange,
  onCategoryChange,
  onCategoriesUpdated
}: {
  metadata: SymbolMetadata;
  categories: SymbolCategoryRecord[];
  categoryId: string;
  readOnly: boolean;
  onChange: (updater: (current: SymbolMetadata) => SymbolMetadata) => void;
  onCategoryChange: (categoryId: string) => void;
  onCategoriesUpdated: (update: SymbolCategoryManagerUpdate) => void;
}) {
  return (
    <section className="tool-panel p-4">
      <div className="mb-4">
        <h2 className="text-sm font-semibold">Symbol Details</h2>
        <p className="mt-1 text-xs text-slate-500">
          Registry name and optional engineering description.
        </p>
      </div>
      <div className="grid gap-4">
        <label className="grid gap-1.5">
          <span className="field-label">Name</span>
          <input
            className="field-input"
            aria-label="Symbol name"
            value={metadata.displayName}
            maxLength={200}
            disabled={readOnly}
            onChange={(event) => {
              const value = event.currentTarget.value;
              onChange((current) => ({
                ...current,
                displayName: value
              }));
            }}
          />
        </label>
        <div className="grid grid-cols-4 items-center">
          <div className="col-span-1 flex min-w-0 items-center gap-1">
            <label
              className="field-label whitespace-nowrap"
              htmlFor="symbol-category"
            >
              Category
            </label>
            <SymbolCategoryManager
              initialCategories={categories}
              trigger="icon"
              onCategoriesUpdated={onCategoriesUpdated}
            />
          </div>
          <select
            id="symbol-category"
            className="field-input col-span-3"
            aria-label="Symbol category"
            value={categoryId}
            disabled={readOnly}
            onChange={(event) => onCategoryChange(event.currentTarget.value)}
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <label className="grid gap-1.5">
          <span className="field-label">Description</span>
          <textarea
            className="field-input min-h-24 resize-y"
            aria-label="Symbol description"
            value={metadata.description ?? ""}
            maxLength={400}
            disabled={readOnly}
            placeholder="Optional engineering description"
            onChange={(event) => {
              const value = event.currentTarget.value;
              onChange((current) => ({
                ...current,
                description: value
              }));
            }}
          />
          <span className="text-right text-[11px] text-slate-400">
            {(metadata.description ?? "").length}/400
          </span>
        </label>
      </div>
    </section>
  );
}
