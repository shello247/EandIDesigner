"use client";

import type { PanelConnectionDisplayMode } from "../../data/schema";

export function ConnectionDisplaySelect({
  id,
  mode,
  hasSidedTerminals,
  disabled = false,
  onChange
}: {
  id: string;
  mode: PanelConnectionDisplayMode;
  hasSidedTerminals: boolean;
  disabled?: boolean;
  onChange: (mode: PanelConnectionDisplayMode) => void;
}) {
  return (
    <select
      id={id}
      className="field-input"
      value={mode}
      disabled={disabled}
      onChange={(event) =>
        onChange(event.currentTarget.value as PanelConnectionDisplayMode)
      }
    >
      <option value="sheet_only">Sheet routes only</option>
      <option value="internal_connected">
        {hasSidedTerminals
          ? "Internal wires only — TOP"
          : "Internal wires only"}
      </option>
      <option value="external_connected">
        {hasSidedTerminals
          ? "External connections only — BOTTOM"
          : "External connections only"}
      </option>
      <option value="all_connected">Both — all directly landed wires</option>
    </select>
  );
}
