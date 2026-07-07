"use client";

import { useMemo, useState } from "react";
import { Link2, Minus, PackagePlus, Plus, X } from "lucide-react";
import type { DrawingModel, DrawingSheetCanvasModel } from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import {
  allocateNextPackageTag,
  canReferenceExistingAsset,
  createDrawingAssetId,
  findAssetTagConflict,
  formatAssetTagConflictMessage,
  getCompatibleReferenceAssets,
  stepEngineeringTag
} from "../../logic/services/drawing-asset-identity";
import {
  getPanelEnclosureTitle,
  getVisibleSheetContainers
} from "../../logic/services/drawing-asset-containment";

export type AddSymbolAssetSubmission = {
  symbol: ApprovedDrawingSymbol;
  assetId: string;
  tag: string;
  containerAssetId?: string;
};

type AddMode = "create" | "reference";

function sheetReferenceSummary(
  asset: ReturnType<typeof getCompatibleReferenceAssets>[number]
): string {
  return [
    ...new Set(
      asset.placementRefs.map(
        (reference) => `Sheet ${reference.sheetNumber}: ${reference.sheetName}`
      )
    )
  ].join(", ");
}

export function AddSymbolAssetDialog({
  symbol,
  model,
  activeSheetModel,
  symbols,
  onCancel,
  onPlace
}: {
  symbol: ApprovedDrawingSymbol;
  model: DrawingModel;
  activeSheetModel: DrawingSheetCanvasModel;
  symbols: ApprovedDrawingSymbol[];
  onCancel: () => void;
  onPlace: (submission: AddSymbolAssetSubmission) => void;
}) {
  const titleId = "add-symbol-asset-dialog-title";
  const descriptionId = "add-symbol-asset-dialog-description";
  const existingAssets = useMemo(
    () => getCompatibleReferenceAssets(model, symbols, symbol),
    [model, symbol, symbols]
  );
  const visibleContainers = useMemo(
    () => getVisibleSheetContainers(activeSheetModel),
    [activeSheetModel]
  );
  const canReference =
    canReferenceExistingAsset(symbol) || existingAssets.length > 0;
  const canAssignContainer = symbol.category !== "cable_assembly";
  const [mode, setMode] = useState<AddMode>("create");
  const [tag, setTag] = useState(() => allocateNextPackageTag(model, symbol));
  const [selectedAssetId, setSelectedAssetId] = useState(
    existingAssets[0]?.assetId ?? ""
  );
  const [containerAssetId, setContainerAssetId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const selectedAsset =
    existingAssets.find((asset) => asset.assetId === selectedAssetId) ??
    existingAssets[0];
  const displayTag = mode === "reference" ? selectedAsset?.tag ?? "" : tag;
  const decrementedTag = stepEngineeringTag(tag, -1);
  const incrementedTag = stepEngineeringTag(tag, 1);

  const placeSymbol = () => {
    if (mode === "reference") {
      if (!selectedAsset) {
        setError("Choose an existing asset to reference.");
        return;
      }

      onPlace({
        symbol,
        assetId: selectedAsset.assetId,
        tag: selectedAsset.tag,
        containerAssetId: containerAssetId || undefined
      });
      return;
    }

    const normalizedTag = tag.trim();

    if (!normalizedTag) {
      setError("Enter an asset tag before placing the symbol.");
      return;
    }

    const conflict = findAssetTagConflict(model, normalizedTag);

    if (conflict) {
      setError(formatAssetTagConflictMessage(normalizedTag, conflict));
      return;
    }

    onPlace({
      symbol,
      assetId: createDrawingAssetId(),
      tag: normalizedTag,
      containerAssetId: containerAssetId || undefined
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
            <PackagePlus aria-hidden="true" size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-sm font-semibold text-slate-950">
              Add Symbol
            </h2>
            <p id={descriptionId} className="mt-1 text-xs leading-5 text-slate-600">
              {symbol.displayName}
            </p>
          </div>
          <button
            type="button"
            className="icon-button h-8 w-8 p-0"
            onClick={onCancel}
            aria-label="Close add symbol dialog"
          >
            <X aria-hidden="true" size={14} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {canReference ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className={[
                  "rounded-md border px-3 py-2 text-left text-xs transition",
                  mode === "create"
                    ? "border-sky-300 bg-sky-50 text-sky-900"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                ].join(" ")}
                aria-pressed={mode === "create"}
                onClick={() => setMode("create")}
              >
                <span className="flex items-center gap-2 font-bold">
                  <PackagePlus aria-hidden="true" size={14} />
                  Create new asset
                </span>
                <span className="mt-1 block text-slate-500">
                  Allocate the next package tag.
                </span>
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
                disabled={existingAssets.length === 0}
                onClick={() => setMode("reference")}
              >
                <span className="flex items-center gap-2 font-bold">
                  <Link2 aria-hidden="true" size={14} />
                  Reference existing
                </span>
                <span className="mt-1 block text-slate-500">
                  Use the same physical asset.
                </span>
              </button>
            </div>
          ) : (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Cable assemblies are created as new package assets by default.
              Unplaced cable assets from Asset Manager can be referenced before
              placement.
            </div>
          )}

          <div>
            <label className="field-label" htmlFor="add-symbol-asset-tag">
              Asset tag
            </label>
            <div className="flex gap-2">
              <input
                id="add-symbol-asset-tag"
                className="field-input"
                value={displayTag}
                readOnly={mode === "reference"}
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
                    aria-label="Decrement tag number"
                    title="Decrement tag number"
                    disabled={!decrementedTag}
                    onClick={() => decrementedTag && setTag(decrementedTag)}
                  >
                    <Minus aria-hidden="true" size={14} />
                  </button>
                  <button
                    type="button"
                    className="icon-button h-9 w-9 p-0"
                    aria-label="Increment tag number"
                    title="Increment tag number"
                    disabled={!incrementedTag}
                    onClick={() => incrementedTag && setTag(incrementedTag)}
                  >
                    <Plus aria-hidden="true" size={14} />
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          {mode === "reference" ? (
            <div className="space-y-2">
              {existingAssets.length > 0 ? (
                existingAssets.map((asset) => (
                  <label
                    key={asset.assetId}
                    className={[
                      "flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2 text-xs transition",
                      selectedAsset?.assetId === asset.assetId
                        ? "border-sky-300 bg-sky-50"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    ].join(" ")}
                  >
                    <input
                      type="radio"
                      className="mt-1"
                      name="asset-reference"
                      checked={selectedAsset?.assetId === asset.assetId}
                      onChange={() => setSelectedAssetId(asset.assetId)}
                    />
                    <span className="min-w-0">
                      <span className="block font-bold text-slate-950">
                        {asset.tag}
                      </span>
                      <span className="mt-0.5 block text-slate-500">
                        {sheetReferenceSummary(asset)}
                      </span>
                    </span>
                  </label>
                ))
              ) : (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                  No compatible assets exist yet for this symbol.
                </div>
              )}
            </div>
          ) : null}

          {canAssignContainer ? (
            <div>
              <label className="field-label" htmlFor="add-symbol-container">
                Contained in panel
              </label>
              <select
                id="add-symbol-container"
                className="field-input"
                value={containerAssetId}
                onChange={(event) =>
                  setContainerAssetId(event.currentTarget.value)
                }
              >
                <option value="">No panel</option>
                {visibleContainers.map((container) => (
                  <option key={container.assetId} value={container.assetId}>
                    {container.placement.tag} / {getPanelEnclosureTitle(container.placement)}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {error}
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button type="button" className="icon-button" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="icon-button icon-button-primary"
            onClick={placeSymbol}
          >
            <PackagePlus aria-hidden="true" size={14} />
            Place symbol
          </button>
        </div>
      </div>
    </div>
  );
}
