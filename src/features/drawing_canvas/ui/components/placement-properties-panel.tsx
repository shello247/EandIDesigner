"use client";

import { useState } from "react";
import { ChevronRight, RefreshCw, Trash2 } from "lucide-react";
import type {
  DrawingAnnotation,
  DrawingConnection,
  DrawingModel
} from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import { getAnnotationSize } from "../../logic/services/drawing-annotations";
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
  onTitleBlockChange,
  selectedConnectionId,
  selectedAnnotationId,
  onConnectionSelect,
  onConnectionChange,
  onConnectionRemove,
  onConnectionRouteReset,
  onAnnotationChange,
  onAnnotationRemove
}: {
  title: string;
  model: DrawingModel;
  symbols: ApprovedDrawingSymbol[];
  onTitleChange: (title: string) => void;
  onTitleBlockChange: (
    updates: Partial<DrawingModel["sheet"]["titleBlock"]>
  ) => void;
  selectedConnectionId?: string;
  selectedAnnotationId?: string;
  onConnectionSelect: (connectionId: string | undefined) => void;
  onConnectionChange: (
    connectionId: string,
    updates: Partial<DrawingConnection>
  ) => void;
  onConnectionRemove: (connectionId: string) => void;
  onConnectionRouteReset: (connectionId: string) => void;
  onAnnotationChange: (
    annotationId: string,
    updates: Partial<DrawingAnnotation>
  ) => void;
  onAnnotationRemove: (annotationId: string) => void;
}) {
  const selectedAnnotation = model.annotations.find(
    (annotation) => annotation.id === selectedAnnotationId
  );

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

      <TitleBlockEditor
        titleBlock={model.sheet.titleBlock}
        onTitleBlockChange={onTitleBlockChange}
      />

      <SelectedNoteEditor
        annotation={selectedAnnotation}
        onAnnotationChange={onAnnotationChange}
        onAnnotationRemove={onAnnotationRemove}
      />

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

const titleBlockFields: Array<{
  key: keyof DrawingModel["sheet"]["titleBlock"];
  label: string;
  placeholder: string;
}> = [
  { key: "client", label: "Client", placeholder: "Enermach" },
  {
    key: "project",
    label: "Project / process",
    placeholder: "Pumping Skid Control Panel"
  },
  {
    key: "drawingNumber",
    label: "Drawing number",
    placeholder: "EI-001"
  },
  { key: "revision", label: "Revision", placeholder: "A" },
  {
    key: "preparedBy",
    label: "Prepared by",
    placeholder: "Designer name"
  },
  {
    key: "checkedBy",
    label: "Checked by",
    placeholder: "Engineer name"
  },
  { key: "date", label: "Date", placeholder: "2026-07-01" }
];

function TitleBlockEditor({
  titleBlock,
  onTitleBlockChange
}: {
  titleBlock: DrawingModel["sheet"]["titleBlock"];
  onTitleBlockChange: (
    updates: Partial<DrawingModel["sheet"]["titleBlock"]>
  ) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <section className="tool-panel overflow-hidden">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 text-left transition hover:bg-slate-50"
        aria-expanded={isExpanded}
        aria-controls="drawing-title-block-editor"
        onClick={() => setIsExpanded((current) => !current)}
      >
        <span>
          <span className="block text-sm font-bold text-slate-950">
            Title Block
          </span>
          <span className="mt-0.5 block text-xs text-slate-500">
            Bottom-right sheet information
          </span>
        </span>
        <ChevronRight
          aria-hidden="true"
          size={16}
          className={[
            "shrink-0 text-slate-400 transition-transform",
            isExpanded ? "rotate-90" : ""
          ].join(" ")}
        />
      </button>

      <div
        id="drawing-title-block-editor"
        className={isExpanded ? "space-y-3 p-4" : "hidden"}
      >
        {titleBlockFields.map((field) => (
          <div key={field.key}>
            <label className="field-label" htmlFor={`title-block-${field.key}`}>
              {field.label}
            </label>
            <input
              id={`title-block-${field.key}`}
              className="field-input"
              value={titleBlock[field.key] ?? ""}
              placeholder={field.placeholder}
              onChange={(event) =>
                onTitleBlockChange({
                  [field.key]: event.currentTarget.value || undefined
                })
              }
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function SelectedNoteEditor({
  annotation,
  onAnnotationChange,
  onAnnotationRemove
}: {
  annotation: DrawingAnnotation | undefined;
  onAnnotationChange: (
    annotationId: string,
    updates: Partial<DrawingAnnotation>
  ) => void;
  onAnnotationRemove: (annotationId: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!annotation) {
    return null;
  }

  const size = getAnnotationSize(annotation);
  const leaderEnabled = Boolean(annotation.leader?.enabled);

  return (
    <section className="tool-panel overflow-hidden">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 text-left transition hover:bg-slate-50"
        aria-expanded={isExpanded}
        aria-controls="selected-note-editor"
        onClick={() => setIsExpanded((current) => !current)}
      >
        <span>
          <span className="block text-sm font-bold text-slate-950">
            Selected Note
          </span>
          <span className="mt-0.5 block truncate text-xs text-slate-500">
            {annotation.title || "Note"}
          </span>
        </span>
        <ChevronRight
          aria-hidden="true"
          size={16}
          className={[
            "shrink-0 text-slate-400 transition-transform",
            isExpanded ? "rotate-90" : ""
          ].join(" ")}
        />
      </button>

      <div id="selected-note-editor" className={isExpanded ? "space-y-3 p-4" : "hidden"}>
        <div>
          <label className="field-label" htmlFor="selected-note-title">
            Note title
          </label>
          <input
            id="selected-note-title"
            className="field-input"
            value={annotation.title ?? ""}
            placeholder="Note"
            onChange={(event) =>
              onAnnotationChange(annotation.id, {
                title: event.currentTarget.value || undefined
              })
            }
          />
        </div>

        <div>
          <label className="field-label" htmlFor="selected-note-text">
            Note text
          </label>
          <textarea
            id="selected-note-text"
            className="field-input min-h-28 resize-y leading-relaxed"
            value={annotation.text}
            placeholder="Enter note text"
            onChange={(event) =>
              onAnnotationChange(annotation.id, {
                text: event.currentTarget.value
              })
            }
          />
        </div>

        <label className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-700">
          <span>Leader arrow</span>
          <input
            type="checkbox"
            checked={leaderEnabled}
            onChange={(event) => {
              const enabled = event.currentTarget.checked;
              onAnnotationChange(annotation.id, {
                leader: enabled
                  ? {
                      enabled: true,
                      targetX:
                        annotation.leader?.targetX ??
                        Number((annotation.x + size.width + 18).toFixed(2)),
                      targetY:
                        annotation.leader?.targetY ??
                        Number((annotation.y + size.height / 2).toFixed(2))
                    }
                  : {
                      enabled: false,
                      targetX:
                        annotation.leader?.targetX ??
                        Number((annotation.x + size.width + 18).toFixed(2)),
                      targetY:
                        annotation.leader?.targetY ??
                        Number((annotation.y + size.height / 2).toFixed(2))
                    }
              });
            }}
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="icon-button icon-button-danger"
            onClick={() => onAnnotationRemove(annotation.id)}
          >
            <Trash2 aria-hidden="true" size={14} />
            Delete note
          </button>
        </div>
      </div>
    </section>
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
  const [expandedGroupIds, setExpandedGroupIds] = useState<ReadonlySet<string>>(
    () => new Set()
  );
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
  const toggleGroup = (groupId: string, hasSelectedConnection: boolean) => {
    setExpandedGroupIds((current) => {
      const next = new Set(current);

      if (next.has(groupId) || hasSelectedConnection) {
        next.delete(groupId);
        return next;
      }

      next.add(groupId);
      return next;
    });

    if (hasSelectedConnection) {
      onConnectionSelect(undefined);
    }
  };

  return (
    <section className="tool-panel overflow-hidden">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-bold">Connections</h2>
      </div>
      <div className="space-y-4 p-4">
        {model.connections.length > 0 ? (
          <div className="max-h-72 space-y-3 overflow-auto pr-1 text-xs">
            {transitionGroups.map((group) => {
              const hasSelectedConnection = group.connections.some(
                (connection) => connection.id === selectedConnectionId
              );
              const isExpanded =
                expandedGroupIds.has(group.id) || hasSelectedConnection;
              const groupPanelId = `connection-group-${group.id}`;

              return (
                <div
                  key={group.id}
                  data-testid="drawing-connection-group"
                  className="overflow-hidden rounded-md border border-slate-200 bg-white"
                >
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 bg-slate-50/80 px-2.5 py-2 text-left transition hover:bg-teal-50"
                    aria-expanded={isExpanded}
                    aria-controls={groupPanelId}
                    onClick={() => toggleGroup(group.id, hasSelectedConnection)}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <ChevronRight
                        aria-hidden="true"
                        size={14}
                        className={[
                          "shrink-0 text-slate-400 transition-transform",
                          isExpanded ? "rotate-90" : ""
                        ].join(" ")}
                      />
                      <span className="truncate font-bold text-slate-900">
                        {group.title}
                      </span>
                    </span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500 ring-1 ring-slate-200">
                      {group.connectionCount}
                    </span>
                  </button>

                  <div
                    id={groupPanelId}
                    className={isExpanded ? "space-y-1.5 border-t border-slate-200 p-2" : "hidden"}
                  >
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
              );
            })}
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
