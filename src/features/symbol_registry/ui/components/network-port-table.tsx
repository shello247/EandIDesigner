"use client";

import { Plus, Trash2 } from "lucide-react";
import {
  networkPortMediaSchema,
  type SymbolAnchor
} from "../../data/schema";
import type { NetworkPortReviewDraft } from "../../logic/services/network-profile-review-draft";

function formatOptionLabel(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function NetworkPortTable({
  ports,
  anchors,
  editable,
  disabled,
  onChange,
  onAdd
}: {
  ports: NetworkPortReviewDraft[];
  anchors: SymbolAnchor[];
  editable: boolean;
  disabled: boolean;
  onChange: (ports: NetworkPortReviewDraft[]) => void;
  onAdd: () => void;
}) {
  const updatePort = (
    index: number,
    updates: Partial<NetworkPortReviewDraft>
  ) => {
    onChange(
      ports.map((port, portIndex) =>
        portIndex === index ? { ...port, ...updates } : port
      )
    );
  };

  const removePort = (index: number) => {
    onChange(ports.filter((_port, portIndex) => portIndex !== index));
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <h3 className="text-sm font-bold">Network Ports</h3>
          <p className="mt-1 text-xs text-slate-500">
            {ports.length} mapped port{ports.length === 1 ? "" : "s"}
          </p>
        </div>
        {editable ? (
          <button
            type="button"
            className="icon-button"
            onClick={onAdd}
            disabled={disabled}
          >
            <Plus aria-hidden="true" size={14} />
            Add network port
          </button>
        ) : null}
      </div>

      <div className="overflow-x-auto">
        <table
          className={[
            "data-table",
            editable ? "min-w-[920px]" : "min-w-[680px]"
          ].join(" ")}
        >
          <thead>
            <tr>
              <th>Port</th>
              <th>Label</th>
              <th>Anchor</th>
              <th>Media</th>
              <th>Speed Mbps</th>
              <th>Protocols</th>
              {editable ? <th aria-label="Actions" /> : null}
            </tr>
          </thead>
          <tbody>
            {ports.length === 0 ? (
              <tr>
                <td
                  colSpan={editable ? 7 : 6}
                  className="py-8 text-center text-sm text-slate-500"
                >
                  No ports are mapped. At least one valid port is required for
                  approval.
                </td>
              </tr>
            ) : (
              ports.map((port, index) =>
                editable ? (
                  <tr key={`${index}-${port.anchorKey}`}>
                    <td>
                      <input
                        className="field-input min-w-24"
                        aria-label={`Network port key ${port.key || index + 1}`}
                        value={port.key}
                        disabled={disabled}
                        onChange={(event) =>
                          updatePort(index, { key: event.currentTarget.value })
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="field-input min-w-36"
                        aria-label={`Network port label ${port.key || index + 1}`}
                        value={port.label}
                        disabled={disabled}
                        onChange={(event) =>
                          updatePort(index, { label: event.currentTarget.value })
                        }
                      />
                    </td>
                    <td>
                      <select
                        className="field-input min-w-28"
                        aria-label={`Network port anchor ${port.key || index + 1}`}
                        value={port.anchorKey}
                        disabled={disabled}
                        onChange={(event) =>
                          updatePort(index, {
                            anchorKey: event.currentTarget.value
                          })
                        }
                      >
                        <option value="">Select anchor</option>
                        {anchors.map((anchor) => (
                          <option key={anchor.key} value={anchor.key}>
                            {anchor.key}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        className="field-input min-w-28"
                        aria-label={`Network port media ${port.key || index + 1}`}
                        value={port.media}
                        disabled={disabled}
                        onChange={(event) =>
                          updatePort(index, {
                            media: event.currentTarget.value as NetworkPortReviewDraft["media"]
                          })
                        }
                      >
                        <option value="">Select media</option>
                        {networkPortMediaSchema.options.map((media) => (
                          <option key={media} value={media}>
                            {formatOptionLabel(media)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        className="field-input min-w-24"
                        inputMode="numeric"
                        aria-label={`Network port speed ${port.key || index + 1}`}
                        value={port.speedMbps}
                        disabled={disabled}
                        onChange={(event) =>
                          updatePort(index, {
                            speedMbps: event.currentTarget.value
                          })
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="field-input min-w-48"
                        aria-label={`Network port protocols ${port.key || index + 1}`}
                        value={port.protocolHints}
                        disabled={disabled}
                        onChange={(event) =>
                          updatePort(index, {
                            protocolHints: event.currentTarget.value
                          })
                        }
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Remove network port ${port.key || index + 1}`}
                        title="Remove network port"
                        disabled={disabled}
                        onClick={() => removePort(index)}
                      >
                        <Trash2 aria-hidden="true" size={14} />
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr key={`${port.key}-${port.anchorKey}`}>
                    <td className="font-bold">{port.key}</td>
                    <td>{port.label}</td>
                    <td>{port.anchorKey}</td>
                    <td>{formatOptionLabel(port.media)}</td>
                    <td>{port.speedMbps || "-"}</td>
                    <td>{port.protocolHints || "-"}</td>
                  </tr>
                )
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
