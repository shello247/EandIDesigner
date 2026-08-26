"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Copy, Search, X } from "lucide-react";
import type { DrawingModel } from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import {
  listStructuredTerminalStripBackplanes
} from "../../logic/commands/drawing-structured-terminal-strip-commands";
import {
  listStructuredTerminalStripCopySources,
  type StructuredTerminalStripReuseInput
} from "../../logic/commands/drawing-structured-terminal-strip-reuse-commands";
import { allocateNextTagFromPrefix } from "../../logic/services/drawing-asset-identity";

type SubmissionResult =
  | { ok: true }
  | { ok: false; error: string };

export function TerminalStripCopyDialog({
  model,
  symbols,
  targetSheetId,
  onCancel,
  onSubmit
}: {
  model: DrawingModel;
  symbols: ApprovedDrawingSymbol[];
  targetSheetId: string;
  onCancel: () => void;
  onSubmit: (input: StructuredTerminalStripReuseInput) => SubmissionResult;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const searchRef = useRef<HTMLInputElement | null>(null);
  const targetSheet = model.sheets.find((sheet) => sheet.id === targetSheetId);
  const sources = useMemo(
    () => listStructuredTerminalStripCopySources({ model, symbols }),
    [model, symbols]
  );
  const backplanes = useMemo(
    () => listStructuredTerminalStripBackplanes(model, targetSheetId),
    [model, targetSheetId]
  );
  const [query, setQuery] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [selectedBackplaneId, setSelectedBackplaneId] = useState<string | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredSources = useMemo(
    () =>
      normalizedQuery
        ? sources.filter((source) =>
            [
              source.tag,
              source.name,
              source.sourceMount ?? "",
              source.sourceSheet
            ].some((value) =>
              value.toLocaleLowerCase().includes(normalizedQuery)
            )
          )
        : sources,
    [normalizedQuery, sources]
  );
  const effectiveAssetId =
    selectedAssetId && sources.some((source) => source.assetId === selectedAssetId)
      ? selectedAssetId
      : sources.length === 1
        ? sources[0].assetId
        : null;
  const selectedSource = sources.find(
    (source) => source.assetId === effectiveAssetId
  );
  const effectiveBackplaneId =
    backplanes.length === 1
      ? backplanes[0].id
      : selectedBackplaneId &&
          backplanes.some((backplane) => backplane.id === selectedBackplaneId)
        ? selectedBackplaneId
        : null;
  const canSubmit = Boolean(
    targetSheet &&
      targetSheet.kind !== "section_title" &&
      selectedSource &&
      (backplanes.length === 0 || effectiveBackplaneId)
  );
  const proposedTag = allocateNextTagFromPrefix({ model, prefix: "TB" });

  const backplaneLabel = (backplaneId: string) => {
    const backplane = backplanes.find((candidate) => candidate.id === backplaneId);
    const panel = backplane?.containerAssetId
      ? model.assets.find((asset) => asset.id === backplane.containerAssetId)
      : undefined;
    return panel ? `${panel.tag} Backplane` : backplane?.tag ?? "Backplane";
  };

  useEffect(() => {
    searchRef.current?.focus();
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
    if (!canSubmit || !selectedSource) return;
    const result = onSubmit({
      mode: "copy_as_new",
      sourceSheetId: selectedSource.sourceSheetId,
      sourcePlacementId: selectedSource.sourcePlacementId,
      targetSheetId,
      targetBackplaneId: effectiveBackplaneId ?? undefined
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
              Copy existing terminal strip
            </h2>
            <p id={descriptionId} className="mt-1 text-xs leading-5 text-slate-600">
              Create independent equipment on {targetSheet?.name ?? "the active sheet"} from an existing structured strip.
            </p>
          </div>
          <button
            type="button"
            className="icon-button h-8 w-8 p-0"
            aria-label="Close copy terminal strip dialog"
            onClick={onCancel}
          >
            <X aria-hidden="true" size={15} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <section className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                Destination sheet
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-950">
                {targetSheet?.name ?? "Unavailable"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                Destination mount
              </div>
              {backplanes.length === 0 ? (
                <div className="mt-1 text-sm font-semibold text-slate-950">
                  Not mounted in a panel
                </div>
              ) : backplanes.length === 1 ? (
                <div className="mt-1 text-sm font-semibold text-slate-950">
                  Mounted on: {backplaneLabel(backplanes[0].id)}
                </div>
              ) : (
                <select
                  className="field-input mt-1"
                  aria-label="Destination backplane"
                  value={effectiveBackplaneId ?? ""}
                  onChange={(event) => {
                    setSelectedBackplaneId(event.currentTarget.value || null);
                    setError(null);
                  }}
                >
                  <option value="">Choose a backplane</option>
                  {backplanes.map((backplane) => (
                    <option key={backplane.id} value={backplane.id}>
                      {backplaneLabel(backplane.id)}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </section>

          <label className="field-label">
            Find terminal strip
            <span className="relative mt-1 block">
              <Search
                aria-hidden="true"
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                ref={searchRef}
                className="field-input pl-9"
                value={query}
                placeholder="Search tag, name, panel, or sheet"
                onChange={(event) => setQuery(event.currentTarget.value)}
              />
            </span>
          </label>

          <div
            className="max-h-72 space-y-2 overflow-y-auto pr-1"
            role="group"
            aria-label="Existing terminal strips"
          >
            {filteredSources.length > 0 ? (
              filteredSources.map((source) => {
                const selected = source.assetId === effectiveAssetId;
                return (
                  <button
                    key={source.assetId}
                    type="button"
                    className={[
                      "w-full rounded-md border px-3 py-3 text-left transition",
                      selected
                        ? "border-teal-400 bg-teal-50"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    ].join(" ")}
                    aria-pressed={selected}
                    onClick={() => {
                      setSelectedAssetId(source.assetId);
                      setError(null);
                    }}
                  >
                    <span className="flex flex-wrap items-start justify-between gap-2">
                      <span>
                        <span className="block text-sm font-bold text-slate-950">
                          {source.tag} — {source.name}
                        </span>
                        <span className="mt-1 block text-xs text-slate-500">
                          {source.sourceMount ?? "Not mounted in a panel"} · {source.sourceSheet}
                        </span>
                      </span>
                      <span className="text-right text-[11px] leading-5 text-slate-600">
                        <span className="block">{source.memberCount} members · {source.terminalCount} terminals</span>
                        <span className="block">{source.widthMm} × {source.heightMm} mm</span>
                      </span>
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="rounded-md border border-dashed border-slate-300 px-4 py-8 text-center text-xs leading-5 text-slate-500">
                {sources.length === 0
                  ? "No valid structured terminal strips are available to copy. Create one first."
                  : "No terminal strips match this search."}
              </div>
            )}
          </div>

          {selectedSource ? (
            <section className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-xs leading-5 text-teal-950">
              <strong>{proposedTag}</strong> will be created from {selectedSource.tag} as an independent physical asset. Composition is copied; wiring, routes, mappings, patterns, schedules, and occupancy are not.
            </section>
          ) : null}

          {error ? (
            <div
              role="alert"
              className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800"
            >
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
            Copy terminal strip
          </button>
        </div>
      </div>
    </div>
  );
}
