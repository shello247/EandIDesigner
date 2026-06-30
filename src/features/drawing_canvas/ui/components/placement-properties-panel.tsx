"use client";

import { RefreshCw, Trash2 } from "lucide-react";
import type {
  DrawingConnection,
  DrawingModel
} from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import {
  getConnectionLabel,
  getSymbolForPlacement
} from "../../logic/services/drawing-connections";
import { getConnectionTransitionGroups } from "../../logic/services/drawing-connection-groups";
import {
  deriveWireId,
  getConnectionWireId,
  getReadableConnectionName
} from "../../logic/services/drawing-identification";

function placementAnchorOptions(
  placementId: string,
  model: DrawingModel,
  symbols: ApprovedDrawingSymbol[]
) {
  const placement = model.placements.find((item) => item.id === placementId);
  const symbol = getSymbolForPlacement(placement, symbols);

  return symbol?.metadata.anchors ?? [];
}

function firstAnchorForPlacement(
  placementId: string,
  model: DrawingModel,
  symbols: ApprovedDrawingSymbol[]
) {
  return placementAnchorOptions(placementId, model, symbols)[0]?.key ?? "";
}

export function PlacementPropertiesPanel({
  title,
  model,
  symbols,
  onTitleChange,
  selectedConnectionId,
  onConnectionSelect,
  onConnectionChange,
  onConnectionRemove,
  onConnectionRouteReset
}: {
  title: string;
  model: DrawingModel;
  symbols: ApprovedDrawingSymbol[];
  onTitleChange: (title: string) => void;
  selectedConnectionId?: string;
  onConnectionSelect: (connectionId: string | undefined) => void;
  onConnectionChange: (
    connectionId: string,
    updates: Partial<DrawingConnection>
  ) => void;
  onConnectionRemove: (connectionId: string) => void;
  onConnectionRouteReset: (connectionId: string) => void;
}) {
  return (
    <div className="space-y-5">
      <section className="tool-panel overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-bold">Drawing Properties</h2>
        </div>
        <div className="space-y-3 p-4">
          <div>
            <label className="field-label" htmlFor="drawing-title">
              Title
            </label>
            <input
              id="drawing-title"
              className="field-input"
              value={title}
              onChange={(event) => onTitleChange(event.currentTarget.value)}
            />
          </div>
        </div>
      </section>

      <ConnectionEditor
        model={model}
        symbols={symbols}
        selectedConnectionId={selectedConnectionId}
        onConnectionSelect={onConnectionSelect}
        onConnectionChange={onConnectionChange}
        onConnectionRemove={onConnectionRemove}
        onConnectionRouteReset={onConnectionRouteReset}
      />
    </div>
  );
}

function ConnectionEditor({
  model,
  symbols,
  selectedConnectionId,
  onConnectionSelect,
  onConnectionChange,
  onConnectionRemove,
  onConnectionRouteReset
}: {
  model: DrawingModel;
  symbols: ApprovedDrawingSymbol[];
  selectedConnectionId?: string;
  onConnectionSelect: (connectionId: string | undefined) => void;
  onConnectionChange: (
    connectionId: string,
    updates: Partial<DrawingConnection>
  ) => void;
  onConnectionRemove: (connectionId: string) => void;
  onConnectionRouteReset: (connectionId: string) => void;
}) {
  const selectedConnection = model.connections.find(
    (connection) => connection.id === selectedConnectionId
  );
  const selectedRoute = selectedConnection?.route;
  const transitionGroups = getConnectionTransitionGroups(model, symbols);
  const cablePlacements = model.placements.filter(
    (placement) => placement.role === "cable_assembly"
  );
  const conductorOptions = selectedConnection?.cablePlacementId
    ? conductorOptionsForPlacement(
        selectedConnection.cablePlacementId,
        model,
        symbols
      )
    : [];

  const updateEndpoint = (
    connection: DrawingConnection,
    endpointName: "from" | "to",
    placementId: string
  ) => {
    onConnectionChange(connection.id, {
      [endpointName]: {
        placementId,
        anchorKey: firstAnchorForPlacement(placementId, model, symbols)
      }
    });
  };
  const regenerateWireId = (connection: DrawingConnection) => {
    onConnectionChange(connection.id, {
      wireId: deriveWireId(model, symbols, connection) ?? undefined
    });
  };

  return (
    <section className="tool-panel overflow-hidden">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-bold">Connections</h2>
      </div>
      <div className="space-y-4 p-4">
        {model.connections.length > 0 ? (
          <div className="max-h-72 space-y-3 overflow-auto pr-1 text-xs">
            {transitionGroups.map((group) => (
              <div
                key={group.id}
                data-testid="drawing-connection-group"
                className="rounded-md border border-slate-200 bg-slate-50/70 p-2"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="font-bold text-slate-900">{group.title}</div>
                  <div className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500 ring-1 ring-slate-200">
                    {group.connectionCount}
                  </div>
                </div>
                <div className="space-y-1.5">
                  {group.connections.map((connection) => {
                    const isSelected = selectedConnectionId === connection.id;
                    const wireId = getConnectionWireId(model, symbols, connection);

                    return (
                      <button
                        type="button"
                        key={connection.id}
                        data-testid="drawing-connection-card"
                        className={[
                          "w-full rounded-md border px-2.5 py-2 text-left transition",
                          isSelected
                            ? "border-sky-300 bg-sky-50"
                            : "border-slate-200 bg-white hover:border-teal-200 hover:bg-teal-50"
                        ].join(" ")}
                        onClick={() => onConnectionSelect(connection.id)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-950">
                            {wireId ??
                              getReadableConnectionName(model, symbols, connection)}
                          </span>
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                            {connection.route?.mode ?? "auto"}
                          </span>
                        </div>
                        <div className="mt-1 text-slate-500">
                          {getConnectionLabel(model, connection)}
                        </div>
                        {connection.conductorKey ? (
                          <div className="mt-1 text-[11px] text-slate-400">
                            Conductor: {connection.conductorKey}
                          </div>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-slate-500">
            No connections yet. Use Connect Mode to link anchors.
          </div>
        )}

        {selectedConnection ? (
          <div className="space-y-3 border-t border-slate-200 pt-4">
            <div>
              <label className="field-label" htmlFor="connection-label">
                Label
              </label>
              <input
                id="connection-label"
                className="field-input"
                value={selectedConnection.label ?? ""}
                onChange={(event) =>
                  onConnectionChange(selectedConnection.id, {
                    label: event.currentTarget.value || undefined
                  })
                }
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <label className="field-label mb-0" htmlFor="connection-wire-id">
                  Wire ID
                </label>
                <button
                  type="button"
                  className="text-[11px] font-semibold text-teal-700 hover:text-teal-900"
                  onClick={() => regenerateWireId(selectedConnection)}
                >
                  Regenerate wire ID
                </button>
              </div>
              <input
                id="connection-wire-id"
                className="field-input"
                value={selectedConnection.wireId ?? ""}
                onChange={(event) =>
                  onConnectionChange(selectedConnection.id, {
                    wireId: event.currentTarget.value || undefined
                  })
                }
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Example: C-101-WHT. Wire IDs are schedule-ready and can be
                overridden.
              </p>
            </div>

            <EndpointEditor
              idPrefix="connection-from"
              label="From"
              endpoint={selectedConnection.from}
              model={model}
              symbols={symbols}
              onPlacementChange={(placementId) =>
                updateEndpoint(selectedConnection, "from", placementId)
              }
              onAnchorChange={(anchorKey) =>
                onConnectionChange(selectedConnection.id, {
                  from: { ...selectedConnection.from, anchorKey }
                })
              }
            />

            <EndpointEditor
              idPrefix="connection-to"
              label="To"
              endpoint={selectedConnection.to}
              model={model}
              symbols={symbols}
              onPlacementChange={(placementId) =>
                updateEndpoint(selectedConnection, "to", placementId)
              }
              onAnchorChange={(anchorKey) =>
                onConnectionChange(selectedConnection.id, {
                  to: { ...selectedConnection.to, anchorKey }
                })
              }
            />

            <div>
              <label className="field-label" htmlFor="connection-cable">
                Cable assembly
              </label>
              <select
                id="connection-cable"
                className="field-input"
                value={selectedConnection.cablePlacementId ?? ""}
                onChange={(event) =>
                  onConnectionChange(selectedConnection.id, {
                    cablePlacementId: event.currentTarget.value || undefined
                  })
                }
              >
                <option value="">No cable assembly</option>
                {cablePlacements.map((placement) => (
                  <option key={placement.id} value={placement.id}>
                    {placement.tag}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="field-label" htmlFor="connection-conductor">
                Conductor key
              </label>
              <input
                id="connection-conductor"
                className="field-input"
                list="connection-conductor-options"
                value={selectedConnection.conductorKey ?? ""}
                onChange={(event) =>
                  onConnectionChange(selectedConnection.id, {
                    conductorKey: event.currentTarget.value || undefined
                  })
                }
              />
              <datalist id="connection-conductor-options">
                {conductorOptions.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </div>

            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold text-slate-950">
                    Route
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {selectedRoute
                      ? `${selectedRoute.mode} / ${selectedRoute.style}`
                      : "Generated fallback until saved"}
                  </div>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => onConnectionRouteReset(selectedConnection.id)}
                >
                  <RefreshCw aria-hidden="true" size={14} />
                  Reset route
                </button>
              </div>

              {selectedRoute ? (
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
                  <div>
                    <label className="field-label" htmlFor="connection-route-mode">
                      Mode
                    </label>
                    <select
                      id="connection-route-mode"
                      className="field-input"
                      value={selectedRoute.mode}
                      onChange={(event) =>
                        onConnectionChange(selectedConnection.id, {
                          route: {
                            ...selectedRoute,
                            mode: event.currentTarget.value as "manual" | "auto"
                          }
                        })
                      }
                    >
                      <option value="manual">Manual</option>
                      <option value="auto">Auto</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-2 pb-2 text-xs font-semibold text-slate-600">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedRoute.locked)}
                      onChange={(event) =>
                        onConnectionChange(selectedConnection.id, {
                          route: {
                            ...selectedRoute,
                            locked: event.currentTarget.checked || undefined
                          }
                        })
                      }
                    />
                    Locked
                  </label>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              className="icon-button icon-button-danger"
              onClick={() => onConnectionRemove(selectedConnection.id)}
            >
              <Trash2 aria-hidden="true" size={14} />
              Delete connection
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function EndpointEditor({
  idPrefix,
  label,
  endpoint,
  model,
  symbols,
  onPlacementChange,
  onAnchorChange
}: {
  idPrefix: string;
  label: string;
  endpoint: DrawingConnection["from"];
  model: DrawingModel;
  symbols: ApprovedDrawingSymbol[];
  onPlacementChange: (placementId: string) => void;
  onAnchorChange: (anchorKey: string) => void;
}) {
  const anchors = placementAnchorOptions(endpoint.placementId, model, symbols);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_112px] gap-3">
      <div>
        <label className="field-label" htmlFor={`${idPrefix}-placement`}>
          {label} placement
        </label>
        <select
          id={`${idPrefix}-placement`}
          className="field-input"
          value={endpoint.placementId}
          onChange={(event) => onPlacementChange(event.currentTarget.value)}
        >
          {model.placements.map((placement) => (
            <option key={placement.id} value={placement.id}>
              {placement.tag}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="field-label" htmlFor={`${idPrefix}-anchor`}>
          Anchor
        </label>
        <select
          id={`${idPrefix}-anchor`}
          className="field-input"
          value={endpoint.anchorKey}
          onChange={(event) => onAnchorChange(event.currentTarget.value)}
        >
          {anchors.map((anchor) => (
            <option key={anchor.key} value={anchor.key}>
              {anchor.key}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function conductorOptionsForPlacement(
  placementId: string,
  model: DrawingModel,
  symbols: ApprovedDrawingSymbol[]
): string[] {
  const placement = model.placements.find((item) => item.id === placementId);
  const symbol = getSymbolForPlacement(placement, symbols);
  const values = new Set<string>();

  for (const terminal of symbol?.metadata.terminals ?? []) {
    values.add(terminal.key);
    values.add(terminal.anchorKey);
  }

  for (const anchor of symbol?.metadata.anchors ?? []) {
    values.add(anchor.key);
  }

  return [...values].sort();
}
