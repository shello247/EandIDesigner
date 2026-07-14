"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { GitBranch, Link2, Minus, Plus, X } from "lucide-react";
import type { DrawingPlacement } from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import {
  buildCompatibleAssetRelinkOptions,
  uniquePlacementTargets,
  type DrawingAssetPlacementTarget
} from "../../logic/services/drawing-asset-resolution";
import {
  stepEngineeringTag,
  type DrawingAssetCatalogItem
} from "../../logic/services/drawing-asset-identity";
import type { DrawingModel } from "../../data/schema";

export type AssetLinkDialogMode = "create" | "reference";

function sheetReferenceSummary(asset: DrawingAssetCatalogItem): string {
  return asset.placementRefs
    .map((reference) => `Sheet ${reference.sheetNumber}`)
    .filter((value, index, values) => values.indexOf(value) === index)
    .join(", ");
}

function targetKey(target: DrawingAssetPlacementTarget): string {
  return `${target.sheetId}:${target.placementId}`;
}

export function AssetLinkDialog({
  placement,
  activeSheetId,
  packageModel,
  symbols,
  initialMode,
  allowCreate = true,
  panelAssetId,
  proposedTag,
  onCancel,
  onCreateNewAsset,
  onReferenceExisting
}: {
  placement: DrawingPlacement;
  activeSheetId: string;
  packageModel: DrawingModel;
  symbols: ApprovedDrawingSymbol[];
  initialMode: AssetLinkDialogMode;
  allowCreate?: boolean;
  panelAssetId?: string;
  proposedTag?: string;
  onCancel: () => void;
  onCreateNewAsset: (targets: DrawingAssetPlacementTarget[], tag: string) => void;
  onReferenceExisting: (
    targets: DrawingAssetPlacementTarget[],
    targetAssetId: string
  ) => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const rawOptions = useMemo(
    () => buildCompatibleAssetRelinkOptions(packageModel, placement, symbols),
    [packageModel, placement, symbols]
  );
  const options = useMemo(() => {
    if (!panelAssetId) {
      return rawOptions;
    }
    const representedOnActiveSheet = new Set(
      packageModel.sheets
        .find((sheet) => sheet.id === activeSheetId)
        ?.placements.flatMap((candidate) =>
          candidate.assetId ? [candidate.assetId] : []
        ) ?? []
    );
    const associatedAssetIds = new Set(
      packageModel.sheets.flatMap((sheet) =>
        sheet.placements.flatMap((candidate) =>
          candidate.containerAssetId === panelAssetId && candidate.assetId
            ? [candidate.assetId]
            : []
        )
      )
    );
    return {
      ...rawOptions,
      compatibleAssets: rawOptions.compatibleAssets.filter(
        (asset) =>
          associatedAssetIds.has(asset.assetId) &&
          !representedOnActiveSheet.has(asset.assetId)
      ),
      linkedOccurrences: rawOptions.linkedOccurrences.filter(
        (occurrence) =>
          occurrence.sheetId === activeSheetId &&
          occurrence.placementId === placement.id
      ),
      proposedTag: proposedTag ?? rawOptions.proposedTag
    };
  }, [
    activeSheetId,
    packageModel.sheets,
    panelAssetId,
    placement.id,
    proposedTag,
    rawOptions
  ]);
  const currentTarget = useMemo(() => {
    const exact = options.linkedOccurrences.find(
      (reference) =>
        reference.sheetId === activeSheetId &&
        reference.placementId === placement.id
    );

    return (
      exact ?? {
        sheetId: activeSheetId,
        sheetName: "Active sheet",
        sheetNumber: 1,
        placementId: placement.id,
        assetId: placement.assetId ?? ""
      }
    );
  }, [activeSheetId, options.linkedOccurrences, placement.assetId, placement.id]);
  const [mode, setMode] = useState<AssetLinkDialogMode>(
    allowCreate ? initialMode : "reference"
  );
  const [tag, setTag] = useState(options.proposedTag);
  const [targetAssetId, setTargetAssetId] = useState(
    options.compatibleAssets[0]?.assetId ?? ""
  );
  const [selectedTargetKeys, setSelectedTargetKeys] = useState<Set<string>>(
    () => new Set([targetKey(currentTarget)])
  );

  useEffect(() => {
    cancelButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onCancel]);

  const occurrences = options.linkedOccurrences.length
    ? options.linkedOccurrences
    : [currentTarget];
  const selectedTargets = uniquePlacementTargets(
    occurrences
      .filter((occurrence) => selectedTargetKeys.has(targetKey(occurrence)))
      .map((occurrence) => ({
        sheetId: occurrence.sheetId,
        placementId: occurrence.placementId
      }))
  );
  const decrementedTag = stepEngineeringTag(tag, -1);
  const incrementedTag = stepEngineeringTag(tag, 1);
  const canSubmit =
    selectedTargets.length > 0 &&
    (mode === "create" ? tag.trim().length > 0 : targetAssetId.length > 0);

  const toggleTarget = (target: DrawingAssetPlacementTarget) => {
    setSelectedTargetKeys((current) => {
      const next = new Set(current);
      const key = targetKey(target);

      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }

      return next;
    });
  };

  const submit = () => {
    if (!canSubmit) {
      return;
    }

    if (mode === "create") {
      onCreateNewAsset(selectedTargets, tag);
      return;
    }

    onReferenceExisting(selectedTargets, targetAssetId);
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
        className="w-full max-w-xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-700">
            <GitBranch aria-hidden="true" size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-sm font-semibold text-slate-950">
              Asset link
            </h2>
            <p id={descriptionId} className="mt-1 text-xs leading-5 text-slate-600">
              {allowCreate
                ? "Split selected occurrences into a new physical asset or reference an existing compatible asset."
                : "Reference an existing compatible asset from the panel inventory."}
            </p>
          </div>
          <button
            type="button"
            className="icon-button h-8 w-8 p-0"
            onClick={onCancel}
            aria-label="Close asset link dialog"
          >
            <X aria-hidden="true" size={14} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className={allowCreate ? "grid grid-cols-2 gap-2" : "grid gap-2"}>
            {allowCreate ? (
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
                  <GitBranch aria-hidden="true" size={14} />
                  Create new asset
                </span>
                <span className="mt-1 block text-slate-500">
                  Give the selected occurrences a new physical identity.
                </span>
              </button>
            ) : null}
            <button
              type="button"
              className={[
                "rounded-md border px-3 py-2 text-left text-xs transition",
                mode === "reference"
                  ? "border-sky-300 bg-sky-50 text-sky-900"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              ].join(" ")}
              aria-pressed={mode === "reference"}
              disabled={options.compatibleAssets.length === 0}
              onClick={() => setMode("reference")}
            >
              <span className="flex items-center gap-2 font-bold">
                <Link2 aria-hidden="true" size={14} />
                Reference existing
              </span>
              <span className="mt-1 block text-slate-500">
                Link the selected occurrences to an existing asset.
              </span>
            </button>
          </div>

          <div>
            <div className="field-label">Occurrences to update</div>
            <div className="max-h-44 space-y-2 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-2">
              {occurrences.map((occurrence) => {
                const key = targetKey(occurrence);

                return (
                  <label
                    key={key}
                    className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
                  >
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={selectedTargetKeys.has(key)}
                      onChange={() => toggleTarget(occurrence)}
                    />
                    <span className="min-w-0">
                      <span className="block font-bold text-slate-950">
                        Sheet {occurrence.sheetNumber}
                      </span>
                      <span className="mt-0.5 block truncate">
                        {occurrence.sheetName}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {mode === "create" ? (
            <div>
              <label className="field-label" htmlFor="asset-link-new-tag">
                New asset tag
              </label>
              <div className="flex gap-2">
                <input
                  id="asset-link-new-tag"
                  className="field-input"
                  value={tag}
                  onChange={(event) => setTag(event.currentTarget.value)}
                />
                <div className="flex gap-1">
                  <button
                    type="button"
                    className="icon-button h-9 w-9 p-0"
                    aria-label="Decrement new asset tag number"
                    title="Decrement new asset tag number"
                    disabled={!decrementedTag}
                    onClick={() => decrementedTag && setTag(decrementedTag)}
                  >
                    <Minus aria-hidden="true" size={14} />
                  </button>
                  <button
                    type="button"
                    className="icon-button h-9 w-9 p-0"
                    aria-label="Increment new asset tag number"
                    title="Increment new asset tag number"
                    disabled={!incrementedTag}
                    onClick={() => incrementedTag && setTag(incrementedTag)}
                  >
                    <Plus aria-hidden="true" size={14} />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div className="field-label">Compatible assets</div>
              <div className="space-y-2">
                {options.compatibleAssets.length > 0 ? (
                  options.compatibleAssets.map((asset) => (
                    <label
                      key={asset.assetId}
                      className={[
                        "flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2 text-xs transition",
                        targetAssetId === asset.assetId
                          ? "border-sky-300 bg-sky-50"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      ].join(" ")}
                    >
                      <input
                        type="radio"
                        className="mt-1"
                        name="asset-link-reference"
                        checked={targetAssetId === asset.assetId}
                        onChange={() => setTargetAssetId(asset.assetId)}
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
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button
            ref={cancelButtonRef}
            type="button"
            className="icon-button"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="icon-button icon-button-primary"
            disabled={!canSubmit}
            onClick={submit}
          >
            {mode === "create" ? (
              <GitBranch aria-hidden="true" size={14} />
            ) : (
              <Link2 aria-hidden="true" size={14} />
            )}
            Apply asset link
          </button>
        </div>
      </div>
    </div>
  );
}
