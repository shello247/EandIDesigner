"use client";

import { useEffect, useRef } from "react";
import { Cable, ChevronRight, X } from "lucide-react";
import type {
  DrawingModel as DrawingPackageModel,
  DrawingSheetCanvasModel
} from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import { getConnectionTransitionGroups } from "../../logic/services/drawing-connection-groups";
import {
  getConnectionWireId,
  getReadableConnectionName
} from "../../logic/services/drawing-identification";
import { getConnectionLabel } from "../../logic/services/drawing-connections";

export function ConnectionsDialog({
  model,
  packageModel,
  symbols,
  selectedConnectionId,
  onCancel,
  onSelect
}: {
  model: DrawingSheetCanvasModel;
  packageModel: DrawingPackageModel;
  symbols: ApprovedDrawingSymbol[];
  selectedConnectionId?: string;
  onCancel: () => void;
  onSelect: (connectionId: string) => void;
}) {
  const titleId = "connections-dialog-title";
  const descriptionId = "connections-dialog-description";
  const transitionGroups = getConnectionTransitionGroups(model, symbols);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/20 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-700">
            <Cable aria-hidden="true" size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-sm font-semibold text-slate-950">
              Connections
            </h2>
            <p id={descriptionId} className="mt-1 text-xs leading-5 text-slate-600">
              Browse this sheet&apos;s connection groups and select one to edit.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="icon-button h-8 w-8 p-0"
            aria-label="Close connections"
            onClick={onCancel}
          >
            <X aria-hidden="true" size={14} />
          </button>
        </div>

        <div className="max-h-[calc(85vh-5rem)] space-y-3 overflow-y-auto px-5 py-4">
          {transitionGroups.length > 0 ? (
            transitionGroups.map((group) => (
              <section
                key={group.id}
                data-testid="drawing-connection-group"
                className="overflow-hidden rounded-md border border-slate-200 bg-white"
              >
                <div className="flex items-center justify-between gap-2 bg-slate-50 px-3 py-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <ChevronRight
                      aria-hidden="true"
                      size={14}
                      className="shrink-0 rotate-90 text-slate-400"
                    />
                    <span className="truncate text-xs font-bold text-slate-900">
                      {group.title}
                    </span>
                  </span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500 ring-1 ring-slate-200">
                    {group.connectionCount}
                  </span>
                </div>
                <div className="space-y-1.5 border-t border-slate-200 p-2">
                  {group.connections.map((connection) => {
                    const isSelected = selectedConnectionId === connection.id;
                    const wireId = getConnectionWireId(
                      model,
                      symbols,
                      connection
                    );

                    return (
                      <button
                        type="button"
                        key={connection.id}
                        data-testid="drawing-connection-card"
                        className={[
                          "w-full rounded-md border px-3 py-2 text-left text-xs transition",
                          isSelected
                            ? "border-sky-300 bg-sky-50"
                            : "border-slate-200 hover:border-teal-200 hover:bg-teal-50"
                        ].join(" ")}
                        onClick={() => onSelect(connection.id)}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-950">
                            {wireId ??
                              getReadableConnectionName(
                                model,
                                symbols,
                                connection
                              )}
                          </span>
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                            {connection.route?.mode ?? "auto"}
                          </span>
                        </span>
                        <span className="mt-1 block text-slate-500">
                          {getConnectionLabel(model, connection)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))
          ) : (
            <div className="rounded-md border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
              No connections on this sheet yet.
            </div>
          )}

          <p className="text-[11px] text-slate-500">
            Drawing package: {packageModel.sheets.length} sheet
            {packageModel.sheets.length === 1 ? "" : "s"}.
          </p>
        </div>
      </div>
    </div>
  );
}
