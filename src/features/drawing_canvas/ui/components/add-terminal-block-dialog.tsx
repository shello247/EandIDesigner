"use client";

import { useMemo, useState } from "react";
import { Hash, Link2, Minus, PackagePlus, Plus, X } from "lucide-react";
import type {
  DrawingModel,
  DrawingSheetCanvasModel
} from "../../data/schema";
import {
  buildTerminalBlockAssetCatalog,
  TERMINAL_BLOCK_TAG_PREFIX
} from "../../logic/services/drawing-terminal-blocks";
import {
  getPanelEnclosureTitle,
  getVisibleSheetContainers
} from "../../logic/services/drawing-asset-containment";
import {
  allocateNextTagFromPrefix,
  createDrawingAssetId,
  findAssetTagConflict,
  formatAssetTagConflictMessage,
  stepEngineeringTag
} from "../../logic/services/drawing-asset-identity";
import {
  DEFAULT_TERMINAL_BLOCK_COUNT,
  DEFAULT_TERMINAL_BLOCK_START_NUMBER,
  normalizeTerminalBlockPlacement
} from "@/features/drawing_terminal_blocks/logic/services/terminal-block-layout";
import type { TerminalBlockPlacement } from "@/features/drawing_terminal_blocks/types";

export type AddTerminalBlockSubmission = {
  assetId: string;
  tag: string;
  terminalBlock: TerminalBlockPlacement;
  containerAssetId?: string;
};

type AddMode = "create" | "reference";

function sheetReferenceSummary(
  terminalBlock: ReturnType<typeof buildTerminalBlockAssetCatalog>[number]
): string {
  return [
    ...new Set(
      terminalBlock.placementRefs.map(
        (reference) => `Sheet ${reference.sheetNumber}: ${reference.sheetName}`
      )
    )
  ].join(", ");
}

export function AddTerminalBlockDialog({
  model,
  activeSheetModel,
  onCancel,
  onPlace
}: {
  model: DrawingModel;
  activeSheetModel: DrawingSheetCanvasModel;
  onCancel: () => void;
  onPlace: (submission: AddTerminalBlockSubmission) => void;
}) {
  const titleId = "add-terminal-block-dialog-title";
  const descriptionId = "add-terminal-block-dialog-description";
  const existingTerminalBlocks = useMemo(
    () => buildTerminalBlockAssetCatalog(model),
    [model]
  );
  const visibleContainers = useMemo(
    () => getVisibleSheetContainers(activeSheetModel),
    [activeSheetModel]
  );
  const [mode, setMode] = useState<AddMode>("create");
  const [tag, setTag] = useState(() =>
    allocateNextTagFromPrefix({
      model,
      prefix: TERMINAL_BLOCK_TAG_PREFIX
    })
  );
  const [count, setCount] = useState(DEFAULT_TERMINAL_BLOCK_COUNT);
  const [startNumber, setStartNumber] = useState(
    DEFAULT_TERMINAL_BLOCK_START_NUMBER
  );
  const [containerAssetId, setContainerAssetId] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState(
    existingTerminalBlocks[0]?.assetId ?? ""
  );
  const [error, setError] = useState<string | null>(null);
  const selectedTerminalBlock =
    existingTerminalBlocks.find((item) => item.assetId === selectedAssetId) ??
    existingTerminalBlocks[0];
  const displayTag =
    mode === "reference" ? selectedTerminalBlock?.tag ?? "" : tag;
  const displayConfig =
    mode === "reference" && selectedTerminalBlock
      ? selectedTerminalBlock.config
      : normalizeTerminalBlockPlacement({
          count,
          startNumber,
          orientation: "horizontal"
        });
  const decrementedTag = stepEngineeringTag(tag, -1);
  const incrementedTag = stepEngineeringTag(tag, 1);

  const placeTerminalBlock = () => {
    if (mode === "reference") {
      if (!selectedTerminalBlock) {
        setError("Choose an existing terminal block to reference.");
        return;
      }

      onPlace({
        assetId: selectedTerminalBlock.assetId,
        tag: selectedTerminalBlock.tag,
        terminalBlock: selectedTerminalBlock.config,
        containerAssetId: containerAssetId || undefined
      });
      return;
    }

    const normalizedTag = tag.trim();

    if (!normalizedTag) {
      setError("Enter a terminal block tag before placing the strip.");
      return;
    }

    const conflict = findAssetTagConflict(model, normalizedTag);

    if (conflict) {
      setError(formatAssetTagConflictMessage(normalizedTag, conflict));
      return;
    }

    onPlace({
      assetId: createDrawingAssetId(),
      tag: normalizedTag,
      terminalBlock: normalizeTerminalBlockPlacement({
        count,
        startNumber,
        orientation: "horizontal"
      }),
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
        className="w-full max-w-xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700">
            <Hash aria-hidden="true" size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-sm font-semibold text-slate-950">
              Add Terminal Block
            </h2>
            <p id={descriptionId} className="mt-1 text-xs leading-5 text-slate-600">
              Add a configurable modular terminal strip to this sheet.
            </p>
          </div>
          <button
            type="button"
            className="icon-button h-8 w-8 p-0"
            onClick={onCancel}
            aria-label="Close add terminal block dialog"
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
                mode === "create"
                  ? "border-teal-300 bg-teal-50 text-teal-900"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              ].join(" ")}
              aria-pressed={mode === "create"}
              onClick={() => setMode("create")}
            >
              <span className="flex items-center gap-2 font-bold">
                <PackagePlus aria-hidden="true" size={14} />
                Create new terminal block
              </span>
              <span className="mt-1 block text-slate-500">
                Allocate the next TB tag.
              </span>
            </button>
            <button
              type="button"
              className={[
                "rounded-md border px-3 py-2 text-left text-xs transition",
                mode === "reference"
                  ? "border-teal-300 bg-teal-50 text-teal-900"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              ].join(" ")}
              aria-pressed={mode === "reference"}
              disabled={existingTerminalBlocks.length === 0}
              onClick={() => setMode("reference")}
            >
              <span className="flex items-center gap-2 font-bold">
                <Link2 aria-hidden="true" size={14} />
                Reference existing
              </span>
              <span className="mt-1 block text-slate-500">
                Show the same physical terminal block.
              </span>
            </button>
          </div>

          <div>
            <label className="field-label" htmlFor="add-terminal-block-tag">
              Terminal block tag
            </label>
            <div className="flex gap-2">
              <input
                id="add-terminal-block-tag"
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
                    aria-label="Decrement terminal block tag number"
                    title="Decrement terminal block tag number"
                    disabled={!decrementedTag}
                    onClick={() => decrementedTag && setTag(decrementedTag)}
                  >
                    <Minus aria-hidden="true" size={14} />
                  </button>
                  <button
                    type="button"
                    className="icon-button h-9 w-9 p-0"
                    aria-label="Increment terminal block tag number"
                    title="Increment terminal block tag number"
                    disabled={!incrementedTag}
                    onClick={() => incrementedTag && setTag(incrementedTag)}
                  >
                    <Plus aria-hidden="true" size={14} />
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          {mode === "create" ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label" htmlFor="terminal-block-count">
                  Terminal count
                </label>
                <input
                  id="terminal-block-count"
                  className="field-input"
                  type="number"
                  min={1}
                  max={80}
                  value={count}
                  onChange={(event) =>
                    setCount(Number(event.currentTarget.value) || 1)
                  }
                />
              </div>
              <div>
                <label className="field-label" htmlFor="terminal-block-start">
                  Start number
                </label>
                <input
                  id="terminal-block-start"
                  className="field-input"
                  type="number"
                  min={1}
                  max={9999}
                  value={startNumber}
                  onChange={(event) =>
                    setStartNumber(Number(event.currentTarget.value) || 1)
                  }
                />
              </div>
            </div>
          ) : null}

          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Terminals:{" "}
            {displayConfig.startNumber} -{" "}
            {displayConfig.startNumber + displayConfig.count - 1} (
            {displayConfig.count} total)
          </div>

          <div>
            <label className="field-label" htmlFor="terminal-block-container">
              Contained in panel
            </label>
            <select
              id="terminal-block-container"
              className="field-input"
              value={containerAssetId}
              onChange={(event) => setContainerAssetId(event.currentTarget.value)}
            >
              <option value="">No panel</option>
              {visibleContainers.map((container) => (
                <option key={container.assetId} value={container.assetId}>
                  {container.placement.tag} / {getPanelEnclosureTitle(container.placement)}
                </option>
              ))}
            </select>
          </div>

          {mode === "reference" ? (
            <div className="space-y-2">
              {existingTerminalBlocks.length > 0 ? (
                existingTerminalBlocks.map((terminalBlock) => (
                  <label
                    key={terminalBlock.assetId}
                    className={[
                      "flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2 text-xs transition",
                      selectedTerminalBlock?.assetId === terminalBlock.assetId
                        ? "border-teal-300 bg-teal-50"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    ].join(" ")}
                  >
                    <input
                      type="radio"
                      className="mt-1"
                      name="terminal-block-reference"
                      checked={
                        selectedTerminalBlock?.assetId === terminalBlock.assetId
                      }
                      onChange={() => setSelectedAssetId(terminalBlock.assetId)}
                    />
                    <span className="min-w-0">
                      <span className="block font-bold text-slate-950">
                        {terminalBlock.tag}
                      </span>
                      <span className="mt-0.5 block text-slate-500">
                        {terminalBlock.terminalLabels.length} terminals /{" "}
                        {sheetReferenceSummary(terminalBlock)}
                      </span>
                    </span>
                  </label>
                ))
              ) : (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                  No generated terminal blocks exist yet in this drawing.
                </div>
              )}
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
            onClick={placeTerminalBlock}
          >
            <PackagePlus aria-hidden="true" size={14} />
            Place terminal block
          </button>
        </div>
      </div>
    </div>
  );
}
