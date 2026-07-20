"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Save } from "lucide-react";
import { updateSymbolLayoutMetadataAction } from "../../api/actions";
import type {
  SymbolLayoutUsage,
  SymbolMetadata,
  SymbolPanelCategory,
  SymbolPanelMountingType
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

const panelCategoryOptions: Array<{
  value: SymbolPanelCategory;
  label: string;
}> = [
  { value: "protection", label: "Protection" },
  { value: "termination", label: "Termination" },
  { value: "controller", label: "Controller" },
  { value: "power", label: "Power" },
  { value: "ducting", label: "Ducting" },
  { value: "rail", label: "Rail" },
  { value: "label", label: "Label" },
  { value: "other", label: "Other" }
];

function numberToInput(value: number | undefined): string {
  return value === undefined ? "" : String(value);
}

function parsePositiveInput(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function SymbolLayoutMetadataPanel({
  versionId,
  metadata,
  readOnly = false
}: {
  versionId: string;
  metadata: SymbolMetadata;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [layoutUsage, setLayoutUsage] = useState<SymbolLayoutUsage>(
    metadata.layoutUsage ?? "wiring"
  );
  const [physicalWidthMm, setPhysicalWidthMm] = useState(
    numberToInput(metadata.physicalWidthMm)
  );
  const [physicalHeightMm, setPhysicalHeightMm] = useState(
    numberToInput(metadata.physicalHeightMm)
  );
  const [mountingType, setMountingType] = useState<
    SymbolPanelMountingType | ""
  >(metadata.mountingType ?? "");
  const [panelCategory, setPanelCategory] = useState<SymbolPanelCategory | "">(
    metadata.panelCategory ?? ""
  );
  const [resizable, setResizable] = useState(metadata.resizable ?? false);
  const panelLayoutEnabled = layoutUsage !== "wiring";

  const save = () => {
    startTransition(async () => {
      const result = await updateSymbolLayoutMetadataAction({
        versionId,
        layoutUsage,
        physicalWidthMm: parsePositiveInput(physicalWidthMm),
        physicalHeightMm: parsePositiveInput(physicalHeightMm),
        mountingType: mountingType || undefined,
        panelCategory: panelCategory || undefined,
        resizable
      });

      setMessage(result.ok ? "Layout metadata saved." : result.error);
      router.refresh();
    });
  };

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
            disabled={isPending || readOnly}
            onChange={(event) =>
              setLayoutUsage(event.currentTarget.value as SymbolLayoutUsage)
            }
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
              disabled={isPending || readOnly || !panelLayoutEnabled}
              onChange={(event) => setPhysicalWidthMm(event.currentTarget.value)}
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
              disabled={isPending || readOnly || !panelLayoutEnabled}
              onChange={(event) => setPhysicalHeightMm(event.currentTarget.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label" htmlFor="symbol-mounting-type">
              Mounting type
            </label>
            <select
              id="symbol-mounting-type"
              className="field-input"
              value={mountingType}
              disabled={isPending || readOnly || !panelLayoutEnabled}
              onChange={(event) =>
                setMountingType(
                  event.currentTarget.value as SymbolPanelMountingType
                )
              }
            >
              <option value="">Select mounting</option>
              {mountingTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="symbol-panel-category">
              Panel category
            </label>
            <select
              id="symbol-panel-category"
              className="field-input"
              value={panelCategory}
              disabled={isPending || readOnly || !panelLayoutEnabled}
              onChange={(event) =>
                setPanelCategory(
                  event.currentTarget.value as SymbolPanelCategory
                )
              }
            >
              <option value="">Select category</option>
              {panelCategoryOptions.map((option) => (
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
            disabled={isPending || readOnly || !panelLayoutEnabled}
            onChange={(event) => setResizable(event.currentTarget.checked)}
          />
          Resizable in panel layouts
        </label>
        {panelLayoutEnabled &&
        (!parsePositiveInput(physicalWidthMm) ||
          !parsePositiveInput(physicalHeightMm)) ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Panel layout symbols need real physical width and height before they
            can be placed on a layout sheet.
          </div>
        ) : null}
        {message ? (
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            {message}
          </div>
        ) : null}
        {!readOnly ? (
          <button
            type="button"
            className="icon-button icon-button-primary w-full justify-center"
            disabled={isPending}
            onClick={save}
          >
            <Save aria-hidden="true" size={14} />
            Save layout metadata
          </button>
        ) : null}
      </div>
    </section>
  );
}
