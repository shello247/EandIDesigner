"use client";

import { Check, MousePointer2, Network, Undo2, X } from "lucide-react";
import type { PanelElectricalDomain } from "../../api/public";

export type PanelPatternAuthoringTopology =
  | "terminal_jumper"
  | "bridge_bar"
  | "daisy_chain"
  | "distribution"
  | "fused_distribution"
  | "shield"
  | "protective_earth"
  | "signal_ground";

export type PanelPatternAuthoringStage = "configure" | "selecting";

const TOPOLOGY_OPTIONS: Array<{
  value: PanelPatternAuthoringTopology;
  label: string;
}> = [
  { value: "terminal_jumper", label: "Terminal jumper" },
  { value: "bridge_bar", label: "Bridge bar" },
  { value: "daisy_chain", label: "Daisy chain" },
  { value: "distribution", label: "Distribution/common" },
  { value: "fused_distribution", label: "Fused distribution" },
  { value: "shield", label: "Shield termination" },
  { value: "protective_earth", label: "Protective earth" },
  { value: "signal_ground", label: "Signal ground" }
];

const DOMAIN_OPTIONS: Array<{
  value: Exclude<PanelElectricalDomain, "unknown">;
  label: string;
}> = [
  { value: "signal", label: "Signal" },
  { value: "power", label: "Power" },
  { value: "neutral", label: "Neutral" },
  { value: "shield", label: "Shield" },
  { value: "protective_earth", label: "Protective earth" },
  { value: "signal_ground", label: "Signal ground" }
];

function selectionHint(
  topology: PanelPatternAuthoringTopology,
  count: number,
  targetMode: "panel_reference" | "terminal"
): string {
  if (topology === "fused_distribution") {
    if (count === 0) return "Select the distribution source.";
    const step = (count - 1) % 3;
    return step === 0
      ? "Select a protection-device input."
      : step === 1
        ? "Select the matching protection-device output."
        : "Select the branch target.";
  }
  if (topology === "distribution") {
    return count === 0
      ? "Select the distribution source."
      : "Select one or more branch targets.";
  }
  if (["shield", "protective_earth", "signal_ground"].includes(topology)) {
    return count === 0
      ? "Select the source terminal."
      : targetMode === "terminal" && count === 1
        ? "Select the target terminal."
        : "Ready for review.";
  }
  return count === 0
    ? "Select the first terminal."
    : "Select additional terminals in electrical order.";
}

export function PanelPatternAuthoringPanel({
  topology,
  domain,
  targetDomain,
  targetMode,
  stage,
  selectedLabels,
  canReview,
  onTopologyChange,
  onDomainChange,
  onTargetDomainChange,
  onTargetModeChange,
  onStartSelecting,
  onRemoveLast,
  onReview,
  onCancel
}: {
  topology: PanelPatternAuthoringTopology;
  domain: Exclude<PanelElectricalDomain, "unknown">;
  targetDomain: "shield" | "protective_earth" | "signal_ground";
  targetMode: "panel_reference" | "terminal";
  stage: PanelPatternAuthoringStage;
  selectedLabels: string[];
  canReview: boolean;
  onTopologyChange: (topology: PanelPatternAuthoringTopology) => void;
  onDomainChange: (domain: Exclude<PanelElectricalDomain, "unknown">) => void;
  onTargetDomainChange: (
    domain: "shield" | "protective_earth" | "signal_ground"
  ) => void;
  onTargetModeChange: (mode: "panel_reference" | "terminal") => void;
  onStartSelecting: () => void;
  onRemoveLast: () => void;
  onReview: () => void;
  onCancel: () => void;
}) {
  const isBond = ["shield", "protective_earth", "signal_ground"].includes(
    topology
  );
  return (
    <section className="tool-panel overflow-hidden" aria-label="Connection pattern authoring">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Network aria-hidden="true" className="text-teal-700" size={16} />
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Connection Pattern</h3>
            <p className="text-[11px] text-slate-500">Structured panel connectivity</p>
          </div>
        </div>
        <button type="button" className="sidebar-toggle" onClick={onCancel} title="Cancel pattern">
          <X aria-hidden="true" size={15} />
        </button>
      </div>
      <div className="space-y-3 p-4">
        <label className="block text-xs font-semibold text-slate-700">
          Pattern type
          <select
            className="input mt-1 w-full"
            value={topology}
            disabled={stage === "selecting" && selectedLabels.length > 0}
            onChange={(event) =>
              onTopologyChange(event.target.value as PanelPatternAuthoringTopology)
            }
          >
            {TOPOLOGY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        {!isBond ? (
          <label className="block text-xs font-semibold text-slate-700">
            Electrical domain
            <select
              className="input mt-1 w-full"
              value={domain}
              disabled={stage === "selecting" && selectedLabels.length > 0}
              onChange={(event) =>
                onDomainChange(
                  event.target.value as Exclude<PanelElectricalDomain, "unknown">
                )
              }
            >
              {DOMAIN_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        ) : (
          <>
            <label className="block text-xs font-semibold text-slate-700">
              Target
              <select
                className="input mt-1 w-full"
                value={targetMode}
                disabled={stage === "selecting" && selectedLabels.length > 0}
                onChange={(event) =>
                  onTargetModeChange(
                    event.target.value as "panel_reference" | "terminal"
                  )
                }
              >
                <option value="panel_reference">Generated panel reference</option>
                <option value="terminal">Existing terminal</option>
              </select>
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              Target domain
              <select
                className="input mt-1 w-full"
                value={targetDomain}
                disabled={stage === "selecting" && selectedLabels.length > 0}
                onChange={(event) =>
                  onTargetDomainChange(
                    event.target.value as
                      | "shield"
                      | "protective_earth"
                      | "signal_ground"
                  )
                }
              >
                <option value="shield">Shield</option>
                <option value="protective_earth">Protective earth</option>
                <option value="signal_ground">Signal ground</option>
              </select>
            </label>
          </>
        )}

        <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          {selectionHint(topology, selectedLabels.length, targetMode)}
        </div>
        {selectedLabels.length > 0 ? (
          <ol className="max-h-32 space-y-1 overflow-auto text-xs text-slate-700">
            {selectedLabels.map((label, index) => (
              <li key={`${label}:${index}`} className="flex gap-2">
                <span className="w-5 text-right font-mono text-slate-400">{index + 1}</span>
                <span className="min-w-0 truncate">{label}</span>
              </li>
            ))}
          </ol>
        ) : null}

        <div className="flex justify-end gap-2">
          {stage === "configure" ? (
            <button type="button" className="icon-button icon-button-primary" onClick={onStartSelecting}>
              <MousePointer2 aria-hidden="true" size={14} /> Select terminals
            </button>
          ) : (
            <>
              {selectedLabels.length > 0 ? (
                <button type="button" className="icon-button" onClick={onRemoveLast}>
                  <Undo2 aria-hidden="true" size={14} /> Last
                </button>
              ) : null}
              <button
                type="button"
                className="icon-button icon-button-primary"
                disabled={!canReview}
                onClick={onReview}
              >
                <Check aria-hidden="true" size={14} /> Review
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
