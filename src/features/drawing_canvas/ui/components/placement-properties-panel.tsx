"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ChevronRight,
  GitBranch,
  Link2,
  Minus,
  Plus,
  RefreshCw,
  Trash2
} from "lucide-react";
import type {
  DrawingAnnotation,
  DrawingConnection,
  DrawingModel as DrawingPackageModel,
  DrawingPackageSheet,
  DrawingSheetCanvasModel as DrawingModel
} from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import {
  buildDrawingAssetCatalog,
  detectDuplicatePlacementTags,
  normalizeAssetTag,
  placementAssetId,
  stepEngineeringTag
} from "../../logic/services/drawing-asset-identity";
import {
  buildPanelAssetCatalog,
  getPanelEnclosureTitle,
  getPanelEnclosureKindLabel,
  getVisibleSheetContainers,
  isContainablePlacement,
  isGeneratedPanelEnclosurePlacement
} from "../../logic/services/drawing-asset-containment";
import {
  autosizeLayoutHelperToBackplane,
  getBackplanesForSheet,
  getLayoutChildrenForBackplane,
  isBackplanePlacement,
  isLayoutHelperPlacement,
  resizeBackplane
} from "../../logic/services/drawing-backplane-layouts";
import { getAnnotationSize } from "../../logic/services/drawing-annotations";
import {
  getConnectionLabel,
  getSymbolForPlacement
} from "../../logic/services/drawing-connections";
import { isPanelLayoutLibrarySymbol } from "../../logic/services/symbol-library-context";
import { getConnectionTransitionGroups } from "../../logic/services/drawing-connection-groups";
import {
  deriveWireId,
  getConnectionWireId,
  getReadableConnectionName
} from "../../logic/services/drawing-identification";
import type { DrawingCanvasSelection } from "../../logic/services/drawing-selection";
import {
  buildTerminalBlockAssetCatalog
} from "../../logic/services/drawing-terminal-blocks";
import { isGeneratedTerminalBlockPlacement } from "../../logic/services/drawing-generated-symbols";
import {
  normalizeTerminalBlockPlacement,
  terminalBlockTerminals
} from "@/features/drawing_terminal_blocks/logic/services/terminal-block-layout";
import {
  detectTerminalBlockWarnings
} from "@/features/drawing_terminal_blocks/logic/services/terminal-block-qc";
import type { TerminalBlockPlacement } from "@/features/drawing_terminal_blocks/types";
import type { AssetLinkDialogMode } from "./asset-link-dialog";

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
  packageModel,
  activeSheet,
  activeSheetNumber,
  sheetCount,
  symbols,
  headerAction,
  onTitleChange,
  onTitleBlockChange,
  onSheetMetadataChange,
  onSectionTitlePageChange,
  selection,
  selectedPlacementId,
  onPlacementAssetTagChange,
  onOpenAssetLinkDialog,
  onPlacementTitleChange,
  onPlacementChange,
  onPanelTitleChange,
  onTerminalBlockChange,
  onPlacementContainerChange,
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
  packageModel: DrawingPackageModel;
  activeSheet: DrawingPackageSheet;
  activeSheetNumber: number;
  sheetCount: number;
  symbols: ApprovedDrawingSymbol[];
  headerAction?: ReactNode;
  onTitleChange: (title: string) => void;
  onTitleBlockChange: (
    updates: Partial<DrawingModel["sheet"]["titleBlock"]>
  ) => void;
  onSheetMetadataChange: (updates: {
    name?: string;
    description?: string;
  }) => void;
  onSectionTitlePageChange: (
    updates: Partial<
      NonNullable<DrawingPackageSheet["sectionTitlePage"]>
    >
  ) => void;
  selection: DrawingCanvasSelection;
  selectedPlacementId?: string;
  onPlacementAssetTagChange: (assetId: string, tag: string) => void;
  onOpenAssetLinkDialog: (mode: AssetLinkDialogMode) => void;
  onPlacementTitleChange: (placementId: string, title: string) => void;
  onPlacementChange: (
    placementId: string,
    updates: Partial<DrawingModel["placements"][number]>
  ) => void;
  onPanelTitleChange: (assetId: string, title: string) => void;
  onTerminalBlockChange: (
    assetId: string,
    terminalBlock: TerminalBlockPlacement
  ) => void;
  onPlacementContainerChange: (
    placementId: string,
    containerAssetId: string | undefined
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
  const selectedPlacement = model.placements.find(
    (placement) => placement.id === selectedPlacementId
  );

  return (
    <div className="space-y-5">
      <section className="tool-panel overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-bold">Drawing Properties</h2>
          {headerAction ?? null}
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

      <SheetPropertiesEditor
        sheet={activeSheet}
        sheetNumber={activeSheetNumber}
        sheetCount={sheetCount}
        onSheetMetadataChange={onSheetMetadataChange}
        onSectionTitlePageChange={onSectionTitlePageChange}
      />

      <MultiSelectionSummary selection={selection} />

      <SelectedPanelEnclosureEditor
        placement={selectedPlacement}
        model={model}
        packageModel={packageModel}
        onPlacementAssetTagChange={onPlacementAssetTagChange}
        onPanelTitleChange={onPanelTitleChange}
      />

      <SelectedPlacementAssetEditor
        placement={selectedPlacement}
        packageModel={packageModel}
        symbols={symbols}
        onPlacementAssetTagChange={onPlacementAssetTagChange}
        onOpenAssetLinkDialog={onOpenAssetLinkDialog}
        onPlacementTitleChange={onPlacementTitleChange}
      />

      <SelectedPlacementLayoutEditor
        placement={selectedPlacement}
        model={model}
        symbols={symbols}
        onPlacementChange={onPlacementChange}
      />

      <SelectedTerminalBlockEditor
        placement={selectedPlacement}
        packageModel={packageModel}
        onTerminalBlockChange={onTerminalBlockChange}
      />

      <SelectedPlacementLocationEditor
        placement={selectedPlacement}
        model={model}
        onPlacementContainerChange={onPlacementContainerChange}
      />

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

function MultiSelectionSummary({
  selection
}: {
  selection: DrawingCanvasSelection;
}) {
  const total = selection.placementIds.length + selection.annotationIds.length;

  if (total <= 1) {
    return null;
  }

  return (
    <section className="tool-panel overflow-hidden">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-bold">Selection</h2>
      </div>
      <div className="grid grid-cols-2 gap-2 p-4 text-xs font-semibold text-slate-600">
        <div className="rounded border border-slate-200 bg-white px-3 py-2">
          <p className="text-[11px] uppercase text-slate-400">Symbols</p>
          <p className="mt-1 text-sm text-slate-900">
            {selection.placementIds.length}
          </p>
        </div>
        <div className="rounded border border-slate-200 bg-white px-3 py-2">
          <p className="text-[11px] uppercase text-slate-400">Notes</p>
          <p className="mt-1 text-sm text-slate-900">
            {selection.annotationIds.length}
          </p>
        </div>
      </div>
    </section>
  );
}

function SheetPropertiesEditor({
  sheet,
  sheetNumber,
  sheetCount,
  onSheetMetadataChange,
  onSectionTitlePageChange
}: {
  sheet: DrawingPackageSheet;
  sheetNumber: number;
  sheetCount: number;
  onSheetMetadataChange: (updates: {
    name?: string;
    description?: string;
  }) => void;
  onSectionTitlePageChange: (
    updates: Partial<
      NonNullable<DrawingPackageSheet["sectionTitlePage"]>
    >
  ) => void;
}) {
  const isSectionTitlePage = sheet.kind === "section_title";
  const sectionTitlePage = sheet.sectionTitlePage ?? {};

  return (
    <section className="tool-panel overflow-hidden">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-bold">
          {isSectionTitlePage ? "Section Title Page" : "Sheet Properties"}
        </h2>
        <p className="mt-0.5 text-xs font-medium text-slate-500">
          Sheet {sheetNumber} of {sheetCount}
        </p>
      </div>
      <div className="space-y-3 p-4">
        <div>
          <label className="field-label" htmlFor="active-sheet-name">
            Sheet name
          </label>
          <input
            id="active-sheet-name"
            className="field-input"
            value={sheet.name}
            onChange={(event) =>
              onSheetMetadataChange({ name: event.currentTarget.value })
            }
          />
        </div>

        {isSectionTitlePage ? (
          <>
            <div>
              <label className="field-label" htmlFor="section-title-page-title">
                Section title
              </label>
              <input
                id="section-title-page-title"
                className="field-input"
                value={sectionTitlePage.title ?? ""}
                placeholder="Section title"
                onChange={(event) =>
                  onSectionTitlePageChange({
                    title: event.currentTarget.value
                  })
                }
              />
            </div>
            <div>
              <label
                className="field-label"
                htmlFor="section-title-page-subtitle"
              >
                Subtitle / description
              </label>
              <textarea
                id="section-title-page-subtitle"
                className="field-input min-h-24 resize-y leading-relaxed"
                value={sectionTitlePage.subtitle ?? ""}
                placeholder="Optional section subtitle"
                onChange={(event) =>
                  onSectionTitlePageChange({
                    subtitle: event.currentTarget.value
                  })
                }
              />
            </div>
            <div>
              <label
                className="field-label"
                htmlFor="section-title-page-number"
              >
                Section number
              </label>
              <input
                id="section-title-page-number"
                className="field-input"
                value={sectionTitlePage.sectionNumber ?? ""}
                placeholder="Optional"
                onChange={(event) =>
                  onSectionTitlePageChange({
                    sectionNumber: event.currentTarget.value
                  })
                }
              />
            </div>
          </>
        ) : (
          <div>
            <label className="field-label" htmlFor="active-sheet-description">
              Description
            </label>
            <textarea
              id="active-sheet-description"
              className="field-input min-h-24 resize-y leading-relaxed"
              value={sheet.description ?? ""}
              placeholder="Optional sheet description"
              onChange={(event) =>
                onSheetMetadataChange({
                  description: event.currentTarget.value
                })
              }
            />
          </div>
        )}
      </div>
    </section>
  );
}

function SelectedPanelEnclosureEditor({
  placement,
  model,
  packageModel,
  onPlacementAssetTagChange,
  onPanelTitleChange
}: {
  placement: DrawingModel["placements"][number] | undefined;
  model: DrawingModel;
  packageModel: DrawingPackageModel;
  onPlacementAssetTagChange: (assetId: string, tag: string) => void;
  onPanelTitleChange: (assetId: string, title: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const panelCatalog = useMemo(
    () => buildPanelAssetCatalog(packageModel),
    [packageModel]
  );
  const duplicateWarnings = useMemo(
    () => detectDuplicatePlacementTags(packageModel),
    [packageModel]
  );
  const placementAsset = placement ? placementAssetId(placement) : undefined;
  const [draftTagState, setDraftTagState] = useState<{
    assetId?: string;
    value: string;
  }>({ assetId: placementAsset, value: placement?.tag ?? "" });
  const [draftTitleState, setDraftTitleState] = useState<{
    assetId?: string;
    value: string;
  }>({
    assetId: placementAsset,
    value: placement ? getPanelEnclosureTitle(placement) : ""
  });

  if (!isGeneratedPanelEnclosurePlacement(placement)) {
    return null;
  }

  const assetId = placementAssetId(placement);
  const panelAsset = panelCatalog.find((panel) => panel.assetId === assetId);
  const containedPlacements = model.placements.filter(
    (candidate) => candidate.containerAssetId === assetId
  );
  const draftTag =
    draftTagState.assetId === assetId ? draftTagState.value : placement.tag;
  const panelTitle = getPanelEnclosureTitle(placement);
  const draftTitle =
    draftTitleState.assetId === assetId ? draftTitleState.value : panelTitle;
  const decrementedTag = stepEngineeringTag(draftTag, -1);
  const incrementedTag = stepEngineeringTag(draftTag, 1);
  const warning = duplicateWarnings.find(
    (candidate) =>
      candidate.normalizedTag === normalizeAssetTag(draftTag) &&
      candidate.assetIds.includes(assetId)
  );
  const sheetReferenceText =
    panelAsset?.placementRefs
      .map((reference) => `Sheet ${reference.sheetNumber}`)
      .filter((value, index, values) => values.indexOf(value) === index)
      .join(", ") ?? "Active sheet";

  const applyTag = (value: string) => {
    setDraftTagState({ assetId, value });

    if (value.trim()) {
      onPlacementAssetTagChange(assetId, value);
    }
  };

  const applyTitle = (value: string) => {
    setDraftTitleState({ assetId, value });
    onPanelTitleChange(assetId, value);
  };

  return (
    <section className="tool-panel overflow-hidden">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 text-left transition hover:bg-slate-50"
        aria-expanded={isExpanded}
        aria-controls="selected-panel-enclosure-editor"
        onClick={() => setIsExpanded((current) => !current)}
      >
        <span className="min-w-0">
          <span className="block text-sm font-bold text-slate-950">
            Panel / Enclosure
          </span>
          <span className="mt-0.5 block truncate text-xs text-slate-500">
            {placement.tag} / {panelTitle}
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
        id="selected-panel-enclosure-editor"
        className={isExpanded ? "space-y-3 p-4" : "hidden"}
      >
        <div>
          <label className="field-label" htmlFor="selected-panel-tag">
            Panel tag
          </label>
          <div className="flex gap-2">
            <input
              id="selected-panel-tag"
              className="field-input"
              value={draftTag}
              onChange={(event) => applyTag(event.currentTarget.value)}
              onBlur={() => {
                if (!draftTag.trim()) {
                  setDraftTagState({ assetId, value: placement.tag });
                }
              }}
            />
            <div className="flex gap-1">
              <button
                type="button"
                className="icon-button h-9 w-9 p-0"
                aria-label="Decrement panel tag number"
                title="Decrement panel tag number"
                disabled={!decrementedTag}
                onClick={() => decrementedTag && applyTag(decrementedTag)}
              >
                <Minus aria-hidden="true" size={14} />
              </button>
              <button
                type="button"
                className="icon-button h-9 w-9 p-0"
                aria-label="Increment panel tag number"
                title="Increment panel tag number"
                disabled={!incrementedTag}
                onClick={() => incrementedTag && applyTag(incrementedTag)}
              >
                <Plus aria-hidden="true" size={14} />
              </button>
            </div>
          </div>
        </div>

        <div>
          <label className="field-label" htmlFor="selected-panel-title">
            Panel title
          </label>
          <input
            id="selected-panel-title"
            className="field-input"
            value={draftTitle}
            placeholder={getPanelEnclosureKindLabel(placement.enclosure.kind)}
            onChange={(event) => applyTitle(event.currentTarget.value)}
            onBlur={() => {
              if (!draftTitle.trim()) {
                setDraftTitleState({
                  assetId,
                  value: getPanelEnclosureKindLabel(placement.enclosure.kind)
                });
              }
            }}
          />
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Referenced on {sheetReferenceText}. Contains{" "}
          {containedPlacements.length} visible item
          {containedPlacements.length === 1 ? "" : "s"} on this sheet.
        </div>

        {containedPlacements.length > 0 ? (
          <div className="space-y-1 rounded-md border border-slate-200 bg-white p-2 text-xs">
            {containedPlacements.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-2 rounded bg-slate-50 px-2 py-1.5"
              >
                <span className="font-semibold text-slate-900">{item.tag}</span>
                <span className="truncate text-slate-500">{item.role}</span>
              </div>
            ))}
          </div>
        ) : null}

        {warning ? (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            <AlertTriangle aria-hidden="true" size={14} className="mt-0.5 shrink-0" />
            <span>
              {warning.tag} is also used by another asset. This is allowed, but
              schedules may need review.
            </span>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function SelectedPlacementLocationEditor({
  placement,
  model,
  onPlacementContainerChange
}: {
  placement: DrawingModel["placements"][number] | undefined;
  model: DrawingModel;
  onPlacementContainerChange: (
    placementId: string,
    containerAssetId: string | undefined
  ) => void;
}) {
  const containers = useMemo(() => getVisibleSheetContainers(model), [model]);

  if (!placement || placement.layoutKind || !isContainablePlacement(placement)) {
    return null;
  }

  const containerExistsOnSheet = containers.some(
    (container) => container.assetId === placement.containerAssetId
  );

  return (
    <section className="tool-panel overflow-hidden">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-bold">Location / Enclosure</h2>
        <p className="mt-0.5 text-xs font-medium text-slate-500">
          Assign this asset to a visible panel.
        </p>
      </div>
      <div className="space-y-3 p-4">
        <div>
          <label className="field-label" htmlFor="selected-placement-container">
            Contained in panel
          </label>
          <select
            id="selected-placement-container"
            className="field-input"
            value={placement.containerAssetId ?? ""}
            onChange={(event) =>
              onPlacementContainerChange(
                placement.id,
                event.currentTarget.value || undefined
              )
            }
          >
            <option value="">No panel</option>
            {containers.map((container) => (
              <option key={container.assetId} value={container.assetId}>
                {container.placement.tag} / {getPanelEnclosureTitle(container.placement)}
              </option>
            ))}
          </select>
        </div>

        {placement.containerAssetId && !containerExistsOnSheet ? (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            <AlertTriangle aria-hidden="true" size={14} className="mt-0.5 shrink-0" />
            <span>
              This asset references a panel that is not visible on the active
              sheet.
            </span>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function SelectedPlacementAssetEditor({
  placement,
  packageModel,
  symbols,
  onPlacementAssetTagChange,
  onOpenAssetLinkDialog,
  onPlacementTitleChange
}: {
  placement: DrawingModel["placements"][number] | undefined;
  packageModel: DrawingPackageModel;
  symbols: ApprovedDrawingSymbol[];
  onPlacementAssetTagChange: (assetId: string, tag: string) => void;
  onOpenAssetLinkDialog: (mode: AssetLinkDialogMode) => void;
  onPlacementTitleChange: (placementId: string, title: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const assetCatalog = useMemo(
    () => buildDrawingAssetCatalog(packageModel, symbols),
    [packageModel, symbols]
  );
  const duplicateWarnings = useMemo(
    () => detectDuplicatePlacementTags(packageModel),
    [packageModel]
  );
  const assetId = placement ? placementAssetId(placement) : undefined;
  const symbol = getSymbolForPlacement(placement, symbols);
  const asset = assetId
    ? assetCatalog.find((candidate) => candidate.assetId === assetId)
    : undefined;
  const tag = asset?.tag ?? placement?.tag ?? "";
  const defaultTitle = asset?.symbolName ?? placement?.symbolId ?? "";
  const placementTitle = placement?.title?.trim() || defaultTitle;
  const [draftTagState, setDraftTagState] = useState<{
    assetId?: string;
    value: string;
  }>({ assetId, value: tag });
  const [draftTitleState, setDraftTitleState] = useState<{
    placementId?: string;
    value: string;
  }>({
    placementId: placement?.id,
    value: placementTitle
  });
  const draftTag =
    draftTagState.assetId === assetId ? draftTagState.value : tag;
  const draftTitle =
    draftTitleState.placementId === placement?.id
      ? draftTitleState.value
      : placementTitle;

  if (
    !placement ||
    !assetId ||
    isGeneratedPanelEnclosurePlacement(placement) ||
    isPanelLayoutLibrarySymbol(symbol)
  ) {
    return null;
  }

  const warning = duplicateWarnings.find(
    (candidate) =>
      candidate.normalizedTag === normalizeAssetTag(draftTag) &&
      candidate.assetIds.includes(assetId)
  );
  const sheetReferenceText =
    asset?.placementRefs
      .map((reference) => `Sheet ${reference.sheetNumber}`)
      .filter((value, index, values) => values.indexOf(value) === index)
      .join(", ") ?? "Active sheet";
  const decrementedTag = stepEngineeringTag(draftTag, -1);
  const incrementedTag = stepEngineeringTag(draftTag, 1);

  const applyTag = (value: string) => {
    setDraftTagState({ assetId, value });

    if (value.trim()) {
      onPlacementAssetTagChange(assetId, value);
    }
  };

  const applyTitle = (value: string) => {
    setDraftTitleState({ placementId: placement.id, value });
    onPlacementTitleChange(placement.id, value);
  };

  return (
    <section className="tool-panel overflow-hidden">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 text-left transition hover:bg-slate-50"
        aria-expanded={isExpanded}
        aria-controls="selected-placement-asset-editor"
        onClick={() => setIsExpanded((current) => !current)}
      >
        <span className="min-w-0">
          <span className="block text-sm font-bold text-slate-950">
            Asset Identity
          </span>
          <span className="mt-0.5 block truncate text-xs text-slate-500">
            {tag} / {placementTitle}
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
        id="selected-placement-asset-editor"
        className={isExpanded ? "space-y-3 p-4" : "hidden"}
      >
        <div>
          <label className="field-label" htmlFor="selected-placement-asset-tag">
            Tag
          </label>
          <div className="flex gap-2">
            <input
              id="selected-placement-asset-tag"
              className="field-input"
              value={draftTag}
              onChange={(event) => applyTag(event.currentTarget.value)}
              onBlur={() => {
                if (!draftTag.trim()) {
                  setDraftTagState({ assetId, value: tag });
                }
              }}
            />
            <div className="flex gap-1">
              <button
                type="button"
                className="icon-button h-9 w-9 p-0"
                aria-label="Decrement selected asset tag number"
                title="Decrement selected asset tag number"
                disabled={!decrementedTag}
                onClick={() => decrementedTag && applyTag(decrementedTag)}
              >
                <Minus aria-hidden="true" size={14} />
              </button>
              <button
                type="button"
                className="icon-button h-9 w-9 p-0"
                aria-label="Increment selected asset tag number"
                title="Increment selected asset tag number"
                disabled={!incrementedTag}
                onClick={() => incrementedTag && applyTag(incrementedTag)}
              >
                <Plus aria-hidden="true" size={14} />
              </button>
            </div>
          </div>
        </div>

        <div>
          <label
            className="field-label"
            htmlFor="selected-placement-symbol-title"
          >
            Symbol title
          </label>
          <input
            id="selected-placement-symbol-title"
            className="field-input"
            value={draftTitle}
            placeholder={defaultTitle}
            onChange={(event) => applyTitle(event.currentTarget.value)}
            onBlur={() => {
              if (!draftTitle.trim()) {
                setDraftTitleState({
                  placementId: placement.id,
                  value: defaultTitle
                });
              }
            }}
          />
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          {asset && asset.placementRefs.length > 1 ? (
            <span>
              Linked asset referenced {asset.placementRefs.length} times on{" "}
              {sheetReferenceText}.
            </span>
          ) : (
            <span>Unique asset on {sheetReferenceText}.</span>
          )}
        </div>

        <div className="rounded-md border border-slate-200 bg-white px-3 py-3">
          <div className="mb-2 text-xs font-bold uppercase text-slate-500">
            Asset link
          </div>
          <div className="grid gap-2">
            <button
              type="button"
              className="icon-button justify-start"
              onClick={() => onOpenAssetLinkDialog("create")}
            >
              <GitBranch aria-hidden="true" size={14} />
              Create new asset
            </button>
            <button
              type="button"
              className="icon-button justify-start"
              onClick={() => onOpenAssetLinkDialog("reference")}
            >
              <Link2 aria-hidden="true" size={14} />
              Reference existing asset
            </button>
            {asset && asset.placementRefs.length > 1 ? (
              <button
                type="button"
                className="icon-button justify-start"
                onClick={() => onOpenAssetLinkDialog("create")}
              >
                <GitBranch aria-hidden="true" size={14} />
                Manage linked occurrences
              </button>
            ) : null}
          </div>
        </div>

        {warning ? (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            <AlertTriangle aria-hidden="true" size={14} className="mt-0.5 shrink-0" />
            <span>
              {warning.tag} is also used by another asset. This is allowed, but
              schedules may need review.
            </span>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function SelectedPlacementLayoutEditor({
  placement,
  model,
  symbols,
  onPlacementChange
}: {
  placement: DrawingModel["placements"][number] | undefined;
  model: DrawingModel;
  symbols: ApprovedDrawingSymbol[];
  onPlacementChange: (
    placementId: string,
    updates: Partial<DrawingModel["placements"][number]>
  ) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const symbol = getSymbolForPlacement(placement, symbols);
  const containers = useMemo(() => getVisibleSheetContainers(model), [model]);
  const backplanes = useMemo(() => getBackplanesForSheet(model), [model]);

  if (!placement) {
    return null;
  }

  if (isBackplanePlacement(placement)) {
    const layoutDimensions = placement.layoutDimensions;
    const parentPanel = containers.find(
      (container) => container.assetId === placement.containerAssetId
    );
    const childCount = getLayoutChildrenForBackplane(model, placement.id).length;
    const updateDimension = (
      key: "lengthMm" | "widthMm",
      value: string
    ) => {
      const parsed = Number(value);

      if (!Number.isFinite(parsed) || parsed <= 0) {
        return;
      }

      const resized = resizeBackplane(model, placement, {
        x: placement.x,
        y: placement.y,
        width: key === "lengthMm" ? parsed : layoutDimensions.lengthMm,
        height: key === "widthMm" ? parsed : layoutDimensions.widthMm
      });

      onPlacementChange(placement.id, resized);
    };

    return (
      <section className="tool-panel overflow-hidden">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 text-left transition hover:bg-slate-50"
          aria-expanded={isExpanded}
          aria-controls="selected-backplane-layout-editor"
          onClick={() => setIsExpanded((current) => !current)}
        >
          <span className="min-w-0">
            <span className="block text-sm font-bold text-slate-950">
              Backplane
            </span>
            <span className="mt-0.5 block truncate text-xs text-slate-500">
              {parentPanel
                ? `${parentPanel.placement.tag} / ${getPanelEnclosureTitle(parentPanel.placement)}`
                : "No visible parent panel"}
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
          id="selected-backplane-layout-editor"
          className={isExpanded ? "space-y-3 p-4" : "hidden"}
        >
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
            {childCount} layout item{childCount === 1 ? "" : "s"} assigned.
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label" htmlFor="backplane-length">
                Width mm
              </label>
              <input
                id="backplane-length"
                className="field-input"
                inputMode="decimal"
                value={layoutDimensions.lengthMm}
                onChange={(event) =>
                  updateDimension("lengthMm", event.currentTarget.value)
                }
              />
            </div>
            <div>
              <label className="field-label" htmlFor="backplane-width">
                Height mm
              </label>
              <input
                id="backplane-width"
                className="field-input"
                inputMode="decimal"
                value={layoutDimensions.widthMm}
                onChange={(event) =>
                  updateDimension("widthMm", event.currentTarget.value)
                }
              />
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (
    !symbol ||
    !isPanelLayoutLibrarySymbol(symbol) ||
    !isLayoutHelperPlacement(placement)
  ) {
    return null;
  }

  const currentBackplane = backplanes.find(
    (candidate) => candidate.id === placement.layoutParentId
  );
  const layoutDimensions = placement.layoutDimensions ?? {
    lengthMm: symbol.metadata.physicalWidthMm ?? symbol.metadata.viewBox.width,
    widthMm: symbol.metadata.physicalHeightMm ?? symbol.metadata.viewBox.height
  };

  const updateDimension = (
    key: "lengthMm" | "widthMm",
    value: string
  ) => {
    const parsed = Number(value);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      return;
    }

    const cappedValue =
      key === "lengthMm" && currentBackplane
        ? Math.min(
            parsed,
            Math.max(1, currentBackplane.layoutDimensions.lengthMm - 6)
          )
        : parsed;

    onPlacementChange(placement.id, {
      layoutDimensions: {
        ...layoutDimensions,
        [key]: Number(cappedValue.toFixed(2))
      }
    });
  };

  const updateParentBackplane = (backplaneId: string) => {
    const backplane = backplanes.find((candidate) => candidate.id === backplaneId);

    if (!backplane) {
      onPlacementChange(placement.id, {
        layoutParentId: undefined,
        containerAssetId: undefined
      });
      return;
    }

    const updated = autosizeLayoutHelperToBackplane({
      placement,
      backplane,
      symbol
    });

    onPlacementChange(placement.id, {
      x: updated.x,
      y: updated.y,
      containerAssetId: updated.containerAssetId,
      layoutKind: updated.layoutKind,
      layoutParentId: updated.layoutParentId,
      layoutDimensions: updated.layoutDimensions
    });
  };

  return (
    <section className="tool-panel overflow-hidden">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 text-left transition hover:bg-slate-50"
        aria-expanded={isExpanded}
        aria-controls="selected-placement-layout-editor"
        onClick={() => setIsExpanded((current) => !current)}
      >
        <span className="min-w-0">
          <span className="block text-sm font-bold text-slate-950">
            Panel Layout
          </span>
          <span className="mt-0.5 block truncate text-xs text-slate-500">
            {symbol.displayName}
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
        id="selected-placement-layout-editor"
        className={isExpanded ? "space-y-3 p-4" : "hidden"}
      >
        <div>
          <label className="field-label" htmlFor="layout-symbol-backplane">
            Parent backplane
          </label>
          <select
            id="layout-symbol-backplane"
            className="field-input"
            value={placement.layoutParentId ?? ""}
            onChange={(event) => updateParentBackplane(event.currentTarget.value)}
          >
            <option value="">No backplane</option>
            {backplanes.map((backplane) => (
              <option key={backplane.id} value={backplane.id}>
                {backplane.title || backplane.tag}
              </option>
            ))}
          </select>
        </div>
        {!currentBackplane ? (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            <AlertTriangle aria-hidden="true" size={14} className="mt-0.5 shrink-0" />
            <span>This layout item is not assigned to a backplane.</span>
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label" htmlFor="layout-symbol-length">
              Length mm
            </label>
            <input
              id="layout-symbol-length"
              className="field-input"
              inputMode="decimal"
              value={layoutDimensions.lengthMm}
              onChange={(event) =>
                updateDimension("lengthMm", event.currentTarget.value)
              }
            />
          </div>
          <div>
            <label className="field-label" htmlFor="layout-symbol-width">
              Width mm
            </label>
            <input
              id="layout-symbol-width"
              className="field-input"
              inputMode="decimal"
              value={layoutDimensions.widthMm}
              onChange={(event) =>
                updateDimension("widthMm", event.currentTarget.value)
              }
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function SelectedTerminalBlockEditor({
  placement,
  packageModel,
  onTerminalBlockChange
}: {
  placement: DrawingModel["placements"][number] | undefined;
  packageModel: DrawingPackageModel;
  onTerminalBlockChange: (
    assetId: string,
    terminalBlock: TerminalBlockPlacement
  ) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const terminalBlockCatalog = useMemo(
    () => buildTerminalBlockAssetCatalog(packageModel),
    [packageModel]
  );
  const terminalBlockWarnings = useMemo(
    () =>
      detectTerminalBlockWarnings(
        packageModel.sheets.flatMap((sheet) => sheet.placements)
      ),
    [packageModel]
  );

  if (!isGeneratedTerminalBlockPlacement(placement)) {
    return null;
  }

  const assetId = placementAssetId(placement);
  const config = normalizeTerminalBlockPlacement(placement.terminalBlock);
  const terminals = terminalBlockTerminals(config);
  const terminalBlockAsset = terminalBlockCatalog.find(
    (candidate) => candidate.assetId === assetId
  );
  const warning = terminalBlockWarnings.find(
    (candidate) =>
      candidate.assetId === assetId || candidate.placementId === placement.id
  );
  const sheetReferenceText =
    terminalBlockAsset?.placementRefs
      .map((reference) => `Sheet ${reference.sheetNumber}`)
      .filter((value, index, values) => values.indexOf(value) === index)
      .join(", ") ?? "Active sheet";
  const previewTerminals = terminals.slice(0, 16);

  const updateConfig = (updates: Partial<TerminalBlockPlacement>) => {
    onTerminalBlockChange(
      assetId,
      normalizeTerminalBlockPlacement({
        ...config,
        ...updates
      })
    );
  };

  return (
    <section className="tool-panel overflow-hidden">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 text-left transition hover:bg-slate-50"
        aria-expanded={isExpanded}
        aria-controls="selected-terminal-block-editor"
        onClick={() => setIsExpanded((current) => !current)}
      >
        <span className="min-w-0">
          <span className="block text-sm font-bold text-slate-950">
            Terminal Block
          </span>
          <span className="mt-0.5 block truncate text-xs text-slate-500">
            {placement.tag} / {terminals.length} terminals
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
        id="selected-terminal-block-editor"
        className={isExpanded ? "space-y-3 p-4" : "hidden"}
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label" htmlFor="selected-terminal-count">
              Terminal count
            </label>
            <input
              id="selected-terminal-count"
              className="field-input"
              type="number"
              min={1}
              max={80}
              value={config.count}
              onChange={(event) =>
                updateConfig({
                  count: Number(event.currentTarget.value) || 1
                })
              }
            />
          </div>
          <div>
            <label className="field-label" htmlFor="selected-terminal-start">
              Start number
            </label>
            <input
              id="selected-terminal-start"
              className="field-input"
              type="number"
              min={1}
              max={9999}
              value={config.startNumber}
              onChange={(event) =>
                updateConfig({
                  startNumber: Number(event.currentTarget.value) || 1
                })
              }
            />
          </div>
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Referenced on {sheetReferenceText}. Terminal range{" "}
          {config.startNumber} - {config.startNumber + config.count - 1}.
        </div>

        <div className="space-y-2">
          <div className="text-[11px] font-bold uppercase text-slate-500">
            Terminals
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {previewTerminals.map((terminal) => (
              <div
                key={terminal.key}
                className="rounded border border-slate-200 bg-white px-2 py-1 text-center text-[11px] font-semibold text-slate-800"
              >
                {placement.tag}:{terminal.label}
              </div>
            ))}
          </div>
          {terminals.length > previewTerminals.length ? (
            <div className="text-[11px] font-medium text-slate-500">
              +{terminals.length - previewTerminals.length} more terminals
            </div>
          ) : null}
        </div>

        {warning ? (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            <AlertTriangle aria-hidden="true" size={14} className="mt-0.5 shrink-0" />
            <span>{warning.message}</span>
          </div>
        ) : null}
      </div>
    </section>
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
  const noteTitle = annotation.title?.trim() ?? "";

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
            {noteTitle}
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
            placeholder="Optional note title"
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
