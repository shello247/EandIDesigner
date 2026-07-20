"use client";

import { useState, type KeyboardEvent } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import {
  MAX_NETWORK_NODE_SCALE,
  MIN_NETWORK_NODE_SCALE,
  type NetworkMapNode,
  type NetworkMapZone,
  type NetworkNodeEditableUpdates
} from "../../data/schema";
import type { ApprovedNetworkSymbol } from "../../types";

function CommitTextField({
  id,
  label,
  value,
  placeholder,
  required,
  onCommit
}: {
  id: string;
  label: string;
  value: string | undefined;
  placeholder?: string;
  required?: boolean;
  onCommit: (value: string) => boolean;
}) {
  const [draft, setDraft] = useState(value ?? "");

  const commit = () => {
    const nextValue = draft.trim();

    if ((required && !nextValue) || !onCommit(nextValue)) {
      setDraft(value ?? "");
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
      event.currentTarget.blur();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setDraft(value ?? "");
      event.currentTarget.blur();
    }
  };

  return (
    <div>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="field-input"
        value={draft}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}

function CommitNumberField({
  id,
  label,
  value,
  min,
  max,
  step,
  optional,
  onCommit
}: {
  id: string;
  label: string;
  value: number | undefined;
  min: number;
  max: number;
  step: number;
  optional?: boolean;
  onCommit: (value: number | undefined) => boolean;
}) {
  const formattedValue = value === undefined ? "" : String(value);
  const [draft, setDraft] = useState(formattedValue);

  const commit = () => {
    if (optional && !draft.trim()) {
      if (!onCommit(undefined)) {
        setDraft(formattedValue);
      }
      return;
    }

    const nextValue = Number(draft);

    if (
      !Number.isFinite(nextValue) ||
      nextValue < min ||
      nextValue > max ||
      !onCommit(nextValue)
    ) {
      setDraft(formattedValue);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
      event.currentTarget.blur();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setDraft(formattedValue);
      event.currentTarget.blur();
    }
  };

  return (
    <div>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type="number"
        className="field-input"
        value={draft}
        min={min}
        max={max}
        step={step}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}

export function NetworkNodePropertiesPanel({
  node,
  symbol,
  zones,
  onNodeChange,
  onNodeDelete
}: {
  node: NetworkMapNode;
  symbol?: ApprovedNetworkSymbol;
  zones: NetworkMapZone[];
  onNodeChange: (updates: NetworkNodeEditableUpdates) => boolean;
  onNodeDelete: () => void;
}) {
  const commit = <Key extends keyof NetworkNodeEditableUpdates>(
    key: Key,
    value: NetworkNodeEditableUpdates[Key]
  ) => onNodeChange({ [key]: value } as NetworkNodeEditableUpdates);

  return (
    <section className="tool-panel overflow-hidden" data-testid="network-node-properties">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-bold">Selected Device</h2>
        <p className="mt-1 truncate text-xs font-semibold text-slate-500">
          {symbol?.displayName ?? node.tag}
        </p>
      </div>
      <div className="space-y-4 p-4">
        {!symbol ? (
          <div
            className="flex gap-2 rounded border border-red-200 bg-red-50 p-2.5 text-xs text-red-800"
            data-testid="network-node-missing-warning"
          >
            <AlertTriangle aria-hidden="true" className="mt-0.5 shrink-0" size={14} />
            <span>
              This historical symbol version is unavailable. The node remains
              editable and will print as a controlled placeholder.
            </span>
          </div>
        ) : null}

        <CommitTextField
          key={`tag-${node.id}-${node.tag}`}
          id="network-node-tag"
          label="Tag"
          value={node.tag}
          required
          onCommit={(value) => commit("tag", value)}
        />
        <CommitTextField
          key={`label-${node.id}-${node.label ?? ""}`}
          id="network-node-label"
          label="Label"
          value={node.label}
          placeholder="Optional device label"
          onCommit={(value) => commit("label", value)}
        />
        <CommitTextField
          key={`ip-${node.id}-${node.ipAddress ?? ""}`}
          id="network-node-ip-address"
          label="IP address"
          value={node.ipAddress}
          placeholder="Optional address or hostname"
          onCommit={(value) => commit("ipAddress", value)}
        />
        <CommitNumberField
          key={`vlan-${node.id}-${node.vlanId ?? ""}`}
          id="network-node-vlan"
          label="VLAN"
          value={node.vlanId}
          min={1}
          max={4094}
          step={1}
          optional
          onCommit={(value) => commit("vlanId", value)}
        />
        <div>
          <label className="field-label" htmlFor="network-node-zone">
            Zone
          </label>
          <select
            id="network-node-zone"
            className="field-input"
            value={node.zoneId ?? ""}
            onChange={(event) => commit("zoneId", event.currentTarget.value)}
          >
            <option value="">Unassigned</option>
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <CommitNumberField
            key={`rotation-${node.id}-${node.rotation}`}
            id="network-node-rotation"
            label="Rotation"
            value={node.rotation}
            min={-3600}
            max={3600}
            step={15}
            onCommit={(value) => commit("rotation", value)}
          />
          <CommitNumberField
            key={`scale-${node.id}-${node.scale}`}
            id="network-node-scale"
            label="Scale"
            value={node.scale}
            min={MIN_NETWORK_NODE_SCALE}
            max={MAX_NETWORK_NODE_SCALE}
            step={0.05}
            onCommit={(value) => commit("scale", value)}
          />
        </div>

        <dl className="grid gap-2 border-t border-slate-200 pt-3 text-[11px]">
          <div>
            <dt className="text-slate-400">Device type</dt>
            <dd className="font-medium text-slate-700">{node.deviceType}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Version ID</dt>
            <dd className="break-all font-mono text-slate-600">{node.versionId}</dd>
          </div>
        </dl>

        <button
          type="button"
          className="icon-button icon-button-danger"
          onClick={onNodeDelete}
        >
          <Trash2 aria-hidden="true" size={14} />
          Delete device
        </button>
      </div>
    </section>
  );
}
