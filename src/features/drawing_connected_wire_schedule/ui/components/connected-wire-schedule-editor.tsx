"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronRight,
  Files,
  RefreshCcw,
  RotateCcw,
  Trash2,
  Unlink
} from "lucide-react";
import type { ConnectedWireScheduleAnnotation } from "../../data/schema";
import type { PanelConnectionDisplayMode } from "@/features/drawing_panel_wiring/api/public";
import { ConnectionDisplaySelect } from "@/features/drawing_panel_wiring/ui/public";
import type {
  ConnectedWireScheduleLayout,
  ConnectedWireScheduleProjection
} from "../../types";
import { clampConnectedWireScheduleWidth } from "../../logic/services/connected-wire-schedule-layout";
import {
  evaluateConnectedWireScheduleCapacity,
  recommendConnectedWireScheduleRowsPerPage
} from "../../logic/services/connected-wire-schedule-page-capacity";
import {
  formatConnectedWireSchedulePageLabel,
  formatConnectedWireScheduleRowRange
} from "../../logic/services/connected-wire-schedule-pagination";

export type ConnectedWireScheduleEquipmentOption = {
  assetId: string;
  placementId: string;
  label: string;
};

export function ConnectedWireScheduleEditor({
  annotation,
  projection,
  layout,
  sheet,
  isDetailedPanel,
  equipmentOptions,
  connectionDisplayMode,
  connectionDisplayHasSidedTerminals,
  connectionDisplayDisabled,
  onChange,
  onConnectionDisplayModeChange,
  onRemove,
  onSynchronize,
  onRemovePagination,
  onOpenPartOne
}: {
  annotation: ConnectedWireScheduleAnnotation;
  projection?: ConnectedWireScheduleProjection;
  layout?: ConnectedWireScheduleLayout;
  sheet: { width: number; height: number };
  isDetailedPanel: boolean;
  equipmentOptions: ConnectedWireScheduleEquipmentOption[];
  connectionDisplayMode: PanelConnectionDisplayMode;
  connectionDisplayHasSidedTerminals: boolean;
  connectionDisplayDisabled?: boolean;
  onChange: (updates: Partial<ConnectedWireScheduleAnnotation>) => void;
  onConnectionDisplayModeChange: (mode: PanelConnectionDisplayMode) => void;
  onRemove: () => void;
  onSynchronize: (rowsPerPage: number) => void;
  onRemovePagination: () => void;
  onOpenPartOne: (continuationSetId: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const pagination = annotation.schedule.pagination;
  const isPartOne = !pagination || pagination.pageIndex === 0;
  const recommendation = useMemo(
    () =>
      projection && isDetailedPanel
        ? recommendConnectedWireScheduleRowsPerPage({
            annotation,
            projection,
            sheet
          })
        : undefined,
    [annotation, isDetailedPanel, projection, sheet]
  );
  const [rowsPerPageDraft, setRowsPerPageDraft] = useState(
    pagination?.rowsPerPage ?? recommendation?.rowsPerPage ?? 10
  );
  const capacity = useMemo(() => {
    if (!projection || !isDetailedPanel) return undefined;
    try {
      return evaluateConnectedWireScheduleCapacity({
        annotation,
        projection,
        sheet,
        rowsPerPage: rowsPerPageDraft
      });
    } catch {
      return undefined;
    }
  }, [annotation, isDetailedPanel, projection, rowsPerPageDraft, sheet]);
  const paginationBlocked =
    !projection?.linkedOccurrenceAvailable ||
    !capacity ||
    !capacity.fitsHorizontally ||
    !capacity.fitsVertically;
  const selectedEquipmentValue = `${annotation.schedule.assetId}:${annotation.schedule.sourcePlacementId}`;
  const internalVisibleCount =
    projection?.allRows.filter((row) => row.canonicalKind === "internal_wire")
      .length ?? 0;
  const externalVisibleCount =
    projection?.allRows.filter((row) => row.canonicalKind === "field_connection")
      .length ?? 0;
  const contentId = `connected-wire-schedule-editor-${annotation.id}`;

  return (
    <section className="tool-panel overflow-hidden">
      <button
        type="button"
        className="group flex w-full items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 text-left transition hover:bg-slate-50"
        aria-expanded={isExpanded}
        aria-controls={contentId}
        onClick={() => setIsExpanded((current) => !current)}
      >
        <span className="min-w-0">
          <span className="block text-sm font-bold text-slate-950">
            Connected Wire Schedule
          </span>
          <span className="mt-0.5 block truncate text-xs text-slate-500">
            Read-only table derived from canonical wiring records.
          </span>
        </span>
        <span
          aria-hidden="true"
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors ${
            isExpanded
              ? "border-sky-200 bg-sky-50 text-sky-700"
              : "border-slate-200 bg-white text-slate-500 group-hover:border-slate-300 group-hover:text-slate-700"
          }`}
        >
          <ChevronRight
            size={17}
            strokeWidth={2.25}
            className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}
          />
        </span>
      </button>
      {isExpanded ? (
        <div id={contentId} className="space-y-4 p-4 text-xs">
        <div>
          <label className="field-label" htmlFor={`schedule-equipment-${annotation.id}`}>
            Equipment
          </label>
          <select
            id={`schedule-equipment-${annotation.id}`}
            className="field-input"
            value={selectedEquipmentValue}
            disabled={Boolean(pagination)}
            onChange={(event) => {
              const option = equipmentOptions.find(
                (candidate) =>
                  `${candidate.assetId}:${candidate.placementId}` ===
                  event.currentTarget.value
              );
              if (!option) return;
              onChange({
                schedule: {
                  ...annotation.schedule,
                  assetId: option.assetId,
                  sourcePlacementId: option.placementId
                }
              });
            }}
          >
            {!equipmentOptions.some(
              (option) =>
                `${option.assetId}:${option.placementId}` ===
                selectedEquipmentValue
            ) ? (
              <option value={selectedEquipmentValue}>
                Linked equipment unavailable
              </option>
            ) : null}
            {equipmentOptions.map((option) => (
              <option
                key={`${option.assetId}:${option.placementId}`}
                value={`${option.assetId}:${option.placementId}`}
              >
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label" htmlFor={`schedule-display-${annotation.id}`}>
            Connection display
          </label>
          <ConnectionDisplaySelect
            id={`schedule-display-${annotation.id}`}
            mode={connectionDisplayMode}
            hasSidedTerminals={connectionDisplayHasSidedTerminals}
            disabled={connectionDisplayDisabled}
            onChange={onConnectionDisplayModeChange}
          />
          {connectionDisplayDisabled ? (
            <p className="mt-1 text-[11px] font-medium text-amber-700">
              The linked equipment occurrence is unavailable. Its connection
              display cannot be changed.
            </p>
          ) : connectionDisplayMode === "sheet_only" ? (
            <p className="mt-1 text-[11px] leading-4 text-slate-500">
              Only routes touching the linked occurrence on this sheet are shown.
            </p>
          ) : (
            <p className="mt-1 text-[11px] leading-4 text-slate-500">
              {connectionDisplayMode === "internal_connected"
                ? `${internalVisibleCount} internal wire reference${internalVisibleCount === 1 ? "" : "s"} shown.`
                : connectionDisplayMode === "external_connected"
                  ? `${externalVisibleCount} external reference${externalVisibleCount === 1 ? "" : "s"} shown.`
                  : `${internalVisibleCount} internal and ${externalVisibleCount} external references shown.`}
            </p>
          )}
        </div>

        <div>
          <label className="field-label" htmlFor={`schedule-width-${annotation.id}`}>
            Table width mm
          </label>
          <input
            key={`${annotation.id}:${annotation.width}`}
            id={`schedule-width-${annotation.id}`}
            className="field-input"
            type="number"
            min={120}
            step={1}
            defaultValue={annotation.width}
            onBlur={(event) => {
              const width = Number(event.currentTarget.value);
              if (Number.isFinite(width) && width > 0 && width !== annotation.width) {
                onChange({
                  width: clampConnectedWireScheduleWidth(width, sheet.width)
                });
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape") {
                event.currentTarget.value = String(annotation.width);
                event.currentTarget.blur();
              }
            }}
          />
          <p className="mt-1 text-[11px] text-slate-500">
            Drag the table&apos;s right edge to resize every column proportionally.
          </p>
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5">
          <span className="block font-semibold text-slate-700">
            Individual columns
          </span>
          <p className="mt-1 text-[11px] leading-4 text-slate-500">
            Select the table, then drag a cyan divider. Only the columns on
            either side of that divider are adjusted.
          </p>
          <button
            type="button"
            className="icon-button mt-2"
            disabled={!annotation.schedule.columnRatios}
            onClick={() => {
              const schedule = { ...annotation.schedule };
              delete schedule.columnRatios;
              onChange({ schedule });
            }}
          >
            <RotateCcw aria-hidden="true" size={14} />
            Reset column widths
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
            <span className="block text-[10px] font-bold uppercase text-slate-500">
              Total rows
            </span>
            <span className="mt-1 block text-sm font-semibold text-slate-900">
              {projection?.totalRows ?? 0}
            </span>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
            <span className="block text-[10px] font-bold uppercase text-slate-500">
              Visible rows
            </span>
            <span className="mt-1 block text-sm font-semibold text-slate-900">
              {projection?.rows.length ?? 0}
            </span>
          </div>
        </div>

        {pagination && projection ? (
          <div className="rounded-md border border-cyan-200 bg-cyan-50 px-3 py-2.5 text-cyan-950">
            <span className="block font-semibold">
              {formatConnectedWireSchedulePageLabel(
                {
                  pageIndex: projection.pageIndex,
                  pageCount: projection.pageCount
                }
              )}
            </span>
            <span className="mt-0.5 block text-[11px]">
              {formatConnectedWireScheduleRowRange(projection)}
            </span>
          </div>
        ) : null}

        {isDetailedPanel ? (
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3">
            {isPartOne ? (
              <>
                <label
                  className="field-label"
                  htmlFor={`schedule-rows-per-page-${annotation.id}`}
                >
                  Rows per sheet
                </label>
                <input
                  id={`schedule-rows-per-page-${annotation.id}`}
                  className="field-input"
                  type="number"
                  min={1}
                  max={100}
                  step={1}
                  value={rowsPerPageDraft}
                  onChange={(event) =>
                    setRowsPerPageDraft(Number(event.currentTarget.value))
                  }
                />
                <div className="mt-2 space-y-0.5 text-[11px] text-slate-600">
                  <p>
                    Recommended: {recommendation?.rowsPerPage ?? "—"} rows per
                    sheet
                  </p>
                  <p>
                    Result: {capacity?.pageCount ?? "—"} sheet
                    {capacity?.pageCount === 1 ? "" : "s"}
                  </p>
                </div>
                {!capacity?.fitsHorizontally ? (
                  <p className="mt-2 text-[11px] font-medium text-amber-700">
                    Move or resize the table so it fits horizontally first.
                  </p>
                ) : null}
                {capacity && !capacity.fitsVertically ? (
                  <p className="mt-2 text-[11px] font-medium text-amber-700">
                    This row count is too high for the available sheet height.
                  </p>
                ) : null}
                <button
                  type="button"
                  className="icon-button mt-3 w-full justify-center"
                  disabled={paginationBlocked}
                  onClick={() => onSynchronize(rowsPerPageDraft)}
                >
                  {pagination ? (
                    <RefreshCcw aria-hidden="true" size={14} />
                  ) : (
                    <Files aria-hidden="true" size={14} />
                  )}
                  {pagination
                    ? "Synchronize continuation sheets"
                    : "Create continuation sheets"}
                </button>
                {pagination ? (
                  <button
                    type="button"
                    className="icon-button mt-2 w-full justify-center"
                    onClick={onRemovePagination}
                  >
                    <Unlink aria-hidden="true" size={14} />
                    Remove pagination
                  </button>
                ) : null}
              </>
            ) : (
              <>
                <p className="text-[11px] leading-4 text-slate-600">
                  This continuation is synchronized from Part 1. Equipment,
                  connection scope, and pagination are read-only here.
                </p>
                <button
                  type="button"
                  className="icon-button mt-3 w-full justify-center"
                  onClick={() =>
                    onOpenPartOne(pagination!.continuationSetId)
                  }
                >
                  Open Part 1
                </button>
              </>
            )}
            <p className="mt-2 text-[10px] leading-4 text-slate-500">
              Every part references the same physical asset. Wiring records are
              never copied.
            </p>
          </div>
        ) : null}

        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
          <span className="text-[10px] font-bold uppercase text-slate-500">
            Unresolved
          </span>
          <span className="ml-2 font-semibold text-slate-900">
            {projection?.unresolvedCount ?? 0}
          </span>
        </div>

        {!projection?.linkedOccurrenceAvailable ? (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
            <AlertTriangle aria-hidden="true" size={14} className="mt-0.5 shrink-0" />
            <span>The linked equipment occurrence is unavailable. Reassign or delete this schedule.</span>
          </div>
        ) : null}
        {layout?.overflow ? (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
            <AlertTriangle aria-hidden="true" size={14} className="mt-0.5 shrink-0" />
            <span>The complete table extends beyond the sheet boundary.</span>
          </div>
        ) : null}

        <button
          type="button"
          className="icon-button icon-button-danger"
          onClick={onRemove}
        >
          <Trash2 aria-hidden="true" size={14} />
          Delete schedule
        </button>
      </div>
      ) : null}
    </section>
  );
}
