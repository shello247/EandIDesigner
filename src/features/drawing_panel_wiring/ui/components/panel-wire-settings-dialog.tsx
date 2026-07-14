"use client";

import { Settings2, X } from "lucide-react";
import { useState } from "react";
import type { PanelWireSettings } from "../../api/contracts";

export function PanelWireSettingsDialog({
  settings,
  onCancel,
  onSave
}: {
  settings: PanelWireSettings;
  onCancel: () => void;
  onSave: (settings: PanelWireSettings) => void;
}) {
  const [prefix, setPrefix] = useState(settings.wireIdPolicy.prefix ?? "");
  const [digits, setDigits] = useState(settings.wireIdPolicy.digits);
  const [nextNumber, setNextNumber] = useState(
    settings.wireIdPolicy.nextNumber
  );
  const [color, setColor] = useState(settings.defaults?.color ?? "");
  const [size, setSize] = useState(settings.defaults?.size ?? "");
  const [wireType, setWireType] = useState(
    settings.defaults?.wireType ?? ""
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/25 p-4 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="panel-wire-settings-title"
        className="w-full max-w-xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-800">
            <Settings2 aria-hidden="true" size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="panel-wire-settings-title" className="text-sm font-bold">
              Internal wire settings
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Configure package-aware wire numbering and new-wire defaults.
            </p>
          </div>
          <button
            type="button"
            className="icon-button h-8 w-8 p-0"
            onClick={onCancel}
            aria-label="Close internal wire settings"
          >
            <X aria-hidden="true" size={14} />
          </button>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          <div>
            <label className="field-label" htmlFor="panel-wire-prefix">
              Prefix
            </label>
            <input
              id="panel-wire-prefix"
              className="field-input"
              value={prefix}
              onChange={(event) => setPrefix(event.currentTarget.value)}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="panel-wire-digits">
              Digits
            </label>
            <input
              id="panel-wire-digits"
              className="field-input"
              type="number"
              min={1}
              max={6}
              value={digits}
              onChange={(event) => setDigits(Number(event.currentTarget.value))}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="panel-wire-next">
              Next number
            </label>
            <input
              id="panel-wire-next"
              className="field-input"
              type="number"
              min={1}
              value={nextNumber}
              onChange={(event) =>
                setNextNumber(Number(event.currentTarget.value))
              }
            />
          </div>
          <div>
            <label className="field-label" htmlFor="panel-wire-default-color">
              Default color
            </label>
            <input
              id="panel-wire-default-color"
              className="field-input"
              value={color}
              onChange={(event) => setColor(event.currentTarget.value)}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="panel-wire-default-size">
              Default size
            </label>
            <input
              id="panel-wire-default-size"
              className="field-input"
              value={size}
              onChange={(event) => setSize(event.currentTarget.value)}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="panel-wire-default-type">
              Default wire type
            </label>
            <input
              id="panel-wire-default-type"
              className="field-input"
              value={wireType}
              onChange={(event) => setWireType(event.currentTarget.value)}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button type="button" className="icon-button" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="icon-button icon-button-primary"
            disabled={
              !prefix.trim() ||
              !Number.isInteger(digits) ||
              digits < 1 ||
              digits > 6 ||
              !Number.isInteger(nextNumber) ||
              nextNumber < 1
            }
            onClick={() =>
              onSave({
                ...settings,
                wireIdPolicy: {
                  mode: "panel_scoped",
                  prefix: prefix.trim(),
                  digits,
                  nextNumber
                },
                defaults: {
                  color: color.trim() || undefined,
                  size: size.trim() || undefined,
                  wireType: wireType.trim() || undefined,
                  description: settings.defaults?.description
                }
              })
            }
          >
            Save settings
          </button>
        </div>
      </div>
    </div>
  );
}
