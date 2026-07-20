"use client";

import { useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  networkPortMediaSchema,
  type NetworkPortMedia,
  type SymbolAnchor
} from "@/features/symbol_registry/data/schema";
import type { SvgImportNetworkPortDraft } from "../../data/schema";

function optionLabel(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function nextPortKey(ports: SvgImportNetworkPortDraft[]): string {
  const keys = new Set(ports.map((port) => port.key.toUpperCase()));

  for (let index = 1; index <= ports.length + 20; index += 1) {
    const key = `PORT${index}`;
    if (!keys.has(key)) {
      return key;
    }
  }

  return `PORT${Date.now()}`;
}

export function NetworkPortEditor({
  anchors,
  ports,
  disabled,
  onChange
}: {
  anchors: SymbolAnchor[];
  ports: SvgImportNetworkPortDraft[];
  disabled: boolean;
  onChange: (ports: SvgImportNetworkPortDraft[]) => void;
}) {
  const networkAnchors = useMemo(
    () => anchors.filter((anchor) => anchor.kind === "network_port"),
    [anchors]
  );

  const addPort = () => {
    const key = nextPortKey(ports);
    const usedAnchors = new Set(ports.map((port) => port.anchorKey));
    const anchorKey =
      networkAnchors.find((anchor) => !usedAnchors.has(anchor.key))?.key ??
      networkAnchors[0]?.key ??
      "";

    onChange([
      ...ports,
      {
        key,
        label: key,
        anchorKey,
        media: "",
        speedMbps: "",
        protocolHints: ""
      }
    ]);
  };

  return (
    <section className="tool-panel overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-bold">Network Ports</h2>
        <button
          type="button"
          className="icon-button"
          onClick={addPort}
          disabled={disabled}
        >
          <Plus aria-hidden="true" size={14} />
          Add port
        </button>
      </div>
      <div className="overflow-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Key</th>
              <th>Label</th>
              <th>Anchor</th>
              <th>Media</th>
              <th>Speed Mbps</th>
              <th>Protocols</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {ports.map((port, index) => {
              const anchorExists = networkAnchors.some(
                (anchor) => anchor.key === port.anchorKey
              );

              return (
                <tr key={`${port.key}-${index}`}>
                  <td>
                    <input
                      aria-label={`Network port key ${index + 1}`}
                      className="field-input min-w-24"
                      value={port.key}
                      disabled={disabled}
                      onChange={(event) =>
                        onChange(
                          ports.map((item, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...item,
                                  key: event.currentTarget.value.toUpperCase()
                                }
                              : item
                          )
                        )
                      }
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`Network port label ${port.key}`}
                      className="field-input min-w-32"
                      value={port.label}
                      disabled={disabled}
                      onChange={(event) =>
                        onChange(
                          ports.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, label: event.currentTarget.value }
                              : item
                          )
                        )
                      }
                    />
                  </td>
                  <td>
                    <select
                      aria-label={`Network port anchor ${port.key}`}
                      className="field-input min-w-28"
                      value={port.anchorKey}
                      disabled={disabled}
                      onChange={(event) =>
                        onChange(
                          ports.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, anchorKey: event.currentTarget.value }
                              : item
                          )
                        )
                      }
                    >
                      {!anchorExists && port.anchorKey ? (
                        <option value={port.anchorKey}>
                          Missing: {port.anchorKey}
                        </option>
                      ) : null}
                      {networkAnchors.map((anchor) => (
                        <option key={anchor.key} value={anchor.key}>
                          {anchor.key}
                        </option>
                      ))}
                      {networkAnchors.length === 0 ? (
                        <option value="">No network anchors</option>
                      ) : null}
                    </select>
                  </td>
                  <td>
                    <select
                      aria-label={`Network port media ${port.key}`}
                      className="field-input min-w-28"
                      value={port.media}
                      disabled={disabled}
                      onChange={(event) =>
                        onChange(
                          ports.map((item, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...item,
                                  media: event.currentTarget
                                    .value as NetworkPortMedia | ""
                                }
                              : item
                          )
                        )
                      }
                    >
                      <option value="">Select media</option>
                      {networkPortMediaSchema.options.map((media) => (
                        <option key={media} value={media}>
                          {optionLabel(media)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      aria-label={`Network port speed ${port.key}`}
                      className="field-input min-w-28"
                      inputMode="numeric"
                      value={port.speedMbps}
                      disabled={disabled}
                      onChange={(event) =>
                        onChange(
                          ports.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, speedMbps: event.currentTarget.value }
                              : item
                          )
                        )
                      }
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`Network port protocols ${port.key}`}
                      className="field-input min-w-44"
                      value={port.protocolHints}
                      disabled={disabled}
                      onChange={(event) =>
                        onChange(
                          ports.map((item, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...item,
                                  protocolHints: event.currentTarget.value
                                }
                              : item
                          )
                        )
                      }
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="icon-button icon-button-danger"
                      aria-label={`Remove network port ${port.key}`}
                      title={`Remove network port ${port.key}`}
                      disabled={disabled}
                      onClick={() =>
                        onChange(
                          ports.filter((_item, itemIndex) => itemIndex !== index)
                        )
                      }
                    >
                      <Trash2 aria-hidden="true" size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {ports.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-slate-500">
                  No network ports defined.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
