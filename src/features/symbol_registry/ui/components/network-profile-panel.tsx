"use client";

import { useMemo } from "react";
import {
  networkDeviceTypeSchema,
  type NetworkDeviceType,
  type SymbolAnchor
} from "../../data/schema";
import {
  createEmptyNetworkPortReviewDraft,
  type NetworkManagedReviewValue,
  type NetworkProfileReviewDraft
} from "../../logic/services/network-profile-review-draft";
import { NetworkPortTable } from "./network-port-table";

function formatOptionLabel(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
    .replace("Router Firewall", "Router / Firewall")
    .replace("Controller Plc", "Controller / PLC")
    .replace("Hmi Workstation", "HMI / Workstation");
}

export function NetworkProfilePanel({
  manufacturer,
  model,
  draft,
  anchors,
  readOnly,
  onManufacturerChange,
  onModelChange,
  onDraftChange
}: {
  manufacturer: string;
  model: string;
  draft: NetworkProfileReviewDraft;
  anchors: SymbolAnchor[];
  readOnly: boolean;
  onManufacturerChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onDraftChange: (draft: NetworkProfileReviewDraft) => void;
}) {
  const networkAnchors = useMemo(
    () => anchors.filter((anchor) => anchor.kind === "network_port"),
    [anchors]
  );

  const addPort = () => {
    const usedAnchors = new Set(draft.ports.map((port) => port.anchorKey));
    const availableAnchor = networkAnchors.find(
      (anchor) => !usedAnchors.has(anchor.key)
    );
    const fallbackIndex = draft.ports.length + 1;
    const key = availableAnchor?.key ?? `PORT${fallbackIndex}`;

    onDraftChange({
      ...draft,
      ports: [
        ...draft.ports,
        createEmptyNetworkPortReviewDraft({
          key,
          anchorKey: availableAnchor?.key ?? ""
        })
      ]
    });
  };

  return (
    <section className="tool-panel overflow-hidden">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-bold">Network Profile</h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Device identity and connection metadata used by networking maps.
        </p>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-2">
        {!readOnly ? (
          <>
            <div>
              <label className="field-label" htmlFor="network-manufacturer">
                Manufacturer
              </label>
              <input
                id="network-manufacturer"
                className="field-input"
                value={manufacturer}
                onChange={(event) =>
                  onManufacturerChange(event.currentTarget.value)
                }
              />
            </div>
            <div>
              <label className="field-label" htmlFor="network-model">
                Model
              </label>
              <input
                id="network-model"
                className="field-input"
                value={model}
                onChange={(event) => onModelChange(event.currentTarget.value)}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="network-device-type-review">
                Device type
              </label>
              <select
                id="network-device-type-review"
                className="field-input"
                value={draft.deviceType}
                onChange={(event) =>
                  onDraftChange({
                    ...draft,
                    deviceType: event.currentTarget.value as NetworkDeviceType
                  })
                }
              >
                {networkDeviceTypeSchema.options.map((deviceType) => (
                  <option key={deviceType} value={deviceType}>
                    {formatOptionLabel(deviceType)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="network-managed-review">
                Managed status
              </label>
              <select
                id="network-managed-review"
                className="field-input"
                value={draft.managed}
                onChange={(event) =>
                  onDraftChange({
                    ...draft,
                    managed: event.currentTarget.value as NetworkManagedReviewValue
                  })
                }
              >
                <option value="unspecified">Unspecified</option>
                <option value="managed">Managed</option>
                <option value="unmanaged">Unmanaged</option>
              </select>
            </div>
          </>
        ) : (
          <>
            <div>
              <div className="field-label">Manufacturer</div>
              <div className="text-sm text-slate-900">
                {manufacturer || "-"}
              </div>
            </div>
            <div>
              <div className="field-label">Model</div>
              <div className="text-sm text-slate-900">{model || "-"}</div>
            </div>
            <div>
              <div className="field-label">Device type</div>
              <div className="text-sm text-slate-900">
                {formatOptionLabel(draft.deviceType)}
              </div>
            </div>
            <div>
              <div className="field-label">Managed status</div>
              <div className="text-sm text-slate-900">
                {draft.managed === "unspecified"
                  ? "Unspecified"
                  : draft.managed === "managed"
                    ? "Managed"
                    : "Unmanaged"}
              </div>
            </div>
          </>
        )}
      </div>

      <NetworkPortTable
        ports={draft.ports}
        anchors={networkAnchors}
        editable={!readOnly}
        disabled={readOnly}
        onChange={(ports) => onDraftChange({ ...draft, ports })}
        onAdd={addPort}
      />

      {readOnly ? (
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
          Archived symbols are read-only.
        </div>
      ) : null}
    </section>
  );
}
