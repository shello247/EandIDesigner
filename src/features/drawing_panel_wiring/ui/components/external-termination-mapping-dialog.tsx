"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Link2, RotateCcw, X } from "lucide-react";
import type {
  ExternalTerminationMappingRow,
  PanelTerminalMappingCandidate,
  PanelTerminalSideRef
} from "../../api/public";

function candidateKey(ref: PanelTerminalSideRef): string {
  return `${ref.assetId}:${ref.terminalKey}:${ref.side}`;
}

function sameTarget(
  first: PanelTerminalSideRef | undefined,
  second: PanelTerminalSideRef
): boolean {
  return Boolean(
    first &&
      first.assetId === second.assetId &&
      first.terminalKey === second.terminalKey &&
      first.side === second.side
  );
}

export function ExternalTerminationMappingDialog({
  row,
  candidates,
  onApply,
  onReset,
  onCancel
}: {
  row: ExternalTerminationMappingRow;
  candidates: PanelTerminalMappingCandidate[];
  onApply: (target: PanelTerminalSideRef) => void;
  onReset: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const [selectedKey, setSelectedKey] = useState(
    row.effectiveTarget ? candidateKey(row.effectiveTarget) : ""
  );
  const selected = useMemo(
    () => candidates.find((candidate) => candidateKey(candidate.ref) === selectedKey),
    [candidates, selectedKey]
  );
  const candidatesByAsset = useMemo(() => {
    const groups = new Map<string, PanelTerminalMappingCandidate[]>();

    candidates.forEach((candidate) => {
      const key = `${candidate.ref.assetId}:${candidate.assetTag}`;
      groups.set(key, [...(groups.get(key) ?? []), candidate]);
    });

    return [...groups.entries()];
  }, [candidates]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCancel();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-[2px]"
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
        className="flex h-[82vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-700">
            <Link2 aria-hidden="true" size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-sm font-semibold text-slate-950">
              Map External Termination
            </h2>
            <p id={descriptionId} className="mt-1 text-xs leading-5 text-slate-600">
              Choose an available external or single terminal side. This stores a
              mapping override; the source field connection remains unchanged.
            </p>
          </div>
          <button
            type="button"
            className="icon-button h-8 w-8 p-0"
            onClick={onCancel}
            aria-label="Close terminal mapping"
          >
            <X aria-hidden="true" size={14} />
          </button>
        </div>

        <div className="grid gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 md:grid-cols-4">
          <div>
            <p className="text-[10px] font-bold uppercase text-slate-500">Wire</p>
            <p className="mt-1 font-mono text-xs font-semibold text-slate-900">
              {row.wireId || "Unidentified"}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase text-slate-500">Cable / conductor</p>
            <p className="mt-1 text-xs font-semibold text-slate-900">
              {row.cableTag || row.cableAssetId || "-"} / {row.conductorKey || "-"}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase text-slate-500">Source sheet</p>
            <p className="mt-1 text-xs font-semibold text-slate-900">
              Sheet {row.sourceSheet.number} - {row.sourceSheet.name}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase text-slate-500">Provenance</p>
            <p className="mt-1 font-mono text-[10px] leading-4 text-slate-700">
              {row.source.connectionId} / {row.source.endpointRole}
              <br />
              {row.source.placementId} / {row.source.anchorKey}
            </p>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4">
          <div className="space-y-4">
            {candidatesByAsset.map(([assetKey, assetCandidates]) => (
              <section key={assetKey} className="overflow-hidden rounded-md border border-slate-200">
                <div className="border-b border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-xs font-bold text-slate-900">
                    {assetCandidates[0].assetTag}
                    <span className="ml-2 font-normal text-slate-500">
                      {assetCandidates[0].assetTitle}
                    </span>
                  </p>
                </div>
                <div className="grid gap-px bg-slate-200 sm:grid-cols-2 lg:grid-cols-3">
                  {assetCandidates.map((candidate) => {
                    const key = candidateKey(candidate.ref);
                    const isCurrent = sameTarget(row.effectiveTarget, candidate.ref);
                    const disabled = Boolean(candidate.disabledReason) && !isCurrent;

                    return (
                      <label
                        key={key}
                        className={`flex min-h-20 gap-3 bg-white p-3 ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-sky-50"}`}
                      >
                        <input
                          type="radio"
                          name="terminal-target"
                          value={key}
                          checked={selectedKey === key}
                          disabled={disabled}
                          onChange={() => setSelectedKey(key)}
                          className="mt-0.5"
                        />
                        <span className="min-w-0">
                          <span className="block text-xs font-bold text-slate-900">
                            Terminal {candidate.terminalLabel}
                            <span className="ml-1 font-medium text-slate-500">
                              / {candidate.ref.side}
                            </span>
                          </span>
                          {candidate.function ? (
                            <span className="mt-0.5 block text-[11px] text-slate-600">
                              {candidate.function}
                            </span>
                          ) : null}
                          <span className={`mt-1 block text-[10px] ${candidate.disabledReason ? "text-rose-700" : "text-emerald-700"}`}>
                            {candidate.disabledReason ??
                              (isCurrent ? "Current mapping" : "Available")}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <div>
            {row.mappingMode === "manual" ? (
              <button type="button" className="icon-button" onClick={onReset}>
                <RotateCcw aria-hidden="true" size={14} />
                Reset to automatic
              </button>
            ) : null}
          </div>
          <div className="flex gap-2">
            <button type="button" className="icon-button" onClick={onCancel}>
              Done
            </button>
            <button
              type="button"
              className="icon-button icon-button-primary"
              disabled={!selected || Boolean(selected.disabledReason)}
              onClick={() => selected && onApply(selected.ref)}
            >
              Apply mapping
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
