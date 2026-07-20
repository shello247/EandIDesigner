"use client";

import {
  symbolCategorySchema,
  type SymbolCategory,
  type SymbolLayoutUsage,
  type SymbolPanelCategory,
  type SymbolPanelMountingType
} from "@/features/symbol_registry/data/schema";

export type SymbolMetadataFormState = {
  symbolKey: string;
  displayName: string;
  manufacturer: string;
  model: string;
  category: SymbolCategory;
  layoutUsage: SymbolLayoutUsage;
  physicalWidthMm: string;
  physicalHeightMm: string;
  mountingType: SymbolPanelMountingType | "";
  panelCategory: SymbolPanelCategory | "";
  resizable: boolean;
};

function optionLabel(value: string): string {
  return value
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

const categoryOptions: Array<{ value: SymbolCategory; label: string }> =
  symbolCategorySchema.options.map((value) => ({
    value,
    label: optionLabel(value)
  }));

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

export function SymbolMetadataForm({
  form,
  disabled,
  onChange
}: {
  form: SymbolMetadataFormState;
  disabled: boolean;
  onChange: (updates: Partial<SymbolMetadataFormState>) => void;
}) {
  return (
    <section className="tool-panel overflow-hidden">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-bold">Symbol Metadata</h2>
      </div>
      <div className="grid gap-4 p-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="display-name">
            Display name
          </label>
          <input
            id="display-name"
            className="field-input"
            value={form.displayName}
            disabled={disabled}
            onChange={(event) => onChange({ displayName: event.currentTarget.value })}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="symbol-key">
            Symbol key
          </label>
          <input
            id="symbol-key"
            className="field-input"
            value={form.symbolKey}
            disabled={disabled}
            onChange={(event) => onChange({ symbolKey: event.currentTarget.value })}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="category">
            Category
          </label>
          <select
            id="category"
            className="field-input"
            value={form.category}
            disabled={disabled}
            onChange={(event) =>
              onChange({ category: event.currentTarget.value as SymbolCategory })
            }
          >
            {categoryOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="manufacturer">
            Manufacturer
          </label>
          <input
            id="manufacturer"
            className="field-input"
            value={form.manufacturer}
            disabled={disabled}
            onChange={(event) => onChange({ manufacturer: event.currentTarget.value })}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="model">
            Model
          </label>
          <input
            id="model"
            className="field-input"
            value={form.model}
            disabled={disabled}
            onChange={(event) => onChange({ model: event.currentTarget.value })}
          />
        </div>
        {form.category !== "network_device" ? (
          <>
        <div className="border-t border-slate-200 pt-4 sm:col-span-2">
          <h3 className="text-xs font-bold uppercase text-slate-500">
            Panel layout metadata
          </h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Use this only for approved symbols that should be placed on panel
            layout sheets at real millimetre size.
          </p>
        </div>
        <div>
          <label className="field-label" htmlFor="layout-usage">
            Layout usage
          </label>
          <select
            id="layout-usage"
            className="field-input"
            value={form.layoutUsage}
            disabled={disabled}
            onChange={(event) =>
              onChange({
                layoutUsage: event.currentTarget.value as SymbolLayoutUsage
              })
            }
          >
            {layoutUsageOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="mounting-type">
            Mounting type
          </label>
          <select
            id="mounting-type"
            className="field-input"
            value={form.mountingType}
            disabled={disabled || form.layoutUsage === "wiring"}
            onChange={(event) =>
              onChange({
                mountingType: event.currentTarget
                  .value as SymbolPanelMountingType
              })
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
          <label className="field-label" htmlFor="physical-width-mm">
            Width mm
          </label>
          <input
            id="physical-width-mm"
            className="field-input"
            inputMode="decimal"
            value={form.physicalWidthMm}
            disabled={disabled || form.layoutUsage === "wiring"}
            onChange={(event) =>
              onChange({ physicalWidthMm: event.currentTarget.value })
            }
          />
        </div>
        <div>
          <label className="field-label" htmlFor="physical-height-mm">
            Height mm
          </label>
          <input
            id="physical-height-mm"
            className="field-input"
            inputMode="decimal"
            value={form.physicalHeightMm}
            disabled={disabled || form.layoutUsage === "wiring"}
            onChange={(event) =>
              onChange({ physicalHeightMm: event.currentTarget.value })
            }
          />
        </div>
        <div>
          <label className="field-label" htmlFor="panel-category">
            Panel category
          </label>
          <select
            id="panel-category"
            className="field-input"
            value={form.panelCategory}
            disabled={disabled || form.layoutUsage === "wiring"}
            onChange={(event) =>
              onChange({
                panelCategory: event.currentTarget.value as SymbolPanelCategory
              })
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
        <label className="flex items-center gap-2 self-end rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={form.resizable}
            disabled={disabled || form.layoutUsage === "wiring"}
            onChange={(event) => onChange({ resizable: event.currentTarget.checked })}
          />
          Resizable in panel layouts
        </label>
          </>
        ) : null}
      </div>
    </section>
  );
}
