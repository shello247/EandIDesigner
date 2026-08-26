"use client";

import { Ruler } from "lucide-react";

export function DrawingGuidesToggle({
  disabled,
  visible,
  onToggle
}: {
  disabled: boolean;
  visible: boolean;
  onToggle: () => void;
}) {
  const label = visible ? "Hide drawing guides" : "Show drawing guides";

  return (
    <button
      type="button"
      className={[
        "icon-button drawing-toolbar-icon-action h-9 p-0",
        visible ? "icon-button-primary" : ""
      ].join(" ")}
      disabled={disabled}
      aria-label={label}
      aria-pressed={visible}
      data-tooltip={label}
      onClick={onToggle}
    >
      <Ruler aria-hidden="true" size={18} />
    </button>
  );
}
