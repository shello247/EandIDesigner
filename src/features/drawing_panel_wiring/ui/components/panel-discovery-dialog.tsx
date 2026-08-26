"use client";

import { useDeferredValue, useEffect, useId, useMemo, useState } from "react";
import {
  Check,
  CircuitBoard,
  Hash,
  MoreHorizontal,
  Network,
  Search,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import {
  EngineeringTablePagination,
  paginateTableRows,
} from "@/shared/ui/table-pagination";
import type {
  ExternalTerminationCatalogRow,
  ExternalTerminationMappingRow,
  PanelAssociatedAssetCatalogRow,
  PanelConnectivityGraph,
  PanelConnectionPatternCatalogRow,
  PanelDiscoveryIndex,
  PanelInternalWireCatalogRow,
  PanelTerminalCatalogRow,
  PanelTerminalSideRef,
} from "../../api/public";
import {
  buildExternalTerminationMappingCandidates,
  formatWireNumber,
} from "../../api/public";
import { PanelDiscoveryStatusBadge } from "./panel-discovery-status";
import { ExternalTerminationMappingDialog } from "./external-termination-mapping-dialog";
import { PanelPatternWorkQueue } from "./panel-pattern-work-queue";
import { PanelEquipmentSelector } from "./panel-equipment-selector";

export type PanelDiscoveryTab =
  "assets" | "terminations" | "terminal-map" | "internal-wires" | "patterns";

const PANEL_DISCOVERY_VIEWS: Array<{
  value: PanelDiscoveryTab;
  label: string;
}> = [
  { value: "assets", label: "Equipment" },
  { value: "terminations", label: "External Terminations" },
  { value: "terminal-map", label: "Terminal Map" },
  { value: "internal-wires", label: "Internal Wires" },
  { value: "patterns", label: "Connection Patterns" },
];

function closeMoreMenu(element: HTMLElement): void {
  element.closest("details")?.removeAttribute("open");
}

function assetSearchText(row: PanelAssociatedAssetCatalogRow): string {
  return [
    row.assetId,
    row.tag,
    row.title,
    row.type,
    row.status,
    row.disabledReason,
    row.panelSequence?.position,
    row.panelSequence ? `position ${row.panelSequence.position}` : undefined,
    row.panelSequence ? `row ${row.panelSequence.row}` : undefined,
    row.panelSequence ? `column ${row.panelSequence.column}` : undefined,
    ...row.sourceOccurrences.flatMap((source) => [
      source.sheetNumber,
      source.sheetName,
    ]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function terminationSearchText(row: ExternalTerminationCatalogRow): string {
  return [
    row.terminationId,
    row.targetAssetTag,
    row.target?.terminalKey,
    row.target?.side,
    row.wireId,
    row.cableTag,
    row.conductorKey,
    row.sourceSheet.number,
    row.sourceSheet.name,
    row.source.connectionId,
    row.source.anchorKey,
    row.status,
    row.disabledReason,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function terminalSearchText(row: PanelTerminalCatalogRow): string {
  return [
    row.terminalId,
    row.assetTag,
    row.assetTitle,
    row.assetType,
    row.terminal.terminalKey,
    row.label,
    row.function,
    ...row.findings.flatMap((finding) => [finding.code, finding.message]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function internalWireSearchText(row: PanelInternalWireCatalogRow): string {
  return [
    row.wire.id,
    row.wire.wireId,
    row.wire.wireNumber,
    row.fromLabel,
    row.toLabel,
    row.wire.specification?.catalogEntryName,
    row.wire.specification?.color ?? row.wire.attributes?.color,
    row.wire.specification?.size ?? row.wire.attributes?.size,
    row.wire.specification?.wireType ?? row.wire.attributes?.wireType,
    row.wire.attributes?.description,
    ...row.routeSheets.flatMap((sheet) => [sheet.number, sheet.name]),
    ...row.findings.flatMap((finding) => [finding.code, finding.message]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function patternSearchText(row: PanelConnectionPatternCatalogRow): string {
  return [
    row.patternId,
    row.patternCode,
    row.displayLabel,
    row.topology,
    row.domain,
    ...row.memberLabels,
    ...row.ownedWireIds,
    ...row.findings.flatMap((finding) => [finding.code, finding.message]),
  ]
    .join(" ")
    .toLowerCase();
}

function mappingModeLabel(row: ExternalTerminationMappingRow): string {
  return row.mappingMode.charAt(0).toUpperCase() + row.mappingMode.slice(1);
}

export function PanelDiscoveryDialog({
  index,
  graph,
  panelLabel,
  activeSheetId,
  internalWires,
  connectionPatterns,
  legacyWireCount,
  readOnly = false,
  initialTab = "assets",
  initialFocusId,
  onCancel,
  onPlaceAssets,
  onSelectPlacement,
  onRemovePlacement,
  onMapTermination,
  onResetTerminationMapping,
  onSelectInternalWireRoute,
  onAddInternalWireRoute,
  onDeleteInternalWire,
  onManageWireCatalog,
  onUpgradeLegacyWires,
  onSelectPatternRoute,
  onAddPatternRepresentation,
  onRemovePatternRepresentation,
  onDeletePattern,
  onCenterEquipment,
  onStartPattern,
}: {
  index: PanelDiscoveryIndex;
  graph: PanelConnectivityGraph;
  panelLabel: string;
  activeSheetId: string;
  internalWires: PanelInternalWireCatalogRow[];
  connectionPatterns: PanelConnectionPatternCatalogRow[];
  legacyWireCount: number;
  readOnly?: boolean;
  initialTab?: PanelDiscoveryTab;
  initialFocusId?: string;
  onCancel: () => void;
  onPlaceAssets: (assetIds: string[]) => boolean;
  onSelectPlacement: (placementId: string) => void;
  onRemovePlacement: (placementId: string) => void;
  onMapTermination: (
    terminationId: string,
    target: PanelTerminalSideRef,
  ) => void;
  onResetTerminationMapping: (terminationId: string) => void;
  onSelectInternalWireRoute: (connectionId: string) => void;
  onAddInternalWireRoute: (wireRecordId: string) => void;
  onDeleteInternalWire: (wireRecordId: string, connectionId?: string) => void;
  onManageWireCatalog: () => void;
  onUpgradeLegacyWires: () => void;
  onSelectPatternRoute: (connectionId: string) => void;
  onAddPatternRepresentation: (patternId: string) => void;
  onRemovePatternRepresentation: (patternId: string) => void;
  onDeletePattern: (patternId: string) => void;
  onCenterEquipment: () => void;
  onStartPattern: () => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const [tab, setTab] = useState<PanelDiscoveryTab>(initialTab);
  const [query, setQuery] = useState(initialFocusId ?? "");
  const deferredQuery = useDeferredValue(query);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [mappingTerminationId, setMappingTerminationId] = useState<
    string | null
  >(null);
  const assets = useMemo(() => [...index.assetsById.values()], [index]);
  const mappingRows = useMemo(
    () => [...index.mappingRowsByTerminationId.values()],
    [index],
  );
  const terminations = mappingRows;
  const terminalRows = useMemo(
    () => [...index.terminalCatalog.rowsByTerminalId.values()],
    [index],
  );
  const normalizedQuery = deferredQuery.trim().toLowerCase();
  const filteredAssets = assets.filter(
    (row) => !normalizedQuery || assetSearchText(row).includes(normalizedQuery),
  );
  const filteredTerminations = terminations.filter(
    (row) =>
      !normalizedQuery || terminationSearchText(row).includes(normalizedQuery),
  );
  const filteredTerminalRows = terminalRows.filter(
    (row) =>
      !normalizedQuery || terminalSearchText(row).includes(normalizedQuery),
  );
  const filteredInternalWires = internalWires.filter(
    (row) =>
      !normalizedQuery || internalWireSearchText(row).includes(normalizedQuery),
  );
  const filteredPatterns = connectionPatterns.filter(
    (row) =>
      !normalizedQuery || patternSearchText(row).includes(normalizedQuery),
  );
  const pagedAssets = paginateTableRows(filteredAssets, page, pageSize);
  const pagedTerminations = paginateTableRows(
    filteredTerminations,
    page,
    pageSize,
  );
  const pagedTerminalRows = paginateTableRows(
    filteredTerminalRows,
    page,
    pageSize,
  );
  const pagedInternalWires = paginateTableRows(
    filteredInternalWires,
    page,
    pageSize,
  );
  const pagedPatterns = paginateTableRows(filteredPatterns, page, pageSize);
  const activeRowCount =
    tab === "assets"
      ? filteredAssets.length
      : tab === "terminations"
        ? filteredTerminations.length
        : tab === "terminal-map"
          ? filteredTerminalRows.length
          : tab === "internal-wires"
            ? filteredInternalWires.length
            : filteredPatterns.length;
  const selectedMappingRow = mappingTerminationId
    ? index.mappingRowsByTerminationId.get(mappingTerminationId)
    : undefined;
  const mappingCandidates = useMemo(
    () =>
      mappingTerminationId
        ? buildExternalTerminationMappingCandidates({
            graph,
            terminalCatalog: index.terminalCatalog,
            panelAssetId: index.panelAssetId,
            terminationId: mappingTerminationId,
          })
        : [],
    [graph, index.panelAssetId, index.terminalCatalog, mappingTerminationId],
  );
  const viewCounts: Record<PanelDiscoveryTab, number> = {
    assets: assets.length,
    terminations: terminations.length,
    "terminal-map": terminalRows.length,
    "internal-wires": internalWires.length,
    patterns: connectionPatterns.length,
  };
  const activeViewLabel =
    PANEL_DISCOVERY_VIEWS.find((view) => view.value === tab)?.label ??
    "Equipment";

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/20 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onCancel();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="flex h-[88vh] w-full max-w-7xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-700">
            <CircuitBoard aria-hidden="true" size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-sm font-semibold text-slate-950">
              Panel Engineering Workbench
            </h2>
            <p
              id={descriptionId}
              className="mt-1 text-xs leading-5 text-slate-600"
            >
              {panelLabel}. Select equipment for this sheet and inspect the
              panel&apos;s terminal, wire, and pattern records.
            </p>
          </div>
          <button
            type="button"
            className="icon-button h-8 w-8 p-0"
            onClick={onCancel}
            aria-label="Close panel engineering workbench"
          >
            <X aria-hidden="true" size={14} />
          </button>
        </div>

        <div className="space-y-3 border-b border-slate-200 bg-slate-50 px-5 py-4">
          {readOnly ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
              Read-only deployment. Catalogs and provenance remain available,
              but placement, mapping, wiring, and pattern changes are disabled.
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search
                aria-hidden="true"
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                className="field-input pl-9"
                value={query}
                placeholder="Search tags, wires, cables, sheets, or provenance"
                onChange={(event) => {
                  setPage(1);
                  setQuery(event.currentTarget.value);
                }}
                aria-label="Search panel engineering workbench"
              />
            </div>
            <details className="group relative shrink-0">
              <summary
                className="icon-button cursor-pointer list-none [&::-webkit-details-marker]:hidden"
                aria-label={`More panel engineering options. Current view: ${activeViewLabel}`}
              >
                <MoreHorizontal aria-hidden="true" size={16} />
                More
              </summary>
              <div
                className="absolute right-0 top-full z-30 mt-2 w-72 overflow-hidden rounded-md border border-slate-200 bg-white py-1 shadow-xl"
                role="menu"
                aria-label="Panel engineering views and tools"
              >
                <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  Engineering view
                </p>
                {PANEL_DISCOVERY_VIEWS.map((view) => (
                  <button
                    key={view.value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={tab === view.value}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-slate-50 ${
                      tab === view.value
                        ? "bg-teal-50 font-semibold text-teal-800"
                        : "text-slate-700"
                    }`}
                    onClick={(event) => {
                      setPage(1);
                      setTab(view.value);
                      closeMoreMenu(event.currentTarget);
                    }}
                  >
                    <span className="flex-1">{view.label}</span>
                    <span className="tabular-nums text-slate-400">
                      {viewCounts[view.value]}
                    </span>
                    <Check
                      aria-hidden="true"
                      size={14}
                      className={
                        tab === view.value ? "opacity-100" : "opacity-0"
                      }
                    />
                  </button>
                ))}
                {tab === "internal-wires" || tab === "patterns" ? (
                  <div className="mt-1 border-t border-slate-200 pt-1">
                    <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      Tools
                    </p>
                    {tab === "internal-wires" ? (
                      <>
                        {legacyWireCount > 0 ? (
                          <button
                            type="button"
                            role="menuitem"
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 disabled:text-slate-400"
                            disabled={readOnly}
                            onClick={(event) => {
                              closeMoreMenu(event.currentTarget);
                              onUpgradeLegacyWires();
                            }}
                          >
                            <Hash aria-hidden="true" size={14} />
                            Upgrade identifiers ({legacyWireCount})
                          </button>
                        ) : null}
                        <button
                          type="button"
                          role="menuitem"
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
                          onClick={(event) => {
                            closeMoreMenu(event.currentTarget);
                            // The menu item is now hidden; return focus to its visible trigger.
                            event.currentTarget.closest("details")?.querySelector("summary")?.focus();
                            onManageWireCatalog();
                          }}
                        >
                          <Settings2 aria-hidden="true" size={14} />
                          Wire Catalog
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        role="menuitem"
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 disabled:text-slate-400"
                        disabled={readOnly}
                        onClick={(event) => {
                          closeMoreMenu(event.currentTarget);
                          onStartPattern();
                        }}
                      >
                        <Network aria-hidden="true" size={14} />
                        New pattern
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
            </details>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4">
          {tab === "assets" ? (
            <PanelEquipmentSelector
              rows={pagedAssets}
              filteredRows={filteredAssets}
              readOnly={readOnly}
              onPlaceAssets={onPlaceAssets}
              onSelectPlacement={onSelectPlacement}
              onRemovePlacement={onRemovePlacement}
              onCenterEquipment={onCenterEquipment}
            />
          ) : tab === "terminations" ? (
            <table className="w-full min-w-[1160px] border-separate border-spacing-0 text-left text-xs">
              <thead className="sticky top-0 z-10 bg-white text-[10px] font-bold uppercase text-slate-500">
                <tr>
                  {[
                    "Status",
                    "Target",
                    "Wire ID",
                    "Cable / conductor",
                    "Source sheet",
                    "Connection provenance",
                    "Mapping",
                    "Action",
                  ].map((heading) => (
                    <th
                      key={heading}
                      className="border-b border-slate-200 px-3 py-2.5"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagedTerminations.map((row) => (
                  <tr
                    key={row.terminationId}
                    className="align-top hover:bg-slate-50"
                  >
                    <td className="border-b border-slate-100 px-3 py-3">
                      <PanelDiscoveryStatusBadge status={row.status} />
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3">
                      <span className="block font-bold text-slate-950">
                        {row.targetAssetTag ?? "Unresolved asset"}
                      </span>
                      <span className="mt-0.5 block text-slate-500">
                        {row.target
                          ? `${row.target.terminalKey} / ${row.target.side}`
                          : "Terminal unresolved"}
                      </span>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 font-mono text-[11px] text-slate-800">
                      {row.wireId || "-"}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                      <span className="block">
                        {row.cableTag || row.cableAssetId || "-"}
                      </span>
                      <span className="mt-0.5 block text-slate-500">
                        {row.conductorKey || "No conductor key"}
                      </span>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                      Sheet {row.sourceSheet.number} - {row.sourceSheet.name}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 font-mono text-[10px] leading-4 text-slate-600">
                      <span className="block">
                        {row.source.connectionId} / {row.source.endpointRole}
                      </span>
                      <span className="block">
                        {row.source.placementId} / {row.source.anchorKey}
                      </span>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${row.mappingMode === "manual" ? "border-violet-200 bg-violet-50 text-violet-800" : row.mappingMode === "conflicting" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-slate-200 bg-slate-50 text-slate-700"}`}
                      >
                        {mappingModeLabel(row)}
                      </span>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="icon-button icon-button-primary"
                          disabled={Boolean(row.mappingDisabledReason)}
                          onClick={() =>
                            setMappingTerminationId(row.terminationId)
                          }
                        >
                          {row.mappingMode === "unmapped"
                            ? "Map"
                            : "Change mapping"}
                        </button>
                        {row.mappingMode === "manual" ? (
                          <button
                            type="button"
                            className="icon-button"
                            onClick={() =>
                              onResetTerminationMapping(row.terminationId)
                            }
                          >
                            Reset automatic
                          </button>
                        ) : null}
                        {row.status === "available" && row.targetAssetId ? (
                          <button
                            type="button"
                            className="icon-button"
                            onClick={() => onPlaceAssets([row.targetAssetId!])}
                          >
                            Add target asset
                          </button>
                        ) : row.status === "represented" &&
                          row.representedPlacementId ? (
                          <button
                            type="button"
                            className="icon-button"
                            onClick={() =>
                              onSelectPlacement(row.representedPlacementId!)
                            }
                          >
                            Select asset
                          </button>
                        ) : null}
                      </div>
                      {row.mappingDisabledReason ? (
                        <span className="mt-1 block max-w-xs text-[11px] leading-4 text-slate-500">
                          {row.mappingDisabledReason}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : tab === "terminal-map" ? (
            <table className="w-full min-w-[1120px] border-separate border-spacing-0 text-left text-xs">
              <thead className="sticky top-0 z-10 bg-white text-[10px] font-bold uppercase text-slate-500">
                <tr>
                  {[
                    "Asset / terminal",
                    "Function",
                    "Field side occupancy",
                    "Field provenance",
                    "Internal side",
                    "Mapping",
                    "Findings",
                  ].map((heading) => (
                    <th
                      key={heading}
                      className="border-b border-slate-200 px-3 py-2.5"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagedTerminalRows.map((row) => {
                  const fieldSide = row.supportedSides.includes("external")
                    ? "external"
                    : row.supportedSides.includes("single")
                      ? "single"
                      : undefined;
                  const fieldOccupancy = fieldSide
                    ? row.occupancy[fieldSide]
                    : undefined;
                  const fieldOccupant = fieldOccupancy?.occupants.find(
                    (occupant) => occupant.kind === "external_termination",
                  );
                  const mappingRow = fieldOccupant
                    ? index.mappingRowsByTerminationId.get(fieldOccupant.id)
                    : undefined;
                  const internalOccupancy = row.occupancy.internal;

                  return (
                    <tr
                      key={row.terminalId}
                      className="align-top hover:bg-slate-50"
                    >
                      <td className="border-b border-slate-100 px-3 py-3">
                        <span className="block font-bold text-slate-950">
                          {row.assetTag}:{row.label}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-slate-500">
                          {row.assetTitle}
                        </span>
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                        {row.function || "-"}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3">
                        <span className="block font-semibold text-slate-800">
                          {fieldOccupancy?.status ?? "Not applicable"}
                        </span>
                        <span className="mt-0.5 block font-mono text-[11px] text-slate-600">
                          {fieldOccupant?.wireId || fieldOccupant?.label || "-"}
                        </span>
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 text-[11px] text-slate-600">
                        {fieldOccupant?.sourceSheet ? (
                          <>
                            <span className="block">
                              {fieldOccupant.cableTag || "-"} /{" "}
                              {fieldOccupant.conductorKey || "-"}
                            </span>
                            <span className="mt-0.5 block">
                              Sheet {fieldOccupant.sourceSheet.number} -{" "}
                              {fieldOccupant.sourceSheet.name}
                            </span>
                          </>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3">
                        {row.supportedSides.includes("internal")
                          ? (internalOccupancy?.status ?? "available")
                          : "Not applicable"}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3">
                        {mappingRow ? (
                          <button
                            type="button"
                            className="icon-button"
                            onClick={() =>
                              setMappingTerminationId(mappingRow.terminationId)
                            }
                          >
                            {mappingModeLabel(mappingRow)}
                          </button>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="max-w-xs border-b border-slate-100 px-3 py-3 text-[11px] leading-4 text-slate-600">
                        {row.findings.length > 0
                          ? row.findings
                              .map((finding) => finding.message)
                              .join("; ")
                          : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : tab === "internal-wires" ? (
            <table className="w-full min-w-[1120px] border-separate border-spacing-0 text-left text-xs">
              <thead className="sticky top-0 z-10 bg-white text-[10px] font-bold uppercase text-slate-500">
                <tr>
                  {[
                    "Wire # / Wire ID",
                    "From",
                    "To",
                    "Specification",
                    "Route sheets",
                    "Findings",
                    "Action",
                  ].map((heading) => (
                    <th
                      key={heading}
                      className="border-b border-slate-200 px-3 py-2.5"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagedInternalWires.map((row) => {
                  const activeRoute = row.routeOccurrences.find(
                    (route) => route.sheetId === activeSheetId,
                  );
                  return (
                    <tr
                      key={row.wire.id}
                      className="align-top hover:bg-slate-50"
                    >
                      <td className="border-b border-slate-100 px-3 py-3">
                        <span className="block font-mono font-bold text-blue-900">
                          {row.wire.wireNumber
                            ? formatWireNumber(row.wire.wireNumber)
                            : "Legacy"}
                        </span>
                        <span className="mt-0.5 block font-mono text-[11px] text-slate-500">
                          {row.wire.wireId}
                        </span>
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                        {row.fromLabel}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                        {row.toLabel}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 text-[11px] text-slate-600">
                        {[
                          row.wire.specification?.color ??
                            row.wire.attributes?.color,
                          row.wire.specification?.size ??
                            row.wire.attributes?.size,
                          row.wire.specification?.wireType ??
                            row.wire.attributes?.wireType,
                        ]
                          .filter(Boolean)
                          .join(" / ") || "-"}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 text-[11px] text-slate-600">
                        {row.routeSheets.length > 0
                          ? row.routeSheets
                              .map(
                                (sheet) =>
                                  `Sheet ${sheet.number} - ${sheet.name}`,
                              )
                              .join("; ")
                          : "Unrepresented"}
                      </td>
                      <td className="max-w-xs border-b border-slate-100 px-3 py-3 text-[11px] leading-4 text-slate-600">
                        {row.findings.length > 0
                          ? row.findings
                              .map((finding) => finding.message)
                              .join("; ")
                          : "-"}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          {activeRoute ? (
                            <button
                              type="button"
                              className="icon-button icon-button-primary"
                              onClick={() =>
                                onSelectInternalWireRoute(
                                  activeRoute.connectionId,
                                )
                              }
                            >
                              Select route
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="icon-button icon-button-primary"
                              onClick={() =>
                                onAddInternalWireRoute(row.wire.id)
                              }
                            >
                              Add representation
                            </button>
                          )}
                          <button
                            type="button"
                            className="icon-button border-rose-200 text-rose-700"
                            onClick={() =>
                              onDeleteInternalWire(
                                row.wire.id,
                                activeRoute?.connectionId,
                              )
                            }
                          >
                            <Trash2 aria-hidden="true" size={13} />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <PanelPatternWorkQueue
              rows={pagedPatterns}
              activeSheetId={activeSheetId}
              onSelectRoute={onSelectPatternRoute}
              onAddRepresentation={onAddPatternRepresentation}
              onRemoveRepresentation={onRemovePatternRepresentation}
              onDeletePattern={onDeletePattern}
            />
          )}

          {tab !== "patterns" &&
          (tab === "assets"
            ? filteredAssets
            : tab === "terminations"
              ? filteredTerminations
              : tab === "terminal-map"
                ? filteredTerminalRows
                : filteredInternalWires
          ).length === 0 ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
              No records match the current search.
            </div>
          ) : null}
        </div>

        <EngineeringTablePagination
          page={page}
          pageSize={pageSize}
          rowCount={activeRowCount}
          onPageChange={setPage}
          onPageSizeChange={(nextPageSize) => {
            setPage(1);
            setPageSize(nextPageSize);
          }}
        />

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs text-slate-500">
          <span>
            {index.warnings.length} discovery finding
            {index.warnings.length === 1 ? "" : "s"}
          </span>
          <button type="button" className="icon-button" onClick={onCancel}>
            Close
          </button>
        </div>
      </div>
      {selectedMappingRow ? (
        <ExternalTerminationMappingDialog
          key={`${selectedMappingRow.terminationId}:${selectedMappingRow.mappingMode}:${selectedMappingRow.effectiveTarget?.assetId ?? ""}:${selectedMappingRow.effectiveTarget?.terminalKey ?? ""}:${selectedMappingRow.effectiveTarget?.side ?? ""}`}
          row={selectedMappingRow}
          candidates={mappingCandidates}
          onApply={(target) =>
            onMapTermination(selectedMappingRow.terminationId, target)
          }
          onReset={() =>
            onResetTerminationMapping(selectedMappingRow.terminationId)
          }
          onCancel={() => setMappingTerminationId(null)}
        />
      ) : null}
    </div>
  );
}
