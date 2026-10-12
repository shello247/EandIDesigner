"use client";

export function DrawingRepresentationControl({
  schematic,
  disabled,
  onChange
}: {
  schematic: boolean;
  disabled: boolean;
  onChange: (schematic: boolean) => void;
}) {
  return (
    <label className="drawing-representation-control">
      <span>View</span>
      <select
        aria-label="Drawing view"
        aria-controls={schematic ? "drawing-schematic-panel" : "drawing-outline-panel"}
        value={schematic ? "schematic" : "outline"}
        disabled={disabled}
        title={disabled ? "Finish the current operation before changing view" : undefined}
        onChange={(event) => onChange(event.currentTarget.value === "schematic")}
      >
        <option value="outline">Outline</option>
        <option value="schematic">Schematic Preview</option>
      </select>
    </label>
  );
}
