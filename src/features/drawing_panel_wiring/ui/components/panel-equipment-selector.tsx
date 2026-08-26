"use client";

import { useMemo, useState } from "react";
import { CheckSquare, LocateFixed, Plus, Square, Trash2 } from "lucide-react";
import type { PanelAssociatedAssetCatalogRow } from "../../api/public";
import { PanelDiscoveryStatusBadge } from "./panel-discovery-status";

export function PanelEquipmentSelector({
  rows,
  filteredRows,
  readOnly,
  onPlaceAssets,
  onSelectPlacement,
  onRemovePlacement,
  onCenterEquipment
}: {
  rows: PanelAssociatedAssetCatalogRow[];
  filteredRows: PanelAssociatedAssetCatalogRow[];
  readOnly: boolean;
  onPlaceAssets: (assetIds: string[]) => boolean;
  onSelectPlacement: (placementId: string) => void;
  onRemovePlacement: (placementId: string) => void;
  onCenterEquipment: () => void;
}) {
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(
    () => new Set()
  );
  const selectableAssetIds = useMemo(
    () =>
      filteredRows
        .filter((row) => row.status === "available")
        .map((row) => row.assetId),
    [filteredRows]
  );
  const effectiveSelectedAssetIds = useMemo(
    () =>
      selectableAssetIds.filter((assetId) => selectedAssetIds.has(assetId)),
    [selectableAssetIds, selectedAssetIds]
  );
  const allAvailableSelected =
    selectableAssetIds.length > 0 &&
    effectiveSelectedAssetIds.length === selectableAssetIds.length;

  const toggleAsset = (assetId: string) => {
    setSelectedAssetIds((current) => {
      const next = new Set(current);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      return next;
    });
  };

  const addSelected = () => {
    if (
      effectiveSelectedAssetIds.length > 0 &&
      onPlaceAssets(effectiveSelectedAssetIds)
    ) {
      setSelectedAssetIds(new Set());
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
        <button
          type="button"
          className="icon-button"
          disabled={readOnly || selectableAssetIds.length === 0}
          onClick={() =>
            setSelectedAssetIds(
              allAvailableSelected
                ? new Set()
                : new Set(selectableAssetIds)
            )
          }
        >
          {allAvailableSelected ? (
            <CheckSquare aria-hidden="true" size={15} />
          ) : (
            <Square aria-hidden="true" size={15} />
          )}
          {allAvailableSelected ? "Clear available" : "Select all available"}
        </button>
        <span className="text-xs text-slate-600">
          {effectiveSelectedAssetIds.length} selected
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          <button
            type="button"
            className="icon-button"
            disabled={readOnly}
            onClick={onCenterEquipment}
          >
            <LocateFixed aria-hidden="true" size={15} />
            Center equipment
          </button>
          <button
            type="button"
            className="icon-button icon-button-primary"
            disabled={readOnly || effectiveSelectedAssetIds.length === 0}
            onClick={addSelected}
          >
            <Plus aria-hidden="true" size={15} />
            Add selected to sheet
          </button>
        </div>
      </div>

      <table className="w-full min-w-[820px] border-separate border-spacing-0 text-left text-xs">
        <thead className="sticky top-0 z-10 bg-white text-[10px] font-bold uppercase text-slate-500">
          <tr>
            {[
              "Select",
              "Position",
              "Status",
              "Tag",
              "Title / type",
              "Terminal use",
              "Action"
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
          {rows.map((row) => {
            const selectable = !readOnly && row.status === "available";
            const selected = selectable && selectedAssetIds.has(row.assetId);
            return (
              <tr
                key={row.assetId}
                className={selected ? "align-top bg-teal-50/60" : "align-top hover:bg-slate-50"}
              >
                <td className="border-b border-slate-100 px-3 py-3">
                  <input
                    type="checkbox"
                    aria-label={`Select ${row.tag}`}
                    checked={selected}
                    disabled={!selectable}
                    onChange={() => toggleAsset(row.assetId)}
                  />
                </td>
                <td className="whitespace-nowrap border-b border-slate-100 px-3 py-3 text-slate-700">
                  {row.panelSequence ? (
                    <>
                      <span className="block text-sm font-semibold text-slate-900">
                        {row.panelSequence.position}
                      </span>
                      <span className="block text-[10px] text-slate-500">
                        Row {row.panelSequence.row} · Column{" "}
                        {row.panelSequence.column}
                      </span>
                    </>
                  ) : (
                    <span
                      className="text-slate-400"
                      title="No authoritative physical panel-layout position"
                    >
                      —
                    </span>
                  )}
                </td>
                <td className="border-b border-slate-100 px-3 py-3">
                  <PanelDiscoveryStatusBadge status={row.status} />
                </td>
                <td className="border-b border-slate-100 px-3 py-3 font-bold text-slate-950">
                  {row.tag}
                </td>
                <td className="border-b border-slate-100 px-3 py-3">
                  <span className="block font-semibold text-slate-800">
                    {row.title}
                  </span>
                  <span className="mt-0.5 block text-slate-500">
                    {row.type.replaceAll("_", " ")}
                  </span>
                </td>
                <td
                  className="whitespace-nowrap border-b border-slate-100 px-3 py-3"
                  title={`${row.terminalUsage.used} used and ${row.terminalUsage.unused} unused conductor connection points across ${row.terminalCount} terminals`}
                >
                  <span className="block font-semibold text-slate-700">
                    {row.terminalUsage.used} used
                  </span>
                  <span className="mt-0.5 block font-semibold text-teal-700">
                    {row.terminalUsage.unused} unused
                  </span>
                </td>
                <td className="border-b border-slate-100 px-3 py-3">
                  {row.status === "available" ? (
                    <button
                      type="button"
                      className="icon-button icon-button-primary"
                      disabled={readOnly}
                      onClick={() => onPlaceAssets([row.assetId])}
                    >
                      <Plus aria-hidden="true" size={14} />
                      Add
                    </button>
                  ) : row.status === "represented" &&
                    row.representedPlacementId ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="icon-button"
                        onClick={() =>
                          onSelectPlacement(row.representedPlacementId!)
                        }
                      >
                        <LocateFixed aria-hidden="true" size={14} />
                        Select
                      </button>
                      <button
                        type="button"
                        className="icon-button text-rose-700"
                        disabled={readOnly}
                        onClick={() =>
                          onRemovePlacement(row.representedPlacementId!)
                        }
                      >
                        <Trash2 aria-hidden="true" size={14} />
                        Remove
                      </button>
                    </div>
                  ) : (
                    <span className="block max-w-xs text-[11px] leading-4 text-slate-500">
                      {row.disabledReason ?? "Action unavailable."}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
