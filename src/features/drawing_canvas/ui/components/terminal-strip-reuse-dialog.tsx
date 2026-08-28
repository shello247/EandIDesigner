"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Copy, Link2, X } from "lucide-react";
import { composeTerminalStripGeometry } from "@/features/drawing_terminal_blocks/api/public";
import type { DrawingModel } from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import {
  listStructuredTerminalStripReuseDestinations,
  type StructuredTerminalStripReuseInput,
  type StructuredTerminalStripReuseMode
} from "../../logic/commands/drawing-structured-terminal-strip-reuse-commands";
import { allocateNextTagFromPrefix } from "../../logic/services/drawing-asset-identity";

type SubmissionResult =
  | { ok: true }
  | { ok: false; error: string };

export function TerminalStripReuseDialog({
  model,
  symbols,
  sourceSheetId,
  sourcePlacementId,
  onCancel,
  onSubmit
}: {
  model: DrawingModel;
  symbols: ApprovedDrawingSymbol[];
  sourceSheetId: string;
  sourcePlacementId: string;
  onCancel: () => void;
  onSubmit: (input: StructuredTerminalStripReuseInput) => SubmissionResult;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const destinations = useMemo(
    () =>
      listStructuredTerminalStripReuseDestinations({
        model,
        sourceSheetId,
        sourcePlacementId
      }),
    [model, sourcePlacementId, sourceSheetId]
  );
  const sourceSheet = model.sheets.find((sheet) => sheet.id === sourceSheetId);
  const sourcePlacement = sourceSheet?.placements.find(
    (placement) => placement.id === sourcePlacementId
  );
  const sourceAsset = model.assets.find(
    (asset) => asset.id === destinations.sourceAssetId
  );
  const geometry = useMemo(
    () =>
      sourceAsset?.terminalStrip
        ? composeTerminalStripGeometry(sourceAsset.terminalStrip, symbols)
        : undefined,
    [sourceAsset, symbols]
  );
  const suggestedSheet =
    destinations.sheets.find(
      (sheet) =>
        sheet.id !== sourceSheetId && sheet.backplanes.length > 0
    ) ??
    destinations.sheets.find((sheet) => sheet.id !== sourceSheetId) ??
    destinations.sheets[0];
  const [mode, setMode] =
    useState<StructuredTerminalStripReuseMode>("copy_as_new");
  const [targetSheetId, setTargetSheetId] = useState(
    suggestedSheet?.id ?? sourceSheetId
  );
  const [targetBackplaneId, setTargetBackplaneId] = useState<string | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const selectedSheet = destinations.sheets.find(
    (sheet) => sheet.id === targetSheetId
  );
  const availableBackplanes = useMemo(
    () =>
      selectedSheet?.backplanes.filter(
        (backplane) =>
          mode === "copy_as_new" || backplane.canPlaceRepresentation
      ) ?? [],
    [mode, selectedSheet]
  );
  const effectiveTargetBackplaneId =
    targetBackplaneId !== null &&
    (targetBackplaneId === "" ||
      availableBackplanes.some(
        (backplane) => backplane.id === targetBackplaneId
      ))
      ? targetBackplaneId
      : availableBackplanes[0]?.id ?? "";
  const selectedBackplane = selectedSheet?.backplanes.find(
    (backplane) => backplane.id === effectiveTargetBackplaneId
  );
  const canPlaceUnmounted = Boolean(
    selectedSheet &&
      (mode === "copy_as_new" || !selectedSheet.alreadyRepresented)
  );
  const canSubmit = Boolean(
    selectedSheet &&
      (effectiveTargetBackplaneId
        ? selectedBackplane &&
          (mode === "copy_as_new" ||
            selectedBackplane.canPlaceRepresentation)
        : canPlaceUnmounted)
  );
  const electricalMembers = sourceAsset?.terminalStrip?.members.filter(
    (member) => member.role === "electrical"
  ).length ?? 0;
  const terminalCount = geometry?.members.reduce(
    (count, member) =>
      count + (member.symbol?.metadata.terminals?.length ?? 0),
    0
  ) ?? 0;
  const currentMount = sourcePlacement?.layoutParentId
    ? (() => {
        const panel = sourcePlacement.containerAssetId
          ? model.assets.find(
              (asset) => asset.id === sourcePlacement.containerAssetId
            )
          : undefined;
        return panel ? `${panel.tag} Backplane` : "Mounted backplane";
      })()
    : "Not mounted in a panel";

  useEffect(() => {
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  const submit = () => {
    if (!canSubmit) return;
    const result = onSubmit({
      mode,
      sourceSheetId,
      sourcePlacementId,
      targetSheetId,
      targetBackplaneId: effectiveTargetBackplaneId || undefined
    });
    if (!result.ok) setError(result.error);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-[2px]"
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
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700">
            <Copy aria-hidden="true" size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-sm font-semibold text-slate-950">
              Reuse terminal strip
            </h2>
            <p id={descriptionId} className="mt-1 text-xs leading-5 text-slate-600">
              Copy this assembly as new equipment or place another view of the same physical strip.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="icon-button h-8 w-8 p-0"
            aria-label="Close reuse terminal strip dialog"
            onClick={onCancel}
          >
            <X aria-hidden="true" size={15} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <section className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <div className="text-sm font-bold text-slate-950">
                  {sourceAsset?.tag} — {sourceAsset?.title}
                </div>
                <div className="mt-1 text-xs text-slate-500">{currentMount}</div>
              </div>
              <div className="text-right text-xs text-slate-600">
                <div>{sourceAsset?.terminalStrip?.members.length ?? 0} members · {electricalMembers} electrical</div>
                <div>{terminalCount} terminals · {geometry ? `${geometry.widthMm} × ${geometry.heightMm} mm` : "Size unavailable"}</div>
              </div>
            </div>
          </section>

          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              className={[
                "rounded-md border px-3 py-3 text-left text-xs transition",
                mode === "copy_as_new"
                  ? "border-teal-400 bg-teal-50 text-teal-950"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              ].join(" ")}
              aria-pressed={mode === "copy_as_new"}
              onClick={() => {
                setMode("copy_as_new");
                setTargetBackplaneId(null);
                setError(null);
              }}
            >
              <span className="flex items-center gap-2 font-bold">
                <Copy aria-hidden="true" size={15} />
                Copy as new terminal strip
              </span>
              <span className="mt-1.5 block leading-5 text-slate-500">
                Creates independent equipment with tag {allocateNextTagFromPrefix({ model, prefix: "TB" })}. No wiring is copied.
              </span>
            </button>
            <button
              type="button"
              className={[
                "rounded-md border px-3 py-3 text-left text-xs transition",
                mode === "place_representation"
                  ? "border-teal-400 bg-teal-50 text-teal-950"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              ].join(" ")}
              aria-pressed={mode === "place_representation"}
              onClick={() => {
                setMode("place_representation");
                setTargetBackplaneId(null);
                setError(null);
              }}
            >
              <span className="flex items-center gap-2 font-bold">
                <Link2 aria-hidden="true" size={15} />
                Place another representation
              </span>
              <span className="mt-1.5 block leading-5 text-slate-500">
                Reuses {sourceAsset?.tag}, its composition, and terminal occupancy. No routes are copied.
              </span>
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="field-label">
              Destination sheet
              <select
                className="field-input"
                value={targetSheetId}
                onChange={(event) => {
                  setTargetSheetId(event.currentTarget.value);
                  setTargetBackplaneId(null);
                  setError(null);
                }}
              >
                {destinations.sheets.map((sheet) => (
                  <option key={sheet.id} value={sheet.id}>
                    Sheet {sheet.number} — {sheet.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-label">
              Destination mount
              <select
                className="field-input"
                value={effectiveTargetBackplaneId}
                onChange={(event) => {
                  setTargetBackplaneId(event.currentTarget.value);
                  setError(null);
                }}
              >
                <option value="">Not mounted on a backplane</option>
                {(selectedSheet?.backplanes ?? []).map((backplane) => (
                  <option
                    key={backplane.id}
                    value={backplane.id}
                    disabled={
                      mode === "place_representation" &&
                      !backplane.canPlaceRepresentation
                    }
                  >
                    {backplane.label}
                    {mode === "place_representation" &&
                    !backplane.canPlaceRepresentation
                      ? " — unavailable"
                      : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {mode === "place_representation" && selectedSheet?.alreadyRepresented ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
              This physical terminal strip is already represented on the selected sheet.
            </div>
          ) : null}
          {mode === "place_representation" && selectedBackplane?.unavailableReason ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
              {selectedBackplane.unavailableReason}
            </div>
          ) : null}
          <div className="rounded-md border border-slate-200 px-3 py-2 text-xs leading-5 text-slate-600">
            {mode === "copy_as_new"
              ? "A new physical asset and independent member composition will be created. Existing wires, routes, mappings, patterns, schedules, and occupancy remain with the source strip."
              : "This is another drawing occurrence of the same physical asset. Shared composition edits and terminal occupancy apply to every representation."}
          </div>
          {error ? (
            <div role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">
              {error}
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
            disabled={!canSubmit}
            onClick={submit}
          >
            {mode === "copy_as_new" ? "Copy terminal strip" : "Place representation"}
          </button>
        </div>
      </div>
    </div>
  );
}
