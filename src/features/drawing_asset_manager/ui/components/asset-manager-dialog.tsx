"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  PackagePlus,
  Plus,
  Search,
  Trash2,
  X
} from "lucide-react";
import type {
  ApprovedDrawingSymbol,
  DrawingAssetType,
  DrawingModel
} from "@/features/drawing_canvas/api/asset-contracts";
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

const ASSET_GROUPS: Array<{
  type: DrawingAssetType;
  title: string;
}> = [
  { type: "instrument", title: "Level Devices / Instruments" },
  { type: "controller", title: "Controllers / Monitors" },
  { type: "panel", title: "Panels / Enclosures" },
  { type: "junction_box", title: "Junction Boxes" },
  { type: "terminal_block", title: "Terminal Blocks" },
  { type: "breaker", title: "Breakers" },
  { type: "cable", title: "Cables" },
  { type: "other", title: "Other Assets" }
];

function uniqueSheetLabels(asset: ManagedAssetCatalogItem): string[] {
  return [
    ...new Map(
      asset.sheetRefs.map((reference) => [
        reference.sheetId,
        `Sheet ${reference.sheetNumber} - ${reference.sheetName}`
      ])
    ).values()
  ];
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
    asset.symbolName ?? "",
    asset.symbolKey ?? "",
    ...uniqueSheetLabels(asset)
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalizedQuery);
}

function symbolOptionLabel(symbol: ApprovedDrawingSymbol): string {
  return `${symbol.displayName} (${symbol.symbolKey})`;
}

export function AssetManagerDialog({
  model,
  symbols,
  onCancel,
  onCreateAsset,
  onUpdateAsset,
  onDeleteAsset
}: {
  model: DrawingModel;
  symbols: ApprovedDrawingSymbol[];
  onCancel: () => void;
  onCreateAsset: (input: ManagedAssetCreateInput) => void;
  onUpdateAsset: (assetId: string, updates: ManagedAssetUpdateInput) => void;
  onDeleteAsset: (assetId: string) => { ok: true } | { ok: false; error: string };
}) {
  const titleId = "asset-manager-dialog-title";
  const descriptionId = "asset-manager-dialog-description";
  const catalog = useMemo(
    () => buildManagedAssetCatalog(model, symbols),
    [model, symbols]
  );
  const [query, setQuery] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState(
    catalog[0]?.id ?? ""
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
    assetId: catalog[0]?.id ?? "",
    tag: catalog[0]?.tag ?? "",
    title: catalog[0]?.title ?? ""
  });
  const [error, setError] = useState<string | null>(null);
  const filteredCatalog = useMemo(
    () => catalog.filter((asset) => assetMatchesSearch(asset, query)),
    [catalog, query]
  );
  const selectedAsset =
    catalog.find((asset) => asset.id === selectedAssetId) ?? catalog[0];
  const deletionBlockers = selectedAsset
    ? getAssetDeletionBlockers(model, selectedAsset.id)
    : [];
  const selectedSheetLabels = selectedAsset
    ? uniqueSheetLabels(selectedAsset)
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
  const selectedCreateSymbol = symbols.find(
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

  const submitCreate = () => {
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

    try {
      onCreateAsset({
        type: createType,
        tag: normalizedTag,
        title: normalizedTitle || assetTypeLabel(createType),
        symbolId: selectedCreateSymbol?.symbolId,
        versionId: selectedCreateSymbol?.versionId
      });
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Asset could not be created."
      );
      return;
    }

    setCreateTag(allocateNextManagedAssetTag(model, createType));
    setCreateTitle(assetTypeLabel(createType));
    setCreateSymbolKey("");
    setError(null);
  };

  const updateSelectedAsset = (updates: ManagedAssetUpdateInput) => {
    if (!selectedAsset) {
      return;
    }

    try {
      onUpdateAsset(selectedAsset.id, updates);
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
            <h2 id={titleId} className="text-sm font-semibold text-slate-950">
              Asset Manager
            </h2>
            <p id={descriptionId} className="mt-1 text-xs leading-5 text-slate-600">
              Drawing package assets only. Sheet occurrences are edited on the
              drawing sheet.
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
            <div className="space-y-3 border-b border-slate-200 p-4">
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
              <button
                type="button"
                className="icon-button icon-button-primary w-full"
                onClick={() => {
                  setIsCreating(true);
                  setError(null);
                }}
              >
                <Plus aria-hidden="true" size={14} />
                Create asset
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-3">
              {filteredCatalog.length === 0 ? (
                <div className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-500">
                  No assets in this drawing yet.
                </div>
              ) : (
                ASSET_GROUPS.map((group) => {
                  const groupAssets = filteredCatalog.filter(
                    (asset) => asset.type === group.type
                  );

                  if (groupAssets.length === 0) {
                    return null;
                  }

                  return (
                    <section key={group.type} className="mb-4">
                      <h3 className="mb-2 text-[11px] font-bold uppercase text-slate-500">
                        {group.title}
                      </h3>
                      <div className="space-y-2">
                        {groupAssets.map((asset) => (
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
                })
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
                    {symbols.map((symbol) => (
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
                    onClick={submitCreate}
                  >
                    <Plus aria-hidden="true" size={14} />
                    Create asset
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

                <div className="grid gap-4 rounded-md border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
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
                </div>

                <section className="rounded-md border border-slate-200">
                  <div className="border-b border-slate-200 px-4 py-3">
                    <h4 className="text-sm font-bold text-slate-950">
                      Sheet associations
                    </h4>
                  </div>
                  <div className="p-4">
                    {selectedSheetLabels.length > 0 ? (
                      <div className="grid gap-2">
                        {selectedSheetLabels.map((label) => (
                          <div
                            key={label}
                            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700"
                          >
                            {label}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">
                        This asset is not placed on any sheet.
                      </p>
                    )}
                  </div>
                </section>

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
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                Select or create an asset.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
