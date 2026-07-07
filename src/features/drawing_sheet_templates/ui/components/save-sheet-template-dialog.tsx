"use client";

import { useState } from "react";
import { Save, X } from "lucide-react";

export type SaveSheetTemplateForm = {
  name: string;
  description?: string;
  category?: string;
  keywords: string[];
};

function splitKeywords(value: string): string[] {
  return value
    .split(",")
    .map((keyword) => keyword.trim())
    .filter(Boolean);
}

export function SaveSheetTemplateDialog({
  defaultName,
  isPending,
  onCancel,
  onSave
}: {
  defaultName: string;
  isPending: boolean;
  onCancel: () => void;
  onSave: (form: SaveSheetTemplateForm) => void;
}) {
  const titleId = "save-sheet-template-dialog-title";
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("wiring");
  const [keywords, setKeywords] = useState("");

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
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-lg overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
        onSubmit={(event) => {
          event.preventDefault();
          onSave({
            name,
            description: description.trim() || undefined,
            category: category.trim() || undefined,
            keywords: splitKeywords(keywords)
          });
        }}
      >
        <div className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-700">
            <Save aria-hidden="true" size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-sm font-semibold text-slate-950">
              Save Sheet as Template
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              Store this sheet as a reusable drawing pattern.
            </p>
          </div>
          <button
            type="button"
            className="icon-button h-8 w-8 p-0"
            onClick={onCancel}
            aria-label="Close save template dialog"
          >
            <X aria-hidden="true" size={14} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <label className="field-label" htmlFor="sheet-template-name">
              Template name
            </label>
            <input
              id="sheet-template-name"
              className="field-input"
              value={name}
              maxLength={160}
              required
              onChange={(event) => setName(event.currentTarget.value)}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="sheet-template-description">
              Description
            </label>
            <textarea
              id="sheet-template-description"
              className="field-input min-h-20 resize-y"
              value={description}
              maxLength={500}
              onChange={(event) => setDescription(event.currentTarget.value)}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="sheet-template-category">
                Category
              </label>
              <input
                id="sheet-template-category"
                className="field-input"
                value={category}
                maxLength={80}
                onChange={(event) => setCategory(event.currentTarget.value)}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="sheet-template-keywords">
                Keywords
              </label>
              <input
                id="sheet-template-keywords"
                className="field-input"
                value={keywords}
                placeholder="tank, wiring, monitor"
                onChange={(event) => setKeywords(event.currentTarget.value)}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button type="button" className="icon-button" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="submit"
            className="icon-button icon-button-primary"
            disabled={isPending || !name.trim()}
          >
            <Save aria-hidden="true" size={14} />
            Save template
          </button>
        </div>
      </form>
    </div>
  );
}
