"use client";

import {
  networkDeviceTypeSchema,
  type NetworkDeviceType
} from "@/features/symbol_registry/data/schema";
import type { SvgImportNetworkProfileDraft } from "../../data/schema";

function optionLabel(value: string): string {
  return value
    .split("_")
    .map((part) => {
      const upper = part.toUpperCase();
      return upper === "PLC" || upper === "HMI"
        ? upper
        : `${part.charAt(0).toUpperCase()}${part.slice(1)}`;
    })
    .join(" ");
}

export function NetworkProfileEditor({
  profile,
  disabled,
  onChange
}: {
  profile: SvgImportNetworkProfileDraft;
  disabled: boolean;
  onChange: (updates: Partial<SvgImportNetworkProfileDraft>) => void;
}) {
  const managedValue =
    profile.managed === undefined
      ? "unspecified"
      : profile.managed
        ? "managed"
        : "unmanaged";

  return (
    <section className="tool-panel overflow-hidden">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-bold">Network Profile</h2>
      </div>
      <div className="grid gap-4 p-4 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="network-device-type">
            Device type
          </label>
          <select
            id="network-device-type"
            className="field-input"
            value={profile.deviceType}
            disabled={disabled}
            onChange={(event) =>
              onChange({
                deviceType: event.currentTarget.value as NetworkDeviceType | ""
              })
            }
          >
            <option value="">Select device type</option>
            {networkDeviceTypeSchema.options.map((deviceType) => (
              <option key={deviceType} value={deviceType}>
                {optionLabel(deviceType)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="network-managed-status">
            Managed status
          </label>
          <select
            id="network-managed-status"
            className="field-input"
            value={managedValue}
            disabled={disabled}
            onChange={(event) => {
              const value = event.currentTarget.value;
              onChange({
                managed:
                  value === "unspecified" ? undefined : value === "managed"
              });
            }}
          >
            <option value="unspecified">Not specified</option>
            <option value="managed">Managed</option>
            <option value="unmanaged">Unmanaged</option>
          </select>
        </div>
      </div>
    </section>
  );
}
