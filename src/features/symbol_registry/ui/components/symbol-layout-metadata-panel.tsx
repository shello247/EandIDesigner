"use client";

import { useState } from "react";
import type {
  SymbolLayoutUsage,
  SymbolMetadata,
  SymbolPanelMountingType,
  SymbolTerminalStripMemberRole,
  SymbolTechnicalKind
} from "../../data/schema";

const layoutUsageOptions: Array<{ value: SymbolLayoutUsage; label: string }> = [
  { value: "wiring", label: "Wiring drawings" },
  { value: "panel_layout", label: "Panel layouts" },
  { value: "both", label: "Wiring and panel layouts" }
];

const mountingTypeOptions: Array<{
  value: SymbolPanelMountingType;
  label: string;
}> = [
  { value: "din_rail", label: "DIN rail" },
  { value: "backplate", label: "Backplate" },
  { value: "wire_duct", label: "Wire duct" },
  { value: "door", label: "Door" },
  { value: "free", label: "Free placement" }
];

function numberToInput(value: number | undefined): string {
  return value === undefined ? "" : String(value);
}

function parsePositiveInput(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function SymbolLayoutMetadataPanel({
  metadata,
  technicalKind,
  readOnly = false,
  onChange
}: {
  metadata: SymbolMetadata;
  technicalKind: SymbolTechnicalKind;
  readOnly?: boolean;
  onChange: (updater: (current: SymbolMetadata) => SymbolMetadata) => void;
}) {
  const [physicalWidthMm, setPhysicalWidthMm] = useState(
    numberToInput(metadata.physicalWidthMm)
  );
  const [physicalHeightMm, setPhysicalHeightMm] = useState(
    numberToInput(metadata.physicalHeightMm)
  );
  const layoutUsage = metadata.layoutUsage ?? "wiring";
  const mountingType = metadata.mountingType ?? "";
  const resizable = metadata.resizable ?? false;
  const panelLayoutEnabled = layoutUsage !== "wiring";
  const terminalStripCapability = metadata.terminalStripCapability;
  const terminalStripEligible =
    technicalKind === "terminal_block" &&
    panelLayoutEnabled &&
    mountingType === "din_rail";

  return (
    <section className="tool-panel overflow-hidden">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-bold">Panel Layout Metadata</h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Physical size and mounting data for panel layout placement.
        </p>
      </div>
      <div className="space-y-3 p-4">
        <div>
          <label className="field-label" htmlFor="symbol-layout-usage">
            Layout usage
          </label>
          <select
            id="symbol-layout-usage"
            className="field-input"
            value={layoutUsage}
            disabled={readOnly}
            onChange={(event) => {
              const value = event.currentTarget.value as SymbolLayoutUsage;
              onChange((current) => ({
                ...current,
                layoutUsage: value
              }));
            }}
          >
            {layoutUsageOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label" htmlFor="symbol-physical-width">
              Width mm
            </label>
            <input
              id="symbol-physical-width"
              className="field-input"
              inputMode="decimal"
              value={physicalWidthMm}
              disabled={readOnly || !panelLayoutEnabled}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setPhysicalWidthMm(value);
                onChange((current) => ({
                  ...current,
                  physicalWidthMm: parsePositiveInput(value)
                }));
              }}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="symbol-physical-height">
              Height mm
            </label>
            <input
              id="symbol-physical-height"
              className="field-input"
              inputMode="decimal"
              value={physicalHeightMm}
              disabled={readOnly || !panelLayoutEnabled}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setPhysicalHeightMm(value);
                onChange((current) => ({
                  ...current,
                  physicalHeightMm: parsePositiveInput(value)
                }));
              }}
            />
          </div>
        </div>
        <div>
          <div>
            <label className="field-label" htmlFor="symbol-mounting-type">
              Mounting type
            </label>
            <select
              id="symbol-mounting-type"
              className="field-input"
              value={mountingType}
              disabled={readOnly || !panelLayoutEnabled}
              onChange={(event) => {
                const value = event.currentTarget.value as
                  | SymbolPanelMountingType
                  | "";
                onChange((current) => ({
                  ...current,
                  mountingType: value || undefined
                }));
              }}
            >
              <option value="">Select mounting</option>
              {mountingTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={resizable}
            disabled={readOnly || !panelLayoutEnabled}
            onChange={(event) => {
              const checked = event.currentTarget.checked;
              onChange((current) => ({
                ...current,
                resizable: checked
              }));
            }}
          />
          Resizable in panel layouts
        </label>
        {technicalKind === "terminal_block" ? (
          <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3">
            <label className="flex items-start gap-2 text-xs text-slate-700">
              <input
                className="mt-0.5"
                type="checkbox"
                checked={Boolean(terminalStripCapability)}
                disabled={readOnly || !terminalStripEligible}
                onChange={(event) => {
                  const checked = event.currentTarget.checked;
                  onChange((current) => ({
                    ...current,
                    terminalStripCapability: checked
                      ? {
                          role: "electrical",
                          railDatumMm: Number(
                            ((current.physicalHeightMm ?? 0) / 2).toFixed(2)
                          )
                        }
                      : undefined
                  }));
                }}
              />
              <span>
                <span className="block font-semibold">
                  Enable as terminal-strip member
                </span>
                <span className="mt-0.5 block leading-5 text-slate-500">
                  Explicitly allows this approved DIN-rail symbol in structured
                  terminal strips.
                </span>
              </span>
            </label>
            {terminalStripCapability ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="field-label" htmlFor="terminal-strip-role">
                      Member role
                    </label>
                    <select
                      id="terminal-strip-role"
                      className="field-input"
                      value={terminalStripCapability.role}
                      disabled={readOnly}
                      onChange={(event) => {
                        const role = event.currentTarget
                          .value as SymbolTerminalStripMemberRole;
                        onChange((current) => ({
                          ...current,
                          terminalStripCapability: current.terminalStripCapability
                            ? { ...current.terminalStripCapability, role }
                            : undefined
                        }));
                      }}
                    >
                      <option value="electrical">Electrical terminal</option>
                      <option value="end_bracket">End bracket</option>
                      <option value="accessory">Accessory</option>
                    </select>
                  </div>
                  <div>
                    <label className="field-label" htmlFor="terminal-strip-datum">
                      DIN-rail datum mm
                    </label>
                    <input
                      id="terminal-strip-datum"
                      className="field-input"
                      inputMode="decimal"
                      value={terminalStripCapability.railDatumMm}
                      disabled={readOnly}
                      onChange={(event) => {
                        const value = Number(event.currentTarget.value);
                        onChange((current) => ({
                          ...current,
                          terminalStripCapability:
                            current.terminalStripCapability &&
                            Number.isFinite(value) &&
                            value >= 0
                              ? {
                                  ...current.terminalStripCapability,
                                  railDatumMm: value
                                }
                              : current.terminalStripCapability
                        }));
                      }}
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={
                      terminalStripCapability.defaultForNewStrips ?? false
                    }
                    disabled={readOnly || terminalStripCapability.role === "accessory"}
                    onChange={(event) => {
                      const checked = event.currentTarget.checked;
                      onChange((current) => ({
                        ...current,
                        terminalStripCapability: current.terminalStripCapability
                          ? {
                              ...current.terminalStripCapability,
                              defaultForNewStrips: checked || undefined
                            }
                          : undefined
                      }));
                    }}
                  />
                  Default {terminalStripCapability.role === "end_bracket"
                    ? "end bracket"
                    : "electrical member"} for new strips
                </label>
              </>
            ) : !terminalStripEligible ? (
              <p className="text-xs leading-5 text-amber-800">
                Select panel-layout use and DIN-rail mounting before enabling
                this capability.
              </p>
            ) : null}
          </div>
        ) : null}
        {panelLayoutEnabled &&
        (!parsePositiveInput(physicalWidthMm) ||
          !parsePositiveInput(physicalHeightMm)) ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Panel layout symbols need real physical width and height before they
            can be placed on a layout sheet.
          </div>
        ) : null}
      </div>
    </section>
  );
}
