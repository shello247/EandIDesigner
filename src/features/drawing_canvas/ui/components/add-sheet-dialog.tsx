"use client";

import { useState } from "react";
import { FileText, Layers, Plus, X } from "lucide-react";

export type AddSheetDialogSubmission =
  | {
      kind: "drawing";
      name: string;
    }
  | {
      kind: "section_title";
      name: string;
      title: string;
      subtitle: string;
      sectionNumber: string;
    };

type SheetMode = AddSheetDialogSubmission["kind"];

export function AddSheetDialog({
  nextSheetNumber,
  onCancel,
  onAdd
}: {
  nextSheetNumber: number;
  onCancel: () => void;
  onAdd: (submission: AddSheetDialogSubmission) => void;
}) {
  const [mode, setMode] = useState<SheetMode>("drawing");
  const [drawingName, setDrawingName] = useState(`Sheet ${nextSheetNumber}`);
  const [sectionName, setSectionName] = useState(
    `Section Title Page ${nextSheetNumber}`
  );
  const [sectionTitle, setSectionTitle] = useState(
    `Section ${nextSheetNumber}`
  );
  const [sectionSubtitle, setSectionSubtitle] = useState("");
  const [sectionNumber, setSectionNumber] = useState("");
  const titleId = "add-sheet-dialog-title";
  const descriptionId = "add-sheet-dialog-description";

  const submit = () => {
    if (mode === "drawing") {
      onAdd({
        kind: "drawing",
        name: drawingName
      });
      return;
    }

    onAdd({
      kind: "section_title",
      name: sectionName,
      title: sectionTitle,
      subtitle: sectionSubtitle,
      sectionNumber
    });
  };

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
        className="w-full max-w-lg overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-700">
            <Layers aria-hidden="true" size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-sm font-semibold text-slate-950">
              Add Sheet
            </h2>
            <p id={descriptionId} className="mt-1 text-xs leading-5 text-slate-600">
              Add a standard drawing sheet or a section title page.
            </p>
          </div>
          <button
            type="button"
            className="icon-button h-8 w-8 p-0"
            onClick={onCancel}
            aria-label="Close add sheet dialog"
          >
            <X aria-hidden="true" size={14} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={[
                "rounded-md border px-3 py-2 text-left text-xs transition",
                mode === "drawing"
                  ? "border-sky-300 bg-sky-50 text-sky-900"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              ].join(" ")}
              aria-pressed={mode === "drawing"}
              onClick={() => setMode("drawing")}
            >
              <span className="flex items-center gap-2 font-bold">
                <FileText aria-hidden="true" size={14} />
                Drawing Sheet
              </span>
              <span className="mt-1 block text-slate-500">
                Blank drawing canvas sheet.
              </span>
            </button>
            <button
              type="button"
              className={[
                "rounded-md border px-3 py-2 text-left text-xs transition",
                mode === "section_title"
                  ? "border-sky-300 bg-sky-50 text-sky-900"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              ].join(" ")}
              aria-pressed={mode === "section_title"}
              onClick={() => setMode("section_title")}
            >
              <span className="flex items-center gap-2 font-bold">
                <Layers aria-hidden="true" size={14} />
                Section Title Page
              </span>
              <span className="mt-1 block text-slate-500">
                Divider page for drawing sections.
              </span>
            </button>
          </div>

          {mode === "drawing" ? (
            <div>
              <label className="field-label" htmlFor="add-drawing-sheet-name">
                Sheet name
              </label>
              <input
                id="add-drawing-sheet-name"
                className="field-input"
                value={drawingName}
                onChange={(event) => setDrawingName(event.currentTarget.value)}
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="field-label" htmlFor="add-section-sheet-name">
                  Sheet name
                </label>
                <input
                  id="add-section-sheet-name"
                  className="field-input"
                  value={sectionName}
                  onChange={(event) => setSectionName(event.currentTarget.value)}
                />
              </div>
              <div>
                <label className="field-label" htmlFor="add-section-title">
                  Section title
                </label>
                <input
                  id="add-section-title"
                  className="field-input"
                  value={sectionTitle}
                  onChange={(event) => setSectionTitle(event.currentTarget.value)}
                />
              </div>
              <div>
                <label className="field-label" htmlFor="add-section-subtitle">
                  Subtitle / description
                </label>
                <textarea
                  id="add-section-subtitle"
                  className="field-input min-h-20 resize-y leading-relaxed"
                  value={sectionSubtitle}
                  onChange={(event) =>
                    setSectionSubtitle(event.currentTarget.value)
                  }
                />
              </div>
              <div>
                <label className="field-label" htmlFor="add-section-number">
                  Section number
                </label>
                <input
                  id="add-section-number"
                  className="field-input"
                  value={sectionNumber}
                  placeholder="Optional"
                  onChange={(event) => setSectionNumber(event.currentTarget.value)}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button type="button" className="icon-button" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="icon-button icon-button-primary"
            onClick={submit}
          >
            <Plus aria-hidden="true" size={14} />
            Add sheet
          </button>
        </div>
      </div>
    </div>
  );
}
