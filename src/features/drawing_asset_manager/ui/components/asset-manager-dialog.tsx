"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BatteryCharging,
  Box,
  Boxes,
  Cable,
  ChevronRight,
  CircuitBoard,
  Cpu,
  Earth,
  Gauge,
  Network,
  PackagePlus,
  PanelsTopLeft,
  Plus,
  Repeat2,
  Rows3,
  Search,
  ShieldCheck,
  ToggleLeft,
  Trash2,
  Workflow,
  Zap,
  type LucideIcon,
  X
} from "lucide-react";
import type {
  ApprovedDrawingSymbol,
  DrawingAssetType,
  DrawingModel
} from "@/features/drawing_canvas/api/asset-contracts";
import type { DrawingSymbolCatalogSummary } from "@/features/symbol_registry/api/public";
import {
  findAssetTagConflict,
  formatAssetTagConflictMessage,
  stepEngineeringTag
} from "@/features/drawing_canvas/api/asset-contracts";
import {
  allocateNextManagedAssetTag,
  assetTypeLabel,
  buildManagedAssetCatalog,
  getAssetDeletionBlockers,
  type ManagedAssetCatalogItem
} from "../../logic/use_cases/drawing-asset-manager-use-cases";
import type {
  ManagedAssetCreateInput,
  ManagedAssetUpdateInput
} from "../../data/schema";
import { applyStructuredTerminalStripMemberOrders } from "@/features/drawing_terminal_blocks/api/public";
import {
  ENGINEERING_ATTRIBUTE_DEFINITION_BY_KEY,
  formatEngineeringAttributeValue
} from "@/features/engineering_attributes/api/public";
import {
  EngineeringAttributesCard,
  type EngineeringAttributeChange
} from "@/features/engineering_attributes/ui/public";

const ASSET_GROUPS: Array<{
  type: DrawingAssetType;
  title: string;
  icon: LucideIcon;
}> = [
  { type: "instrument", title: "Level Devices / Instruments", icon: Gauge },
  { type: "controller", title: "Controllers / Monitors", icon: Cpu },
  { type: "panel", title: "Panels / Enclosures", icon: PanelsTopLeft },
  { type: "junction_box", title: "Junction Boxes", icon: Box },
  { type: "terminal_block", title: "Terminal Blocks", icon: Rows3 },
  { type: "breaker", title: "Breakers", icon: ToggleLeft },
  { type: "fuse", title: "Fuses", icon: Zap },
  { type: "relay", title: "Relays", icon: Workflow },
  { type: "power_supply", title: "Power Supplies", icon: BatteryCharging },
  { type: "isolator", title: "Isolators", icon: ShieldCheck },
  { type: "converter", title: "Converters", icon: Repeat2 },
  { type: "io_module", title: "I/O Modules", icon: CircuitBoard },
  { type: "network_device", title: "Network Devices", icon: Network },
  { type: "earth_bar", title: "Earth Bars", icon: Earth },
  { type: "cable", title: "Cables", icon: Cable },
  { type: "other", title: "Other Assets", icon: Boxes }
];

function AssetDetailSection({
  assetId,
  sectionKey,
  sectionNumber,
  title,
  subtitle,
  children
}: {
  assetId: string;
  sectionKey: string;
  sectionNumber: number;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const contentId = `asset-manager-${assetId}-${sectionKey}`;

  return (
    <section className="tool-panel overflow-hidden">
      <button
        type="button"
        className="group flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={() => setExpanded((current) => !current)}
      >
        <span className="min-w-0">
          <span className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-sky-200 bg-sky-50 text-[10px] font-bold tabular-nums text-sky-700">
              {sectionNumber}
            </span>
            <span className="truncate text-sm font-bold text-slate-950">
              {title}
            </span>
          </span>
          <span className="mt-1 block pl-[30px] text-xs text-slate-500">
            {subtitle}
          </span>
        </span>
        <span
          aria-hidden="true"
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors ${
            expanded
              ? "border-sky-200 bg-sky-50 text-sky-700"
              : "border-slate-200 bg-white text-slate-500 group-hover:border-slate-300 group-hover:text-slate-700"
          }`}
        >
          <ChevronRight
            size={17}
            strokeWidth={2.25}
            className={`transition-transform ${expanded ? "rotate-90" : ""}`}
          />
        </span>
      </button>
      {expanded ? (
        <div
          id={contentId}
          className="space-y-4 border-t border-slate-200 bg-slate-50 p-4"
        >
          {children}
        </div>
      ) : null}
    </section>
  );
}

function uniqueSheetReferences(asset: ManagedAssetCatalogItem): Array<{
  sheetId: string;
  label: string;
}> {
  return [
    ...new Map(
      asset.sheetRefs.map((reference) => [
        reference.sheetId,
        {
          sheetId: reference.sheetId,
          label: `Sheet ${reference.sheetNumber} - ${reference.sheetName}`
        }
      ])
    ).values()
  ];
}

function uniqueSheetLabels(asset: ManagedAssetCatalogItem): string[] {
  return uniqueSheetReferences(asset).map((reference) => reference.label);
}

function installedComponentNames(
  asset: ManagedAssetCatalogItem,
  symbols: ApprovedDrawingSymbol[]
): string[] {
  const names: string[] = [];

  const visit = (selections: typeof asset.componentSelections) => {
    for (const selection of selections ?? []) {
      const symbol = symbols.find(
        (candidate) =>
          candidate.symbolId === selection.symbolId &&
          candidate.versionId === selection.versionId
      );
      names.push(symbol?.displayName ?? `Missing ${selection.versionId}`);
      visit(selection.children);
    }
  };

  visit(asset.componentSelections);
  return names;
}

function assetMatchesSearch(
  asset: ManagedAssetCatalogItem,
  query: string
): boolean {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  return [
    asset.tag,
    asset.title,
    asset.description ?? "",
    asset.symbolName ?? "",
    asset.symbolKey ?? "",
    ...(asset.engineeringAttributes?.values.flatMap((value) => [
      ENGINEERING_ATTRIBUTE_DEFINITION_BY_KEY.get(value.definitionKey)?.label ??
        value.definitionKey,
      formatEngineeringAttributeValue(value)
    ]) ?? []),
    ...uniqueSheetLabels(asset)
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalizedQuery);
}

function symbolOptionLabel(
  symbol: Pick<DrawingSymbolCatalogSummary, "displayName" | "symbolKey">
): string {
  return `${symbol.displayName} (${symbol.symbolKey})`;
}

export function AssetManagerDialog({
  model,
  symbols,
  symbolCatalogSummaries,
  initialAssetId,
  onCancel,
  onCreateAsset,
  onUpdateAsset,
  onLoadSheet,
  onLoadSymbol,
  onDeleteAsset
}: {
  model: DrawingModel;
  symbols: ApprovedDrawingSymbol[];
  symbolCatalogSummaries: DrawingSymbolCatalogSummary[];
  initialAssetId?: string;
  onCancel: () => void;
  onCreateAsset: (input: ManagedAssetCreateInput) => {
    id: string;
    tag: string;
    title: string;
  };
  onUpdateAsset: (
    assetId: string,
    updates: ManagedAssetUpdateInput,
    engineeringAttributeChange?: EngineeringAttributeChange
  ) => void;
  onLoadSheet: (sheetId: string) => void;
  onLoadSymbol: (
    versionId: string
  ) => Promise<
    | { ok: true; symbol: ApprovedDrawingSymbol }
    | { ok: false; error: string }
  >;
  onDeleteAsset: (assetId: string) => { ok: true } | { ok: false; error: string };
}) {
  const titleId = "asset-manager-dialog-title";
  const descriptionId = "asset-manager-dialog-description";
  const catalog = useMemo(
    () => buildManagedAssetCatalog(model, symbols),
    [model, symbols]
  );
  const initialSelectedAsset = initialAssetId
    ? catalog.find((asset) => asset.id === initialAssetId)
    : undefined;
  const [query, setQuery] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState(
    initialSelectedAsset?.id ?? ""
  );
  const [expandedGroups, setExpandedGroups] = useState<Set<DrawingAssetType>>(
    () =>
      initialSelectedAsset
        ? new Set<DrawingAssetType>([initialSelectedAsset.type])
        : new Set<DrawingAssetType>()
  );
  const [isCreating, setIsCreating] = useState(catalog.length === 0);
  const [createType, setCreateType] = useState<DrawingAssetType>("instrument");
  const [createTag, setCreateTag] = useState(() =>
    allocateNextManagedAssetTag(model, "instrument")
  );
  const [createTitle, setCreateTitle] = useState("Instrument");
  const [createSymbolKey, setCreateSymbolKey] = useState("");
  const [draftState, setDraftState] = useState<{
    assetId: string;
    tag: string;
    title: string;
  }>({
    assetId: initialSelectedAsset?.id ?? "",
    tag: initialSelectedAsset?.tag ?? "",
    title: initialSelectedAsset?.title ?? ""
  });
  const [error, setError] = useState<string | null>(null);
  const [isLoadingCreateSymbol, setIsLoadingCreateSymbol] = useState(false);
  const filteredCatalog = useMemo(
    () => catalog.filter((asset) => assetMatchesSearch(asset, query)),
    [catalog, query]
  );
  const groupedCatalog = useMemo(
    () =>
      ASSET_GROUPS.map((group) => ({
        ...group,
        assets: filteredCatalog.filter((asset) => asset.type === group.type),
        totalCount: catalog.filter((asset) => asset.type === group.type).length
      })).filter((group) => group.assets.length > 0),
    [catalog, filteredCatalog]
  );
  const isSearching = query.trim().length > 0;
  const selectedAsset = catalog.find((asset) => asset.id === selectedAssetId);
  const deletionBlockers = selectedAsset
    ? getAssetDeletionBlockers(model, selectedAsset.id)
    : [];
  const selectedSheetReferences = selectedAsset
    ? uniqueSheetReferences(selectedAsset)
    : [];
  const selectedDraft =
    selectedAsset && draftState.assetId === selectedAsset.id
      ? draftState
      : {
          assetId: selectedAsset?.id ?? "",
          tag: selectedAsset?.tag ?? "",
          title: selectedAsset?.title ?? ""
        };
  const decrementedTag = stepEngineeringTag(selectedDraft.tag, -1);
  const incrementedTag = stepEngineeringTag(selectedDraft.tag, 1);
  const selectedCreateSymbol = symbolCatalogSummaries.find(
    (symbol) => `${symbol.symbolId}:${symbol.versionId}` === createSymbolKey
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  const changeCreateType = (type: DrawingAssetType) => {
    setCreateType(type);
    setCreateTag(allocateNextManagedAssetTag(model, type));
    setCreateTitle(assetTypeLabel(type));
    setError(null);
  };

  const beginCreatingAsset = () => {
    setCreateTag(allocateNextManagedAssetTag(model, createType));
    setCreateTitle(assetTypeLabel(createType));
    setCreateSymbolKey("");
    setIsCreating(true);
    setError(null);
  };

  const toggleGroup = (type: DrawingAssetType) => {
    setExpandedGroups((current) => {
      const next = new Set(current);

      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }

      return next;
    });
  };

  const submitCreate = async () => {
    const normalizedTag = createTag.trim();
    const normalizedTitle = createTitle.trim();

    if (!normalizedTag) {
      setError("Enter an asset tag.");
      return;
    }

    const conflict = findAssetTagConflict(model, normalizedTag);

    if (conflict) {
      setError(formatAssetTagConflictMessage(normalizedTag, conflict));
      return;
    }

    setIsLoadingCreateSymbol(Boolean(selectedCreateSymbol));
    const loadedSymbol = selectedCreateSymbol
      ? await onLoadSymbol(selectedCreateSymbol.versionId)
      : undefined;
    setIsLoadingCreateSymbol(false);

    if (loadedSymbol && !loadedSymbol.ok) {
      setError(loadedSymbol.error);
      return;
    }

    try {
      const createdAsset = onCreateAsset({
        type: createType,
        tag: normalizedTag,
        title: normalizedTitle || assetTypeLabel(createType),
        symbolId: loadedSymbol?.symbol.symbolId,
        versionId: loadedSymbol?.symbol.versionId
      });
      setSelectedAssetId(createdAsset.id);
      setExpandedGroups((current) => {
        if (current.has(createType)) {
          return current;
        }

        const next = new Set(current);
        next.add(createType);
        return next;
      });
      setDraftState({
        assetId: createdAsset.id,
        tag: createdAsset.tag,
        title: createdAsset.title
      });
      setIsCreating(false);
      setCreateSymbolKey("");
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Asset could not be created."
      );
      return;
    }

    setError(null);
  };

  const updateSelectedAsset = (
    updates: ManagedAssetUpdateInput,
    engineeringAttributeChange?: EngineeringAttributeChange
  ) => {
    if (!selectedAsset) {
      return;
    }

    try {
      onUpdateAsset(selectedAsset.id, updates, engineeringAttributeChange);
      setError(null);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Asset could not be updated."
      );
    }
  };

  const updateDraftTag = (tag: string) => {
    if (!selectedAsset) {
      return;
    }

    setDraftState({
      assetId: selectedAsset.id,
      tag,
      title: selectedDraft.title
    });

    const conflict = findAssetTagConflict(model, tag, {
      allowedAssetIds: [selectedAsset.id]
    });

    if (conflict) {
      setError(formatAssetTagConflictMessage(tag, conflict));
      return;
    }

    if (tag.trim()) {
      updateSelectedAsset({ tag });
    }
  };

  const updateDraftTitle = (title: string) => {
    if (!selectedAsset) {
      return;
    }

    setDraftState({
      assetId: selectedAsset.id,
      tag: selectedDraft.tag,
      title
    });

    if (title.trim()) {
      updateSelectedAsset({ title });
    }
  };

  const deleteSelectedAsset = () => {
    if (!selectedAsset) {
      return;
    }

    const result = onDeleteAsset(selectedAsset.id);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setError(null);
  };

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
        className="flex h-[86vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-700">
            <PackagePlus aria-hidden="true" size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-h-6 items-center gap-2">
              <h2 id={titleId} className="text-sm font-semibold text-slate-950">
                Asset Manager
              </h2>
              <button
                type="button"
                className="icon-button icon-button-primary h-6 w-6 shrink-0 !min-h-6 !p-0"
                onClick={beginCreatingAsset}
                aria-label="Create asset"
                title="Create asset"
              >
                <Plus aria-hidden="true" size={14} strokeWidth={2.25} />
              </button>
            </div>
            <p
              id={descriptionId}
              className="mt-0.5 text-xs leading-4 text-slate-600"
            >
              Create and manage package assets, engineering data, and sheet
              associations.
            </p>
          </div>
          <button
            type="button"
            className="icon-button h-8 w-8 p-0"
            onClick={onCancel}
            aria-label="Close asset manager"
          >
            <X aria-hidden="true" size={14} />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(320px,0.95fr)_minmax(420px,1.05fr)]">
          <div className="flex min-h-0 flex-col border-r border-slate-200 bg-slate-50">
            <div className="border-b border-slate-200 p-4">
              <div className="relative">
                <Search
                  aria-hidden="true"
                  size={15}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  className="field-input pl-9"
                  value={query}
                  placeholder="Search assets or sheets"
                  onChange={(event) => setQuery(event.currentTarget.value)}
                  aria-label="Search drawing assets"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-3">
              {filteredCatalog.length === 0 ? (
                <div className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-500">
                  No assets in this drawing yet.
                </div>
              ) : (
                <>
                  <div
                    className="grid grid-cols-5 gap-2"
                    role="group"
                    aria-label="Asset categories"
                  >
                    {groupedCatalog.map((group) => {
                      const isExpanded =
                        isSearching || expandedGroups.has(group.type);
                      const contentId = `asset-manager-group-${group.type}`;
                      const GroupIcon = group.icon;
                      const assetCountLabel =
                        group.totalCount === 1 ? "asset" : "assets";

                      return (
                        <button
                          key={group.type}
                          type="button"
                          className={[
                            "relative flex min-h-14 items-center justify-center rounded-lg border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1",
                            isExpanded
                              ? "border-sky-300 bg-sky-50 text-sky-700 shadow-sm ring-1 ring-sky-100"
                              : "border-slate-200 bg-white text-slate-600 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
                          ].join(" ")}
                          aria-label={`${group.title}, ${group.totalCount} ${assetCountLabel}`}
                          aria-expanded={isExpanded}
                          aria-controls={contentId}
                          title={group.title}
                          onClick={() => toggleGroup(group.type)}
                        >
                          <GroupIcon
                            aria-hidden="true"
                            size={22}
                            strokeWidth={1.8}
                          />
                          <span
                            aria-hidden="true"
                            className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full border border-slate-200 bg-white px-1 text-[9px] font-bold leading-none tabular-nums text-slate-500"
                          >
                            {group.totalCount}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-4 space-y-4">
                    {groupedCatalog.map((group) => {
                      const isExpanded =
                        isSearching || expandedGroups.has(group.type);

                      if (!isExpanded) {
                        return null;
                      }

                      const contentId = `asset-manager-group-${group.type}`;

                      return (
                        <section key={group.type} id={contentId}>
                          <h3 className="mb-2 flex items-center justify-between px-1 text-[11px] font-bold uppercase tracking-wide text-slate-600">
                            <span>{group.title}</span>
                            <span className="text-[10px] font-semibold tabular-nums text-slate-400">
                              {group.assets.length}
                            </span>
                          </h3>
                          <div className="space-y-2">
                            {group.assets.map((asset) => (
                              <button
                                key={asset.id}
                                type="button"
                                className={[
                                  "w-full rounded-md border px-3 py-2 text-left text-xs transition",
                                  selectedAsset?.id === asset.id && !isCreating
                                    ? "border-sky-300 bg-sky-50"
                                    : "border-slate-200 bg-white hover:bg-slate-50"
                                ].join(" ")}
                                onClick={() => {
                                  setSelectedAssetId(asset.id);
                                  setExpandedGroups((current) => {
                                    if (current.has(group.type)) {
                                      return current;
                                    }

                                    const next = new Set(current);
                                    next.add(group.type);
                                    return next;
                                  });
                                  setDraftState({
                                    assetId: asset.id,
                                    tag: asset.tag,
                                    title: asset.title
                                  });
                                  setIsCreating(false);
                                  setError(null);
                                }}
                              >
                                <span className="flex items-start justify-between gap-3">
                                  <span className="min-w-0">
                                    <span className="block truncate font-bold text-slate-950">
                                      {asset.tag}
                                    </span>
                                    <span className="mt-0.5 block truncate text-slate-500">
                                      {asset.title}
                                    </span>
                                    {asset.componentSelections?.length ? (
                                      <span className="mt-1 block text-[11px] text-violet-700">
                                        Components:{" "}
                                        {installedComponentNames(
                                          asset,
                                          symbols
                                        ).join(" · ")}
                                      </span>
                                    ) : null}
                                    {asset.terminalStrip ? (
                                      <span className="mt-1 block text-[11px] text-teal-700">
                                        Terminal strip:{" "}
                                        {asset.terminalStrip.members.length} members
                                      </span>
                                    ) : null}
                                  </span>
                                  <span className="shrink-0 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-bold text-slate-500">
                                    {asset.occurrenceCount}
                                  </span>
                                </span>
                                {asset.warnings.length > 0 ? (
                                  <span className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                                    <AlertTriangle aria-hidden="true" size={12} />
                                    Needs review
                                  </span>
                                ) : null}
                              </button>
                            ))}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="min-h-0 overflow-auto p-5">
            {isCreating ? (
              <div className="mx-auto max-w-xl space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-950">
                    Create asset
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Create a drawing package asset before placing it on a sheet.
                  </p>
                </div>

                <div>
                  <label className="field-label" htmlFor="asset-manager-type">
                    Asset type
                  </label>
                  <select
                    id="asset-manager-type"
                    className="field-input"
                    value={createType}
                    onChange={(event) =>
                      changeCreateType(event.currentTarget.value as DrawingAssetType)
                    }
                  >
                    {ASSET_GROUPS.map((group) => (
                      <option key={group.type} value={group.type}>
                        {assetTypeLabel(group.type)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="field-label" htmlFor="asset-manager-tag">
                    Tag
                  </label>
                  <input
                    id="asset-manager-tag"
                    className="field-input"
                    value={createTag}
                    onChange={(event) => setCreateTag(event.currentTarget.value)}
                  />
                </div>

                <div>
                  <label className="field-label" htmlFor="asset-manager-title">
                    Title
                  </label>
                  <input
                    id="asset-manager-title"
                    className="field-input"
                    value={createTitle}
                    onChange={(event) => setCreateTitle(event.currentTarget.value)}
                  />
                </div>

                <div>
                  <label className="field-label" htmlFor="asset-manager-symbol">
                    Approved symbol
                  </label>
                  <select
                    id="asset-manager-symbol"
                    className="field-input"
                    value={createSymbolKey}
                    onChange={(event) =>
                      setCreateSymbolKey(event.currentTarget.value)
                    }
                  >
                    <option value="">No symbol selected yet</option>
                    {symbolCatalogSummaries.map((symbol) => (
                      <option
                        key={`${symbol.symbolId}:${symbol.versionId}`}
                        value={`${symbol.symbolId}:${symbol.versionId}`}
                      >
                        {symbolOptionLabel(symbol)}
                      </option>
                    ))}
                  </select>
                </div>

                {error ? (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                    {error}
                  </div>
                ) : null}

                <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => {
                      setIsCreating(false);
                      setError(null);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="icon-button icon-button-primary"
                    disabled={isLoadingCreateSymbol}
                    onClick={() => void submitCreate()}
                  >
                    <Plus aria-hidden="true" size={14} />
                    {isLoadingCreateSymbol ? "Loading symbol..." : "Create asset"}
                  </button>
                </div>
              </div>
            ) : selectedAsset ? (
              <div className="mx-auto max-w-2xl space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-bold uppercase text-slate-500">
                      {assetTypeLabel(selectedAsset.type)}
                    </div>
                    <h3 className="mt-1 text-lg font-bold text-slate-950">
                      {selectedAsset.tag}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {selectedAsset.title}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="icon-button icon-button-danger"
                    disabled={deletionBlockers.length > 0}
                    onClick={deleteSelectedAsset}
                    title={
                      deletionBlockers.length > 0
                        ? "Remove this asset from sheets before deleting it."
                        : "Delete asset"
                    }
                  >
                    <Trash2 aria-hidden="true" size={14} />
                    Delete asset
                  </button>
                </div>

                <AssetDetailSection
                  key={`identity:${selectedAsset.id}`}
                  assetId={selectedAsset.id}
                  sectionKey="identity"
                  sectionNumber={1}
                  title="Identity"
                  subtitle="Tag, category, title, and description"
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                    <label className="field-label" htmlFor="selected-asset-tag">
                      Tag
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="selected-asset-tag"
                        className="field-input"
                        value={selectedDraft.tag}
                        onChange={(event) => updateDraftTag(event.currentTarget.value)}
                        onBlur={() => {
                          if (!selectedDraft.tag.trim()) {
                            setDraftState({
                              assetId: selectedAsset.id,
                              tag: selectedAsset.tag,
                              title: selectedAsset.title
                            });
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="icon-button h-9 w-9 p-0"
                        disabled={!decrementedTag}
                        aria-label="Decrement asset tag number"
                        onClick={() => decrementedTag && updateDraftTag(decrementedTag)}
                      >
                        -
                      </button>
                      <button
                        type="button"
                        className="icon-button h-9 w-9 p-0"
                        disabled={!incrementedTag}
                        aria-label="Increment asset tag number"
                        onClick={() => incrementedTag && updateDraftTag(incrementedTag)}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="field-label" htmlFor="selected-asset-type">
                      Type
                    </label>
                    <select
                      id="selected-asset-type"
                      className="field-input"
                      value={selectedAsset.type}
                      onChange={(event) =>
                        updateSelectedAsset({
                          type: event.currentTarget.value as DrawingAssetType
                        })
                      }
                    >
                      {ASSET_GROUPS.map((group) => (
                        <option key={group.type} value={group.type}>
                          {assetTypeLabel(group.type)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="field-label" htmlFor="selected-asset-title">
                      Title
                    </label>
                    <input
                      id="selected-asset-title"
                      className="field-input"
                      value={selectedDraft.title}
                      onChange={(event) => updateDraftTitle(event.currentTarget.value)}
                      onBlur={() => {
                        if (!selectedDraft.title.trim()) {
                          setDraftState({
                            assetId: selectedAsset.id,
                            tag: selectedAsset.tag,
                            title: selectedAsset.title
                          });
                        }
                      }}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label
                      className="field-label"
                      htmlFor="selected-asset-description"
                    >
                      General description
                    </label>
                    <textarea
                      id="selected-asset-description"
                      className="field-input min-h-20 resize-y"
                      value={selectedAsset.description ?? ""}
                      maxLength={400}
                      placeholder="Optional engineering description"
                      onChange={(event) =>
                        updateSelectedAsset({
                          description: event.currentTarget.value
                        })
                      }
                    />
                    </div>
                  </div>

                  {selectedAsset.terminalBlock ? (
                    <section className="rounded-md border border-slate-200 bg-white px-4 py-3 text-xs text-slate-700">
                      <div className="font-bold uppercase text-slate-500">
                        Terminal block group
                      </div>
                      <div className="mt-1 font-semibold text-slate-900">
                        {selectedAsset.terminalBlock.count} terminals / range{" "}
                        {selectedAsset.terminalBlock.startNumber} -{" "}
                        {selectedAsset.terminalBlock.startNumber +
                          selectedAsset.terminalBlock.count -
                          1}
                      </div>
                    </section>
                  ) : null}

                  {selectedAsset.terminalStrip ? (
                    <section className="overflow-hidden rounded-md border border-slate-200 bg-white">
                      <div className="border-b border-slate-200 px-4 py-3">
                        <h4 className="text-sm font-bold text-slate-950">
                          Terminal strip members
                        </h4>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Nested under {selectedAsset.tag}; members are not
                          separate assets.
                        </p>
                      </div>
                      <div className="max-h-64 overflow-auto p-3">
                        <div className="space-y-2">
                          {applyStructuredTerminalStripMemberOrders(
                            selectedAsset.terminalStrip
                          ).members.map((member) => {
                            const memberSymbol = symbols.find(
                              (symbol) =>
                                symbol.symbolId === member.symbolId &&
                                symbol.versionId === member.versionId
                            );
                            return (
                              <div
                                key={member.id}
                                className="grid grid-cols-[64px_80px_minmax(0,1fr)] gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
                              >
                                <span className="font-bold text-slate-700">
                                  {member.token}
                                </span>
                                <span className="text-slate-600">
                                  {member.designation ??
                                    member.role.replace("_", " ")}
                                </span>
                                <span className="min-w-0">
                                  <span className="block truncate font-medium text-slate-900">
                                    {memberSymbol?.displayName ??
                                      "Pinned symbol unavailable"}
                                  </span>
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </section>
                  ) : null}
                </AssetDetailSection>

                <EngineeringAttributesCard
                  key={`engineering-attributes:${selectedAsset.id}`}
                  assetId={selectedAsset.id}
                  assetType={selectedAsset.type}
                  container={selectedAsset.engineeringAttributes}
                  onChange={(engineeringAttributes, change) =>
                    updateSelectedAsset({ engineeringAttributes }, change)
                  }
                  sectionNumber={2}
                  title="Engineering Attributes"
                  defaultExpanded={false}
                />

                <AssetDetailSection
                  key={`sheet-associations:${selectedAsset.id}`}
                  assetId={selectedAsset.id}
                  sectionKey="sheet-associations"
                  sectionNumber={3}
                  title="Sheet Associations"
                  subtitle={`${selectedSheetReferences.length} associated ${selectedSheetReferences.length === 1 ? "sheet" : "sheets"}`}
                >
                  {selectedSheetReferences.length > 0 ? (
                    <div className="grid gap-2">
                      {selectedSheetReferences.map((reference) => (
                        <div
                          key={reference.sheetId}
                          className="flex min-h-9 items-center gap-3 rounded-md border border-slate-200 bg-white py-1 pl-3 pr-1 text-xs font-medium text-slate-700"
                        >
                          <span className="min-w-0 flex-1 truncate">
                            {reference.label}
                          </span>
                          <button
                            type="button"
                            className="icon-button h-8 shrink-0 px-2.5 text-[11px] font-semibold"
                            aria-label={`Load ${reference.label}`}
                            title={`Load ${reference.label}`}
                            onClick={() => onLoadSheet(reference.sheetId)}
                          >
                            Load sheet
                            <ArrowRight
                              aria-hidden="true"
                              size={13}
                              strokeWidth={2.25}
                            />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">
                      This asset is not placed on any sheet.
                    </p>
                  )}
                </AssetDetailSection>

                {selectedAsset.warnings.length > 0 ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                    {selectedAsset.warnings.join(" ")}
                  </div>
                ) : null}

                {deletionBlockers.length > 0 ? (
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    Delete is available after this asset is disassociated from
                    sheets.{" "}
                    {deletionBlockers
                      .map((blocker) => blocker.message)
                      .join(" ")}
                  </div>
                ) : null}

                {error ? (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                    {error}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex h-full items-center justify-center px-8 text-center">
                <div className="max-w-sm">
                  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-sky-50 text-sky-700">
                    <Boxes aria-hidden="true" size={20} strokeWidth={1.8} />
                  </div>
                  <h3 className="mt-3 text-sm font-bold text-slate-950">
                    Select an asset
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Choose a category, then select an asset to view or edit its
                    engineering details.
                  </p>
                  <p className="mt-2 text-[11px] leading-4 text-slate-400">
                    Use the plus button beside Asset Manager to create a new
                    package asset.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
