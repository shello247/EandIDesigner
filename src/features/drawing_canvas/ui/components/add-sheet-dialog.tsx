"use client";

import { useState } from "react";
import { CircuitBoard, FileText, Layers, Plus, X } from "lucide-react";
import type { CompatiblePanelOption } from "@/features/drawing_panel_wiring/api/public";

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
    }
  | {
      kind: "detailed_panel";
      mode: "reference";
      panelAssetId: string;
      name?: string;
      description?: string;
    }
  | {
      kind: "detailed_panel";
      mode: "create";
      panelType: "panel" | "junction_box";
      tag: string;
      title: string;
      name?: string;
      description?: string;
    };

type SheetMode = AddSheetDialogSubmission["kind"];

export function AddSheetDialog({
  nextSheetNumber,
  nextSectionNumber,
  panelOptions,
  suggestedPanelTag,
  suggestedJunctionBoxTag,
  allowDetailedPanel = true,
  onCancel,
  onAdd
}: {
  nextSheetNumber: number;
  nextSectionNumber: number;
  panelOptions: CompatiblePanelOption[];
  suggestedPanelTag: string;
  suggestedJunctionBoxTag: string;
  allowDetailedPanel?: boolean;
  onCancel: () => void;
  onAdd: (submission: AddSheetDialogSubmission) => void;
}) {
  const [mode, setMode] = useState<SheetMode>("drawing");
  const [drawingName, setDrawingName] = useState(`Sheet ${nextSheetNumber}`);
  const [sectionName, setSectionName] = useState(
    `Section ${nextSectionNumber} Title Page`
  );
  const [sectionTitle, setSectionTitle] = useState(
    `Section ${nextSectionNumber}`
  );
  const [sectionSubtitle, setSectionSubtitle] = useState("");
  const [panelMode, setPanelMode] = useState<"reference" | "create">(
    "reference"
  );
  const [panelAssetId, setPanelAssetId] = useState(
    panelOptions[0]?.assetId ?? ""
  );
  const [panelType, setPanelType] = useState<"panel" | "junction_box">(
    "junction_box"
  );
  const [panelTag, setPanelTag] = useState(suggestedJunctionBoxTag);
  const [panelTitle, setPanelTitle] = useState("Junction Box");
  const [panelSheetName, setPanelSheetName] = useState("");
  const [panelDescription, setPanelDescription] = useState("");
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

    if (mode === "section_title") {
      onAdd({
        kind: "section_title",
        name: sectionName,
        title: sectionTitle,
        subtitle: sectionSubtitle
      });
      return;
    }

    if (panelMode === "reference") {
      onAdd({
        kind: "detailed_panel",
        mode: "reference",
        panelAssetId,
        name: panelSheetName.trim() || undefined,
        description: panelDescription.trim() || undefined
      });
      return;
    }

    onAdd({
      kind: "detailed_panel",
      mode: "create",
      panelType,
      tag: panelTag,
      title: panelTitle,
      name: panelSheetName.trim() || undefined,
      description: panelDescription.trim() || undefined
    });
  };
  const selectedPanel = panelOptions.find(
    (option) => option.assetId === panelAssetId
  );
  const canSubmit =
    mode !== "detailed_panel" ||
    (panelMode === "reference"
      ? Boolean(selectedPanel)
      : Boolean(panelTag.trim() && panelTitle.trim()));

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
        className="w-full max-w-2xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
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
              Add a drawing, section divider, or panel-specific drawing sheet.
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
          <div
            className={`grid gap-2 ${
              allowDetailedPanel ? "grid-cols-3" : "grid-cols-2"
            }`}
          >
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
            {allowDetailedPanel ? (
              <button
                type="button"
                className={[
                  "rounded-md border px-3 py-2 text-left text-xs transition",
                  mode === "detailed_panel"
                    ? "border-sky-300 bg-sky-50 text-sky-900"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                ].join(" ")}
                aria-pressed={mode === "detailed_panel"}
                onClick={() => setMode("detailed_panel")}
              >
                <span className="flex items-center gap-2 font-bold">
                  <CircuitBoard aria-hidden="true" size={14} />
                  Detailed Panel
                </span>
                <span className="mt-1 block text-slate-500">
                  Electrical detail for one enclosure.
                </span>
              </button>
            ) : null}
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
          ) : mode === "section_title" ? (
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
              <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-800">
                The section number is assigned automatically from package order.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={[
                    "rounded-md border px-3 py-2 text-left text-xs",
                    panelMode === "reference"
                      ? "border-sky-300 bg-sky-50 text-sky-900"
                      : "border-slate-200 text-slate-600"
                  ].join(" ")}
                  aria-pressed={panelMode === "reference"}
                  onClick={() => setPanelMode("reference")}
                >
                  <span className="block font-bold">Reference existing</span>
                  <span className="mt-1 block text-slate-500">
                    Use one physical package panel.
                  </span>
                </button>
                <button
                  type="button"
                  className={[
                    "rounded-md border px-3 py-2 text-left text-xs",
                    panelMode === "create"
                      ? "border-sky-300 bg-sky-50 text-sky-900"
                      : "border-slate-200 text-slate-600"
                  ].join(" ")}
                  aria-pressed={panelMode === "create"}
                  onClick={() => setPanelMode("create")}
                >
                  <span className="block font-bold">Create new</span>
                  <span className="mt-1 block text-slate-500">
                    Add one unplaced package asset.
                  </span>
                </button>
              </div>

              {panelMode === "reference" ? (
                panelOptions.length > 0 ? (
                  <div>
                    <label className="field-label" htmlFor="detailed-panel-asset">
                      Panel / enclosure
                    </label>
                    <select
                      id="detailed-panel-asset"
                      className="field-input"
                      value={panelAssetId}
                      onChange={(event) => setPanelAssetId(event.currentTarget.value)}
                    >
                      {panelOptions.map((option) => (
                        <option key={option.assetId} value={option.assetId}>
                          {option.tag} / {option.title} / {option.type === "junction_box" ? "Junction Box" : "Panel"}
                        </option>
                      ))}
                    </select>
                    <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      {selectedPanel?.sourceSheets.length
                        ? `Referenced on ${selectedPanel.sourceSheets
                            .map((sheet) => `Sheet ${sheet.sheetNumber} - ${sheet.name}`)
                            .join(", ")}.`
                        : "This panel is not yet referenced on another sheet."}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-900">
                    No compatible panel or junction-box assets are available. Choose Create new.
                  </div>
                )
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="field-label" htmlFor="new-panel-type">Type</label>
                    <select
                      id="new-panel-type"
                      className="field-input"
                      value={panelType}
                      onChange={(event) => {
                        const type = event.currentTarget.value as "panel" | "junction_box";
                        setPanelType(type);
                        setPanelTag(type === "panel" ? suggestedPanelTag : suggestedJunctionBoxTag);
                        setPanelTitle(type === "panel" ? "Panel" : "Junction Box");
                      }}
                    >
                      <option value="junction_box">Junction Box</option>
                      <option value="panel">Panel</option>
                    </select>
                  </div>
                  <div>
                    <label className="field-label" htmlFor="new-panel-tag">Asset tag</label>
                    <input id="new-panel-tag" className="field-input" value={panelTag} onChange={(event) => setPanelTag(event.currentTarget.value)} />
                  </div>
                  <div className="col-span-2">
                    <label className="field-label" htmlFor="new-panel-title">Asset title</label>
                    <input id="new-panel-title" className="field-input" value={panelTitle} onChange={(event) => setPanelTitle(event.currentTarget.value)} />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label" htmlFor="detailed-panel-sheet-name">Sheet name</label>
                  <input id="detailed-panel-sheet-name" className="field-input" value={panelSheetName} placeholder="Generated from the panel tag" onChange={(event) => setPanelSheetName(event.currentTarget.value)} />
                </div>
                <div>
                  <label className="field-label" htmlFor="detailed-panel-description">Description</label>
                  <input id="detailed-panel-description" className="field-input" value={panelDescription} placeholder="Generated from the panel tag" onChange={(event) => setPanelDescription(event.currentTarget.value)} />
                </div>
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
            disabled={!canSubmit}
          >
            <Plus aria-hidden="true" size={14} />
            Add sheet
          </button>
        </div>
      </div>
    </div>
  );
}
