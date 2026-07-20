"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ChevronRight,
  GitBranch,
  Link2,
  Maximize2,
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
  getBackplanePlacementArea,
  isBackplanePlacement,
  isLayoutHelperPlacement,
  normalizeLayoutHelperDimensionsForSymbol,
  shouldAutosizeLayoutSymbolToBackplane
} from "../../logic/services/drawing-backplane-layouts";
import {
  getBackplaneCenteredPosition,
  getBackplanePrintableArea,
  resolveBackplaneLayoutScale
} from "../../logic/services/drawing-backplane-scale";
import { getAnnotationSize } from "../../logic/services/drawing-annotations";
import {
  getConnectionLabel,
  getSymbolForPlacement
} from "../../logic/services/drawing-connections";
import { isPanelLayoutLibrarySymbol } from "../../logic/services/symbol-library-context";
import {
  layoutLabelPositionLabels,
  layoutLabelPositions,
  resolveLayoutLabel,
  type LayoutLabelPosition
} from "../../logic/services/drawing-layout-labels";
import {
  isLayoutDimensionPlacement,
  layoutDimensionValueLabel,
  resolveAssociatedLayoutDimensionPlacement,
  updateLayoutDimensionPlacement
} from "../../logic/services/drawing-layout-dimensions";
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
import { getTerminalBlockGroupPhysicalSize } from "@/features/drawing_terminal_blocks/logic/services/terminal-block-groups";
import type { AssetLinkDialogMode } from "./asset-link-dialog";
import {
  getPanelComponentPlacementSummary,
  type PanelConnectionPatternRecord,
  type PanelWireAttributes
} from "@/features/drawing_panel_wiring/api/public";
import { isGeneratedPanelPatternLegendPlacement } from "../../logic/services/drawing-panel-reference-symbols";

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
  sectionLabel,
  sectionMemberCount,
  sectionMoveOptions,
  symbols,
  headerAction,
  onTitleChange,
  onTitleBlockChange,
  onSheetMetadataChange,
  onSectionTitlePageChange,
  onMoveSheetToSection,
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
  onInternalWireChange,
  onPanelPatternChange,
  onPanelPatternLegendVisibilityChange,
  showConnections = true,
  onAnnotationChange,
  onAnnotationRemove
}: {
  title: string;
  model: DrawingModel;
  packageModel: DrawingPackageModel;
  activeSheet: DrawingPackageSheet;
  activeSheetNumber: number;
  sheetCount: number;
  sectionLabel: string;
  sectionMemberCount?: number;
  sectionMoveOptions: Array<{ id: string; label: string }>;
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
    updates: {
      terminalBlock?: TerminalBlockPlacement;
      title?: string;
      description?: string;
    }
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
  onInternalWireChange?: (
    wireRecordId: string,
    updates: { wireId: string; attributes?: PanelWireAttributes }
  ) => void;
  onMoveSheetToSection: (targetSectionId: string | "front_matter") => void;
  onPanelPatternChange?: (
    patternId: string,
    updates: { label?: string; description?: string }
  ) => void;
  onPanelPatternLegendVisibilityChange?: (visible: boolean) => void;
  showConnections?: boolean;
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
        sectionLabel={sectionLabel}
        sectionMemberCount={sectionMemberCount}
        sectionMoveOptions={sectionMoveOptions}
        onSheetMetadataChange={onSheetMetadataChange}
        onSectionTitlePageChange={onSectionTitlePageChange}
        onMoveSheetToSection={onMoveSheetToSection}
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
        allowCreateAsset={
          activeSheet.panelDrawingContext?.kind !== "detailed_panel_wiring"
        }
        onPlacementAssetTagChange={onPlacementAssetTagChange}
        onOpenAssetLinkDialog={onOpenAssetLinkDialog}
        onPlacementTitleChange={onPlacementTitleChange}
      />

      <SelectedDetailedPanelComponentSummary
        placement={selectedPlacement}
        activeSheet={activeSheet}
        packageModel={packageModel}
        symbols={symbols}
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

      <InternalWireEditor
        packageModel={packageModel}
        model={model}
        selectedConnectionId={selectedConnectionId}
        onInternalWireChange={onInternalWireChange}
        onConnectionRemove={onConnectionRemove}
        onConnectionRouteReset={onConnectionRouteReset}
      />

      <PanelPatternEditor
        packageModel={packageModel}
        model={model}
        selectedConnectionId={selectedConnectionId}
        onPanelPatternChange={onPanelPatternChange}
        onLegendVisibilityChange={onPanelPatternLegendVisibilityChange}
        onConnectionRemove={onConnectionRemove}
        onConnectionRouteReset={onConnectionRouteReset}
      />

      {showConnections ? <ConnectionEditor
        model={model}
        symbols={symbols}
        selectedConnectionId={selectedConnectionId}
        onConnectionSelect={onConnectionSelect}
        onConnectionChange={onConnectionChange}
        onConnectionRemove={onConnectionRemove}
        onConnectionRouteReset={onConnectionRouteReset}
      /> : null}
    </div>
  );
}

function SelectedDetailedPanelComponentSummary({
  placement,
  activeSheet,
  packageModel,
  symbols
}: {
  placement?: DrawingModel["placements"][number];
  activeSheet: DrawingPackageSheet;
  packageModel: DrawingPackageModel;
  symbols: ApprovedDrawingSymbol[];
}) {
  if (
    !placement?.assetId ||
    activeSheet.panelDrawingContext?.kind !== "detailed_panel_wiring" ||
    placement.containerAssetId !== activeSheet.panelDrawingContext.panelAssetId
  ) {
    return null;
  }
  const symbol = symbols.find(
    (candidate) =>
      candidate.symbolId === placement.symbolId &&
      candidate.versionId === placement.versionId
  );
  if (!symbol?.metadata.panelWiring) {
    return null;
  }
  const asset = packageModel.assets?.find(
    (candidate) => candidate.id === placement.assetId
  );
  const panel = packageModel.assets?.find(
    (candidate) => candidate.id === placement.containerAssetId
  );
  const summary = getPanelComponentPlacementSummary({
    symbol,
    placement,
    asset
  });

  return (
    <section className="tool-panel overflow-hidden">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-bold">Panel Component</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          {summary.tag} / {summary.title ?? symbol.displayName}
        </p>
      </div>
      <div className="space-y-3 p-4 text-xs">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[10px] font-bold uppercase text-slate-500">Type</p>
            <p className="mt-1 font-semibold text-slate-900">
              {(summary.assetType ?? symbol.metadata.panelWiring.assetType)
                .replace(/_/g, " ")
                .replace(/\b\w/g, (letter) => letter.toUpperCase())}
            </p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[10px] font-bold uppercase text-slate-500">Parent panel</p>
            <p className="mt-1 font-semibold text-slate-900">{panel?.tag ?? "Missing"}</p>
          </div>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase text-slate-500">
            Approved symbol
          </p>
          <p className="mt-1 font-semibold text-slate-900">
            {symbol.displayName} / Version {symbol.versionNumber}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase text-slate-500">
            Terminals ({summary.terminals.length})
          </p>
          <div className="mt-2 space-y-1.5">
            {summary.terminals.map((terminal) => (
              <div key={terminal.terminalKey} className="rounded-md border border-slate-200 px-2.5 py-2">
                <p className="font-bold text-slate-900">
                  {terminal.terminalKey} / {terminal.label}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-500">
                  {terminal.function ?? "Electrical terminal"} / {terminal.supportedSides.join(", ")}
                </p>
              </div>
            ))}
          </div>
        </div>
        {summary.warnings.map((warning) => (
          <div key={warning} className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
            {warning}
          </div>
        ))}
      </div>
    </section>
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
  sectionLabel,
  sectionMemberCount,
  sectionMoveOptions,
  onSheetMetadataChange,
  onSectionTitlePageChange,
  onMoveSheetToSection
}: {
  sheet: DrawingPackageSheet;
  sheetNumber: number;
  sheetCount: number;
  sectionLabel: string;
  sectionMemberCount?: number;
  sectionMoveOptions: Array<{ id: string; label: string }>;
  onSheetMetadataChange: (updates: {
    name?: string;
    description?: string;
  }) => void;
  onSectionTitlePageChange: (
    updates: Partial<
      NonNullable<DrawingPackageSheet["sectionTitlePage"]>
    >
  ) => void;
  onMoveSheetToSection: (targetSectionId: string | "front_matter") => void;
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
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-[11px] font-bold uppercase text-slate-500">
                Package section
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {sectionLabel}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {sectionMemberCount ?? 0} member sheet
                {(sectionMemberCount ?? 0) === 1 ? "" : "s"}
              </p>
            </div>
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
          </>
        ) : (
          <>
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
            <div>
              <label className="field-label" htmlFor="active-sheet-section">
                Package section
              </label>
              <div
                id="active-sheet-section"
                className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900"
              >
                {sectionLabel}
              </div>
            </div>
            {sectionMoveOptions.length > 0 ? (
              <div>
                <label
                  className="field-label"
                  htmlFor="move-active-sheet-section"
                >
                  Move to section
                </label>
                <select
                  id="move-active-sheet-section"
                  className="field-input"
                  value=""
                  onChange={(event) => {
                    const target = event.currentTarget.value;
                    if (target) onMoveSheetToSection(target);
                  }}
                >
                  <option value="">Choose destination...</option>
                  {sectionMoveOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </>
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
  allowCreateAsset,
  onPlacementAssetTagChange,
  onOpenAssetLinkDialog,
  onPlacementTitleChange
}: {
  placement: DrawingModel["placements"][number] | undefined;
  packageModel: DrawingPackageModel;
  symbols: ApprovedDrawingSymbol[];
  allowCreateAsset: boolean;
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
            {allowCreateAsset ? (
              <button
                type="button"
                className="icon-button justify-start"
                onClick={() => onOpenAssetLinkDialog("create")}
              >
                <GitBranch aria-hidden="true" size={14} />
                Create new asset
              </button>
            ) : null}
            <button
              type="button"
              className="icon-button justify-start"
              onClick={() => onOpenAssetLinkDialog("reference")}
            >
              <Link2 aria-hidden="true" size={14} />
              Reference existing asset
            </button>
            {allowCreateAsset && asset && asset.placementRefs.length > 1 ? (
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
  const [dimensionDraft, setDimensionDraft] = useState<{
    placementId: string;
    values: {
      lengthMm: string;
      widthMm: string;
    };
  } | null>(null);
  const symbol = getSymbolForPlacement(placement, symbols);
  const containers = useMemo(() => getVisibleSheetContainers(model), [model]);
  const backplanes = useMemo(() => getBackplanesForSheet(model), [model]);

  if (!placement) {
    return null;
  }

  if (isBackplanePlacement(placement)) {
    const layoutDimensions = placement.layoutDimensions;
    const activeDraft =
      dimensionDraft?.placementId === placement.id ? dimensionDraft : null;
    const draftValues = activeDraft?.values ?? {
      lengthMm: String(layoutDimensions.lengthMm),
      widthMm: String(layoutDimensions.widthMm)
    };
    const parentPanel = containers.find(
      (container) => container.assetId === placement.containerAssetId
    );
    const resolvedScale = resolveBackplaneLayoutScale(model.sheet, placement);
    const childCount = getLayoutChildrenForBackplane(model, placement.id).length;
    const fitBackplane = (
      layoutDimensions: NonNullable<typeof placement.layoutDimensions>
    ) => {
      const nextPlacement = {
        ...placement,
        layoutDimensions
      };
      const area = parentPanel
        ? getBackplanePlacementArea(parentPanel.placement)
        : getBackplanePrintableArea(model.sheet);

      return getBackplaneCenteredPosition({
        sheet: model.sheet,
        backplane: nextPlacement,
        area
      });
    };
    const updateDimensionDraft = (
      key: "lengthMm" | "widthMm",
      value: string
    ) => {
      setDimensionDraft((current) => {
        const base =
          current?.placementId === placement.id
            ? current.values
            : {
                lengthMm: String(layoutDimensions.lengthMm),
                widthMm: String(layoutDimensions.widthMm)
              };

        return {
          placementId: placement.id,
          values: {
            ...base,
            [key]: value
          }
        };
      });
    };
    const commitDimensionDraft = () => {
      const width = Number(draftValues.lengthMm);
      const height = Number(draftValues.widthMm);

      if (
        !Number.isFinite(width) ||
        width <= 0 ||
        !Number.isFinite(height) ||
        height <= 0
      ) {
        setDimensionDraft(null);
        return;
      }

      const layoutDimensions = {
        lengthMm: Number(width.toFixed(2)),
        widthMm: Number(height.toFixed(2))
      };

      setDimensionDraft(null);
      onPlacementChange(placement.id, {
        layoutDimensions,
        ...fitBackplane(layoutDimensions)
      });
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
          <div className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-500">
            <span>
              Scale: {resolvedScale.mode === "auto" ? "Auto " : ""}
              {resolvedScale.label}
            </span>
            <button
              type="button"
              className="icon-button h-8 shrink-0 px-2"
              onClick={() =>
                onPlacementChange(
                  placement.id,
                  fitBackplane(placement.layoutDimensions)
                )
              }
              aria-label="Fit backplane within panel"
              title="Fit backplane within panel"
            >
              <Maximize2 aria-hidden="true" size={14} />
              Fit panel
            </button>
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
                value={draftValues.lengthMm}
                onChange={(event) =>
                  updateDimensionDraft("lengthMm", event.currentTarget.value)
                }
                onBlur={commitDimensionDraft}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                  if (event.key === "Escape") {
                    setDimensionDraft(null);
                  }
                }}
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
                value={draftValues.widthMm}
                onChange={(event) =>
                  updateDimensionDraft("widthMm", event.currentTarget.value)
                }
                onBlur={commitDimensionDraft}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                  if (event.key === "Escape") {
                    setDimensionDraft(null);
                  }
                }}
              />
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (isLayoutDimensionPlacement(placement)) {
    const currentBackplane = backplanes.find(
      (candidate) => candidate.id === placement.layoutParentId
    );
    const resolvedPlacement = currentBackplane
      ? resolveAssociatedLayoutDimensionPlacement({
          model,
          placement,
          backplane: currentBackplane
        })
      : placement;
    const dimension = resolvedPlacement.layoutDimension!;
    const updateDimension = (
      updates: Partial<NonNullable<typeof placement.layoutDimension>>
    ) => {
      if (!currentBackplane) {
        onPlacementChange(placement.id, {
          layoutDimension: {
            ...dimension,
            ...updates
          }
        });
        return;
      }

      const updated = updateLayoutDimensionPlacement({
        placement: resolvedPlacement,
        backplane: currentBackplane,
        sheet: model.sheet,
        updates
      });

      onPlacementChange(placement.id, {
        x: updated.x,
        y: updated.y,
        layoutPosition: updated.layoutPosition,
        layoutDimensions: updated.layoutDimensions,
        layoutDimension: updated.layoutDimension
      });
    };
    const updateNumericDimension = (
      key: "startMm" | "endMm" | "offsetMm" | "labelPositionMm",
      value: string
    ) => {
      const parsed = Number(value);

      if (!Number.isFinite(parsed)) {
        return;
      }

      updateDimension({ [key]: Number(parsed.toFixed(2)) });
    };

    return (
      <section className="tool-panel overflow-hidden">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 text-left transition hover:bg-slate-50"
          aria-expanded={isExpanded}
          aria-controls="selected-placement-dimension-editor"
          onClick={() => setIsExpanded((current) => !current)}
        >
          <span className="min-w-0">
            <span className="block text-sm font-bold text-slate-950">
              Dimension
            </span>
            <span className="mt-0.5 block truncate text-xs text-slate-500">
              {dimension.orientation === "horizontal"
                ? "Horizontal"
                : "Vertical"}{" "}
              / {layoutDimensionValueLabel(resolvedPlacement)}
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
          id="selected-placement-dimension-editor"
          className={isExpanded ? "space-y-3 p-4" : "hidden"}
        >
          {!currentBackplane ? (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
              <AlertTriangle
                aria-hidden="true"
                size={14}
                className="mt-0.5 shrink-0"
              />
              <span>This dimension is not assigned to a backplane.</span>
            </div>
          ) : null}
          <div>
            <label className="field-label" htmlFor="layout-dimension-orientation">
              Orientation
            </label>
            <input
              id="layout-dimension-orientation"
              className="field-input"
              value={
                dimension.orientation === "horizontal"
                  ? "Horizontal"
                  : "Vertical"
              }
              readOnly
            />
          </div>
          <div className="rounded-md border border-sky-100 bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-800">
            Drag the grey witness grips onto measured edges. The yellow end
            grip moves the dimension line; the yellow centre grip moves its
            label. Numeric values remain exact.
          </div>
          <div>
            <label
              className="field-label"
              htmlFor="layout-dimension-label-position"
            >
              Label position mm
            </label>
            <input
              id="layout-dimension-label-position"
              className="field-input"
              inputMode="decimal"
              value={
                dimension.labelPositionMm ??
                Number(((dimension.startMm + dimension.endMm) / 2).toFixed(2))
              }
              onChange={(event) =>
                updateNumericDimension(
                  "labelPositionMm",
                  event.currentTarget.value
                )
              }
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="field-label" htmlFor="layout-dimension-start">
                Start mm
              </label>
              <input
                id="layout-dimension-start"
                className="field-input"
                inputMode="decimal"
                value={dimension.startMm}
                onChange={(event) =>
                  updateNumericDimension("startMm", event.currentTarget.value)
                }
              />
            </div>
            <div>
              <label className="field-label" htmlFor="layout-dimension-end">
                End mm
              </label>
              <input
                id="layout-dimension-end"
                className="field-input"
                inputMode="decimal"
                value={dimension.endMm}
                onChange={(event) =>
                  updateNumericDimension("endMm", event.currentTarget.value)
                }
              />
            </div>
            <div>
              <label className="field-label" htmlFor="layout-dimension-offset">
                Offset mm
              </label>
              <input
                id="layout-dimension-offset"
                className="field-input"
                inputMode="decimal"
                value={dimension.offsetMm}
                onChange={(event) =>
                  updateNumericDimension("offsetMm", event.currentTarget.value)
                }
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              checked={dimension.showValue ?? true}
              onChange={(event) =>
                updateDimension({ showValue: event.currentTarget.checked })
              }
            />
            Show value
          </label>
          <div>
            <label className="field-label" htmlFor="layout-dimension-label">
              Label override
            </label>
            <input
              id="layout-dimension-label"
              className="field-input"
              value={dimension.labelOverride ?? ""}
              placeholder={layoutDimensionValueLabel(resolvedPlacement)}
              onChange={(event) =>
                updateDimension({
                  labelOverride: event.currentTarget.value || undefined
                })
              }
            />
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
  const normalizedPlacement = normalizeLayoutHelperDimensionsForSymbol(
    placement,
    symbol
  );
  const layoutDimensions = normalizedPlacement.layoutDimensions ?? {
    lengthMm: symbol.metadata.physicalWidthMm ?? symbol.metadata.viewBox.width,
    widthMm: symbol.metadata.physicalHeightMm ?? symbol.metadata.viewBox.height
  };
  const canEditDimensions = shouldAutosizeLayoutSymbolToBackplane(symbol);
  const resolvedLabel = resolveLayoutLabel({ placement, symbol });

  const updateDimension = (
    key: "lengthMm" | "widthMm",
    value: string
  ) => {
    if (!canEditDimensions) {
      return;
    }

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

  const updateLayoutLabel = (
    updates: Partial<NonNullable<typeof placement.layoutLabel>>
  ) => {
    onPlacementChange(placement.id, {
      layoutLabel: {
        ...(placement.layoutLabel ?? {}),
        ...updates
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
      symbol,
      sheet: model.sheet
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
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold uppercase text-slate-500">
                Label
              </div>
              <div className="mt-0.5 text-xs text-slate-500">
                Generated from item tag.
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                checked={resolvedLabel.visible}
                onChange={(event) =>
                  updateLayoutLabel({ visible: event.currentTarget.checked })
                }
              />
              Show
            </label>
          </div>
          <label className="field-label" htmlFor="layout-symbol-label-position">
            Position
          </label>
          <select
            id="layout-symbol-label-position"
            className="field-input"
            value={resolvedLabel.position}
            disabled={!resolvedLabel.visible}
            onChange={(event) =>
              updateLayoutLabel({
                position: event.currentTarget.value as LayoutLabelPosition
              })
            }
          >
            {layoutLabelPositions.map((position) => (
              <option key={position} value={position}>
                {layoutLabelPositionLabels[position]}
              </option>
            ))}
          </select>
        </div>
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
              readOnly={!canEditDimensions}
              disabled={!canEditDimensions}
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
              readOnly={!canEditDimensions}
              disabled={!canEditDimensions}
              onChange={(event) =>
                updateDimension("widthMm", event.currentTarget.value)
              }
            />
          </div>
        </div>
        {!canEditDimensions ? (
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">
            Fixed-size layout symbol. Dimensions come from the approved symbol
            metadata.
          </div>
        ) : null}
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
    updates: {
      terminalBlock?: TerminalBlockPlacement;
      title?: string;
      description?: string;
    }
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
  const physicalSize = getTerminalBlockGroupPhysicalSize(config);
  const terminals = terminalBlockTerminals(config);
  const packageAsset = packageModel.assets.find(
    (asset) => asset.id === assetId
  );
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
      {
        terminalBlock: normalizeTerminalBlockPlacement({
          ...config,
          ...updates
        })
      }
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
        <div>
          <label className="field-label" htmlFor="selected-terminal-name">
            Group name
          </label>
          <input
            id="selected-terminal-name"
            className="field-input"
            value={packageAsset?.title ?? placement.title ?? ""}
            onChange={(event) =>
              onTerminalBlockChange(assetId, {
                title: event.currentTarget.value
              })
            }
          />
        </div>
        <div>
          <label
            className="field-label"
            htmlFor="selected-terminal-description"
          >
            Description
          </label>
          <textarea
            id="selected-terminal-description"
            className="field-input min-h-20 resize-y"
            value={packageAsset?.description ?? ""}
            placeholder="Optional engineering description"
            onChange={(event) =>
              onTerminalBlockChange(assetId, {
                description: event.currentTarget.value
              })
            }
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label" htmlFor="selected-terminal-count">
              Terminal count
            </label>
            <input
              id="selected-terminal-count"
              className="field-input"
              type="number"
              min={2}
              max={80}
              value={config.count}
              onChange={(event) =>
                updateConfig({
                  count: Number(event.currentTarget.value) || 2
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
              readOnly
            />
          </div>
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Referenced on {sheetReferenceText}. Terminal range{" "}
          {config.startNumber} - {config.startNumber + config.count - 1}. Physical
          size {physicalSize.lengthMm} x {physicalSize.widthMm} mm.
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

function PanelPatternEditor({
  packageModel,
  model,
  selectedConnectionId,
  onPanelPatternChange,
  onLegendVisibilityChange,
  onConnectionRemove,
  onConnectionRouteReset
}: {
  packageModel: DrawingPackageModel;
  model: DrawingModel;
  selectedConnectionId?: string;
  onPanelPatternChange?: (
    patternId: string,
    updates: { label?: string; description?: string }
  ) => void;
  onLegendVisibilityChange?: (visible: boolean) => void;
  onConnectionRemove: (connectionId: string) => void;
  onConnectionRouteReset: (connectionId: string) => void;
}) {
  const connection = model.connections.find(
    (candidate) => candidate.id === selectedConnectionId
  );
  if (!connection?.panelPatternId) return null;
  const bridge = packageModel.panelWiring?.bridges.find(
    (candidate) => candidate.id === connection.panelPatternId
  );
  const bond = packageModel.panelWiring?.bonds.find(
    (candidate) => candidate.id === connection.panelPatternId
  );
  const pattern: PanelConnectionPatternRecord | undefined = bridge
    ? { recordType: "bridge", record: bridge }
    : bond
      ? { recordType: "bond", record: bond }
      : undefined;
  if (!pattern) return null;
  const topology = pattern.recordType === "bridge"
    ? pattern.record.definition?.topology ?? "legacy"
    : pattern.record.kind;
  const domain = pattern.recordType === "bridge"
    ? pattern.record.domain ?? "unknown"
    : pattern.record.kind;
  const members = pattern.recordType === "bridge"
    ? pattern.record.members
    : pattern.record.endpoints.flatMap((endpoint) =>
        endpoint.kind === "terminal" ? [endpoint.terminal] : []
      );
  const ownedWires = packageModel.panelWiring?.internalWires.filter(
    (wire) => wire.ownerPatternId === pattern.record.id
  ) ?? [];
  const assetTag = (assetId: string) =>
    packageModel.assets.find((asset) => asset.id === assetId)?.tag ?? assetId;
  const legendVisible = model.placements.find(
    isGeneratedPanelPatternLegendPlacement
  )?.panelPatternLegend.visible ?? false;

  return (
    <section className="tool-panel overflow-hidden">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-bold">Connection Pattern</h2>
        <p className="mt-1 text-[11px] text-slate-500">
          {pattern.record.patternCode ?? pattern.record.id} / {topology.replaceAll("_", " ")}
        </p>
      </div>
      <div className="space-y-4 p-4 text-xs">
        <dl className="grid grid-cols-2 gap-2">
          <div className="rounded border border-slate-200 bg-slate-50 p-2">
            <dt className="text-[10px] font-bold uppercase text-slate-500">Domain</dt>
            <dd className="mt-1 capitalize text-slate-900">{domain.replaceAll("_", " ")}</dd>
          </div>
          <div className="rounded border border-slate-200 bg-slate-50 p-2">
            <dt className="text-[10px] font-bold uppercase text-slate-500">Owned wires</dt>
            <dd className="mt-1 text-slate-900">{ownedWires.length}</dd>
          </div>
        </dl>
        <div>
          <span className="field-label">Members</span>
          <div className="mt-1 max-h-28 space-y-1 overflow-auto rounded border border-slate-200 bg-slate-50 p-2 font-mono text-[11px]">
            {members.map((member, index) => (
              <div key={`${member.assetId}:${member.terminalKey}:${member.side}:${index}`}>
                {assetTag(member.assetId)}:{member.terminalKey}/{member.side}
              </div>
            ))}
          </div>
        </div>
        {onPanelPatternChange ? (
          <>
            <label className="block">
              <span className="field-label">Label</span>
              <input
                key={`${pattern.record.id}:label:${pattern.record.label ?? ""}`}
                className="field-input mt-1"
                defaultValue={pattern.record.label ?? ""}
                onBlur={(event) =>
                  onPanelPatternChange(pattern.record.id, {
                    label: event.currentTarget.value.trim() || undefined,
                    description: pattern.record.description
                  })
                }
              />
            </label>
            <label className="block">
              <span className="field-label">Description</span>
              <textarea
                key={`${pattern.record.id}:description:${pattern.record.description ?? ""}`}
                className="field-input mt-1 min-h-20"
                defaultValue={pattern.record.description ?? ""}
                onBlur={(event) =>
                  onPanelPatternChange(pattern.record.id, {
                    label: pattern.record.label,
                    description: event.currentTarget.value.trim() || undefined
                  })
                }
              />
            </label>
          </>
        ) : null}
        {onLegendVisibilityChange ? (
          <label className="flex items-center gap-2 text-slate-700">
            <input
              type="checkbox"
              checked={legendVisible}
              onChange={(event) =>
                onLegendVisibilityChange(event.currentTarget.checked)
              }
            />
            Show connection legend
          </label>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="icon-button" onClick={() => onConnectionRouteReset(connection.id)}>
            <RefreshCw aria-hidden="true" size={14} /> Reset route
          </button>
          <button type="button" className="icon-button icon-button-danger" onClick={() => onConnectionRemove(connection.id)}>
            <Trash2 aria-hidden="true" size={14} /> Remove pattern
          </button>
        </div>
      </div>
    </section>
  );
}

function InternalWireEditor({
  packageModel,
  model,
  selectedConnectionId,
  onInternalWireChange,
  onConnectionRemove,
  onConnectionRouteReset
}: {
  packageModel: DrawingPackageModel;
  model: DrawingModel;
  selectedConnectionId?: string;
  onInternalWireChange?: (
    wireRecordId: string,
    updates: { wireId: string; attributes?: PanelWireAttributes }
  ) => void;
  onConnectionRemove: (connectionId: string) => void;
  onConnectionRouteReset: (connectionId: string) => void;
}) {
  const connection = model.connections.find(
    (candidate) => candidate.id === selectedConnectionId
  );
  const wire = connection?.panelConnectionId
    ? packageModel.panelWiring?.internalWires.find(
        (candidate) => candidate.id === connection.panelConnectionId
      )
    : undefined;
  if (!connection || !wire || wire.ownerPatternId || !onInternalWireChange) {
    return null;
  }
  const assetTag = (assetId: string) =>
    packageModel.assets?.find((asset) => asset.id === assetId)?.tag ?? assetId;
  const updateAttributes = (
    key: keyof PanelWireAttributes,
    value: string
  ) => {
    onInternalWireChange(wire.id, {
      wireId: wire.wireId,
      attributes: {
        ...wire.attributes,
        [key]: value.trim() || undefined
      }
    });
  };

  return (
    <section className="tool-panel overflow-hidden">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-bold">Internal Wire</h2>
        <p className="mt-1 text-[11px] text-slate-500">
          Physical panel wire with a route occurrence on this sheet.
        </p>
      </div>
      <div className="space-y-4 p-4 text-xs">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
            <span className="block text-[10px] font-bold uppercase text-slate-500">From</span>
            <span className="mt-1 block font-semibold text-slate-900">
              {assetTag(wire.from.assetId)}:{wire.from.terminalKey}
            </span>
            <span className="text-slate-500">{wire.from.side}</span>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
            <span className="block text-[10px] font-bold uppercase text-slate-500">To</span>
            <span className="mt-1 block font-semibold text-slate-900">
              {assetTag(wire.to.assetId)}:{wire.to.terminalKey}
            </span>
            <span className="text-slate-500">{wire.to.side}</span>
          </div>
        </div>
        <div>
          <label className="field-label" htmlFor={`internal-wire-id-${wire.id}`}>
            Wire ID
          </label>
          <input
            key={`${wire.id}:${wire.wireId}`}
            id={`internal-wire-id-${wire.id}`}
            className="field-input"
            defaultValue={wire.wireId}
            onBlur={(event) => {
              const wireId = event.currentTarget.value.trim();
              if (wireId && wireId !== wire.wireId) {
                onInternalWireChange(wire.id, {
                  wireId,
                  attributes: wire.attributes
                });
              }
            }}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {([
            ["color", "Color"],
            ["size", "Size"],
            ["wireType", "Wire type"],
            ["description", "Description"]
          ] as const).map(([key, label]) => (
            <div key={key}>
              <label className="field-label" htmlFor={`internal-wire-${key}-${wire.id}`}>
                {label}
              </label>
              <input
                key={`${wire.id}:${key}:${wire.attributes?.[key] ?? ""}`}
                id={`internal-wire-${key}-${wire.id}`}
                className="field-input"
                defaultValue={wire.attributes?.[key] ?? ""}
                onBlur={(event) => updateAttributes(key, event.currentTarget.value)}
              />
            </div>
          ))}
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600">
          Route mode: <strong>{connection.route?.mode ?? "auto"}</strong>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="icon-button"
            onClick={() => onConnectionRouteReset(connection.id)}
          >
            <RefreshCw aria-hidden="true" size={14} />
            Reset route
          </button>
          <button
            type="button"
            className="icon-button icon-button-danger"
            onClick={() => onConnectionRemove(connection.id)}
          >
            <Trash2 aria-hidden="true" size={14} />
            Remove wire
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
