"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import type {
  SymbolMetadata,
  SymbolPanelWiringAssetType
} from "../../data/schema";

const assetTypeOptions: Array<{
  value: SymbolPanelWiringAssetType;
  label: string;
}> = [
  { value: "instrument", label: "Instrument" },
  { value: "controller", label: "Controller" },
  { value: "terminal_block", label: "Terminal Block" },
  { value: "breaker", label: "Breaker" },
  { value: "fuse", label: "Fuse" },
  { value: "relay", label: "Relay" },
  { value: "power_supply", label: "Power Supply" },
  { value: "isolator", label: "Isolator" },
  { value: "converter", label: "Converter" },
  { value: "io_module", label: "I/O Module" },
  { value: "network_device", label: "Network Device" },
  { value: "earth_bar", label: "Earth Bar" },
  { value: "other", label: "Other" }
];

function terminalReadiness(metadata: SymbolMetadata): string[] {
  const anchorKeys = new Set(metadata.anchors.map((anchor) => anchor.key));
  const terminalGroups = new Map<string, typeof metadata.terminals>();
  const issues: string[] = [];

  if (metadata.terminals.length === 0) {
    issues.push("Add at least one electrical terminal.");
  }

  for (const terminal of metadata.terminals) {
    if (!anchorKeys.has(terminal.anchorKey)) {
      issues.push(`Terminal ${terminal.key} references a missing anchor.`);
    }
    const group = terminalGroups.get(terminal.key) ?? [];
    group.push(terminal);
    terminalGroups.set(terminal.key, group);
  }

  for (const [key, terminals] of terminalGroups) {
    if (terminals.length < 2) {
      continue;
    }
    const sides = terminals.map((terminal) => terminal.panelSide);
    if (sides.some((side) => !side) || new Set(sides).size !== sides.length) {
      issues.push(`Terminal ${key} needs unique explicit panel sides.`);
    }
  }

  return [...new Set(issues)];
}

function parsePositive(value: string): number | undefined {
  if (!value.trim()) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function SymbolPanelWiringCapabilityPanel({
  metadata,
  readOnly,
  onChange
}: {
  metadata: SymbolMetadata;
  readOnly: boolean;
  onChange: (updater: (current: SymbolMetadata) => SymbolMetadata) => void;
}) {
  const enabled = Boolean(metadata.panelWiring);
  const assetType = metadata.panelWiring?.assetType ?? "other";
  const [tagPrefix, setTagPrefix] = useState(
    metadata.panelWiring?.tagPrefix ?? "EQ"
  );
  const [schematicScale, setSchematicScale] = useState(
    metadata.panelWiring?.schematicScale
      ? String(metadata.panelWiring.schematicScale)
      : ""
  );
  const readinessIssues = terminalReadiness(metadata);
  const missingPhysicalDimensions =
    !metadata.physicalWidthMm || !metadata.physicalHeightMm;

  const updateCapability = (
    updates: Partial<NonNullable<SymbolMetadata["panelWiring"]>>
  ) => {
    onChange((current) => ({
      ...current,
      panelWiring: {
        assetType: current.panelWiring?.assetType ?? "other",
        tagPrefix: current.panelWiring?.tagPrefix ?? "EQ",
        ...current.panelWiring,
        ...updates
      }
    }));
  };

  return (
    <section className="tool-panel overflow-hidden">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-bold">Detailed Panel Component</h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Explicitly approve this symbol for schematic panel wiring drawings.
        </p>
      </div>
      <div className="space-y-3 p-4">
        <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={enabled}
            disabled={readOnly}
            onChange={(event) => {
              const checked = event.currentTarget.checked;
              onChange((current) => ({
                ...current,
                panelWiring: checked
                  ? {
                      assetType: current.panelWiring?.assetType ?? "other",
                      tagPrefix: current.panelWiring?.tagPrefix ?? "EQ",
                      schematicScale: current.panelWiring?.schematicScale
                    }
                  : undefined
              }));
            }}
          />
          Enable Detailed Panel use
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label" htmlFor="panel-wiring-asset-type">
              Asset type
            </label>
            <select
              id="panel-wiring-asset-type"
              className="field-input"
              value={assetType}
              disabled={readOnly || !enabled}
              onChange={(event) =>
                updateCapability({
                  assetType:
                    event.currentTarget.value as SymbolPanelWiringAssetType
                })
              }
            >
              {assetTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="panel-wiring-tag-prefix">
              Tag prefix
            </label>
            <input
              id="panel-wiring-tag-prefix"
              className="field-input"
              value={tagPrefix}
              disabled={readOnly || !enabled}
              maxLength={24}
              onChange={(event) => {
                const value = event.currentTarget.value.toUpperCase();
                setTagPrefix(value);
                updateCapability({ tagPrefix: value });
              }}
            />
          </div>
        </div>
        <div>
          <label className="field-label" htmlFor="panel-wiring-scale">
            Schematic scale
          </label>
          <input
            id="panel-wiring-scale"
            className="field-input"
            inputMode="decimal"
            placeholder="Use normal symbol scale"
            value={schematicScale}
            disabled={readOnly || !enabled}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setSchematicScale(value);
              updateCapability({ schematicScale: parsePositive(value) });
            }}
          />
        </div>
        {readinessIssues.length === 0 ? (
          <div className="flex gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            <CheckCircle2 aria-hidden="true" className="mt-0.5" size={14} />
            Electrical terminals are ready for Detailed Panel wiring.
          </div>
        ) : (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle aria-hidden="true" size={14} />
              Wiring readiness needs attention
            </div>
            <ul className="mt-2 space-y-1">
              {readinessIssues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </div>
        )}
        {missingPhysicalDimensions ? (
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Physical dimensions are missing. Schematic placement is available,
            but physical panel-layout placement remains unavailable.
          </div>
        ) : null}
        {enabled && !tagPrefix.trim() ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            A default tag prefix is required.
          </div>
        ) : null}
      </div>
    </section>
  );
}
