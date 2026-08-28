"use client";

import { useEffect, useRef, useState } from "react";
import { Settings, X } from "lucide-react";
import {
  drawingSettingsDraftSchema,
  type DrawingMeasurementUnit,
  type DrawingSettingsDraft,
  type DrawingModel
} from "../../data/schema";
import { MeasurementUnitToggle } from "./measurement-unit-toggle";

const titleBlockFields: Array<{
  key: keyof DrawingModel["titleBlock"];
  label: string;
  placeholder: string;
}> = [
  { key: "client", label: "Client", placeholder: "Client name" },
  { key: "project", label: "Project / process", placeholder: "Project name" },
  {
    key: "drawingNumber",
    label: "Drawing number",
    placeholder: "EI-001"
  },
  { key: "revision", label: "Revision", placeholder: "A" },
  { key: "preparedBy", label: "Prepared by", placeholder: "Designer name" },
  { key: "checkedBy", label: "Checked by", placeholder: "Engineer name" },
  { key: "date", label: "Date", placeholder: "2026-07-01" }
];

function optionalText(value: string): string | undefined {
  const normalized = value.trim();
  return normalized || undefined;
}

export function DrawingSettingsDialog({
  drawingTitle,
  titleBlock,
  measurementUnit,
  onCancel,
  onApply
}: {
  drawingTitle: string;
  titleBlock: DrawingModel["titleBlock"];
  measurementUnit: DrawingMeasurementUnit;
  onCancel: () => void;
  onApply: (settings: DrawingSettingsDraft) => void;
}) {
  const [title, setTitle] = useState(drawingTitle);
  const [titleBlockDraft, setTitleBlockDraft] = useState(titleBlock);
  const [measurementUnitDraft, setMeasurementUnitDraft] =
    useState(measurementUnit);
  const [error, setError] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const titleId = "drawing-settings-dialog-title";
  const descriptionId = "drawing-settings-dialog-description";

  useEffect(() => {
    titleInputRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  const apply = () => {
    const parsed = drawingSettingsDraftSchema.safeParse({
      title,
      measurementUnit: measurementUnitDraft,
      titleBlock: Object.fromEntries(
        titleBlockFields.map((field) => [
          field.key,
          optionalText(titleBlockDraft[field.key] ?? "")
        ])
      )
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Review the drawing settings.");
      return;
    }

    onApply(parsed.data);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/20 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
        onSubmit={(event) => {
          event.preventDefault();
          apply();
        }}
      >
        <div className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-700">
            <Settings aria-hidden="true" size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-sm font-semibold text-slate-950">
              Drawing Settings
            </h2>
            <p id={descriptionId} className="mt-1 text-xs leading-5 text-slate-600">
              Edit drawing-wide information. Apply updates the local draft; use
              the main Save button to persist it.
            </p>
          </div>
          <button
            type="button"
            className="icon-button h-8 w-8 p-0"
            aria-label="Close drawing settings"
            onClick={onCancel}
          >
            <X aria-hidden="true" size={14} />
          </button>
        </div>

        <div className="max-h-[calc(90vh-9rem)] space-y-5 overflow-y-auto px-5 py-4">
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Drawing
            </h3>
            <div className="mt-3">
              <label className="field-label" htmlFor="drawing-settings-title">
                Title
              </label>
              <input
                ref={titleInputRef}
                id="drawing-settings-title"
                className="field-input"
                value={title}
                maxLength={200}
                onChange={(event) => {
                  setTitle(event.currentTarget.value);
                  setError(null);
                }}
              />
            </div>
            <div className="mt-4">
              <span className="field-label">Measurement units</span>
              <MeasurementUnitToggle
                value={measurementUnitDraft}
                onChange={setMeasurementUnitDraft}
                ariaLabel="Drawing settings measurement units"
              />
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Dimensions are stored in millimetres and displayed in the
                selected unit.
              </p>
            </div>
          </section>

          <section className="border-t border-slate-200 pt-5">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Package title block
            </h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {titleBlockFields.map((field) => (
                <div
                  key={field.key}
                  className={field.key === "project" ? "sm:col-span-2" : ""}
                >
                  <label
                    className="field-label"
                    htmlFor={`drawing-settings-${field.key}`}
                  >
                    {field.label}
                  </label>
                  <input
                    id={`drawing-settings-${field.key}`}
                    className="field-input"
                    value={titleBlockDraft[field.key] ?? ""}
                    placeholder={field.placeholder}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setTitleBlockDraft((current) => ({
                        ...current,
                        [field.key]: value
                      }));
                      setError(null);
                    }}
                  />
                </div>
              ))}
            </div>
          </section>

          {error ? (
            <div
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-800"
            >
              {error}
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button type="button" className="icon-button" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="icon-button icon-button-primary">
            Apply
          </button>
        </div>
      </form>
    </div>
  );
}
