"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  ChevronDown,
  ChevronRight,
  FilterX,
  LoaderCircle,
  MousePointer2,
  Search,
  X
} from "lucide-react";
import { networkDeviceTypeSchema } from "@/features/symbol_registry/api/public";
import {
  filterAndGroupNetworkCatalog,
  networkDeviceTypeLabel
} from "../../logic/services/network-library-catalog";
import type {
  ApprovedNetworkSymbolCatalogItem,
  NetworkLibraryFilters,
  NetworkPlacementToolState
} from "../../types";
import { NetworkSymbolPreview } from "./network-symbol-preview";

function managedStatusLabel(value: boolean | null): string {
  return value === null ? "Unspecified" : value ? "Managed" : "Unmanaged";
}

function mediaSummary(item: ApprovedNetworkSymbolCatalogItem): string {
  return item.mediaTypes.length > 0
    ? item.mediaTypes
        .map((media) =>
          media.charAt(0).toUpperCase().concat(media.slice(1))
        )
        .join(", ")
    : "No media specified";
}

export function NetworkMapLibraryPanel({
  catalogItems,
  filters,
  placementTool,
  onFiltersChange,
  onPlacementToggle,
  headerAction
}: {
  catalogItems: ApprovedNetworkSymbolCatalogItem[];
  filters: NetworkLibraryFilters;
  placementTool: NetworkPlacementToolState;
  onFiltersChange: (filters: NetworkLibraryFilters) => void;
  onPlacementToggle: (item: ApprovedNetworkSymbolCatalogItem) => void;
  headerAction?: ReactNode;
}) {
  const groups = useMemo(
    () => filterAndGroupNetworkCatalog(catalogItems, filters),
    [catalogItems, filters]
  );
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    () => new Set(networkDeviceTypeSchema.options)
  );
  const resultCount = groups.reduce(
    (total, group) => total + group.items.length,
    0
  );
  const hasActiveFilters =
    filters.query.trim().length > 0 ||
    filters.deviceType !== "all" ||
    filters.managed !== "all";

  const updateFilters = (updates: Partial<NetworkLibraryFilters>) => {
    onFiltersChange({ ...filters, ...updates });
  };

  const clearFilters = () => {
    onFiltersChange({ query: "", deviceType: "all", managed: "all" });
  };

  const toggleGroup = (key: string) => {
    setOpenGroups((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <section className="tool-panel overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
        <div>
          <h2 className="text-sm font-bold">Network Library</h2>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {catalogItems.length} approved device
            {catalogItems.length === 1 ? "" : "s"}
          </p>
        </div>
        {headerAction ?? null}
      </div>

      <div className="space-y-3 border-b border-slate-200 bg-slate-50/60 p-3">
        <div className="relative">
          <Search
            aria-hidden="true"
            size={14}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <label className="sr-only" htmlFor="network-library-search">
            Search network devices
          </label>
          <input
            id="network-library-search"
            className="field-input pl-8 pr-8"
            placeholder="Search devices or ports"
            value={filters.query}
            onChange={(event) => updateFilters({ query: event.currentTarget.value })}
          />
          {filters.query ? (
            <button
              type="button"
              className="absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center text-slate-500 hover:text-slate-900"
              aria-label="Clear network device search"
              title="Clear search"
              onClick={() => updateFilters({ query: "" })}
            >
              <X aria-hidden="true" size={14} />
            </button>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="field-label" htmlFor="network-device-type-filter">
              Device type
            </label>
            <select
              id="network-device-type-filter"
              className="field-input"
              value={filters.deviceType}
              onChange={(event) =>
                updateFilters({
                  deviceType: event.currentTarget
                    .value as NetworkLibraryFilters["deviceType"]
                })
              }
            >
              <option value="all">All types</option>
              {networkDeviceTypeSchema.options.map((deviceType) => (
                <option key={deviceType} value={deviceType}>
                  {networkDeviceTypeLabel(deviceType)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="network-managed-filter">
              Managed
            </label>
            <select
              id="network-managed-filter"
              className="field-input"
              value={filters.managed}
              onChange={(event) =>
                updateFilters({
                  managed: event.currentTarget
                    .value as NetworkLibraryFilters["managed"]
                })
              }
            >
              <option value="all">All statuses</option>
              <option value="managed">Managed</option>
              <option value="unmanaged">Unmanaged</option>
              <option value="unspecified">Unspecified</option>
            </select>
          </div>
        </div>
      </div>

      <div className="max-h-[620px] space-y-3 overflow-auto p-3">
        {catalogItems.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500">
            No approved network devices are available. Approve a network symbol
            to add it to this library.
          </div>
        ) : null}

        {catalogItems.length > 0 && groups.length === 0 ? (
          <div className="space-y-3 py-8 text-center">
            <p className="text-sm text-slate-500">
              No network devices match the current filters.
            </p>
            {hasActiveFilters ? (
              <button
                type="button"
                className="icon-button mx-auto"
                onClick={clearFilters}
              >
                <FilterX aria-hidden="true" size={14} />
                Clear filters
              </button>
            ) : null}
          </div>
        ) : null}

        {groups.map((group) => {
          const isOpen = openGroups.has(group.key);

          return (
            <div key={group.key}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 px-1 py-1 text-left text-xs font-semibold text-slate-700 hover:text-slate-950"
                aria-expanded={isOpen}
                aria-controls={`network-library-group-${group.key}`}
                onClick={() => toggleGroup(group.key)}
              >
                <span className="inline-flex items-center gap-1.5">
                  {isOpen ? (
                    <ChevronDown aria-hidden="true" size={13} />
                  ) : (
                    <ChevronRight aria-hidden="true" size={13} />
                  )}
                  {group.label}
                </span>
                <span className="text-[10px] font-medium text-slate-500">
                  {group.items.length}
                </span>
              </button>

              {isOpen ? (
                <div
                  id={`network-library-group-${group.key}`}
                  className="mt-2 space-y-2"
                >
                  {group.items.map((item) => (
                    <button
                      key={item.versionId}
                      type="button"
                      className={[
                        "flex w-full min-w-0 gap-3 rounded-md border p-2.5 text-left transition",
                        placementTool.mode !== "idle" &&
                        placementTool.item.versionId === item.versionId
                          ? "border-teal-400 bg-teal-50 ring-1 ring-teal-200"
                          : "border-slate-200 bg-white hover:border-teal-200 hover:bg-teal-50/60"
                      ].join(" ")}
                      data-network-catalog-version={item.versionId}
                      aria-pressed={
                        placementTool.mode !== "idle" &&
                        placementTool.item.versionId === item.versionId
                      }
                      onClick={() => onPlacementToggle(item)}
                    >
                      <NetworkSymbolPreview
                        src={item.previewUrl}
                        name={item.displayName}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-xs font-semibold leading-snug text-slate-950">
                            {item.displayName}
                          </h3>
                          {placementTool.mode === "loading" &&
                          placementTool.item.versionId === item.versionId ? (
                            <LoaderCircle
                              aria-label={`Loading ${item.displayName} for placement`}
                              size={14}
                              className="shrink-0 animate-spin text-teal-700"
                            />
                          ) : placementTool.mode === "placing" &&
                            placementTool.item.versionId === item.versionId ? (
                            <MousePointer2
                              aria-label={`${item.displayName} is active for placement`}
                              size={14}
                              className="shrink-0 text-teal-700"
                            />
                          ) : null}
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-slate-500">
                          {[item.manufacturer, item.model]
                            .filter(Boolean)
                            .join(" / ") || "Manufacturer not specified"}
                        </p>
                        <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] leading-tight">
                          <div>
                            <dt className="text-slate-400">Ports</dt>
                            <dd className="font-medium text-slate-700">
                              {item.portCount}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-slate-400">Status</dt>
                            <dd className="font-medium text-slate-700">
                              {managedStatusLabel(item.managed)}
                            </dd>
                          </div>
                          <div className="col-span-2">
                            <dt className="text-slate-400">Media</dt>
                            <dd className="font-medium text-slate-700">
                              {mediaSummary(item)}
                            </dd>
                          </div>
                        </dl>
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}

        {groups.length > 0 ? (
          <div className="pt-1 text-center text-[10px] text-slate-400">
            Showing {resultCount} device{resultCount === 1 ? "" : "s"}
          </div>
        ) : null}
      </div>
    </section>
  );
}
