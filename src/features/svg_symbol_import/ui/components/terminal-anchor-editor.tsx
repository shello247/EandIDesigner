"use client";

import { Plus, Trash2 } from "lucide-react";
import type {
  AnchorKind,
  SymbolAnchor,
  SymbolTerminal
} from "@/features/symbol_registry/data/schema";
import type { SvgViewBox } from "@/shared/svg/svg-inspector";

const anchorKindOptions: AnchorKind[] = [
  "terminal",
  "network_port",
  "ground",
  "shield",
  "label",
  "mounting",
  "other"
];

function nextKey(items: Array<{ key: string }>, prefix: string): string {
  const keys = new Set(items.map((item) => item.key));

  for (let index = 1; index <= items.length + 20; index += 1) {
    const candidate = `${prefix}${index}`;
    if (!keys.has(candidate)) {
      return candidate;
    }
  }

  return `${prefix}${Date.now()}`;
}

export function TerminalAnchorEditor({
  viewBox,
  anchors,
  terminals,
  disabled,
  onAnchorsChange,
  onTerminalsChange,
  onAnchorRenamed
}: {
  viewBox: SvgViewBox;
  anchors: SymbolAnchor[];
  terminals: SymbolTerminal[];
  disabled: boolean;
  onAnchorsChange: (anchors: SymbolAnchor[]) => void;
  onTerminalsChange: (terminals: SymbolTerminal[]) => void;
  onAnchorRenamed?: (previousKey: string, nextKey: string) => void;
}) {
  const addAnchor = () => {
    const key = nextKey(anchors, "A");
    onAnchorsChange([
      ...anchors,
      {
        key,
        x: Number((viewBox.x + viewBox.width / 2).toFixed(2)),
        y: Number((viewBox.y + viewBox.height / 2).toFixed(2)),
        kind: "terminal"
      }
    ]);
  };

  const addTerminal = () => {
    const key = nextKey(terminals, "T");
    onTerminalsChange([
      ...terminals,
      {
        key,
        label: key,
        function: "",
        anchorKey: anchors[0]?.key ?? "",
        requiredForWiring: true
      }
    ]);
  };

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <section className="tool-panel overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-bold">Anchors</h2>
          <button
            type="button"
            className="icon-button"
            onClick={addAnchor}
            disabled={disabled}
          >
            <Plus aria-hidden="true" size={14} />
            Add anchor
          </button>
        </div>
        <div className="overflow-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Key</th>
                <th>Kind</th>
                <th>X</th>
                <th>Y</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {anchors.map((anchor, index) => (
                <tr key={`${anchor.key}-${index}`}>
                  <td>
                    <input
                      aria-label={`Anchor key ${index + 1}`}
                      className="field-input min-w-24"
                      value={anchor.key}
                      disabled={disabled}
                      onChange={(event) => {
                        const previousKey = anchor.key;
                        const nextKey =
                          anchor.kind === "network_port"
                            ? event.currentTarget.value.toUpperCase()
                            : event.currentTarget.value;
                        const nextAnchor = {
                          ...anchor,
                          key: nextKey
                        };
                        onAnchorsChange(
                          anchors.map((item, itemIndex) =>
                            itemIndex === index ? nextAnchor : item
                          )
                        );
                        onTerminalsChange(
                          terminals.map((terminal) =>
                            terminal.anchorKey === previousKey
                              ? {
                                  ...terminal,
                                  anchorKey: nextAnchor.key
                                }
                              : terminal
                          )
                        );
                        onAnchorRenamed?.(previousKey, nextKey);
                      }}
                    />
                  </td>
                  <td>
                    <select
                      aria-label={`Anchor kind ${anchor.key}`}
                      className="field-input min-w-28"
                      value={anchor.kind}
                      disabled={disabled}
                      onChange={(event) => {
                        const nextKind = event.currentTarget.value as AnchorKind;
                        const nextKey =
                          nextKind === "network_port"
                            ? anchor.key.toUpperCase()
                            : anchor.key;

                        onAnchorsChange(
                          anchors.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, key: nextKey, kind: nextKind }
                              : item
                          )
                        );

                        if (nextKey !== anchor.key) {
                          onTerminalsChange(
                            terminals.map((terminal) =>
                              terminal.anchorKey === anchor.key
                                ? { ...terminal, anchorKey: nextKey }
                                : terminal
                            )
                          );
                          onAnchorRenamed?.(anchor.key, nextKey);
                        }
                      }}
                    >
                      {anchorKindOptions.map((kind) => (
                        <option key={kind} value={kind}>
                          {kind}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      aria-label={`Anchor x ${anchor.key}`}
                      className="field-input min-w-24"
                      type="number"
                      value={anchor.x}
                      disabled={disabled}
                      onChange={(event) =>
                        onAnchorsChange(
                          anchors.map((item, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...item,
                                  x: Number(event.currentTarget.value)
                                }
                              : item
                          )
                        )
                      }
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`Anchor y ${anchor.key}`}
                      className="field-input min-w-24"
                      type="number"
                      value={anchor.y}
                      disabled={disabled}
                      onChange={(event) =>
                        onAnchorsChange(
                          anchors.map((item, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...item,
                                  y: Number(event.currentTarget.value)
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
                      aria-label={`Remove anchor ${anchor.key}`}
                      disabled={disabled}
                      onClick={() =>
                        onAnchorsChange(
                          anchors.filter((_item, itemIndex) => itemIndex !== index)
                        )
                      }
                    >
                      <Trash2 aria-hidden="true" size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {anchors.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-slate-500">
                    No anchors defined.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="tool-panel overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-bold">Terminals</h2>
          <button
            type="button"
            className="icon-button"
            onClick={addTerminal}
            disabled={disabled}
          >
            <Plus aria-hidden="true" size={14} />
            Add terminal
          </button>
        </div>
        <div className="overflow-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Key</th>
                <th>Label</th>
                <th>Function</th>
                <th>Anchor</th>
                <th>Required</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {terminals.map((terminal, index) => (
                <tr key={`${terminal.key}-${index}`}>
                  <td>
                    <input
                      aria-label={`Terminal key ${index + 1}`}
                      className="field-input min-w-24"
                      value={terminal.key}
                      disabled={disabled}
                      onChange={(event) =>
                        onTerminalsChange(
                          terminals.map((item, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...item,
                                  key: event.currentTarget.value
                                }
                              : item
                          )
                        )
                      }
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`Terminal label ${terminal.key}`}
                      className="field-input min-w-36"
                      value={terminal.label}
                      disabled={disabled}
                      onChange={(event) =>
                        onTerminalsChange(
                          terminals.map((item, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...item,
                                  label: event.currentTarget.value
                                }
                              : item
                          )
                        )
                      }
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`Terminal function ${terminal.key}`}
                      className="field-input min-w-44"
                      value={terminal.function ?? ""}
                      disabled={disabled}
                      onChange={(event) =>
                        onTerminalsChange(
                          terminals.map((item, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...item,
                                  function: event.currentTarget.value
                                }
                              : item
                          )
                        )
                      }
                    />
                  </td>
                  <td>
                    <select
                      aria-label={`Terminal anchor ${terminal.key}`}
                      className="field-input min-w-36"
                      value={terminal.anchorKey}
                      disabled={disabled}
                      onChange={(event) =>
                        onTerminalsChange(
                          terminals.map((item, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...item,
                                  anchorKey: event.currentTarget.value
                                }
                              : item
                          )
                        )
                      }
                    >
                      {anchors.map((anchor) => (
                        <option key={anchor.key} value={anchor.key}>
                          {anchor.key}
                        </option>
                      ))}
                      {anchors.length === 0 ? <option value="">No anchors</option> : null}
                    </select>
                  </td>
                  <td>
                    <input
                      aria-label={`Terminal required ${terminal.key}`}
                      type="checkbox"
                      checked={terminal.requiredForWiring}
                      disabled={disabled}
                      onChange={(event) =>
                        onTerminalsChange(
                          terminals.map((item, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...item,
                                  requiredForWiring: event.currentTarget.checked
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
                      aria-label={`Remove terminal ${terminal.key}`}
                      disabled={disabled}
                      onClick={() =>
                        onTerminalsChange(
                          terminals.filter(
                            (_item, itemIndex) => itemIndex !== index
                          )
                        )
                      }
                    >
                      <Trash2 aria-hidden="true" size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {terminals.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-slate-500">
                    No terminals defined.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
