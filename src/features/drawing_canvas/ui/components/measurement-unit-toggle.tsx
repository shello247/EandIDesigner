"use client";

import type { DrawingMeasurementUnit } from "../../data/schema";

const measurementUnits: DrawingMeasurementUnit[] = ["mm", "in"];

export function MeasurementUnitToggle({
  value,
  onChange,
  disabled = false,
  ariaLabel = "Drawing measurement units"
}: {
  value: DrawingMeasurementUnit;
  onChange: (unit: DrawingMeasurementUnit) => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="measurement-unit-toggle inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white p-1"
    >
      <span className="px-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
        Units
      </span>
      {measurementUnits.map((unit) => (
        <button
          key={unit}
          type="button"
          className={[
            "min-h-7 rounded px-2.5 py-1 text-xs font-bold transition",
            value === unit
              ? "bg-teal-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          ].join(" ")}
          aria-pressed={value === unit}
          disabled={disabled}
          onClick={() => onChange(unit)}
        >
          {unit}
        </button>
      ))}
    </div>
  );
}
