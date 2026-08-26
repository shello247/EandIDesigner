"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ChevronRight,
  Copy,
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
  DrawingMeasurementUnit,
  DrawingModel as DrawingPackageModel,
  DrawingPackageSheet,
  DrawingSheetCanvasModel as DrawingModel
} from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import type {
  PanelConnectionDisplayMode,
  PlacementWireContextSummary
} from "@/features/drawing_panel_wiring/api/public";
import { ConnectionDisplaySelect } from "@/features/drawing_panel_wiring/ui/public";
import type {
  DrawingTerminalAvailabilityItem,
  DrawingTerminalAvailabilitySummary
} from "../../logic/services/drawing-anchor-availability";
import {
  createConnectedWireScheduleLayout,
  isConnectedWireScheduleAnnotation,
  type ConnectedWireScheduleProjection
} from "@/features/drawing_connected_wire_schedule/api/public";
import { ConnectedWireScheduleEditor } from "@/features/drawing_connected_wire_schedule/ui/public";
import {
  buildDrawingAssetCatalog,
  detectDuplicatePlacementTags,
  normalizeAssetTag,
  placementAssetId,
  stepEngineeringTag
} from "../../logic/services/drawing-asset-identity";
import {
  constrainPanelEnclosureDimensions,
  getPanelEnclosureCenteredPosition,
  getPanelEnclosureDisplayBounds,
  getPanelEnclosureTitle,
  getPanelEnclosureKindLabel,
  getVisibleSheetContainers,
  isGeneratedPanelEnclosurePlacement,
  isLegacyPanelEnclosureLayout,
  resolvePanelEnclosureLayoutScale,
  resizePanelEnclosure
} from "../../logic/services/drawing-asset-containment";
import {
  autosizeLayoutHelperToBackplane,
  getBackplanesForSheet,
  getLayoutChildrenForBackplane,
  getBackplanePhysicalPlacementArea,
  isBackplanePlacement,
  isLayoutHelperPlacement,
  normalizeLayoutHelperDimensionsForSymbol,
  shouldAutosizeLayoutSymbolToBackplane
} from "../../logic/services/drawing-backplane-layouts";
import {
  getBackplaneCenteredPosition,
  getBackplaneDisplayBounds,
  getBackplanePrintableArea,
  getPanelPhysicalContentRequirements,
  resolveBackplaneLayoutScale,
  resolveLayoutHelperDisplayPlacement
} from "../../logic/services/drawing-backplane-scale";
import { getAnnotationSize } from "../../logic/services/drawing-annotations";
import { hasConnectionRouteOutsideSheet } from "../../logic/services/connection-route-geometry";
import { getSymbolForPlacement } from "../../logic/services/drawing-connections";
import { getRotatedPlacementBounds } from "../../logic/services/drawing-geometry";
import { PANEL_ENCLOSURE_SCALE_DENOMINATORS } from "../../logic/services/drawing-physical-layout-scale";
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
import {
  deriveWireId,
  getConnectionWireId,
  getReadableConnectionName
} from "../../logic/services/drawing-identification";
import type { DrawingCanvasSelection } from "../../logic/services/drawing-selection";
import type { PlacementArrangementAction } from "../../logic/services/drawing-selection-arrangement";
import {
  isInspectorLayoutOnlyPlacement,
  resolveDrawingInspectorContext
} from "../../logic/services/drawing-inspector-context";
import {
  drawingMeasurementLabel,
  formatDrawingMeasurement,
  formatDrawingMeasurementPair,
  parseDrawingMeasurement
} from "../../logic/services/drawing-measurement-units";
import { isGeneratedTerminalBlockPlacement } from "../../logic/services/drawing-generated-symbols";
import { getPlacementConnectionDisplayMode } from "../../logic/services/drawing-placement-connection-display";
import {
  normalizeTerminalBlockPlacement,
  terminalBlockTerminals
} from "@/features/drawing_terminal_blocks/logic/services/terminal-block-layout";
import { getTerminalBlockGroupPhysicalSize } from "@/features/drawing_terminal_blocks/logic/services/terminal-block-groups";
import type { AssetLinkDialogMode } from "./asset-link-dialog";
import {
  deriveInternalWireId,
  formatWireNumber,
  getPanelComponentPlacementSummary,
  type PanelConnectionPatternRecord,
  type PanelWireAttributes
} from "@/features/drawing_panel_wiring/api/public";
import {
  createWireSpecificationSnapshot,
  type WireCatalogEntry,
  type WireSpecificationSnapshot
} from "@/features/wire_catalog/api/public";
import { WireCatalogPicker } from "@/features/wire_catalog/ui/components/wire-catalog-picker";
import { isGeneratedPanelPatternLegendPlacement } from "../../logic/services/drawing-panel-reference-symbols";
import type { DrawingComponentSelection } from "@/features/symbol_components/api/public";
import { validateDrawingComponentSelections } from "@/features/symbol_components/api/public";
import { AssetComponentConfigurator } from "@/features/symbol_components/ui/components/asset-component-configurator";
import { DrawingSelectionArrangeControls } from "./drawing-selection-arrange-controls";
import {
  composeTerminalStripGeometry,
  countStructuredTerminalStripMemberAttributes,
  resolveStructuredTerminalStripMemberPurpose
} from "@/features/drawing_terminal_blocks/api/public";
import {
  getPanelConnectionViewChildren,
  isPanelConnectionViewPlacement,
  listPanelConnectionViewSources
} from "../../logic/services/drawing-panel-connection-views";
import type { EngineeringAttributeContainer } from "@/features/engineering_attributes/api/public";
import {
  EngineeringAttributesCard,
  type EngineeringAttributeChange
} from "@/features/engineering_attributes/ui/public";

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

function placementHasSidedTerminals(
  placement: DrawingModel["placements"][number],
  symbols: ApprovedDrawingSymbol[]
) {
  if (isGeneratedTerminalBlockPlacement(placement)) return true;

  return Boolean(
    getSymbolForPlacement(placement, symbols)?.metadata.terminals.some(
      (terminal) =>
        terminal.panelSide === "internal" || terminal.panelSide === "external"
    )
  );
}

function DrawingMeasurementField({
  id,
  label,
  valueMm,
  measurementUnit,
  disabled = false,
  requirePositive = false,
  onCommit
}: {
  id: string;
  label: string;
  valueMm: number;
  measurementUnit: DrawingMeasurementUnit;
  disabled?: boolean;
  requirePositive?: boolean;
  onCommit: (valueMm: number) => void;
}) {
  const canonicalKey = `${measurementUnit}:${valueMm}`;
  const canonicalDisplay = formatDrawingMeasurement(valueMm, measurementUnit);
  const [draftState, setDraftState] = useState({
    canonicalKey,
    value: canonicalDisplay
  });
  const draft =
    draftState.canonicalKey === canonicalKey
      ? draftState.value
      : canonicalDisplay;

  const reset = () => {
    setDraftState({
      canonicalKey,
      value: canonicalDisplay
    });
  };
  const commit = () => {
    const parsed = parseDrawingMeasurement(draft, measurementUnit);

    if (
      parsed === undefined ||
      (requirePositive && parsed <= 0)
    ) {
      reset();
      return;
    }

    setDraftState({
      canonicalKey: `${measurementUnit}:${parsed}`,
      value: formatDrawingMeasurement(parsed, measurementUnit)
    });
    onCommit(parsed);
  };

  return (
    <div>
      <label className="field-label" htmlFor={id}>
        {drawingMeasurementLabel(label, measurementUnit)}
      </label>
      <input
        id={id}
        className="field-input"
        inputMode="decimal"
        value={draft}
        readOnly={disabled}
        disabled={disabled}
        onChange={(event) =>
          setDraftState({
            canonicalKey,
            value: event.currentTarget.value
          })
        }
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            reset();
          }
        }}
      />
    </div>
  );
}

function InspectorDisclosureSection({
  title,
  subtitle,
  children,
  contentClassName = "space-y-3 p-4",
  testId
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  contentClassName?: string;
  testId?: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const contentId = useId();

  return (
    <section className="tool-panel overflow-hidden" data-testid={testId}>
      <button
        type="button"
        className="group flex w-full items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 text-left transition hover:bg-slate-50"
        aria-expanded={isExpanded}
        aria-controls={contentId}
        onClick={() => setIsExpanded((current) => !current)}
      >
        <span className="min-w-0">
          <span className="block text-sm font-bold text-slate-950">
            {title}
          </span>
          {subtitle ? (
            <span className="mt-0.5 block truncate text-xs text-slate-500">
              {subtitle}
            </span>
          ) : null}
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
        <div id={contentId} className={contentClassName}>
          {children}
        </div>
      ) : null}
    </section>
  );
}

export function DrawingObjectInspector({
  model,
  packageModel,
  activeSheet,
  symbols,
  measurementUnit,
  headerAction,
  selection,
  onArrangeSelection,
  onAssetChange,
  onOpenAssetLinkDialog,
  onPlacementChange,
  onConnectionDisplayModeChange,
  onFitPanelConnectionView,
  placementWireContextSummary,
  terminalAvailabilitySummary,
  connectedWireScheduleProjection,
  onEditTerminalStrip,
  onReuseTerminalStrip,
  onAssetComponentSelectionsChange,
  selectedConnectionId,
  onConnectionChange,
  onConnectionRemove,
  onConnectionRouteRecover,
  onConnectionRouteReset,
  onInternalWireChange,
  wireCatalogEntries = [],
  onManageWireCatalog,
  onPanelPatternChange,
  onPanelPatternLegendVisibilityChange,
  showConnections = true,
  onAnnotationChange,
  onAnnotationRemove,
  onConnectedWireScheduleSynchronize,
  onConnectedWireSchedulePaginationRemove,
  onConnectedWireScheduleOpenPartOne
}: {
  model: DrawingModel;
  packageModel: DrawingPackageModel;
  activeSheet: DrawingPackageSheet;
  symbols: ApprovedDrawingSymbol[];
  measurementUnit: DrawingMeasurementUnit;
  headerAction?: ReactNode;
  selection: DrawingCanvasSelection;
  onArrangeSelection: (action: PlacementArrangementAction) => void;
  onAssetChange: (
    assetId: string,
    updates: {
      tag?: string;
      title?: string;
      description?: string;
      engineeringAttributes?: EngineeringAttributeContainer;
    },
    engineeringAttributeChange?: EngineeringAttributeChange
  ) => void;
  onOpenAssetLinkDialog: (mode: AssetLinkDialogMode) => void;
  onPlacementChange: (
    placementId: string,
    updates: Partial<DrawingModel["placements"][number]>
  ) => void;
  onAssetComponentSelectionsChange: (
    assetId: string,
    selections: DrawingComponentSelection[]
  ) => void;
  onConnectionDisplayModeChange: (
    placementId: string,
    mode: PanelConnectionDisplayMode
  ) => void;
  onFitPanelConnectionView: (placementId: string) => void;
  onEditTerminalStrip: (assetId: string) => void;
  onReuseTerminalStrip: (placementId: string) => void;
  placementWireContextSummary?: PlacementWireContextSummary;
  terminalAvailabilitySummary?: DrawingTerminalAvailabilitySummary;
  connectedWireScheduleProjection?: ConnectedWireScheduleProjection;
  selectedConnectionId?: string;
  onConnectionChange: (
    connectionId: string,
    updates: Partial<DrawingConnection>
  ) => void;
  onConnectionRemove: (connectionId: string) => void;
  onConnectionRouteRecover: (connectionId: string) => void;
  onConnectionRouteReset: (connectionId: string) => void;
  onInternalWireChange?: (
    wireRecordId: string,
    updates: {
      wireId?: string;
      specification?: WireSpecificationSnapshot;
      attributes?: PanelWireAttributes;
    }
  ) => void;
  wireCatalogEntries?: WireCatalogEntry[];
  onManageWireCatalog?: () => void;
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
  onConnectedWireScheduleSynchronize: (
    annotationId: string,
    rowsPerPage: number
  ) => void;
  onConnectedWireSchedulePaginationRemove: (annotationId: string) => void;
  onConnectedWireScheduleOpenPartOne: (continuationSetId: string) => void;
}) {
  const context = resolveDrawingInspectorContext({
    selection,
    selectedConnectionId
  });
  const selectedAnnotation =
    context.kind === "annotation"
      ? model.annotations.find(
          (annotation) => annotation.id === context.annotationId
        )
      : undefined;
  const selectedPlacement =
    context.kind === "placement"
      ? model.placements.find(
          (placement) => placement.id === context.placementId
        )
      : undefined;
  const selectedAssetId = selectedPlacement
    ? placementAssetId(selectedPlacement)
    : undefined;
  const selectedAsset = selectedAssetId
    ? packageModel.assets.find((asset) => asset.id === selectedAssetId)
    : undefined;
  const selectedAssetEditorKey = [
    selectedAssetId,
    selectedAsset?.tag ?? selectedPlacement?.tag,
    selectedAsset?.title ?? selectedPlacement?.title,
    selectedAsset?.description
  ].join(":");
  const scheduleEquipmentOptions = useMemo(
    () =>
      activeSheet.placements.flatMap((placement) => {
        if (
          !placement.assetId ||
          !["device", "terminal_block"].includes(placement.role) ||
          placement.layoutKind ||
          placement.panelReference
        ) {
          return [];
        }
        const symbol = getSymbolForPlacement(placement, symbols);
        if (!symbol || (symbol.metadata.terminals?.length ?? 0) === 0) {
          return [];
        }
        const asset = packageModel.assets.find(
          (candidate) => candidate.id === placement.assetId
        );
        return [
          {
            assetId: placement.assetId,
            placementId: placement.id,
            label: `${asset?.tag ?? placement.tag} — ${asset?.title ?? placement.title ?? symbol.displayName}`
          }
        ];
      }),
    [activeSheet.placements, packageModel.assets, symbols]
  );
  const selectedScheduleSourcePlacement =
    selectedAnnotation && isConnectedWireScheduleAnnotation(selectedAnnotation)
      ? activeSheet.placements.find(
          (placement) =>
            placement.id === selectedAnnotation.schedule.sourcePlacementId
        )
      : undefined;
  const selectedScheduleDisplayMode = selectedScheduleSourcePlacement
    ? getPlacementConnectionDisplayMode(
        selectedScheduleSourcePlacement,
        activeSheet
      )
    : "sheet_only";

  return (
    <div className="drawing-object-inspector space-y-5">
      <section className="tool-panel drawing-object-inspector-header overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-bold">Properties</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {context.kind === "placement"
                ? "Selected drawing item"
                : context.kind === "annotation"
                  ? "Selected note"
                  : context.kind === "connection"
                    ? "Selected connection"
                    : context.kind === "multiple"
                      ? "Multiple items selected"
                      : "No selection"}
            </p>
          </div>
          {headerAction ?? null}
        </div>
        {context.kind === "empty" ? (
          <div className="p-4">
            <div className="rounded-md border border-dashed border-slate-300 px-4 py-8 text-center text-sm leading-6 text-slate-500">
              Select an item on the drawing to inspect its properties.
            </div>
          </div>
        ) : null}
      </section>

      {context.kind === "multiple" ? (
        <MultiSelectionSummary
          key={`selection:${selection.placementIds.join(",")}:${selection.annotationIds.join(",")}`}
          model={model}
          symbols={symbols}
          selection={selection}
          onArrange={onArrangeSelection}
        />
      ) : null}

      {context.kind === "placement" ? (
        <>
          <SelectedPlacementAssetEditor
            key={selectedAssetEditorKey}
            placement={selectedPlacement}
            packageModel={packageModel}
            symbols={symbols}
            measurementUnit={measurementUnit}
            allowCreateAsset={
              activeSheet.panelDrawingContext?.kind !== "detailed_panel_wiring"
            }
            onAssetChange={onAssetChange}
            onOpenAssetLinkDialog={onOpenAssetLinkDialog}
          />

          {selectedAsset ? (
            <EngineeringAttributesCard
              key={`engineering-attributes:${selectedAsset.id}`}
              assetId={selectedAsset.id}
              assetType={selectedAsset.type}
              container={selectedAsset.engineeringAttributes}
              title={
                selectedAsset.terminalStrip
                  ? "Strip Engineering Attributes"
                  : "Engineering Attributes"
              }
              subtitle={
                selectedAsset.terminalStrip
                  ? `Complete strip · ${selectedAsset.engineeringAttributes?.values.length ?? 0} recorded`
                  : undefined
              }
              onChange={(engineeringAttributes, change) =>
                onAssetChange(
                  selectedAsset.id,
                  { engineeringAttributes },
                  change
                )
              }
            />
          ) : null}

          <SelectedPanelEnclosureEditor
            key={`panel-enclosure:${selectedPlacement?.id ?? "none"}`}
            placement={selectedPlacement}
            model={model}
            symbols={symbols}
            measurementUnit={measurementUnit}
            onPlacementChange={onPlacementChange}
          />

          <SelectedPanelConnectionViewEditor
            key={`panel-reference:${selectedPlacement?.id ?? "none"}`}
            placement={selectedPlacement}
            model={model}
            packageModel={packageModel}
            onFitContents={onFitPanelConnectionView}
          />

          <SelectedDetailedPanelComponentSummary
            key={`panel-component:${selectedPlacement?.id ?? "none"}`}
            placement={selectedPlacement}
            activeSheet={activeSheet}
            packageModel={packageModel}
            symbols={symbols}
          />

          <SelectedTerminalAvailabilitySummary
            key={`terminal-availability:${selectedPlacement?.id ?? "none"}`}
            summary={terminalAvailabilitySummary}
          />

          <SelectedPlacementLayoutEditor
            key={`${selectedPlacement?.id ?? "none"}:${measurementUnit}`}
            placement={selectedPlacement}
            model={model}
            symbols={symbols}
            measurementUnit={measurementUnit}
            onPlacementChange={onPlacementChange}
          />

          <SelectedPlacementConnectionDisplayEditor
            key={`connection-display:${selectedPlacement?.id ?? "none"}`}
            placement={selectedPlacement}
            activeSheet={activeSheet}
            symbols={symbols}
            summary={placementWireContextSummary}
            onConnectionDisplayModeChange={onConnectionDisplayModeChange}
          />

          <SelectedAssetComponentsEditor
            key={`asset-components:${selectedPlacement?.id ?? "none"}`}
            placement={selectedPlacement}
            packageModel={packageModel}
            symbols={symbols}
            onChange={onAssetComponentSelectionsChange}
          />

          <SelectedTerminalBlockEditor
            key={`terminal-block:${selectedPlacement?.id ?? "none"}`}
            placement={selectedPlacement}
            measurementUnit={measurementUnit}
          />

          <SelectedStructuredTerminalStripEditor
            key={`terminal-strip:${selectedPlacement?.id ?? "none"}`}
            placement={selectedPlacement}
            packageModel={packageModel}
            symbols={symbols}
            measurementUnit={measurementUnit}
            onEdit={onEditTerminalStrip}
            onReuse={onReuseTerminalStrip}
          />

        </>
      ) : null}

      {context.kind === "annotation" &&
      selectedAnnotation &&
      isConnectedWireScheduleAnnotation(selectedAnnotation) ? (
        <ConnectedWireScheduleEditor
          key={`${selectedAnnotation.id}:${selectedAnnotation.schedule.pagination?.rowsPerPage ?? "unpaginated"}`}
          annotation={selectedAnnotation}
          projection={connectedWireScheduleProjection}
          layout={
            connectedWireScheduleProjection
              ? createConnectedWireScheduleLayout({
                  annotation: selectedAnnotation,
                  projection: connectedWireScheduleProjection,
                  sheet: model.sheet
                })
              : undefined
          }
          equipmentOptions={scheduleEquipmentOptions}
          connectionDisplayMode={selectedScheduleDisplayMode}
          connectionDisplayHasSidedTerminals={
            selectedScheduleSourcePlacement
              ? placementHasSidedTerminals(
                  selectedScheduleSourcePlacement,
                  symbols
                )
              : false
          }
          connectionDisplayDisabled={!selectedScheduleSourcePlacement}
          sheet={model.sheet}
          isDetailedPanel={
            activeSheet.panelDrawingContext?.kind === "detailed_panel_wiring"
          }
          onChange={(updates) =>
            onAnnotationChange(selectedAnnotation.id, updates)
          }
          onConnectionDisplayModeChange={(mode) => {
            if (selectedScheduleSourcePlacement) {
              onConnectionDisplayModeChange(
                selectedScheduleSourcePlacement.id,
                mode
              );
            }
          }}
          onRemove={() => onAnnotationRemove(selectedAnnotation.id)}
          onSynchronize={(rowsPerPage) =>
            onConnectedWireScheduleSynchronize(
              selectedAnnotation.id,
              rowsPerPage
            )
          }
          onRemovePagination={() =>
            onConnectedWireSchedulePaginationRemove(selectedAnnotation.id)
          }
          onOpenPartOne={onConnectedWireScheduleOpenPartOne}
        />
      ) : null}

      {context.kind === "annotation" &&
      selectedAnnotation &&
      !isConnectedWireScheduleAnnotation(selectedAnnotation) ? (
        <SelectedNoteEditor
          key={`note:${selectedAnnotation.id}`}
          annotation={selectedAnnotation}
          onAnnotationChange={onAnnotationChange}
          onAnnotationRemove={onAnnotationRemove}
        />
      ) : null}

      {context.kind === "connection" ? (
        <>
          <InternalWireEditor
            key={`internal-wire:${context.connectionId}`}
            packageModel={packageModel}
            model={model}
            selectedConnectionId={context.connectionId}
            onInternalWireChange={onInternalWireChange}
            wireCatalogEntries={wireCatalogEntries}
            onManageWireCatalog={onManageWireCatalog}
            onConnectionRemove={onConnectionRemove}
            onConnectionRouteRecover={onConnectionRouteRecover}
            onConnectionRouteReset={onConnectionRouteReset}
          />

          <PanelPatternEditor
            key={`panel-pattern:${context.connectionId}`}
            packageModel={packageModel}
            model={model}
            selectedConnectionId={context.connectionId}
            onPanelPatternChange={onPanelPatternChange}
            onLegendVisibilityChange={onPanelPatternLegendVisibilityChange}
            onConnectionRemove={onConnectionRemove}
            onConnectionRouteRecover={onConnectionRouteRecover}
            onConnectionRouteReset={onConnectionRouteReset}
          />

          {showConnections ? (
            <ConnectionEditor
              key={`connection:${context.connectionId}`}
              model={model}
              symbols={symbols}
              selectedConnectionId={context.connectionId}
              onConnectionChange={onConnectionChange}
              onConnectionRemove={onConnectionRemove}
              onConnectionRouteRecover={onConnectionRouteRecover}
              onConnectionRouteReset={onConnectionRouteReset}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function SelectedPanelConnectionViewEditor({
  placement,
  model,
  packageModel,
  onFitContents
}: {
  placement: DrawingModel["placements"][number] | undefined;
  model: DrawingModel;
  packageModel: DrawingPackageModel;
  onFitContents: (placementId: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  if (!isPanelConnectionViewPlacement(placement) || !placement.assetId) {
    return null;
  }
  const children = getPanelConnectionViewChildren(model, placement.id);
  const sources = listPanelConnectionViewSources(packageModel, placement.assetId);
  const source = sources.find(
    (candidate) =>
      candidate.placementId ===
      placement.panelConnectionView.sourceBackplanePlacementId
  );
  return (
    <section className="tool-panel overflow-hidden">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 text-left transition hover:bg-slate-50"
        aria-expanded={isExpanded}
        onClick={() => setIsExpanded((current) => !current)}
      >
        <span className="min-w-0">
          <span className="block text-sm font-bold text-slate-950">
            Panel Connection Reference
          </span>
          <span className="mt-0.5 block truncate text-xs text-slate-500">
            {placement.tag} / {children.length} represented asset{children.length === 1 ? "" : "s"}
          </span>
        </span>
        <ChevronRight
          aria-hidden="true"
          size={16}
          className={`shrink-0 text-slate-400 transition-transform ${isExpanded ? "rotate-90" : ""}`}
        />
      </button>
      <div className={isExpanded ? "space-y-3 p-4" : "hidden"}>
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <p className="font-semibold text-slate-800">Linked panel: {placement.tag}</p>
          <p className="mt-1">
            Linked backplane: {source?.label ?? "Unavailable"}
          </p>
          <p className="mt-1">{children.length} represented asset{children.length === 1 ? "" : "s"}</p>
        </div>
        {!source ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            The authoritative physical backplane is no longer available. Existing representations remain visible, but new assets cannot be added.
          </div>
        ) : null}
        <button
          type="button"
          className="icon-button w-full justify-center"
          disabled={children.length === 0}
          onClick={() => onFitContents(placement.id)}
        >
          <Maximize2 aria-hidden="true" size={14} />
          Fit contents
        </button>
      </div>
    </section>
  );
}

function SelectedTerminalAvailabilitySummary({
  summary
}: {
  summary?: DrawingTerminalAvailabilitySummary;
}) {
  if (!summary) return null;
  const total =
    summary.available +
    summary.occupied +
    summary.conflicting +
    summary.unresolved;
  const availableTerminals = summary.terminals.filter(
    (terminal) => terminal.status === "available"
  );
  const occupiedTerminals = summary.terminals.filter(
    (terminal) => terminal.status === "occupied"
  );
  const attentionTerminals = summary.terminals.filter(
    (terminal) =>
      terminal.status !== "available" && terminal.status !== "occupied"
  );

  return (
    <InspectorDisclosureSection
      title="Terminal availability"
      subtitle={`${total} terminal${total === 1 ? "" : "s"}`}
      contentClassName="space-y-4 p-4"
      testId="selected-terminal-availability-summary"
    >
      <p className="text-xs font-semibold text-slate-600">
        <span className="text-emerald-700">{summary.available} available</span>
        <span aria-hidden="true"> · </span>
        <span className="text-teal-800">{summary.occupied} occupied</span>
        {summary.conflicting > 0 ? (
          <>
            <span aria-hidden="true"> · </span>
            <span className="text-rose-700">
              {summary.conflicting} conflicting
            </span>
          </>
        ) : null}
        {summary.unresolved > 0 ? (
          <>
            <span aria-hidden="true"> · </span>
            <span className="text-slate-500">
              {summary.unresolved} unresolved
            </span>
          </>
        ) : null}
      </p>
      <TerminalAvailabilityGroup
        title="Available"
        emptyMessage="No available terminals."
        terminals={availableTerminals}
        tone="available"
      />
      <TerminalAvailabilityGroup
        title="Occupied"
        emptyMessage="No occupied terminals."
        terminals={occupiedTerminals}
        tone="occupied"
      />
      {attentionTerminals.length > 0 ? (
        <TerminalAvailabilityGroup
          title="Needs attention"
          emptyMessage=""
          terminals={attentionTerminals}
          tone="attention"
        />
      ) : null}
    </InspectorDisclosureSection>
  );
}

function terminalAvailabilitySideLabel(
  side: DrawingTerminalAvailabilityItem["side"]
): string | undefined {
  if (side === "internal") return "Internal / TOP";
  if (side === "external") return "External / BOTTOM";
  return undefined;
}

function terminalAvailabilityLabel(label: string): string {
  return /^terminal\b/i.test(label) ? label : `Terminal ${label}`;
}

function TerminalAvailabilityGroup({
  title,
  emptyMessage,
  terminals,
  tone
}: {
  title: string;
  emptyMessage: string;
  terminals: DrawingTerminalAvailabilityItem[];
  tone: "available" | "occupied" | "attention";
}) {
  const toneClasses = {
    available: {
      heading: "text-emerald-800",
      badge: "bg-emerald-100 text-emerald-800",
      row: "border-emerald-200 bg-emerald-50/60"
    },
    occupied: {
      heading: "text-teal-900",
      badge: "bg-teal-100 text-teal-900",
      row: "border-teal-200 bg-teal-50/50"
    },
    attention: {
      heading: "text-rose-800",
      badge: "bg-rose-100 text-rose-800",
      row: "border-rose-200 bg-rose-50/60"
    }
  }[tone];

  return (
    <section aria-label={`${title} terminals`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className={`text-[11px] font-bold uppercase tracking-wide ${toneClasses.heading}`}>
          {title}
        </h3>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${toneClasses.badge}`}>
          {terminals.length}
        </span>
      </div>
      {terminals.length === 0 ? (
        <p className="mt-2 rounded-md border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-500">
          {emptyMessage}
        </p>
      ) : (
        <div className="mt-2 space-y-1.5">
          {terminals.map((terminal) => {
            const sideLabel = terminalAvailabilitySideLabel(terminal.side);
            const occupant = terminal.occupants[0];
            const occupantLabel = occupant?.wireId ?? occupant?.label;

            return (
              <div
                key={terminal.id}
                className={`flex items-start justify-between gap-3 rounded-md border px-3 py-2 ${toneClasses.row}`}
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-slate-900">
                    {terminalAvailabilityLabel(terminal.terminalLabel)}
                  </p>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    {terminal.terminalKey}
                    {sideLabel ? ` · ${sideLabel}` : ""}
                  </p>
                </div>
                <div className="min-w-0 max-w-[58%] text-right">
                  {occupantLabel ? (
                    <p className="break-words text-[11px] font-semibold text-slate-700">
                      {occupantLabel}
                    </p>
                  ) : null}
                  {terminal.reason && !occupantLabel ? (
                    <p className="break-words text-[10px] leading-4 text-slate-600">
                      {terminal.reason}
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function SelectedPlacementConnectionDisplayEditor({
  placement,
  activeSheet,
  symbols,
  summary,
  onConnectionDisplayModeChange
}: {
  placement: DrawingModel["placements"][number] | undefined;
  activeSheet: DrawingPackageSheet;
  symbols: ApprovedDrawingSymbol[];
  summary?: PlacementWireContextSummary;
  onConnectionDisplayModeChange: (
    placementId: string,
    mode: PanelConnectionDisplayMode
  ) => void;
}) {
  if (!placement || !placementAssetId(placement)) {
    return null;
  }

  const symbol = getSymbolForPlacement(placement, symbols);
  const hasTerminals = isGeneratedTerminalBlockPlacement(placement)
    ? terminalBlockTerminals(placement.terminalBlock).length > 0
    : Boolean(symbol?.metadata.terminals.length);

  if (
    !hasTerminals ||
    !["device", "terminal_block"].includes(placement.role) ||
    isInspectorLayoutOnlyPlacement(placement, symbol)
  ) {
    return null;
  }

  const mode = getPlacementConnectionDisplayMode(placement, activeSheet);
  const hasSidedTerminals = placementHasSidedTerminals(placement, symbols);
  const summaryText = summary
    ? mode === "internal_connected"
      ? `${summary.internalVisibleCount} internal wire reference${summary.internalVisibleCount === 1 ? "" : "s"} shown.`
      : mode === "external_connected"
        ? `${summary.externalVisibleCount} external reference${summary.externalVisibleCount === 1 ? "" : "s"} shown.`
        : `${summary.internalVisibleCount} internal and ${summary.externalVisibleCount} external references shown.`
    : "Resolving connected wire references...";

  return (
    <InspectorDisclosureSection
      title="Connection Display"
      subtitle="Choose the wiring context shown for this occurrence only."
    >
        <label className="field-label" htmlFor={`connection-display-${placement.id}`}>
          Connected wiring
        </label>
        <ConnectionDisplaySelect
          id={`connection-display-${placement.id}`}
          mode={mode}
          hasSidedTerminals={hasSidedTerminals}
          onChange={(nextMode) =>
            onConnectionDisplayModeChange(placement.id, nextMode)
          }
        />
        {mode !== "sheet_only" ? (
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
            {summaryText}
            {summary?.unresolvedCount ? (
              <p className="mt-1 font-medium text-amber-700">
                {summary.unresolvedCount} connection
                {summary.unresolvedCount === 1 ? "" : "s"} could not be mapped
                to an unambiguous terminal anchor.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-xs leading-5 text-slate-500">
            Off-sheet stubs are hidden. The linked schedule includes only routes
            touching this occurrence on this sheet.
          </p>
        )}
    </InspectorDisclosureSection>
  );
}

function SelectedAssetComponentsEditor({
  placement,
  packageModel,
  symbols,
  onChange
}: {
  placement?: DrawingModel["placements"][number];
  packageModel: DrawingPackageModel;
  symbols: ApprovedDrawingSymbol[];
  onChange: (assetId: string, selections: DrawingComponentSelection[]) => void;
}) {
  if (!placement) {
    return null;
  }

  const assetId = placementAssetId(placement);
  const asset = packageModel.assets.find((candidate) => candidate.id === assetId);
  const symbol = symbols.find(
    (candidate) =>
      candidate.symbolId === placement.symbolId &&
      candidate.versionId === placement.versionId
  );

  if (!asset || !symbol?.metadata.componentPositions?.length) {
    return null;
  }

  const selections = asset.componentSelections ?? [];
  return (
    <AssetComponentsDraftEditor
      key={`${assetId}:${JSON.stringify(selections)}`}
      assetId={assetId}
      tag={asset.tag}
      symbol={symbol}
      symbols={symbols}
      initialSelections={selections}
      onChange={onChange}
    />
  );
}

function AssetComponentsDraftEditor({
  assetId,
  tag,
  symbol,
  symbols,
  initialSelections,
  onChange
}: {
  assetId: string;
  tag: string;
  symbol: ApprovedDrawingSymbol;
  symbols: ApprovedDrawingSymbol[];
  initialSelections: DrawingComponentSelection[];
  onChange: (assetId: string, selections: DrawingComponentSelection[]) => void;
}) {
  const [draft, setDraft] = useState(initialSelections);
  const issues = useMemo(
    () =>
      validateDrawingComponentSelections({
        parent: symbol,
        selections: draft,
        symbols
      }),
    [draft, symbol, symbols]
  );

  return (
    <InspectorDisclosureSection
      title="Components"
      subtitle={`Installed on ${tag}. Changes apply to every occurrence of this asset.`}
    >
        <AssetComponentConfigurator
          parent={symbol}
          symbols={symbols}
          value={draft}
          onChange={setDraft}
        />
        {issues[0] ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
            {issues[0].message}
          </div>
        ) : null}
        <button
          type="button"
          className="tool-button"
          disabled={issues.some((issue) => issue.severity === "blocking")}
          onClick={() => onChange(assetId, draft)}
        >
          Apply component configuration
        </button>
    </InspectorDisclosureSection>
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
    <InspectorDisclosureSection
      title="Panel Component"
      subtitle={`${summary.tag} / ${summary.title ?? symbol.displayName}`}
      contentClassName="space-y-3 p-4 text-xs"
    >
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
    </InspectorDisclosureSection>
  );
}

function MultiSelectionSummary({
  model,
  symbols,
  selection,
  onArrange
}: {
  model: DrawingModel;
  symbols: ApprovedDrawingSymbol[];
  selection: DrawingCanvasSelection;
  onArrange: (action: PlacementArrangementAction) => void;
}) {
  const total = selection.placementIds.length + selection.annotationIds.length;

  if (total <= 1) {
    return null;
  }

  return (
    <InspectorDisclosureSection
      title="Selection"
      subtitle={`${total} items selected`}
      contentClassName="space-y-4 p-4 text-xs font-semibold text-slate-600"
    >
        <div className="grid grid-cols-2 gap-2">
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
        <DrawingSelectionArrangeControls
          model={model}
          symbols={symbols}
          selection={selection}
          onArrange={onArrange}
        />
    </InspectorDisclosureSection>
  );
}

function SelectedPanelEnclosureEditor({
  placement,
  model,
  symbols,
  measurementUnit,
  onPlacementChange
}: {
  placement: DrawingModel["placements"][number] | undefined;
  model: DrawingModel;
  symbols: ApprovedDrawingSymbol[];
  measurementUnit: DrawingMeasurementUnit;
  onPlacementChange: (
    placementId: string,
    updates: Partial<DrawingModel["placements"][number]>
  ) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!isGeneratedPanelEnclosurePlacement(placement)) {
    return null;
  }

  const assetId = placementAssetId(placement);
  const containedPlacements = model.placements.filter(
    (candidate) => candidate.containerAssetId === assetId
  );
  const panelTitle = getPanelEnclosureTitle(placement);
  const physicalContentRequirements = getPanelPhysicalContentRequirements({
    panel: placement,
    placements: model.placements
  });
  const legacyLayout = isLegacyPanelEnclosureLayout(placement);
  const canEnableHierarchicalScale = physicalContentRequirements.fits;
  const containedBounds = containedPlacements.map((candidate) => {
    if (isBackplanePlacement(candidate)) {
      return getBackplaneDisplayBounds(model.sheet, candidate, placement);
    }

    const parentBackplane = candidate.layoutParentId
      ? model.placements.find(
          (item) =>
            item.id === candidate.layoutParentId && isBackplanePlacement(item)
        )
      : undefined;
    const displayCandidate = parentBackplane
      ? resolveLayoutHelperDisplayPlacement({
          sheet: model.sheet,
          placement: candidate,
          backplane: parentBackplane,
          parentPanel: placement
        })
      : candidate;
    const dimensions = displayCandidate.layoutDimensions;

    if (dimensions) {
      const radians = (displayCandidate.rotation * Math.PI) / 180;
      const width = dimensions.lengthMm;
      const height = dimensions.widthMm;
      const rotatedWidth =
        Math.abs(width * Math.cos(radians)) +
        Math.abs(height * Math.sin(radians));
      const rotatedHeight =
        Math.abs(width * Math.sin(radians)) +
        Math.abs(height * Math.cos(radians));

      return {
        x: displayCandidate.x + (width - rotatedWidth) / 2,
        y: displayCandidate.y + (height - rotatedHeight) / 2,
        width: rotatedWidth,
        height: rotatedHeight
      };
    }

    const symbol = getSymbolForPlacement(displayCandidate, symbols);
    return symbol
      ? getRotatedPlacementBounds(displayCandidate, symbol.metadata)
      : {
          x: displayCandidate.x,
          y: displayCandidate.y,
          width: 0,
          height: 0
        };
  });
  const automaticScale = resolvePanelEnclosureLayoutScale(model.sheet, {
    ...placement,
    layoutScale: { mode: "auto" }
  });
  const selectedScaleValue = legacyLayout
    ? "legacy"
    : placement.layoutScale?.mode === "manual" && placement.layoutScale.value
      ? String(placement.layoutScale.value)
      : "auto";
  const knownManualScale =
    placement.layoutScale?.mode === "manual" &&
    placement.layoutScale.value &&
    !PANEL_ENCLOSURE_SCALE_DENOMINATORS.some(
      (denominator) => denominator === placement.layoutScale?.value
    )
      ? placement.layoutScale.value
      : undefined;
  const scaleOptions = PANEL_ENCLOSURE_SCALE_DENOMINATORS.map(
    (denominator) => ({
      denominator,
      fits: resolvePanelEnclosureLayoutScale(model.sheet, {
        ...placement,
        layoutScale: { mode: "manual", value: denominator }
      }).fits
    })
  );
  const changeScale = (value: string) => {
    if (value === "legacy") {
      return;
    }

    const layoutScale =
      value === "auto"
        ? ({ mode: "auto" } as const)
        : ({ mode: "manual", value: Number(value) } as const);
    const scaledPlacement = {
      ...placement,
      layoutScale
    };

    if (!resolvePanelEnclosureLayoutScale(model.sheet, scaledPlacement).fits) {
      return;
    }

    onPlacementChange(placement.id, {
      layoutScale,
      ...getPanelEnclosureCenteredPosition(model.sheet, scaledPlacement)
    });
  };
  const updateDimension = (dimension: "width" | "height", valueMm: number) => {
    const constrained = constrainPanelEnclosureDimensions({
      placement,
      sheet: model.sheet,
      containedBounds,
      width: dimension === "width" ? valueMm : placement.enclosure.width,
      height: dimension === "height" ? valueMm : placement.enclosure.height
    });
    const resized = resizePanelEnclosure(placement, {
      x: placement.x,
      y: placement.y,
      width: constrained.width,
      height: constrained.height
    });
    const resizedSupportsHierarchy = getPanelPhysicalContentRequirements({
      panel: resized,
      placements: model.placements
    }).fits;
    const retainedManualScale =
      placement.layoutScale?.mode === "manual" &&
      resolvePanelEnclosureLayoutScale(model.sheet, resized).fits
        ? placement.layoutScale
        : undefined;

    onPlacementChange(placement.id, {
      enclosure: resized.enclosure,
      ...(placement.layoutScale || resizedSupportsHierarchy
        ? {
            layoutScale:
              retainedManualScale ?? ({ mode: "auto" as const })
          }
        : {})
    });
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
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <p className="font-semibold text-slate-800">
            {getPanelEnclosureKindLabel(placement.enclosure.kind)}
          </p>
          <p className="mt-1">
            Physical envelope{" "}
            {formatDrawingMeasurementPair(
              placement.enclosure.width,
              placement.enclosure.height,
              measurementUnit
            )}
            . Contains {containedPlacements.length}{" "}
            visible item{containedPlacements.length === 1 ? "" : "s"} on this
            sheet.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <DrawingMeasurementField
            id="panel-enclosure-width"
            label="Width"
            valueMm={placement.enclosure.width}
            measurementUnit={measurementUnit}
            requirePositive
            onCommit={(widthMm) => updateDimension("width", widthMm)}
          />
          <DrawingMeasurementField
            id="panel-enclosure-height"
            label="Height"
            valueMm={placement.enclosure.height}
            measurementUnit={measurementUnit}
            requirePositive
            onCommit={(heightMm) => updateDimension("height", heightMm)}
          />
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 rounded-md border border-slate-200 bg-white px-3 py-2">
          <div className="min-w-0">
            <label
              className="field-label"
              htmlFor="panel-enclosure-layout-scale"
            >
              Drawing scale
            </label>
            <select
              id="panel-enclosure-layout-scale"
              className="field-input text-xs"
              value={selectedScaleValue}
              disabled={legacyLayout && !canEnableHierarchicalScale}
              onChange={(event) => changeScale(event.currentTarget.value)}
            >
              {legacyLayout ? (
                <option value="legacy">Current 1:1 (preserved)</option>
              ) : null}
              <option value="auto">Auto ({automaticScale.label})</option>
              {knownManualScale ? (
                <option value={String(knownManualScale)}>
                  1:{knownManualScale} (current)
                </option>
              ) : null}
              {scaleOptions.map(({ denominator, fits }) => (
                <option
                  key={denominator}
                  value={String(denominator)}
                  disabled={!fits}
                >
                  1:{denominator}{fits ? "" : " (does not fit)"}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="icon-button h-[39px] shrink-0 px-2"
            disabled={legacyLayout && !canEnableHierarchicalScale}
            onClick={() =>
              onPlacementChange(placement.id, {
                layoutScale: { mode: "auto" },
                ...getPanelEnclosureCenteredPosition(model.sheet, {
                  ...placement,
                  layoutScale: { mode: "auto" }
                })
              })
            }
            aria-label="Fit panel within printable area"
            title={
              legacyLayout && !canEnableHierarchicalScale
                ? "Increase the panel dimensions to contain its physical backplane before fitting"
                : "Fit panel within printable area"
            }
          >
            <Maximize2 aria-hidden="true" size={14} />
            Fit panel
          </button>
        </div>
        {legacyLayout && !canEnableHierarchicalScale ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-4 text-amber-800">
            Existing layout preserved. Before physical auto-scaling can be
            enabled, the panel must contain at least {" "}
            {formatDrawingMeasurementPair(
              physicalContentRequirements.width,
              physicalContentRequirements.height,
              measurementUnit
            )}.
          </p>
        ) : null}

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

      </div>
    </section>
  );
}

function SelectedPlacementAssetEditor({
  placement,
  packageModel,
  symbols,
  measurementUnit,
  allowCreateAsset,
  onAssetChange,
  onOpenAssetLinkDialog
}: {
  placement: DrawingModel["placements"][number] | undefined;
  packageModel: DrawingPackageModel;
  symbols: ApprovedDrawingSymbol[];
  measurementUnit: DrawingMeasurementUnit;
  allowCreateAsset: boolean;
  onAssetChange: (
    assetId: string,
    updates: {
      tag?: string;
      title?: string;
      description?: string;
      engineeringAttributes?: EngineeringAttributeContainer;
    },
    engineeringAttributeChange?: EngineeringAttributeChange
  ) => void;
  onOpenAssetLinkDialog: (mode: AssetLinkDialogMode) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
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
  const catalogAsset = assetId
    ? assetCatalog.find((candidate) => candidate.assetId === assetId)
    : undefined;
  const packageAsset = assetId
    ? packageModel.assets.find((candidate) => candidate.id === assetId)
    : undefined;
  const tag = packageAsset?.tag ?? catalogAsset?.tag ?? placement?.tag ?? "";
  const title =
    packageAsset?.title ??
    placement?.title?.trim() ??
    symbol?.displayName ??
    placement?.symbolId ??
    "";
  const description = packageAsset?.description ?? "";
  const [draftState, setDraftState] = useState<{
    assetId?: string;
    tag: string;
    title: string;
    description: string;
  }>({
    assetId,
    tag,
    title,
    description
  });
  const draft =
    draftState.assetId === assetId
      ? draftState
      : { assetId, tag, title, description };
  const isLayoutOnlyPlacement = isInspectorLayoutOnlyPlacement(
    placement,
    symbol
  );

  if (
    !placement ||
    !assetId ||
    isLayoutOnlyPlacement
  ) {
    return null;
  }

  const warning = duplicateWarnings.find(
    (candidate) =>
      candidate.normalizedTag === normalizeAssetTag(draft.tag) &&
      candidate.assetIds.includes(assetId)
  );
  const sheetReferenceText =
    catalogAsset?.placementRefs
      .map((reference) => `Sheet ${reference.sheetNumber}`)
      .filter((value, index, values) => values.indexOf(value) === index)
      .join(", ") ?? "Active sheet";
  const decrementedTag = stepEngineeringTag(draft.tag, -1);
  const incrementedTag = stepEngineeringTag(draft.tag, 1);
  const canRelink =
    !isGeneratedPanelEnclosurePlacement(placement) &&
    !isGeneratedTerminalBlockPlacement(placement);
  const updateDraft = (
    updates: Partial<Pick<typeof draft, "tag" | "title" | "description">>
  ) => {
    setDraftState((current) => ({
      ...(current.assetId === assetId
        ? current
        : { assetId, tag, title, description }),
      ...updates,
      assetId
    }));
  };

  const commitTag = (value: string) => {
    const normalized = value.trim();
    if (!normalized) {
      updateDraft({ tag });
      return;
    }
    updateDraft({ tag: normalized });
    if (normalized !== tag) onAssetChange(assetId, { tag: normalized });
  };
  const commitTitle = (value: string) => {
    const normalized = value.trim();
    if (!normalized) {
      updateDraft({ title });
      return;
    }
    updateDraft({ title: normalized });
    if (normalized !== title) onAssetChange(assetId, { title: normalized });
  };
  const commitDescription = (value: string) => {
    const normalized = value.trim();
    updateDraft({ description: normalized });
    if (normalized !== description) {
      onAssetChange(assetId, {
        description: normalized || undefined
      });
    }
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
            {tag} / {title}
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
            Tag / ID
          </label>
          <div className="flex gap-2">
            <input
              id="selected-placement-asset-tag"
              className="field-input"
              value={draft.tag}
              maxLength={120}
              onChange={(event) => updateDraft({ tag: event.currentTarget.value })}
              onBlur={() => commitTag(draft.tag)}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
                if (event.key === "Escape") {
                  event.preventDefault();
                  updateDraft({ tag });
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
                onClick={() => decrementedTag && commitTag(decrementedTag)}
              >
                <Minus aria-hidden="true" size={14} />
              </button>
              <button
                type="button"
                className="icon-button h-9 w-9 p-0"
                aria-label="Increment selected asset tag number"
                title="Increment selected asset tag number"
                disabled={!incrementedTag}
                onClick={() => incrementedTag && commitTag(incrementedTag)}
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
            Title
          </label>
          <input
            id="selected-placement-symbol-title"
            className="field-input"
            value={draft.title}
            maxLength={160}
            placeholder={symbol?.displayName ?? title}
            onChange={(event) => updateDraft({ title: event.currentTarget.value })}
            onBlur={() => commitTitle(draft.title)}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape") {
                event.preventDefault();
                updateDraft({ title });
              }
            }}
          />
        </div>

        <div>
          <label
            className="field-label"
            htmlFor="selected-placement-asset-description"
          >
            General description
          </label>
          <textarea
            id="selected-placement-asset-description"
            className="field-input min-h-20 resize-y leading-relaxed"
            value={draft.description}
            maxLength={400}
            placeholder="Optional engineering description"
            onChange={(event) =>
              updateDraft({ description: event.currentTarget.value })
            }
            onBlur={() => commitDescription(draft.description)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                updateDraft({ description });
              }
              if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                event.currentTarget.blur();
              }
            }}
          />
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          {catalogAsset && catalogAsset.placementRefs.length > 1 ? (
            <span>
              Linked asset referenced {catalogAsset.placementRefs.length} times on{" "}
              {sheetReferenceText}.
            </span>
          ) : (
            <span>Unique asset on {sheetReferenceText}.</span>
          )}
        </div>

        {symbol ? (
          <div className="rounded-md border border-slate-200 bg-white px-3 py-3 text-xs">
            <div className="mb-2 font-bold uppercase text-slate-500">
              Approved registry symbol
            </div>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5">
              <dt className="text-slate-500">Symbol</dt>
              <dd className="font-semibold text-slate-900">
                {symbol.displayName}
              </dd>
              {symbol.manufacturer ? (
                <>
                  <dt className="text-slate-500">Manufacturer</dt>
                  <dd className="font-semibold text-slate-900">
                    {symbol.manufacturer}
                  </dd>
                </>
              ) : null}
              {symbol.model ? (
                <>
                  <dt className="text-slate-500">Model</dt>
                  <dd className="font-semibold text-slate-900">
                    {symbol.model}
                  </dd>
                </>
              ) : null}
              <dt className="text-slate-500">Version</dt>
              <dd className="font-semibold text-slate-900">
                {symbol.versionNumber}
              </dd>
              <dt className="text-slate-500">Category</dt>
              <dd className="font-semibold capitalize text-slate-900">
                {symbol.managedCategory?.name ??
                  symbol.category.replace(/_/g, " ")}
              </dd>
              {symbol.metadata.physicalWidthMm &&
              symbol.metadata.physicalHeightMm ? (
                <>
                  <dt className="text-slate-500">Physical size</dt>
                  <dd className="font-semibold text-slate-900">
                    {formatDrawingMeasurementPair(
                      symbol.metadata.physicalWidthMm,
                      symbol.metadata.physicalHeightMm,
                      measurementUnit
                    )}
                  </dd>
                </>
              ) : null}
              <dt className="text-slate-500">Terminals</dt>
              <dd className="font-semibold text-slate-900">
                {symbol.metadata.anchors.length}
              </dd>
            </dl>
            <a
              className="mt-3 inline-flex font-semibold text-teal-700 hover:text-teal-900"
              href={`/symbols/${symbol.symbolId}`}
            >
              Open in Symbol Registry
            </a>
          </div>
        ) : null}

        {canRelink ? (
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
            {allowCreateAsset &&
            catalogAsset &&
            catalogAsset.placementRefs.length > 1 ? (
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

function SelectedPlacementLayoutEditor({
  placement,
  model,
  symbols,
  measurementUnit,
  onPlacementChange
}: {
  placement: DrawingModel["placements"][number] | undefined;
  model: DrawingModel;
  symbols: ApprovedDrawingSymbol[];
  measurementUnit: DrawingMeasurementUnit;
  onPlacementChange: (
    placementId: string,
    updates: Partial<DrawingModel["placements"][number]>
  ) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
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
      lengthMm: formatDrawingMeasurement(
        layoutDimensions.lengthMm,
        measurementUnit
      ),
      widthMm: formatDrawingMeasurement(
        layoutDimensions.widthMm,
        measurementUnit
      )
    };
    const parentPanel = containers.find(
      (container) => container.assetId === placement.containerAssetId
    );
    const resolvedScale = resolveBackplaneLayoutScale(
      model.sheet,
      placement,
      parentPanel?.placement
    );
    const childCount = getLayoutChildrenForBackplane(model, placement.id).length;
    const fitBackplane = (
      layoutDimensions: NonNullable<typeof placement.layoutDimensions>
    ) => {
      const nextPlacement = {
        ...placement,
        layoutDimensions
      };
      if (parentPanel) {
        const area = getBackplanePhysicalPlacementArea(
          parentPanel.placement,
          model.sheet
        );
        const layoutPosition = {
          xMm: Number(
            (
              area.x +
              (area.width - layoutDimensions.lengthMm) / 2
            ).toFixed(2)
          ),
          yMm: Number(
            (
              area.y +
              (area.height - layoutDimensions.widthMm) / 2
            ).toFixed(2)
          )
        };
        const panelBounds = getPanelEnclosureDisplayBounds(
          model.sheet,
          parentPanel.placement
        );

        return {
          layoutPosition,
          x: Number(
            (panelBounds.x + layoutPosition.xMm * resolvedScale.factor).toFixed(
              2
            )
          ),
          y: Number(
            (panelBounds.y + layoutPosition.yMm * resolvedScale.factor).toFixed(
              2
            )
          )
        };
      }

      return getBackplaneCenteredPosition({
        sheet: model.sheet,
        backplane: nextPlacement,
        area: getBackplanePrintableArea(model.sheet)
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
                lengthMm: formatDrawingMeasurement(
                  layoutDimensions.lengthMm,
                  measurementUnit
                ),
                widthMm: formatDrawingMeasurement(
                  layoutDimensions.widthMm,
                  measurementUnit
                )
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
      const width = parseDrawingMeasurement(
        draftValues.lengthMm,
        measurementUnit
      );
      const height = parseDrawingMeasurement(
        draftValues.widthMm,
        measurementUnit
      );

      if (
        width === undefined ||
        width <= 0 ||
        height === undefined ||
        height <= 0
      ) {
        setDimensionDraft(null);
        return;
      }

      const layoutDimensions = {
        lengthMm: width,
        widthMm: height
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
                {drawingMeasurementLabel("Width", measurementUnit)}
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
                {drawingMeasurementLabel("Height", measurementUnit)}
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
              /{" "}
              {layoutDimensionValueLabel(
                resolvedPlacement,
                undefined,
                measurementUnit
              )}
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
          <DrawingMeasurementField
            id="layout-dimension-label-position"
            label="Label position"
            valueMm={
              dimension.labelPositionMm ??
              Number(((dimension.startMm + dimension.endMm) / 2).toFixed(2))
            }
            measurementUnit={measurementUnit}
            onCommit={(labelPositionMm) =>
              updateDimension({ labelPositionMm })
            }
          />
          <div className="grid grid-cols-3 gap-3">
            <DrawingMeasurementField
              id="layout-dimension-start"
              label="Start"
              valueMm={dimension.startMm}
              measurementUnit={measurementUnit}
              onCommit={(startMm) => updateDimension({ startMm })}
            />
            <DrawingMeasurementField
              id="layout-dimension-end"
              label="End"
              valueMm={dimension.endMm}
              measurementUnit={measurementUnit}
              onCommit={(endMm) => updateDimension({ endMm })}
            />
            <DrawingMeasurementField
              id="layout-dimension-offset"
              label="Offset"
              valueMm={dimension.offsetMm}
              measurementUnit={measurementUnit}
              onCommit={(offsetMm) => updateDimension({ offsetMm })}
            />
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
              placeholder={layoutDimensionValueLabel(
                resolvedPlacement,
                undefined,
                measurementUnit
              )}
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
    valueMm: number
  ) => {
    if (!canEditDimensions) {
      return;
    }

    if (!Number.isFinite(valueMm) || valueMm <= 0) {
      return;
    }

    const cappedValue =
      key === "lengthMm" && currentBackplane
        ? Math.min(
            valueMm,
            Math.max(1, currentBackplane.layoutDimensions.lengthMm - 6)
          )
        : valueMm;

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
      sheet: model.sheet,
      parentPanel: containers.find(
        (container) => container.assetId === backplane.containerAssetId
      )?.placement
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
            onChange={(event) => {
              const position = event.currentTarget.value as LayoutLabelPosition;
              onPlacementChange(placement.id, {
                layoutLabel: {
                  ...(placement.layoutLabel ?? {}),
                  position
                },
                labelPosition: undefined
              });
            }}
          >
            {layoutLabelPositions.map((position) => (
              <option key={position} value={position}>
                {layoutLabelPositionLabels[position]}
              </option>
            ))}
          </select>
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-[11px] leading-4 text-slate-500">
              Select the item and drag the purple label handle to position it manually.
            </p>
            {placement.labelPosition ? (
              <button
                type="button"
                className="icon-button shrink-0 px-2.5 py-1.5 text-[11px]"
                onClick={() =>
                  onPlacementChange(placement.id, { labelPosition: undefined })
                }
              >
                Reset position
              </button>
            ) : null}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <DrawingMeasurementField
            id="layout-symbol-length"
            label="Length"
            valueMm={layoutDimensions.lengthMm}
            measurementUnit={measurementUnit}
            disabled={!canEditDimensions}
            requirePositive
            onCommit={(lengthMm) => updateDimension("lengthMm", lengthMm)}
          />
          <DrawingMeasurementField
            id="layout-symbol-width"
            label="Width"
            valueMm={layoutDimensions.widthMm}
            measurementUnit={measurementUnit}
            disabled={!canEditDimensions}
            requirePositive
            onCommit={(widthMm) => updateDimension("widthMm", widthMm)}
          />
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
  measurementUnit
}: {
  placement: DrawingModel["placements"][number] | undefined;
  measurementUnit: DrawingMeasurementUnit;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!isGeneratedTerminalBlockPlacement(placement)) {
    return null;
  }

  const config = normalizeTerminalBlockPlacement(placement.terminalBlock);
  const physicalSize = getTerminalBlockGroupPhysicalSize(config);
  const terminals = terminalBlockTerminals(config);
  const previewTerminals = terminals.slice(0, 16);

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
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
          This is a legacy count-based terminal block group. It is read-only;
          delete it and recreate it with the Structured Terminal Strip Builder.
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Terminal range{" "}
          {config.startNumber} - {config.startNumber + config.count - 1}. Physical
          size{" "}
          {formatDrawingMeasurementPair(
            physicalSize.lengthMm,
            physicalSize.widthMm,
            measurementUnit
          )}
          .
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

      </div>
    </section>
  );
}

function SelectedStructuredTerminalStripEditor({
  placement,
  packageModel,
  symbols,
  measurementUnit,
  onEdit,
  onReuse
}: {
  placement: DrawingModel["placements"][number] | undefined;
  packageModel: DrawingPackageModel;
  symbols: ApprovedDrawingSymbol[];
  measurementUnit: DrawingMeasurementUnit;
  onEdit: (assetId: string) => void;
  onReuse: (placementId: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const assetId = placement ? placementAssetId(placement) : undefined;
  const asset = assetId
    ? packageModel.assets.find((candidate) => candidate.id === assetId)
    : undefined;
  const strip = asset?.terminalStrip;
  const geometry = useMemo(
    () => (strip ? composeTerminalStripGeometry(strip, symbols) : undefined),
    [strip, symbols]
  );
  const memberSpecificationRows = useMemo(() => {
    if (!strip) return [];

    let fallbackOrder = 0;
    return strip.members.map((member) => {
      if (member.role === "electrical") fallbackOrder += 1;
      const symbol = symbols.find(
        (candidate) =>
          candidate.symbolId === member.symbolId &&
          candidate.versionId === member.versionId
      );
      return {
        id: member.id,
        memberToken: member.token,
        terminalNumber:
          member.role === "electrical"
            ? member.designation?.trim() || String(fallbackOrder)
            : undefined,
        terminalType: symbol?.displayName ?? "Unavailable member symbol",
        purpose: resolveStructuredTerminalStripMemberPurpose(member),
        attributeCount: countStructuredTerminalStripMemberAttributes(member)
      };
    });
  }, [strip, symbols]);

  if (!placement || !assetId || !strip) {
    return null;
  }

  const electricalCount = strip.members.filter(
    (member) => member.role === "electrical"
  ).length;
  const terminalCount = geometry?.members.reduce(
    (total, member) =>
      total + (member.symbol?.metadata.terminals?.length ?? 0),
    0
  );

  return (
    <section className="tool-panel overflow-hidden">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 text-left transition hover:bg-slate-50"
        aria-expanded={isExpanded}
        aria-controls="selected-structured-terminal-strip-editor"
        onClick={() => setIsExpanded((current) => !current)}
      >
        <span className="min-w-0">
          <span className="block text-sm font-bold text-slate-950">
            Terminal Strip
          </span>
          <span className="mt-0.5 block truncate text-xs text-slate-500">
            {asset.tag} / {electricalCount} electrical members
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
        id="selected-structured-terminal-strip-editor"
        className={isExpanded ? "space-y-3 p-4" : "hidden"}
      >
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
            <div className="font-bold text-slate-500">Members</div>
            <div className="mt-1 text-slate-900">{strip.members.length}</div>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
            <div className="font-bold text-slate-500">Terminals</div>
            <div className="mt-1 text-slate-900">{terminalCount ?? "—"}</div>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
            <div className="font-bold text-slate-500">Size</div>
            <div className="mt-1 text-slate-900">
              {geometry
                ? formatDrawingMeasurementPair(
                    geometry.widthMm,
                    geometry.heightMm,
                    measurementUnit
                  )
                : "Unavailable"}
            </div>
          </div>
        </div>
        <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
          <div className="border-b border-slate-200 bg-slate-50 px-3 py-2">
            <div className="text-xs font-bold text-slate-900">
              Member specifications
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">
              Read-only facts for each permanent strip member.
            </div>
          </div>
          <table
            aria-label="Terminal strip member specifications"
            className="w-full table-fixed text-left text-[11px]"
          >
            <thead className="border-b border-slate-200 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="w-12 px-2 py-2 text-center">
                  No.
                </th>
                <th scope="col" className="w-20 px-2 py-2">
                  Member
                </th>
                <th scope="col" className="px-2 py-2">
                  Purpose / Description
                </th>
                <th scope="col" className="w-12 px-2 py-2 text-center">
                  Attrs
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {memberSpecificationRows.map((row) => (
                <tr key={row.id}>
                  <th
                    scope="row"
                    className="px-2 py-2 text-center align-top font-bold text-slate-900"
                  >
                    {row.terminalNumber ?? "—"}
                  </th>
                  <td className="px-2 py-2 align-top">
                    <div className="font-mono text-[10px] font-bold text-slate-700">
                      {row.memberToken}
                    </div>
                    <div
                      className="mt-0.5 truncate text-[9px] text-slate-500"
                      title={row.terminalType}
                    >
                      {row.terminalType}
                    </div>
                  </td>
                  <td className="break-words px-2 py-2 align-top leading-4 text-slate-700">
                    {row.purpose ?? (
                      <span className="italic text-slate-400">
                        No purpose recorded
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-center align-top font-semibold tabular-nums text-slate-600">
                    {row.attributeCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          className="icon-button w-full justify-center"
          onClick={() => onEdit(assetId)}
        >
          Edit terminal strip
        </button>
        <button
          type="button"
          className="icon-button w-full justify-center gap-2"
          onClick={() => onReuse(placement.id)}
        >
          <Copy aria-hidden="true" size={15} />
          Reuse terminal strip
        </button>
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
  const [isExpanded, setIsExpanded] = useState(false);

  if (!annotation || isConnectedWireScheduleAnnotation(annotation)) {
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

function BringRouteOntoSheetButton({
  connection,
  sheet,
  onRecover
}: {
  connection: DrawingConnection;
  sheet: DrawingModel["sheet"];
  onRecover: (connectionId: string) => void;
}) {
  if (
    !connection.route ||
    !hasConnectionRouteOutsideSheet(connection.route, sheet)
  ) {
    return null;
  }

  return (
    <button
      type="button"
      className="icon-button"
      onClick={() => onRecover(connection.id)}
      title="Bring escaped route points back inside the printable sheet"
    >
      <Maximize2 aria-hidden="true" size={14} />
      Bring route onto sheet
    </button>
  );
}

function PanelPatternEditor({
  packageModel,
  model,
  selectedConnectionId,
  onPanelPatternChange,
  onLegendVisibilityChange,
  onConnectionRemove,
  onConnectionRouteRecover,
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
  onConnectionRouteRecover: (connectionId: string) => void;
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
    <InspectorDisclosureSection
      title="Connection Pattern"
      subtitle={`${pattern.record.patternCode ?? pattern.record.id} / ${topology.replaceAll("_", " ")}`}
      contentClassName="space-y-4 p-4 text-xs"
    >
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
          <BringRouteOntoSheetButton
            connection={connection}
            sheet={model.sheet}
            onRecover={onConnectionRouteRecover}
          />
          <button type="button" className="icon-button" onClick={() => onConnectionRouteReset(connection.id)}>
            <RefreshCw aria-hidden="true" size={14} /> Reset route
          </button>
          <button type="button" className="icon-button icon-button-danger" onClick={() => onConnectionRemove(connection.id)}>
            <Trash2 aria-hidden="true" size={14} /> Remove pattern
          </button>
        </div>
    </InspectorDisclosureSection>
  );
}

function InternalWireEditor({
  packageModel,
  model,
  selectedConnectionId,
  onInternalWireChange,
  wireCatalogEntries,
  onManageWireCatalog,
  onConnectionRemove,
  onConnectionRouteRecover,
  onConnectionRouteReset
}: {
  packageModel: DrawingPackageModel;
  model: DrawingModel;
  selectedConnectionId?: string;
  onInternalWireChange?: (
    wireRecordId: string,
    updates: {
      wireId?: string;
      specification?: WireSpecificationSnapshot;
      attributes?: PanelWireAttributes;
    }
  ) => void;
  wireCatalogEntries: WireCatalogEntry[];
  onManageWireCatalog?: () => void;
  onConnectionRemove: (connectionId: string) => void;
  onConnectionRouteRecover: (connectionId: string) => void;
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
  const effectiveWireId = wire.wireNumber
    ? deriveInternalWireId({
        sourceTag: assetTag(wire.from.assetId),
        terminalKey: wire.from.terminalKey,
        wireNumber: wire.wireNumber
      })
    : wire.wireId;
  const updateAttributes = (
    key: keyof PanelWireAttributes,
    value: string
  ) => {
    onInternalWireChange(wire.id, {
      attributes: {
        ...wire.attributes,
        [key]: value.trim() || undefined
      }
    });
  };

  return (
    <InspectorDisclosureSection
      title="Internal Wire"
      subtitle="Physical panel wire with a route occurrence on this sheet."
      contentClassName="space-y-4 p-4 text-xs"
    >
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
        {wire.wireNumber ? (
          <>
            <div className="grid grid-cols-[110px_1fr] gap-3">
              <label>
                <span className="field-label">Wire #</span>
                <input
                  className="field-input font-mono"
                  readOnly
                  value={formatWireNumber(wire.wireNumber)}
                />
              </label>
              <label>
                <span className="field-label">Wire ID</span>
                <input
                  className="field-input font-mono"
                  readOnly
                  value={effectiveWireId}
                />
              </label>
            </div>
            <WireCatalogPicker
              entries={wireCatalogEntries}
              value={wire.specification?.catalogEntryId ?? ""}
              snapshot={wire.specification}
              onChange={(entryId) => {
                const entry = wireCatalogEntries.find(
                  (candidate) => candidate.id === entryId
                );
                if (!entry) return;
                onInternalWireChange(wire.id, {
                  specification: createWireSpecificationSnapshot(entry),
                  attributes: wire.attributes
                });
              }}
              onManage={onManageWireCatalog ?? (() => undefined)}
            />
          </>
        ) : (
          <>
            <div>
              <label className="field-label" htmlFor={`internal-wire-id-${wire.id}`}>
                Legacy Wire ID
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
            <div className="grid grid-cols-3 gap-3">
              {([
                ["color", "Color"],
                ["size", "Size"],
                ["wireType", "Wire type"]
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
          </>
        )}
        <div>
          <label className="field-label" htmlFor={`internal-wire-description-${wire.id}`}>
            Description
          </label>
          <input
            key={`${wire.id}:description:${wire.attributes?.description ?? ""}`}
            id={`internal-wire-description-${wire.id}`}
            className="field-input"
            defaultValue={wire.attributes?.description ?? ""}
            onBlur={(event) => updateAttributes("description", event.currentTarget.value)}
          />
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600">
          Route mode: <strong>{connection.route?.mode ?? "auto"}</strong>
        </div>
        <div className="flex flex-wrap gap-2">
          <BringRouteOntoSheetButton
            connection={connection}
            sheet={model.sheet}
            onRecover={onConnectionRouteRecover}
          />
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
    </InspectorDisclosureSection>
  );
}

function ConnectionEditor({
  model,
  symbols,
  selectedConnectionId,
  onConnectionChange,
  onConnectionRemove,
  onConnectionRouteRecover,
  onConnectionRouteReset
}: {
  model: DrawingModel;
  symbols: ApprovedDrawingSymbol[];
  selectedConnectionId?: string;
  onConnectionChange: (
    connectionId: string,
    updates: Partial<DrawingConnection>
  ) => void;
  onConnectionRemove: (connectionId: string) => void;
  onConnectionRouteRecover: (connectionId: string) => void;
  onConnectionRouteReset: (connectionId: string) => void;
}) {
  const selectedConnection = model.connections.find(
    (connection) => connection.id === selectedConnectionId
  );
  const selectedRoute = selectedConnection?.route;
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
  if (!selectedConnection) return null;

  return (
    <InspectorDisclosureSection
      title="Connection"
      subtitle={
        getConnectionWireId(model, symbols, selectedConnection) ??
        getReadableConnectionName(model, symbols, selectedConnection)
      }
      contentClassName="space-y-4 p-4"
    >
          <div className="space-y-3">
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
              {selectedRoute &&
              hasConnectionRouteOutsideSheet(selectedRoute, model.sheet) ? (
                <div className="mt-3 border-t border-slate-200 pt-3">
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() =>
                      onConnectionRouteRecover(selectedConnection.id)
                    }
                  >
                    <Maximize2 aria-hidden="true" size={14} />
                    Bring route onto sheet
                  </button>
                  <p className="mt-2 text-[11px] leading-4 text-amber-700">
                    One or more route points are outside the printable sheet.
                    This keeps the current route shape and brings only escaped
                    points back inside.
                  </p>
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
    </InspectorDisclosureSection>
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
