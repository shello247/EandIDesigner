"use client";

import { useCallback, useDeferredValue, useEffect, useId, useMemo, useState } from "react";
import { Cable, CircuitBoard, Network, Search, Settings2, Trash2, X } from "lucide-react";
import {
  EngineeringTablePagination,
  paginateTableRows
} from "@/shared/ui/table-pagination";
import type {
  ExternalTerminationCatalogRow,
  ExternalTerminationMappingRow,
  PanelAssociatedAssetCatalogRow,
  PanelConnectivityGraph,
  PanelConnectionPatternCatalogRow,
  PanelDiscoveryIndex,
  PanelDiscoveryStatus,
  PanelGuidedWorkflowSnapshot,
  PanelInternalWireCatalogRow,
  PanelInternalWireEndpointCatalog,
  PanelTerminalCatalogRow,
  PanelTerminalSideRef,
  PanelWireSettings
} from "../../api/public";
import {
  buildExternalTerminationMappingCandidates,
  getPanelInternalWireEndpointPairState
} from "../../api/public";
import {
  PanelDiscoveryStatusBadge,
  panelDiscoveryStatusLabel
} from "./panel-discovery-status";
import { ExternalTerminationMappingDialog } from "./external-termination-mapping-dialog";
import { PanelWireSettingsDialog } from "./panel-wire-settings-dialog";
import { PanelPatternWorkQueue } from "./panel-pattern-work-queue";
import { PanelGuidedWorkflow } from "./panel-guided-workflow";
import type {
  PanelInternalWireFormResult,
  PanelInternalWireFormSubmission
} from "./panel-internal-wire-form";

export type PanelDiscoveryTab = "assets" | "terminations" | "terminal-map" | "internal-wires" | "patterns";
type StatusFilter = "all" | PanelDiscoveryStatus;

const PANEL_DISCOVERY_STATUSES: PanelDiscoveryStatus[] = [
  "available",
  "represented",
  "missing",
  "conflicting",
  "unsupported"
];
const STATUS_OPTIONS: StatusFilter[] = ["all", ...PANEL_DISCOVERY_STATUSES];

function assetSearchText(row: PanelAssociatedAssetCatalogRow): string {
  return [
    row.assetId,
    row.tag,
    row.title,
    row.type,
    row.status,
    row.disabledReason,
    ...row.sourceOccurrences.flatMap((source) => [
      source.sheetNumber,
      source.sheetName
    ])
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
    row.disabledReason
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
    ...row.findings.flatMap((finding) => [finding.code, finding.message])
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function internalWireSearchText(row: PanelInternalWireCatalogRow): string {
  return [
    row.wire.id,
    row.wire.wireId,
    row.fromLabel,
    row.toLabel,
    row.wire.attributes?.color,
    row.wire.attributes?.size,
    row.wire.attributes?.wireType,
    row.wire.attributes?.description,
    ...row.routeSheets.flatMap((sheet) => [sheet.number, sheet.name]),
    ...row.findings.flatMap((finding) => [finding.code, finding.message])
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
    ...row.findings.flatMap((finding) => [finding.code, finding.message])
  ].join(" ").toLowerCase();
}

function mappingModeLabel(row: ExternalTerminationMappingRow): string {
  return row.mappingMode.charAt(0).toUpperCase() + row.mappingMode.slice(1);
}

function sourceSheetSummary(row: PanelAssociatedAssetCatalogRow): string {
  const sheets = new Map<number, string>();

  row.sourceOccurrences.forEach((source) => {
    sheets.set(source.sheetNumber, source.sheetName);
  });

  return [...sheets.entries()]
    .map(([number, name]) => `Sheet ${number} - ${name}`)
    .join("; ");
}

export function PanelDiscoveryDialog({
  index,
  graph,
  panelLabel,
  activeSheetId,
  internalWires,
  connectionPatterns,
  wireSettings,
  endpointCatalog,
  proposedWireId,
  workflow,
  readOnly = false,
  initialTab = "assets",
  initialFocusId,
  onCancel,
  onPlaceAsset,
  onSelectPlacement,
  onRemovePlacement,
  onMapTermination,
  onResetTerminationMapping,
  onSelectInternalWireRoute,
  onAddInternalWireRoute,
  onDeleteInternalWire,
  onUpdateWireSettings,
  onSelectPatternRoute,
  onAddPatternRepresentation,
  onRemovePatternRepresentation,
  onDeletePattern,
  onFocusAsset,
  onCreateInternalWire,
  onPickInternalWire,
  onCenterEquipment,
  onStartPattern,
  onOpenReview,
  onOpenDeliverables
}: {
  index: PanelDiscoveryIndex;
  graph: PanelConnectivityGraph;
  panelLabel: string;
  activeSheetId: string;
  internalWires: PanelInternalWireCatalogRow[];
  connectionPatterns: PanelConnectionPatternCatalogRow[];
  wireSettings: PanelWireSettings;
  endpointCatalog: PanelInternalWireEndpointCatalog;
  proposedWireId: string;
  workflow: PanelGuidedWorkflowSnapshot;
  readOnly?: boolean;
  initialTab?: PanelDiscoveryTab;
  initialFocusId?: string;
  onCancel: () => void;
  onPlaceAsset: (assetId: string) => void;
  onSelectPlacement: (placementId: string) => void;
  onRemovePlacement: (placementId: string) => void;
  onMapTermination: (
    terminationId: string,
    target: PanelTerminalSideRef
  ) => void;
  onResetTerminationMapping: (terminationId: string) => void;
  onSelectInternalWireRoute: (connectionId: string) => void;
  onAddInternalWireRoute: (wireRecordId: string) => void;
  onDeleteInternalWire: (
    wireRecordId: string,
    connectionId?: string
  ) => void;
  onUpdateWireSettings: (settings: PanelWireSettings) => void;
  onSelectPatternRoute: (connectionId: string) => void;
  onAddPatternRepresentation: (patternId: string) => void;
  onRemovePatternRepresentation: (patternId: string) => void;
  onDeletePattern: (patternId: string) => void;
  onFocusAsset: (assetId: string) => void;
  onCreateInternalWire: (
    submission: PanelInternalWireFormSubmission
  ) => PanelInternalWireFormResult;
  onPickInternalWire: () => void;
  onCenterEquipment: () => void;
  onStartPattern: () => void;
  onOpenReview: () => void;
  onOpenDeliverables: () => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const [tab, setTab] = useState<PanelDiscoveryTab>(initialTab);
  const [mode, setMode] = useState<"guided" | "advanced">(() =>
    initialTab !== "assets" || initialFocusId ? "advanced" : "guided"
  );
  const [query, setQuery] = useState(initialFocusId ?? "");
  const deferredQuery = useDeferredValue(query);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [mappingTerminationId, setMappingTerminationId] = useState<
    string | null
  >(null);
  const [isWireSettingsOpen, setIsWireSettingsOpen] = useState(false);
  const getInternalWirePairState = useCallback(
    (from: PanelTerminalSideRef, to: PanelTerminalSideRef) =>
      getPanelInternalWireEndpointPairState({
        graph,
        panelAssetId: index.panelAssetId,
        from,
        to
      }),
    [graph, index.panelAssetId]
  );
  const assets = useMemo(() => [...index.assetsById.values()], [index]);
  const mappingRows = useMemo(
    () => [...index.mappingRowsByTerminationId.values()],
    [index]
  );
  const terminations = mappingRows;
  const terminalRows = useMemo(
    () => [...index.terminalCatalog.rowsByTerminalId.values()],
    [index]
  );
  const normalizedQuery = deferredQuery.trim().toLowerCase();
  const filteredAssets = assets.filter(
    (row) =>
      (statusFilter === "all" || row.status === statusFilter) &&
      (!normalizedQuery || assetSearchText(row).includes(normalizedQuery))
  );
  const filteredTerminations = terminations.filter(
    (row) =>
      (statusFilter === "all" || row.status === statusFilter) &&
      (!normalizedQuery || terminationSearchText(row).includes(normalizedQuery))
  );
  const filteredTerminalRows = terminalRows.filter(
    (row) => !normalizedQuery || terminalSearchText(row).includes(normalizedQuery)
  );
  const filteredInternalWires = internalWires.filter(
    (row) => !normalizedQuery || internalWireSearchText(row).includes(normalizedQuery)
  );
  const filteredPatterns = connectionPatterns.filter(
    (row) => !normalizedQuery || patternSearchText(row).includes(normalizedQuery)
  );
  const pagedAssets = paginateTableRows(filteredAssets, page, pageSize);
  const pagedTerminations = paginateTableRows(filteredTerminations, page, pageSize);
  const pagedTerminalRows = paginateTableRows(filteredTerminalRows, page, pageSize);
  const pagedInternalWires = paginateTableRows(filteredInternalWires, page, pageSize);
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
            terminationId: mappingTerminationId
          })
        : [],
    [graph, index.panelAssetId, index.terminalCatalog, mappingTerminationId]
  );
  const counts = useMemo(() => {
    const rows = [...assets, ...terminations];

    return PANEL_DISCOVERY_STATUSES.reduce<Record<PanelDiscoveryStatus, number>>(
      (current, status) => ({
        ...current,
        [status]: rows.filter((row) => row.status === status).length
      }),
      {
        available: 0,
        represented: 0,
        missing: 0,
        conflicting: 0,
        unsupported: 0
      }
    );
  }, [assets, terminations]);

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
              Detailed Panel Workflow
            </h2>
            <p id={descriptionId} className="mt-1 text-xs leading-5 text-slate-600">
              {panelLabel}. Guided work references existing engineering records;
              Advanced Workbench retains the complete panel catalogs.
            </p>
          </div>
          <div
            className="flex shrink-0 rounded-md border border-slate-200 bg-slate-50 p-0.5"
            aria-label="Detailed Panel workflow mode"
          >
            <button
              type="button"
              className={[
                "rounded px-3 py-1.5 text-xs font-semibold",
                mode === "guided"
                  ? "bg-white text-teal-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              ].join(" ")}
              aria-pressed={mode === "guided"}
              onClick={() => setMode("guided")}
            >
              Guided
            </button>
            <button
              type="button"
              className={[
                "rounded px-3 py-1.5 text-xs font-semibold",
                mode === "advanced"
                  ? "bg-white text-teal-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              ].join(" ")}
              aria-pressed={mode === "advanced"}
              onClick={() => setMode("advanced")}
            >
              Advanced Workbench
            </button>
          </div>
          <button
            type="button"
            className="icon-button h-8 w-8 p-0"
            onClick={onCancel}
            aria-label="Close panel work queue"
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
          {mode === "advanced" ? <>
          <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_190px_auto]">
            <div className="relative">
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
                aria-label="Search panel work queue"
              />
            </div>
            <select
              className="field-input"
              value={statusFilter}
              onChange={(event) => {
                setPage(1);
                setStatusFilter(event.currentTarget.value as StatusFilter);
              }}
              aria-label="Filter panel work queue by status"
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status === "all"
                    ? "All statuses"
                    : panelDiscoveryStatusLabel(status)}
                </option>
              ))}
            </select>
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              {PANEL_DISCOVERY_STATUSES.map((status) => (
                <button
                  key={status}
                  type="button"
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 font-semibold text-slate-600 hover:bg-slate-100"
                  onClick={() => {
                    setPage(1);
                    setStatusFilter(status);
                  }}
                >
                  {panelDiscoveryStatusLabel(status)} {counts[status]}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-1" role="tablist" aria-label="Panel work queue views">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "assets"}
              className={tab === "assets" ? "icon-button icon-button-primary" : "icon-button"}
              onClick={() => {
                setPage(1);
                setTab("assets");
              }}
            >
              Associated Assets ({assets.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "terminations"}
              className={tab === "terminations" ? "icon-button icon-button-primary" : "icon-button"}
              onClick={() => {
                setPage(1);
                setTab("terminations");
              }}
            >
              External Terminations ({terminations.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "terminal-map"}
              className={tab === "terminal-map" ? "icon-button icon-button-primary" : "icon-button"}
              onClick={() => {
                setPage(1);
                setTab("terminal-map");
              }}
            >
              Terminal Map ({terminalRows.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "internal-wires"}
              className={tab === "internal-wires" ? "icon-button icon-button-primary" : "icon-button"}
              onClick={() => {
                setPage(1);
                setTab("internal-wires");
              }}
            >
              <Cable aria-hidden="true" size={14} />
              Internal Wires ({internalWires.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "patterns"}
              className={tab === "patterns" ? "icon-button icon-button-primary" : "icon-button"}
              onClick={() => {
                setPage(1);
                setTab("patterns");
              }}
            >
              <Network aria-hidden="true" size={14} />
              Connection Patterns ({connectionPatterns.length})
            </button>
            {tab === "internal-wires" ? (
              <button
                type="button"
                className="icon-button ml-auto"
                onClick={() => setIsWireSettingsOpen(true)}
              >
                <Settings2 aria-hidden="true" size={14} />
                Wire settings
              </button>
            ) : null}
            {tab === "patterns" ? (
              <button
                type="button"
                className="icon-button ml-auto"
                disabled={readOnly}
                onClick={onStartPattern}
              >
                <Network aria-hidden="true" size={14} />
                New pattern
              </button>
            ) : null}
          </div>
          </> : (
            <div className="flex items-center justify-between gap-4 text-xs text-slate-600">
              <span>
                Focused engineering sequence with derived progress. No checklist
                state or duplicate connectivity records are created.
              </span>
              <span className="shrink-0 font-semibold text-slate-800">
                {workflow.readyAssetCount}/{workflow.totalAssetCount} equipment ready
              </span>
            </div>
          )}
        </div>

        {mode === "guided" ? (
          <PanelGuidedWorkflow
            key={workflow.focusAssetId ?? "no-focus"}
            snapshot={workflow}
            index={index}
            internalWires={internalWires}
            connectionPatterns={connectionPatterns}
            endpointCatalog={endpointCatalog}
            proposedWireId={proposedWireId}
            wireDefaults={wireSettings.defaults}
            activeSheetId={activeSheetId}
            readOnly={readOnly}
            onFocusAsset={onFocusAsset}
            onPlaceAsset={onPlaceAsset}
            onSelectPlacement={onSelectPlacement}
            onRemovePlacement={onRemovePlacement}
            onRequestMapping={setMappingTerminationId}
            onResetTerminationMapping={onResetTerminationMapping}
            onSelectInternalWireRoute={onSelectInternalWireRoute}
            onAddInternalWireRoute={onAddInternalWireRoute}
            onDeleteInternalWire={onDeleteInternalWire}
            onCreateInternalWire={onCreateInternalWire}
            onGetInternalWirePairState={getInternalWirePairState}
            onPickInternalWire={onPickInternalWire}
            onCenterEquipment={onCenterEquipment}
            onOpenReview={onOpenReview}
            onOpenDeliverables={onOpenDeliverables}
            onOpenAdvanced={(nextTab, focusId) => {
              setMode("advanced");
              setTab(nextTab);
              setQuery(focusId ?? "");
              setStatusFilter("all");
              setPage(1);
            }}
          />
        ) : <>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {tab === "assets" ? (
            <table className="w-full min-w-[1040px] border-separate border-spacing-0 text-left text-xs">
              <thead className="sticky top-0 z-10 bg-white text-[10px] font-bold uppercase text-slate-500">
                <tr>
                  {[
                    "Status",
                    "Tag",
                    "Title / type",
                    "Terminals",
                    "Source sheets",
                    "Representation",
                    "Action"
                  ].map((heading) => (
                    <th key={heading} className="border-b border-slate-200 px-3 py-2.5">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagedAssets.map((row) => (
                  <tr key={row.assetId} className="align-top hover:bg-slate-50">
                    <td className="border-b border-slate-100 px-3 py-3">
                      <PanelDiscoveryStatusBadge status={row.status} />
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 font-bold text-slate-950">
                      {row.tag}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3">
                      <span className="block font-semibold text-slate-800">{row.title}</span>
                      <span className="mt-0.5 block text-slate-500">{row.type.replaceAll("_", " ")}</span>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                      {row.terminalCount}
                    </td>
                    <td className="max-w-sm border-b border-slate-100 px-3 py-3 text-slate-600">
                      {sourceSheetSummary(row) || "No source occurrence"}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-600">
                      {row.representedPlacementId ? "On this sheet" : "Not represented"}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3">
                      {row.status === "available" ? (
                        <button type="button" className="icon-button icon-button-primary" onClick={() => onPlaceAsset(row.assetId)}>
                          Place
                        </button>
                      ) : row.status === "represented" && row.representedPlacementId ? (
                        <div className="flex gap-2">
                          <button type="button" className="icon-button" onClick={() => onSelectPlacement(row.representedPlacementId!)}>
                            Select
                          </button>
                          <button type="button" className="icon-button text-rose-700" onClick={() => onRemovePlacement(row.representedPlacementId!)}>
                            Remove representation
                          </button>
                        </div>
                      ) : (
                        <span className="block max-w-xs text-[11px] leading-4 text-slate-500">
                          {row.disabledReason ?? "Action unavailable."}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                    "Action"
                  ].map((heading) => (
                    <th key={heading} className="border-b border-slate-200 px-3 py-2.5">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagedTerminations.map((row) => (
                  <tr key={row.terminationId} className="align-top hover:bg-slate-50">
                    <td className="border-b border-slate-100 px-3 py-3">
                      <PanelDiscoveryStatusBadge status={row.status} />
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3">
                      <span className="block font-bold text-slate-950">{row.targetAssetTag ?? "Unresolved asset"}</span>
                      <span className="mt-0.5 block text-slate-500">
                        {row.target ? `${row.target.terminalKey} / ${row.target.side}` : "Terminal unresolved"}
                      </span>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 font-mono text-[11px] text-slate-800">
                      {row.wireId || "-"}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                      <span className="block">{row.cableTag || row.cableAssetId || "-"}</span>
                      <span className="mt-0.5 block text-slate-500">{row.conductorKey || "No conductor key"}</span>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                      Sheet {row.sourceSheet.number} - {row.sourceSheet.name}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 font-mono text-[10px] leading-4 text-slate-600">
                      <span className="block">{row.source.connectionId} / {row.source.endpointRole}</span>
                      <span className="block">{row.source.placementId} / {row.source.anchorKey}</span>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${row.mappingMode === "manual" ? "border-violet-200 bg-violet-50 text-violet-800" : row.mappingMode === "conflicting" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-slate-200 bg-slate-50 text-slate-700"}`}>
                        {mappingModeLabel(row)}
                      </span>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="icon-button icon-button-primary"
                          disabled={Boolean(row.mappingDisabledReason)}
                          onClick={() => setMappingTerminationId(row.terminationId)}
                        >
                          {row.mappingMode === "unmapped" ? "Map" : "Change mapping"}
                        </button>
                        {row.mappingMode === "manual" ? (
                          <button
                            type="button"
                            className="icon-button"
                            onClick={() => onResetTerminationMapping(row.terminationId)}
                          >
                            Reset automatic
                          </button>
                        ) : null}
                        {row.status === "available" && row.targetAssetId ? (
                          <button type="button" className="icon-button" onClick={() => onPlaceAsset(row.targetAssetId!)}>
                            Place target asset
                          </button>
                        ) : row.status === "represented" && row.representedPlacementId ? (
                          <button type="button" className="icon-button" onClick={() => onSelectPlacement(row.representedPlacementId!)}>
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
                  {["Asset / terminal", "Function", "Field side occupancy", "Field provenance", "Internal side", "Mapping", "Findings"].map((heading) => (
                    <th key={heading} className="border-b border-slate-200 px-3 py-2.5">
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
                  const fieldOccupancy = fieldSide ? row.occupancy[fieldSide] : undefined;
                  const fieldOccupant = fieldOccupancy?.occupants.find(
                    (occupant) => occupant.kind === "external_termination"
                  );
                  const mappingRow = fieldOccupant
                    ? index.mappingRowsByTerminationId.get(fieldOccupant.id)
                    : undefined;
                  const internalOccupancy = row.occupancy.internal;

                  return (
                    <tr key={row.terminalId} className="align-top hover:bg-slate-50">
                      <td className="border-b border-slate-100 px-3 py-3">
                        <span className="block font-bold text-slate-950">{row.assetTag}:{row.label}</span>
                        <span className="mt-0.5 block text-[11px] text-slate-500">{row.assetTitle}</span>
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
                            <span className="block">{fieldOccupant.cableTag || "-"} / {fieldOccupant.conductorKey || "-"}</span>
                            <span className="mt-0.5 block">Sheet {fieldOccupant.sourceSheet.number} - {fieldOccupant.sourceSheet.name}</span>
                          </>
                        ) : "-"}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3">
                        {row.supportedSides.includes("internal")
                          ? internalOccupancy?.status ?? "available"
                          : "Not applicable"}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3">
                        {mappingRow ? (
                          <button
                            type="button"
                            className="icon-button"
                            onClick={() => setMappingTerminationId(mappingRow.terminationId)}
                          >
                            {mappingModeLabel(mappingRow)}
                          </button>
                        ) : "-"}
                      </td>
                      <td className="max-w-xs border-b border-slate-100 px-3 py-3 text-[11px] leading-4 text-slate-600">
                        {row.findings.length > 0
                          ? row.findings.map((finding) => finding.message).join("; ")
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
                  {["Wire ID", "From", "To", "Attributes", "Route sheets", "Findings", "Action"].map((heading) => (
                    <th key={heading} className="border-b border-slate-200 px-3 py-2.5">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagedInternalWires.map((row) => {
                  const activeRoute = row.routeOccurrences.find(
                    (route) => route.sheetId === activeSheetId
                  );
                  return (
                    <tr key={row.wire.id} className="align-top hover:bg-slate-50">
                      <td className="border-b border-slate-100 px-3 py-3 font-mono font-bold text-blue-900">
                        {row.wire.wireId}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                        {row.fromLabel}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                        {row.toLabel}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 text-[11px] text-slate-600">
                        {[row.wire.attributes?.color, row.wire.attributes?.size, row.wire.attributes?.wireType]
                          .filter(Boolean)
                          .join(" / ") || "-"}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 text-[11px] text-slate-600">
                        {row.routeSheets.length > 0
                          ? row.routeSheets.map((sheet) => `Sheet ${sheet.number} - ${sheet.name}`).join("; ")
                          : "Unrepresented"}
                      </td>
                      <td className="max-w-xs border-b border-slate-100 px-3 py-3 text-[11px] leading-4 text-slate-600">
                        {row.findings.length > 0
                          ? row.findings.map((finding) => finding.message).join("; ")
                          : "-"}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          {activeRoute ? (
                            <button
                              type="button"
                              className="icon-button icon-button-primary"
                              onClick={() => onSelectInternalWireRoute(activeRoute.connectionId)}
                            >
                              Select route
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="icon-button icon-button-primary"
                              onClick={() => onAddInternalWireRoute(row.wire.id)}
                            >
                              Add representation
                            </button>
                          )}
                          <button
                            type="button"
                            className="icon-button border-rose-200 text-rose-700"
                            onClick={() => onDeleteInternalWire(row.wire.id, activeRoute?.connectionId)}
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

          {(tab === "assets"
            ? filteredAssets
            : tab === "terminations"
              ? filteredTerminations
              : tab === "terminal-map"
                ? filteredTerminalRows
                : tab === "internal-wires"
                  ? filteredInternalWires
                  : filteredPatterns
          ).length === 0 ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
              No records match the current search and status filter.
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
        </>}

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs text-slate-500">
          <span>{index.warnings.length} discovery finding{index.warnings.length === 1 ? "" : "s"}</span>
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
      {isWireSettingsOpen ? (
        <PanelWireSettingsDialog
          settings={wireSettings}
          onCancel={() => setIsWireSettingsOpen(false)}
          onSave={(settings) => {
            onUpdateWireSettings(settings);
            setIsWireSettingsOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
