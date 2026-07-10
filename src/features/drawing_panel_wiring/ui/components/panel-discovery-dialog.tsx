"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { CircuitBoard, Search, X } from "lucide-react";
import type {
  ExternalTerminationCatalogRow,
  PanelAssociatedAssetCatalogRow,
  PanelDiscoveryIndex,
  PanelDiscoveryStatus
} from "../../api/public";
import {
  PanelDiscoveryStatusBadge,
  panelDiscoveryStatusLabel
} from "./panel-discovery-status";

type DiscoveryTab = "assets" | "terminations";
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
  panelLabel,
  onCancel,
  onPlaceAsset,
  onSelectPlacement,
  onRemovePlacement
}: {
  index: PanelDiscoveryIndex;
  panelLabel: string;
  onCancel: () => void;
  onPlaceAsset: (assetId: string) => void;
  onSelectPlacement: (placementId: string) => void;
  onRemovePlacement: (placementId: string) => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const [tab, setTab] = useState<DiscoveryTab>("assets");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const assets = useMemo(() => [...index.assetsById.values()], [index]);
  const terminations = useMemo(
    () => [...index.terminationsById.values()],
    [index]
  );
  const normalizedQuery = query.trim().toLowerCase();
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
              Panel Work Queue
            </h2>
            <p id={descriptionId} className="mt-1 text-xs leading-5 text-slate-600">
              {panelLabel}. Existing assets and field terminations are referenced;
              no physical assets or field connections are created here.
            </p>
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
                onChange={(event) => setQuery(event.currentTarget.value)}
                aria-label="Search panel work queue"
              />
            </div>
            <select
              className="field-input"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.currentTarget.value as StatusFilter)
              }
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
                  onClick={() => setStatusFilter(status)}
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
              onClick={() => setTab("assets")}
            >
              Associated Assets ({assets.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "terminations"}
              className={tab === "terminations" ? "icon-button icon-button-primary" : "icon-button"}
              onClick={() => setTab("terminations")}
            >
              External Terminations ({terminations.length})
            </button>
          </div>
        </div>

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
                {filteredAssets.map((row) => (
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
          ) : (
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
                    "Action"
                  ].map((heading) => (
                    <th key={heading} className="border-b border-slate-200 px-3 py-2.5">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredTerminations.map((row) => (
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
                      {row.status === "available" && row.targetAssetId ? (
                        <button type="button" className="icon-button icon-button-primary" onClick={() => onPlaceAsset(row.targetAssetId!)}>
                          Place target asset
                        </button>
                      ) : row.status === "represented" && row.representedPlacementId ? (
                        <button type="button" className="icon-button" onClick={() => onSelectPlacement(row.representedPlacementId!)}>
                          Select represented asset
                        </button>
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
          )}

          {(tab === "assets" ? filteredAssets : filteredTerminations).length === 0 ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
              No records match the current search and status filter.
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs text-slate-500">
          <span>{index.warnings.length} discovery finding{index.warnings.length === 1 ? "" : "s"}</span>
          <button type="button" className="icon-button" onClick={onCancel}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
