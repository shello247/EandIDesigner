"use client";

import { useEffect, useRef, useState } from "react";
import { CircuitBoard, FileText, Plus } from "lucide-react";
import type { CompatiblePanelOption } from "@/features/drawing_panel_wiring/api/public";
import { EngineeringDialog } from "@/shared/ui/engineering-dialog";
import type { DrawingSection } from "../../logic/services/drawing-sections";
import type { WorkingSheetDestination } from "../../logic/services/drawing-sheet-destination";

export type AddSheetDialogSubmission =
  | {
      kind: "drawing";
      name: string;
      destination: WorkingSheetDestination;
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
      destination: WorkingSheetDestination;
      panelAssetId: string;
      name?: string;
      description?: string;
    }
  | {
      kind: "detailed_panel";
      mode: "create";
      destination: WorkingSheetDestination;
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
  intent = "sheet",
  sections,
  activeSectionId,
  onCancel,
  onAdd
}: {
  nextSheetNumber: number;
  nextSectionNumber: number;
  panelOptions: CompatiblePanelOption[];
  suggestedPanelTag: string;
  suggestedJunctionBoxTag: string;
  allowDetailedPanel?: boolean;
  intent?: "sheet" | "section";
  sections: Pick<DrawingSection, "id" | "number" | "title">[];
  activeSectionId?: string;
  onCancel: () => void;
  onAdd: (submission: AddSheetDialogSubmission) => string | undefined;
}) {
  const [mode, setMode] = useState<SheetMode>(intent === "section" ? "section_title" : "drawing");
  const [destinationId, setDestinationId] = useState(activeSectionId ?? (sections.length === 0 ? "new" : ""));
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [error, setError] = useState<string>();
  const [drawingName, setDrawingName] = useState(`Sheet ${nextSheetNumber}`);
  const [sectionName, setSectionName] = useState("");
  const [sectionTitle, setSectionTitle] = useState("");
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
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const form = formRef.current;
      // Never steal focus from an engineer who has already started entering
      // values while the native dialog's opening frame was being scheduled.
      if (!form || form.contains(document.activeElement)) return;
      form.querySelector<HTMLElement>("input, select")?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  const defaultDestinationId = activeSectionId ?? (sections.length === 0 ? "new" : "");
  const effectiveDrawingName = drawingName === `Sheet ${nextSheetNumber}`
    ? `Sheet ${nextSheetNumber + (destinationId === "new" ? 1 : 0)}` : drawingName;
  const dirty = drawingName !== `Sheet ${nextSheetNumber}` || Boolean(sectionName || sectionTitle ||
    sectionSubtitle || newSectionTitle || panelSheetName || panelDescription) || panelMode === "create" ||
    destinationId !== defaultDestinationId || panelAssetId !== (panelOptions[0]?.assetId ?? "") ||
    mode !== (intent === "section" ? "section_title" : "drawing");
  const cancel = () => {
    if (!dirty || window.confirm("Discard unsaved changes to this entry?")) onCancel();
  };
  const add = (submission: AddSheetDialogSubmission) => setError(onAdd(submission));

  const submit = () => {
    const destination: WorkingSheetDestination = destinationId === "new"
      ? { kind: "new", title: newSectionTitle }
      : { kind: "existing", sectionId: destinationId };
    if (mode === "drawing") {
      add({
        kind: "drawing",
        name: effectiveDrawingName,
        destination
      });
      return;
    }

    if (mode === "section_title") {
      add({
        kind: "section_title",
        name: sectionName,
        title: sectionTitle,
        subtitle: sectionSubtitle
      });
      return;
    }

    if (panelMode === "reference") {
      add({
        kind: "detailed_panel",
        mode: "reference",
        destination,
        panelAssetId,
        name: panelSheetName.trim() || undefined,
        description: panelDescription.trim() || undefined
      });
      return;
    }

    add({
      kind: "detailed_panel",
      mode: "create",
      destination,
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
    (mode === "section_title" ? Boolean(sectionTitle.trim()) :
      destinationId === "new" ? Boolean(newSectionTitle.trim()) : sections.some(section => section.id === destinationId)) &&
    (mode !== "detailed_panel" || (panelMode === "reference"
      ? Boolean(selectedPanel)
      : Boolean(panelTag.trim() && panelTitle.trim())));

  return (
    <EngineeringDialog title={intent === "section" ? "Add Section" : "Add Sheet"}
      subtitle={intent === "section" ? `Section ${nextSectionNumber} · Includes its own title page` : "Choose a section for the new working sheet."}
      compact contentSized dirty={dirty} onClose={onCancel}>
      <form ref={formRef} className="flex min-h-0 flex-1 flex-col" onSubmit={event => { event.preventDefault(); if (canSubmit) submit(); }}>
        <div className="min-h-0 space-y-4 overflow-y-auto px-5 py-4">
          {intent === "sheet" ? <>
          <div
            className={`grid gap-2 ${allowDetailedPanel ? "grid-cols-2" : "grid-cols-1"}`}
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
          <div>
            <label className="field-label" htmlFor="add-sheet-section">Section</label>
            <select id="add-sheet-section" className="field-input" value={destinationId}
              onChange={event => { setDestinationId(event.currentTarget.value); setError(undefined); }}>
              <option value="" disabled>Choose a section</option>
              {sections.map(section => <option key={section.id} value={section.id}>Section {section.number} — {section.title}</option>)}
              <option value="new">Create a new section</option>
            </select>
            {destinationId === "new" ? <div className="mt-3">
              <label className="field-label" htmlFor="add-sheet-new-section">New section title</label>
              <input id="add-sheet-new-section" className="field-input" maxLength={160} required
                placeholder="For example, Panel Layout" value={newSectionTitle} onChange={event => setNewSectionTitle(event.currentTarget.value)} />
              <p className="mt-2 text-xs text-slate-500">A section title page and this sheet will be added together. Existing sheets stay in place.</p>
            </div> : null}
          </div>
          </> : null}

          {mode === "drawing" ? (
            <div>
              <label className="field-label" htmlFor="add-drawing-sheet-name">
                Sheet name
              </label>
              <input
                id="add-drawing-sheet-name"
                className="field-input"
                maxLength={120}
                value={effectiveDrawingName}
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
                  maxLength={120}
                  placeholder="Generated from the section title"
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
                  maxLength={160}
                  required
                  placeholder="For example, Panel Layout"
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
                  maxLength={400}
                  value={sectionSubtitle}
                  onChange={(event) =>
                    setSectionSubtitle(event.currentTarget.value)
                  }
                />
              </div>
              <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-800">
                The section number is assigned automatically. The new section is added after existing sheets.
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
          {error ? <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</p> : null}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button type="button" className="icon-button" onClick={cancel}>
            Cancel
          </button>
          <button
            type="submit"
            className="icon-button icon-button-primary"
            disabled={!canSubmit}
          >
            <Plus aria-hidden="true" size={14} />
            {intent === "section" ? "Add section" : "Add sheet"}
          </button>
        </div>
      </form>
    </EngineeringDialog>
  );
}
