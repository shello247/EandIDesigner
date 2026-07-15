"use client";

import { useMemo, useState } from "react";
import { Blocks, X } from "lucide-react";
import {
  buildTerminalBlockGroupDefinition,
  getTerminalBlockGroupPhysicalSize,
  MAX_TERMINAL_BLOCK_GROUP_COUNT,
  MIN_TERMINAL_BLOCK_GROUP_COUNT,
  resolveDefaultTerminalBlockModule
} from "@/features/drawing_terminal_blocks/logic/services/terminal-block-groups";
import { TERMINAL_BLOCK_TAG_PREFIX } from "@/features/drawing_terminal_blocks/logic/services/terminal-block-layout";
import type {
  DrawingModel,
  DrawingSheetCanvasModel
} from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import { allocateNextTagFromPrefix } from "../../logic/services/drawing-asset-identity";
import { getBackplanesForSheet } from "../../logic/services/drawing-backplane-layouts";

export type TerminalBlockGroupDialogSubmission = {
  backplaneId: string;
  name: string;
  description?: string;
  count: number;
};

function formatMillimetres(value: number): string {
  return Number(value.toFixed(2)).toString();
}

export function TerminalBlockGroupDialog({
  model,
  activeSheetModel,
  symbols,
  preferredBackplaneId,
  onCancel,
  onPlace
}: {
  model: DrawingModel;
  activeSheetModel: DrawingSheetCanvasModel;
  symbols: ApprovedDrawingSymbol[];
  preferredBackplaneId?: string;
  onCancel: () => void;
  onPlace: (submission: TerminalBlockGroupDialogSubmission) => void;
}) {
  const titleId = "terminal-block-group-dialog-title";
  const descriptionId = "terminal-block-group-dialog-description";
  const backplanes = useMemo(
    () =>
      getBackplanesForSheet(activeSheetModel).filter(
        (backplane) => Boolean(backplane.containerAssetId)
      ),
    [activeSheetModel]
  );
  const moduleResolution = useMemo(
    () => resolveDefaultTerminalBlockModule(symbols),
    [symbols]
  );
  const proposedTag = useMemo(
    () =>
      allocateNextTagFromPrefix({
        model,
        prefix: TERMINAL_BLOCK_TAG_PREFIX
      }),
    [model]
  );
  const [backplaneId, setBackplaneId] = useState(
    () =>
      backplanes.find((backplane) => backplane.id === preferredBackplaneId)?.id ??
      backplanes[0]?.id ??
      ""
  );
  const [name, setName] = useState("Modular Terminal Strip");
  const [description, setDescription] = useState("");
  const [count, setCount] = useState(5);
  const [error, setError] = useState<string | null>(null);
  const countIsValid =
    Number.isInteger(count) &&
    count >= MIN_TERMINAL_BLOCK_GROUP_COUNT &&
    count <= MAX_TERMINAL_BLOCK_GROUP_COUNT;
  const definition = moduleResolution.ok && countIsValid
    ? buildTerminalBlockGroupDefinition({ count, module: moduleResolution.module })
    : undefined;
  const size = definition
    ? getTerminalBlockGroupPhysicalSize(definition)
    : undefined;
  const blockingReason =
    backplanes.length === 0
      ? "Add a panel-associated backplane before creating a terminal block group."
      : !moduleResolution.ok
        ? moduleResolution.error
        : undefined;

  const place = () => {
    const normalizedName = name.trim();

    if (blockingReason) {
      setError(blockingReason);
      return;
    }

    if (!backplaneId) {
      setError("Choose a backplane for this terminal block group.");
      return;
    }

    if (!normalizedName) {
      setError("Enter a group name.");
      return;
    }

    if (
      !countIsValid
    ) {
      setError(
        `Terminal count must be between ${MIN_TERMINAL_BLOCK_GROUP_COUNT} and ${MAX_TERMINAL_BLOCK_GROUP_COUNT}.`
      );
      return;
    }

    onPlace({
      backplaneId,
      name: normalizedName,
      description: description.trim() || undefined,
      count
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/20 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
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
            <Blocks aria-hidden="true" size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-sm font-semibold text-slate-950">
              Add Terminal Block Group
            </h2>
            <p id={descriptionId} className="mt-1 text-xs leading-5 text-slate-600">
              Create one physical terminal strip from repeated standard DIN-rail
              terminal modules.
            </p>
          </div>
          <button
            type="button"
            className="icon-button h-8 w-8 p-0"
            onClick={onCancel}
            aria-label="Close terminal block group dialog"
          >
            <X aria-hidden="true" size={14} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {backplanes.length > 1 ? (
            <div>
              <label className="field-label" htmlFor="terminal-group-backplane">
                Backplane
              </label>
              <select
                id="terminal-group-backplane"
                className="field-input"
                value={backplaneId}
                onChange={(event) => {
                  setBackplaneId(event.currentTarget.value);
                  setError(null);
                }}
              >
                {backplanes.map((backplane, index) => (
                  <option key={backplane.id} value={backplane.id}>
                    {backplane.tag || `Backplane ${index + 1}`}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label" htmlFor="terminal-group-tag">
                Group tag
              </label>
              <input
                id="terminal-group-tag"
                className="field-input bg-slate-50 font-semibold"
                value={proposedTag}
                readOnly
              />
            </div>
            <div>
              <label className="field-label" htmlFor="terminal-group-count">
                Terminal count
              </label>
              <input
                id="terminal-group-count"
                className="field-input"
                type="number"
                min={MIN_TERMINAL_BLOCK_GROUP_COUNT}
                max={MAX_TERMINAL_BLOCK_GROUP_COUNT}
                value={count}
                onChange={(event) => {
                  const value = Number(event.currentTarget.value);
                  setCount(Number.isFinite(value) ? value : 5);
                  setError(null);
                }}
              />
            </div>
          </div>

          <div>
            <label className="field-label" htmlFor="terminal-group-name">
              Group name
            </label>
            <input
              id="terminal-group-name"
              className="field-input"
              value={name}
              maxLength={160}
              onChange={(event) => {
                setName(event.currentTarget.value);
                setError(null);
              }}
            />
          </div>

          <div>
            <label className="field-label" htmlFor="terminal-group-description">
              Description
            </label>
            <textarea
              id="terminal-group-description"
              className="field-input min-h-20 resize-y"
              value={description}
              maxLength={400}
              placeholder="Optional engineering description"
              onChange={(event) => {
                setDescription(event.currentTarget.value);
                setError(null);
              }}
            />
          </div>

          <div className="grid grid-cols-2 border-y border-slate-200 bg-slate-50 py-3 text-xs">
            <div className="border-r border-slate-200 px-3">
              <div className="font-bold uppercase text-slate-500">Terminal range</div>
              <div className="mt-1 font-semibold text-slate-900">
                1 - {Math.max(1, count)}
              </div>
            </div>
            <div className="px-3">
              <div className="font-bold uppercase text-slate-500">Physical size</div>
              <div className="mt-1 font-semibold text-slate-900">
                {size
                  ? `${formatMillimetres(size.lengthMm)} x ${formatMillimetres(size.widthMm)} mm`
                  : "Unavailable"}
              </div>
            </div>
          </div>

          {blockingReason || error ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
              {error ?? blockingReason}
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button type="button" className="icon-button" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="icon-button icon-button-primary"
            disabled={Boolean(blockingReason)}
            onClick={place}
          >
            <Blocks aria-hidden="true" size={14} />
            Create group
          </button>
        </div>
      </div>
    </div>
  );
}
