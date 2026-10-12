"use client";

import { useMemo, useState } from "react";
import { Box, Link2, Minus, PackagePlus, Plus, X } from "lucide-react";
import type { DrawingModel, DrawingPackageSheet } from "../../data/schema";
import {
  buildPanelAssetCatalog,
  getPanelEnclosureKindLabel,
  normalizePanelEnclosureTitle,
  PANEL_ENCLOSURE_TAG_PREFIX
} from "../../logic/services/drawing-asset-containment";
import {
  allocateNextTagFromPrefix,
  createDrawingAssetId,
  findAssetTagConflict,
  formatAssetTagConflictMessage,
  stepEngineeringTag
} from "../../logic/services/drawing-asset-identity";
import { listPanelConnectionViewSources } from "../../logic/services/drawing-panel-connection-views";

export type AddPanelEnclosureSubmission =
  | {
      mode: "create" | "place-existing";
      assetId: string;
      tag: string;
      title: string;
    }
  | {
      mode: "reference";
      assetId: string;
      tag: string;
      title: string;
      sourceBackplanePlacementId: string;
    };

type AddMode = "create" | "place-existing" | "reference";

function sheetReferenceSummary(
  panel: ReturnType<typeof buildPanelAssetCatalog>[number]
): string {
  return [
    ...new Set(
      panel.placementRefs.map(
        (reference) => `Sheet ${reference.sheetNumber}: ${reference.sheetName}`
      )
    )
  ].join(", ");
}

export function AddPanelEnclosureDialog({
  model,
  activeSheet,
  onCancel,
  onPlace
}: {
  model: DrawingModel;
  activeSheet: DrawingPackageSheet;
  onCancel: () => void;
  onPlace: (submission: AddPanelEnclosureSubmission) => void;
}) {
  const titleId = "add-panel-enclosure-dialog-title";
  const descriptionId = "add-panel-enclosure-dialog-description";
  const existingPanels = useMemo(() => buildPanelAssetCatalog(model), [model]);
  const [mode, setMode] = useState<AddMode>(existingPanels.length ? "place-existing" : "create");
  const [tag, setTag] = useState(() =>
    allocateNextTagFromPrefix({
      model,
      prefix: PANEL_ENCLOSURE_TAG_PREFIX
    })
  );
  const [panelTitle, setPanelTitle] = useState(() =>
    normalizePanelEnclosureTitle(undefined, "power_distribution_panel")
  );
  const [selectedAssetId, setSelectedAssetId] = useState(
    existingPanels.find((panel) => !panel.placementRefs.some((ref) => ref.sheetId === activeSheet.id))?.assetId ?? existingPanels[0]?.assetId ?? ""
  );
  const [error, setError] = useState<string | null>(null);
  const selectedPanel =
    existingPanels.find((panel) => panel.assetId === selectedAssetId) ??
    existingPanels[0];
  const backplaneOptions = useMemo(
    () =>
      selectedPanel
        ? listPanelConnectionViewSources(model, selectedPanel.assetId)
        : [],
    [model, selectedPanel]
  );
  const [selectedBackplaneId, setSelectedBackplaneId] = useState("");
  const effectiveBackplaneId =
    backplaneOptions.length === 1
      ? backplaneOptions[0].placementId
      : backplaneOptions.some(
            (option) => option.placementId === selectedBackplaneId
          )
        ? selectedBackplaneId
        : "";
  const alreadyPlaced = selectedPanel?.placementRefs.some((ref) => ref.sheetId === activeSheet.id) ?? false;
  const displayTag = mode !== "create" ? selectedPanel?.tag ?? "" : tag;
  const displayTitle =
    mode !== "create" ? selectedPanel?.title ?? "" : panelTitle;
  const decrementedTag = stepEngineeringTag(tag, -1);
  const incrementedTag = stepEngineeringTag(tag, 1);

  const placePanel = () => {
    if (mode === "place-existing") {
      if (!selectedPanel || alreadyPlaced) return;
      onPlace({ mode, assetId: selectedPanel.assetId, tag: selectedPanel.tag, title: selectedPanel.title });
      return;
    }
    if (mode === "reference") {
      if (!selectedPanel) {
        setError("Choose an existing panel to reference.");
        return;
      }
      if (!effectiveBackplaneId) {
        setError(
          backplaneOptions.length === 0
            ? "This panel does not have an authoritative physical backplane."
            : "Choose the backplane this connection view represents."
        );
        return;
      }

      onPlace({
        mode: "reference",
        assetId: selectedPanel.assetId,
        tag: selectedPanel.tag,
        title: selectedPanel.title,
        sourceBackplanePlacementId: effectiveBackplaneId
      });
      return;
    }

    const normalizedTag = tag.trim();

    if (!normalizedTag) {
      setError("Enter a panel tag before placing the enclosure.");
      return;
    }

    const conflict = findAssetTagConflict(model, normalizedTag);

    if (conflict) {
      setError(formatAssetTagConflictMessage(normalizedTag, conflict));
      return;
    }

    onPlace({
      mode: "create",
      assetId: createDrawingAssetId(),
      tag: normalizedTag,
      title: normalizePanelEnclosureTitle(panelTitle, "power_distribution_panel")
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
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex shrink-0 items-start gap-3 border-b border-slate-200 px-5 py-4">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-700">
            <PackagePlus aria-hidden="true" size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-sm font-semibold text-slate-950">
              Add Panel
            </h2>
            <p id={descriptionId} className="mt-1 text-xs leading-5 text-slate-600">
              Place a physical enclosure or add a schematic reference.
            </p>
          </div>
          <button
            type="button"
            className="icon-button h-8 w-8 p-0"
            onClick={onCancel}
            aria-label="Close add panel dialog"
          >
            <X aria-hidden="true" size={14} />
          </button>
        </div>

        <div className="min-h-0 space-y-4 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              type="button"
              className={[
                "rounded-md border px-3 py-2 text-left text-xs transition",
                mode === "create"
                  ? "border-sky-300 bg-sky-50 text-sky-900"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              ].join(" ")}
              aria-pressed={mode === "create"}
              onClick={() => { setMode("create"); setError(null); }}
            >
              <span className="flex items-center gap-2 font-bold">
                <PackagePlus aria-hidden="true" size={14} />
                Create new panel
              </span>
              <span className="mt-1 block text-slate-500">
                Allocate the next PDP tag.
              </span>
            </button>
            <button
              type="button"
              className={`rounded-md border px-3 py-2 text-left text-xs transition ${mode === "place-existing" ? "border-sky-300 bg-sky-50 text-sky-900" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
              aria-pressed={mode === "place-existing"}
              disabled={existingPanels.length === 0}
              onClick={() => { setMode("place-existing"); setError(null); }}
            >
              <span className="flex items-center gap-2 font-bold"><Box aria-hidden="true" size={14} />Place existing panel</span>
              <span className="mt-1 block text-slate-500">Reuse its identity. Add a backplane after placement.</span>
            </button>
            <button
              type="button"
              className={[
                "rounded-md border px-3 py-2 text-left text-xs transition",
                mode === "reference"
                  ? "border-sky-300 bg-sky-50 text-sky-900"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              ].join(" ")}
              aria-pressed={mode === "reference"}
              disabled={existingPanels.length === 0}
              onClick={() => { setMode("reference"); setError(null); }}
            >
              <span className="flex items-center gap-2 font-bold">
                <Link2 aria-hidden="true" size={14} />
                Add schematic reference
              </span>
              <span className="mt-1 block text-slate-500">
                Add a compact schematic connection view linked to its backplane.
              </span>
            </button>
          </div>

          <div>
            <label className="field-label" htmlFor="add-panel-enclosure-tag">
              Panel tag
            </label>
            <div className="flex gap-2">
              <input
                id="add-panel-enclosure-tag"
                className="field-input"
                value={displayTag}
                readOnly={mode !== "create"}
                onChange={(event) => {
                  setTag(event.currentTarget.value);
                  setError(null);
                }}
              />
              {mode === "create" ? (
                <div className="flex gap-1">
                  <button
                    type="button"
                    className="icon-button h-9 w-9 p-0"
                    aria-label="Decrement panel tag number"
                    title="Decrement panel tag number"
                    disabled={!decrementedTag}
                    onClick={() => decrementedTag && setTag(decrementedTag)}
                  >
                    <Minus aria-hidden="true" size={14} />
                  </button>
                  <button
                    type="button"
                    className="icon-button h-9 w-9 p-0"
                    aria-label="Increment panel tag number"
                    title="Increment panel tag number"
                    disabled={!incrementedTag}
                    onClick={() => incrementedTag && setTag(incrementedTag)}
                  >
                    <Plus aria-hidden="true" size={14} />
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <div>
            <label className="field-label" htmlFor="add-panel-enclosure-title">
              Panel title
            </label>
            <input
              id="add-panel-enclosure-title"
              className="field-input"
              value={displayTitle}
              readOnly={mode !== "create"}
              placeholder="Power Distribution Panel"
              onChange={(event) => {
                setPanelTitle(event.currentTarget.value);
                setError(null);
              }}
            />
          </div>

          {mode !== "create" ? (
            <div className="space-y-2">
              {existingPanels.length > 0 ? (
                existingPanels.map((panel) => (
                  <label
                    key={panel.assetId}
                    className={[
                      "flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2 text-xs transition",
                      selectedPanel?.assetId === panel.assetId
                        ? "border-sky-300 bg-sky-50"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    ].join(" ")}
                  >
                    <input
                      type="radio"
                      className="mt-1"
                      name="panel-reference"
                      checked={selectedPanel?.assetId === panel.assetId}
                      onChange={() => { setSelectedAssetId(panel.assetId); setSelectedBackplaneId(""); setError(null); }}
                    />
                    <span className="min-w-0">
                      <span className="block font-bold text-slate-950">
                        {panel.tag}
                      </span>
                      <span className="mt-0.5 block text-slate-500">
                        {panel.title || getPanelEnclosureKindLabel(panel.kind)}
                        {panel.placementRefs.length ? ` / ${sheetReferenceSummary(panel)}` : " / Not physically placed yet"}
                      </span>
                    </span>
                  </label>
                ))
              ) : (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                  No panels exist yet in this drawing.
                </div>
              )}
              {mode === "place-existing" && alreadyPlaced ? (
                <div role="status" className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {selectedPanel?.tag} is already physically placed on this sheet. Select it to add a backplane.
                </div>
              ) : null}
              {mode === "reference" && selectedPanel && backplaneOptions.length === 1 ? (
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  <span className="font-bold text-slate-800">Linked backplane:</span>{" "}
                  {backplaneOptions[0].label}
                </div>
              ) : null}
              {mode === "reference" && selectedPanel && backplaneOptions.length > 1 ? (
                <div>
                  <label className="field-label" htmlFor="panel-reference-backplane">
                    Linked backplane
                  </label>
                  <select
                    id="panel-reference-backplane"
                    className="field-input"
                    value={effectiveBackplaneId}
                    onChange={(event) => {
                      setSelectedBackplaneId(event.currentTarget.value);
                      setError(null);
                    }}
                  >
                    <option value="">Choose a backplane</option>
                    {backplaneOptions.map((option) => (
                      <option key={option.placementId} value={option.placementId}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              {mode === "reference" && selectedPanel && backplaneOptions.length === 0 ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                  Place this panel using “Place existing panel”, then add its backplane before creating a schematic reference.
                </div>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {error}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button type="button" className="icon-button" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="icon-button icon-button-primary"
            onClick={placePanel}
            disabled={
              (mode === "reference" && (!selectedPanel || !effectiveBackplaneId)) ||
              (mode === "place-existing" && (!selectedPanel || alreadyPlaced))
            }
          >
            <PackagePlus aria-hidden="true" size={14} />
            Continue to placement
          </button>
        </div>
      </div>
    </div>
  );
}
