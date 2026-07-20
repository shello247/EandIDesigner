"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Save } from "lucide-react";
import { updateSymbolNetworkProfileAction } from "../../api/actions";
import {
  networkDeviceTypeSchema,
  type NetworkDeviceType,
  type SymbolAnchor,
  type SymbolNetworkProfile
} from "../../data/schema";
import {
  buildNetworkProfileFromReviewDraft,
  createEmptyNetworkPortReviewDraft,
  createNetworkProfileReviewDraft,
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
  versionId,
  manufacturer,
  model,
  profile,
  anchors,
  editable
}: {
  versionId: string;
  manufacturer?: string | null;
  model?: string | null;
  profile?: SymbolNetworkProfile;
  anchors: SymbolAnchor[];
  editable: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [manufacturerDraft, setManufacturerDraft] = useState(manufacturer ?? "");
  const [modelDraft, setModelDraft] = useState(model ?? "");
  const [draft, setDraft] = useState<NetworkProfileReviewDraft>(() =>
    createNetworkProfileReviewDraft(profile)
  );
  const [message, setMessage] = useState<string | null>(null);
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

    setDraft((current) => ({
      ...current,
      ports: [
        ...current.ports,
        createEmptyNetworkPortReviewDraft({
          key,
          anchorKey: availableAnchor?.key ?? ""
        })
      ]
    }));
  };

  const save = () => {
    setMessage(null);

    let networkProfile: SymbolNetworkProfile;
    try {
      networkProfile = buildNetworkProfileFromReviewDraft(draft);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Network profile is invalid."
      );
      return;
    }

    startTransition(async () => {
      const result = await updateSymbolNetworkProfileAction({
        versionId,
        manufacturer: manufacturerDraft,
        model: modelDraft,
        networkProfile
      });

      if (!result.ok) {
        setMessage(result.error);
        return;
      }

      setMessage("Network profile updated. Validation was refreshed.");
      router.refresh();
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
        {editable ? (
          <>
            <div>
              <label className="field-label" htmlFor="network-manufacturer">
                Manufacturer
              </label>
              <input
                id="network-manufacturer"
                className="field-input"
                value={manufacturerDraft}
                disabled={isPending}
                onChange={(event) =>
                  setManufacturerDraft(event.currentTarget.value)
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
                value={modelDraft}
                disabled={isPending}
                onChange={(event) => setModelDraft(event.currentTarget.value)}
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
                disabled={isPending}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    deviceType: event.currentTarget.value as NetworkDeviceType
                  }))
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
                disabled={isPending}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    managed: event.currentTarget.value as NetworkManagedReviewValue
                  }))
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
              <div className="text-sm text-slate-900">{manufacturer || "-"}</div>
            </div>
            <div>
              <div className="field-label">Model</div>
              <div className="text-sm text-slate-900">{model || "-"}</div>
            </div>
            <div>
              <div className="field-label">Device type</div>
              <div className="text-sm text-slate-900">
                {profile ? formatOptionLabel(profile.deviceType) : "-"}
              </div>
            </div>
            <div>
              <div className="field-label">Managed status</div>
              <div className="text-sm text-slate-900">
                {profile?.managed === undefined
                  ? "Unspecified"
                  : profile.managed
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
        editable={editable}
        disabled={isPending}
        onChange={(ports) => setDraft((current) => ({ ...current, ports }))}
        onAdd={addPort}
      />

      {message ? (
        <div
          className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700"
          role="status"
        >
          {message}
        </div>
      ) : null}

      {editable ? (
        <div className="border-t border-slate-200 p-4">
          <button
            type="button"
            className="icon-button icon-button-primary w-full justify-center"
            disabled={isPending}
            onClick={save}
          >
            <Save aria-hidden="true" size={14} />
            Save network profile
          </button>
        </div>
      ) : (
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
          Approved and archived versions are read-only.
        </div>
      )}
    </section>
  );
}
