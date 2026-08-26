"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition
} from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import type {
  WireCatalogEntry,
  WireSpecificationSnapshot
} from "@/features/wire_catalog/api/public";
import {
  createWireSpecificationSnapshot,
  getDefaultWireCatalogEntry
} from "@/features/wire_catalog/api/public";
import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  X
} from "lucide-react";
import type { EngineeringAttributeChange } from "@/features/engineering_attributes/ui/public";
import type {
  DrawingAnnotation,
  DrawingConnection,
  DrawingConnectionRoute,
  DrawingAssetRecord,
  DrawingEndpoint,
  DrawingModel,
  DrawingPlacement,
  DrawingSheetCanvasModel,
  DrawingSettingsDraft,
  SheetSettingsDraft
} from "../../data/schema";
import type { ApprovedDrawingSymbol, DrawingDetail } from "../../types";
import {
  approveDrawingAction,
  saveDrawingAction
} from "../../api/actions";
import {
  addConnection as addConnectionCommand,
  addAnnotation as addAnnotationCommand,
  addPlacement as addPlacementCommand,
  deleteAnnotation as deleteAnnotationCommand,
  deleteConnection as deleteConnectionCommand,
  deletePlacement as deletePlacementCommand,
  updateAnnotation as updateAnnotationCommand,
  updateConnection as updateConnectionCommand,
  updateConnectionRoute as updateConnectionRouteCommand,
  updatePlacementProperties
} from "../../logic/commands/drawing-model-commands";
import {
  addDrawingSheet as addDrawingSheetCommand,
  addSectionTitlePage as addSectionTitlePageCommand,
  deleteSheet as deleteSheetCommand,
  getActiveSheetId,
  replaceSheetFromCanvasModel,
  toSheetCanvasModel,
  updatePackageTitleBlock,
  updateSectionTitlePage,
  updateSheetMetadata
} from "../../logic/commands/drawing-sheet-commands";
import {
  moveDrawingSection,
  moveSheetToDrawingSection,
  moveSheetToSectionEnd,
  moveSheetWithinSection,
  removeSectionDivider,
  type DrawingSectionMoveDirection
} from "../../logic/commands/drawing-section-commands";
import { createDetailedPanelDrawingSheet } from "../../logic/commands/drawing-detailed-panel-sheet-commands";
import {
  createOrSynchronizeConnectedWireScheduleContinuations,
  removeConnectedWireSchedulePagination
} from "../../logic/commands/drawing-connected-wire-schedule-continuation-commands";
import { updateDrawingConnectionDisplayMode } from "../../logic/commands/drawing-connection-display-commands";
import {
  createAndPlaceStructuredTerminalStrip,
  updateStructuredTerminalStrip
} from "../../logic/commands/drawing-structured-terminal-strip-commands";
import {
  reuseStructuredTerminalStrip,
  type StructuredTerminalStripReuseInput
} from "../../logic/commands/drawing-structured-terminal-strip-reuse-commands";
import {
  centerDetailedPanelEquipment,
  placePanelAssetOccurrences,
  removePanelAssetOccurrence
} from "../../logic/commands/drawing-panel-occurrence-commands";
import {
  addInternalWireRouteOccurrence,
  createInternalPanelWireRoute,
  deleteInternalWireAndRoutes,
  deleteInternalWireRouteOccurrence,
  updateInternalPanelWireCommand,
  type PanelWireOccurrenceEndpoint
} from "../../logic/commands/drawing-panel-wire-commands";
import {
  addPanelPatternRouteOccurrence,
  createPanelPatternWithRoutes,
  deletePanelPatternAndRoutes,
  removePanelPatternRouteOccurrence,
  setPanelPatternLegendVisibility
} from "../../logic/commands/drawing-panel-pattern-commands";
import {
  applyApprovedPanelRepair,
  navigateToPanelFinding
} from "../../logic/commands/drawing-panel-review-commands";
import {
  applyPanelWiringMutations,
  createPanelWiringSource
} from "../../api/panel-wiring-contracts";
import {
  buildCompatiblePanelOptions,
  buildPanelInternalWireCatalog,
  buildPanelConnectionPatternCatalog,
  buildPanelEngineeringSnapshotFromValidatedSource,
  buildPanelDiscoveryIndex,
  buildPlacementWireContextDisplayIndex,
  buildPanelInternalWireEndpointCatalog,
  buildPanelQualityIndex,
  allocateInternalWireNumber,
  buildLegacyWireIdentityUpgradePreview,
  createDistributionGroup,
  createEarthTermination,
  createShieldTermination,
  createTerminalJumper,
  getDetailedPanelDrawingContext,
  getPreviousInternalWireDescription,
  getTerminalSideOccupancy,
  mapExternalTerminationToTerminal,
  placementWireContextKey,
  resetExternalTerminationMapping,
  runPanelDrawingQualityChecks,
  updatePanelConnectionPattern,
  reconcileDerivedInternalWireIds,
  upgradeLegacyWireIdentities,
  validateInternalWireEndpoints,
  updateDetailedPanelDrawingContext,
  validatePanelDrawingContext,
  type PanelDrawingQualityFinding,
  type PanelConnectionDisplayMode,
  type PlacementWireContextDisplayIndex,
  type PanelInternalWireEndpointCatalog,
  type PanelElectricalDomain,
  type PanelPatternCommandResult,
  type PanelTerminalSideRef,
  type PanelWireAttributes
} from "@/features/drawing_panel_wiring/api/public";
import {
  buildPlacementConnectionDisplayModeIndex,
  collectPlacementWireContextRequests,
  sheetHasCompleteWiringDisplay
} from "../../logic/services/drawing-placement-connection-display";
import {
  buildConnectedWireScheduleIndex,
  defaultConnectedWireSchedulePosition,
  isConnectedWireScheduleAnnotation,
  type ConnectedWireScheduleAnnotation,
  type ConnectedWireScheduleIndex
} from "@/features/drawing_connected_wire_schedule/api/public";
import {
  InternalWireDeleteDialog,
  InternalWireDialog,
  LegacyWireIdentityUpgradeDialog,
  type InternalWireDialogSubmission,
  PanelDrawingSummary,
  PanelPatternAuthoringPanel,
  PanelPatternDeleteDialog,
  PanelPatternReviewDialog,
  PanelRepairConfirmationDialog,
  type PanelPatternAuthoringStage,
  type PanelPatternAuthoringTopology
} from "@/features/drawing_panel_wiring/ui/public";
import {
  bringConnectionRouteOntoSheet,
  generateDefaultOrthogonalRoute
} from "../../logic/services/connection-route-geometry";
import {
  addGuidedConnectionWaypoint,
  buildGuidedConnectionPreview,
  buildGuidedConnectionRoute,
  removeLastGuidedConnectionWaypoint,
  resolveGuidedConnectionPointer,
  type GuidedConnectionWaypoint
} from "../../logic/services/guided-connection-routing";
import { getPlacementBounds } from "../../logic/services/drawing-geometry";
import {
  clampPointToSheet,
  createDefaultNoteAnnotation
} from "../../logic/services/drawing-annotations";
import {
  buildRenderableDrawingSymbols,
  getRenderableSymbolForPlacement
} from "../../logic/services/drawing-generated-symbols";
import {
  drawingTerminalSideKey,
  resolveDrawingAnchorAvailability,
  summarizeDrawingTerminalAvailability,
  type DrawingAnchorAvailability
} from "../../logic/services/drawing-anchor-availability";
import {
  allocateNextPackageTag,
  allocateNextTagFromPrefix,
  createDrawingAssetId,
  defaultPlacementScale,
  roleFromSymbol
} from "../../logic/services/drawing-asset-identity";
import {
  createPanelEnclosurePlacement,
  getPanelEnclosureTitle,
  getVisibleSheetContainers,
} from "../../logic/services/drawing-asset-containment";
import {
  autosizeLayoutHelperToBackplane,
  createBackplanePlacement,
  getBackplanesForSheet,
  isBackplanePlacement,
  isGeneratedBackplaneSymbolReference
} from "../../logic/services/drawing-backplane-layouts";
import {
  createLayoutDimensionPlacement,
  isGeneratedLayoutDimensionSymbolReference,
  layoutDimensionOrientationFromSymbol
} from "../../logic/services/drawing-layout-dimensions";
import { createConnectionFromEndpoints } from "../../logic/services/drawing-connections";
import {
  copySelectionToClipboard,
  pasteClipboardToSheet,
  type DrawingCanvasClipboard
} from "../../logic/services/drawing-clipboard-commands";
import { moveCanvasSelection } from "../../logic/services/drawing-movement";
import {
  applyPlacementArrangement,
  placementArrangementMessage,
  resolvePlacementArrangement,
  type PlacementArrangementAction
} from "../../logic/services/drawing-selection-arrangement";
import {
  measureDrawingOperation,
  updateDrawingPerformanceContext
} from "../../logic/services/drawing-performance-diagnostics";
import { createDrawingPanelEngineeringSnapshotCache } from "../../logic/services/drawing-panel-engineering-snapshot-cache";
import {
  createEmptyDrawingHistory,
  pushDrawingHistoryEntry,
  redoDrawingHistory,
  undoDrawingHistory,
  type DrawingModelHistoryEntry
} from "../../logic/services/drawing-model-history";
import {
  beginCanvasGesture,
  cancelCanvasGesture,
  commitCanvasGesture,
  updateCanvasGesturePreview,
  type CanvasGestureDraft
} from "../../logic/services/drawing-gesture-draft";
import {
  EMPTY_CANVAS_SELECTION,
  normalizeCanvasSelection,
  primaryAnnotationId,
  primaryPlacementId,
  replaceCanvasSelection,
  type DrawingCanvasSelection,
  type SelectionKind
} from "../../logic/services/drawing-selection";
import type { ViewportTransform } from "../../logic/services/viewport-transform";
import {
  AddSymbolAssetDialog,
  type AddSymbolAssetSubmission
} from "./add-symbol-asset-dialog";
import {
  AddPanelEnclosureDialog,
  type AddPanelEnclosureSubmission
} from "./add-panel-enclosure-dialog";
import {
  createPanelConnectionView,
  fitPanelConnectionViewContents,
  isPanelConnectionViewPlacement
} from "../../logic/services/drawing-panel-connection-views";
import {
  TerminalStripBuilder,
  type TerminalStripBuilderSubmission,
  type TerminalStripBuilderSubmissionResult
} from "@/features/drawing_terminal_blocks/ui/components/terminal-strip-builder";
import {
  AddSheetDialog,
  type AddSheetDialogSubmission
} from "./add-sheet-dialog";
import { SheetLoaderDialog } from "./sheet-loader-dialog";
import {
  AssetLinkDialog,
  type AssetLinkDialogMode
} from "./asset-link-dialog";
import { DeleteSheetConfirmationDialog } from "./delete-sheet-confirmation-dialog";
import { DrawingSaveConflictDialog } from "./drawing-save-conflict-dialog";
import {
  allocateNextManagedAssetTag,
  createManagedAsset,
  classifyManagedAssetFromPlacement,
  deleteManagedAsset,
  reconcileDrawingAssets,
  updateManagedAsset
} from "@/features/drawing_asset_manager/logic/use_cases/drawing-asset-manager-use-cases";
import { replaceDrawingAssetComponentSelections } from "@/features/symbol_components/api/public";
import type {
  ManagedAssetCreateInput,
  ManagedAssetUpdateInput
} from "@/features/drawing_asset_manager/data/schema";

import { DrawingObjectInspector } from "./drawing-object-inspector";
import { TerminalStripCopyDialog } from "./terminal-strip-copy-dialog";
import { TerminalStripReuseDialog } from "./terminal-strip-reuse-dialog";
import { DrawingSettingsDialog } from "./drawing-settings-dialog";
import { DrawingPackageToolbar } from "./drawing-package-toolbar";
import { SheetSettingsDialog } from "./sheet-settings-dialog";
import { PackagePreviewSurface } from "./package-preview-surface";
import { SvgDrawingSurface } from "./svg-drawing-surface";
import { SymbolLibraryPanel } from "./symbol-library-panel";
import { ConnectionEndpointInspector } from "./connection-endpoint-inspector";
import type {
  ConnectionDraft,
  DrawingAnchorInspection,
  GuidedConnectionPointerOptions
} from "../canvas/types";
import {
  buildAssociatedPanelAssetCatalog,
  placeAssociatedPanelAssetOnBackplane,
  placeAssociatedPanelAssetOnConnectionView,
  type PanelAssetPlacementTarget
} from "@/features/drawing_panel_asset_placement/api/public";
import { PanelAssociatedAssetsSection } from "@/features/drawing_panel_asset_placement/ui/components/panel-associated-assets-section";
import {
  getSymbolLibraryContextForSheetKind,
  hasPanelLayoutPhysicalDimensions,
  isPanelLayoutLibrarySymbol
} from "../../logic/services/symbol-library-context";
import { buildSheetLoaderGroups } from "../../logic/services/sheet-loader-rows";
import {
  buildDrawingSectionIndex,
  getSectionInsertionIndex,
  getSheetInsertionIndex
} from "../../logic/services/drawing-sections";
import { getDrawingSheetPresentation } from "../../logic/services/drawing-sheet-presentation";
import { isGeneratedTerminalBlockGroupLibrarySymbolReference } from "../../logic/services/drawing-terminal-block-groups";
import {
  createNewAssetFromPlacement,
  relinkPlacementsToExistingAsset,
  type DrawingAssetPlacementTarget
} from "../../logic/services/drawing-asset-resolution";

const ConnectionsDialog = dynamic(
  () =>
    import("./connections-dialog").then((module) => module.ConnectionsDialog),
  {
    ssr: false,
    loading: () => <EngineeringDialogLoading label="Loading connections" />
  }
);
const PanelDiscoveryDialog = dynamic(
  () =>
    import("@/features/drawing_panel_wiring/ui/public").then(
      (module) => module.PanelDiscoveryDialog
    ),
  {
    ssr: false,
    loading: () => <EngineeringDialogLoading label="Loading panel work queue" />
  }
);
const PanelDrawingReviewDialog = dynamic(
  () =>
    import("@/features/drawing_panel_wiring/ui/public").then(
      (module) => module.PanelDrawingReviewDialog
    ),
  {
    ssr: false,
    loading: () => <EngineeringDialogLoading label="Loading panel review" />
  }
);
const AssetManagerDialog = dynamic(
  () =>
    import("@/features/drawing_asset_manager/ui/components/asset-manager-dialog").then(
      (module) => module.AssetManagerDialog
    ),
  {
    ssr: false,
    loading: () => <EngineeringDialogLoading label="Loading Asset Manager" />
  }
);
const WireCatalogManager = dynamic(
  () =>
    import("@/features/wire_catalog/ui/components/wire-catalog-manager").then(
      (module) => module.WireCatalogManager
    ),
  {
    ssr: false,
    loading: () => <EngineeringDialogLoading label="Loading Wire Catalog" />
  }
);

function EngineeringDialogLoading({ label }: { label: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/20 p-4 backdrop-blur-[2px]">
      <div
        role="status"
        className="rounded-md border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-700 shadow-xl"
      >
        {label}...
      </div>
    </div>
  );
}

type DragState = {
  placementId: string;
  placementIds: string[];
  startPointer: { x: number; y: number };
  startPlacement: { x: number; y: number };
  startModel: DrawingSheetCanvasModel;
  previewDelta?: { x: number; y: number };
};

type ConnectionMode = "idle" | "connecting";
type CanvasViewMode = "edit" | "preview";

type PendingInternalWire = {
  from: PanelWireOccurrenceEndpoint;
  to: PanelWireOccurrenceEndpoint;
  waypoints: GuidedConnectionWaypoint[];
};

type InternalWireDeleteCandidate = {
  wireRecordId: string;
  connectionId?: string;
};

type PanelPatternDraft = {
  topology: PanelPatternAuthoringTopology;
  domain: Exclude<PanelElectricalDomain, "unknown">;
  targetDomain: "shield" | "protective_earth" | "signal_ground";
  targetMode: "panel_reference" | "terminal";
  stage: PanelPatternAuthoringStage;
  selected: PanelWireOccurrenceEndpoint[];
};

type PendingPanelPatternReview = {
  result: PanelPatternCommandResult;
  memberLabels: string[];
};

function normalizeCanvasModel(
  model: DrawingModel,
  symbols: ApprovedDrawingSymbol[]
): DrawingModel {
  const reconciled = reconcileDrawingAssets(
    {
      ...model,
      measurementUnit: model.measurementUnit ?? "mm"
    },
    symbols
  );
  const mutations = reconcileDerivedInternalWireIds(
    createPanelWiringSource(reconciled, symbols)
  );
  return mutations.length
    ? applyPanelWiringMutations(reconciled, mutations)
    : reconciled;
}

export function DrawingCanvasShell({
  drawing,
  symbols,
  wireCatalogEntries: initialWireCatalogEntries = [],
  detailedPanelDrawingsEnabled = true
}: {
  drawing: DrawingDetail;
  symbols: ApprovedDrawingSymbol[];
  wireCatalogEntries?: WireCatalogEntry[];
  detailedPanelDrawingsEnabled?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const initialSheet = drawing.model.sheets[0];
  const initialSelection: DrawingCanvasSelection = initialSheet.placements[0]
    ? {
        placementIds: [initialSheet.placements[0].id],
        annotationIds: []
      }
    : { ...EMPTY_CANVAS_SELECTION };
  const [title, setTitle] = useState(drawing.title);
  const [serverUpdatedAt, setServerUpdatedAt] = useState(drawing.updatedAt);
  const [saveConflict, setSaveConflict] = useState<{
    latestUpdatedAt?: string;
  } | null>(null);
  const [editRevision, setEditRevision] = useState(0);
  const [savedRevision, setSavedRevision] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [wireCatalogEntries, setWireCatalogEntries] = useState(
    initialWireCatalogEntries
  );
  const [isWireCatalogOpen, setIsWireCatalogOpen] = useState(false);
  const [hasRequestedWireCatalog, setHasRequestedWireCatalog] = useState(false);
  const [isLegacyWireUpgradeOpen, setIsLegacyWireUpgradeOpen] =
    useState(false);
  const [viewMode, setViewMode] = useState<CanvasViewMode>("edit");
  const [model, setModelState] = useState<DrawingModel>(() =>
    normalizeCanvasModel(drawing.model, symbols)
  );
  const [gesturePreviewModel, setGesturePreviewModel] =
    useState<DrawingModel | null>(null);
  const [activeSheetId, setActiveSheetId] = useState(initialSheet.id);
  const [selection, setSelectionState] =
    useState<DrawingCanvasSelection>(initialSelection);
  const [selectedConnectionId, setSelectedConnectionId] = useState<
    string | undefined
  >(undefined);
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>("idle");
  const [connectionDraft, setConnectionDraft] = useState<ConnectionDraft>({
    waypoints: []
  });
  const [connectionSourceInspection, setConnectionSourceInspection] =
    useState<DrawingAnchorInspection | null>(null);
  const [connectionHoverInspection, setConnectionHoverInspection] =
    useState<DrawingAnchorInspection | null>(null);
  const [pendingInternalWire, setPendingInternalWire] =
    useState<PendingInternalWire | null>(null);
  const [internalWireDeleteCandidate, setInternalWireDeleteCandidate] =
    useState<InternalWireDeleteCandidate | null>(null);
  const [panelPatternDraft, setPanelPatternDraft] =
    useState<PanelPatternDraft | null>(null);
  const [pendingPanelPatternReview, setPendingPanelPatternReview] =
    useState<PendingPanelPatternReview | null>(null);
  const [panelPatternDeleteId, setPanelPatternDeleteId] =
    useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [viewportTransform, setViewportTransform] = useState<ViewportTransform>({
    zoom: 1,
    panX: 0,
    panY: 0
  });
  const sheetViewportTransformsRef = useRef<Record<string, ViewportTransform>>({
    [initialSheet.id]: {
      zoom: 1,
      panX: 0,
      panY: 0
    }
  });
  const [viewportCenter, setViewportCenter] = useState({
    x: initialSheet.page.width / 2,
    y: initialSheet.page.height / 2
  });
  const sheetViewportCentersRef = useRef<Record<string, { x: number; y: number }>>({
    [initialSheet.id]: {
      x: initialSheet.page.width / 2,
      y: initialSheet.page.height / 2
    }
  });
  const [sheetFocusRequestKey, setSheetFocusRequestKey] = useState(0);
  const [isSymbolsCollapsed, setIsSymbolsCollapsed] = useState(false);
  const [isPropertiesCollapsed, setIsPropertiesCollapsed] = useState(false);
  const propertiesCollapsedBeforeWireModeRef = useRef<boolean | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingSymbol, setPendingSymbol] = useState<ApprovedDrawingSymbol | null>(
    null
  );
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [isSheetLoaderOpen, setIsSheetLoaderOpen] = useState(false);
  const [isDrawingSettingsOpen, setIsDrawingSettingsOpen] = useState(false);
  const [isSheetSettingsOpen, setIsSheetSettingsOpen] = useState(false);
  const [isConnectionsOpen, setIsConnectionsOpen] = useState(false);
  const drawingSettingsReturnFocusRef = useRef<HTMLElement | null>(null);
  const sheetSettingsReturnFocusRef = useRef<HTMLElement | null>(null);
  const connectionsReturnFocusRef = useRef<HTMLElement | null>(null);
  const wireCatalogReturnFocusRef = useRef<HTMLElement | null>(null);
  const [isAddPanelOpen, setIsAddPanelOpen] = useState(false);
  const [isAddTerminalBlockOpen, setIsAddTerminalBlockOpen] = useState(false);
  const [isCopyTerminalBlockOpen, setIsCopyTerminalBlockOpen] = useState(false);
  const [isTerminalBlockGroupOpen, setIsTerminalBlockGroupOpen] =
    useState(false);
  const [editingTerminalStripAssetId, setEditingTerminalStripAssetId] =
    useState<string | null>(null);
  const [terminalStripReuseSource, setTerminalStripReuseSource] = useState<{
    sheetId: string;
    placementId: string;
  } | null>(null);
  const [isBackplanePanelPickerOpen, setIsBackplanePanelPickerOpen] =
    useState(false);
  const [isAssetManagerOpen, setIsAssetManagerOpen] = useState(false);
  const [assetManagerInitialAssetId, setAssetManagerInitialAssetId] = useState<
    string | null
  >(null);
  const [isPanelDiscoveryOpen, setIsPanelDiscoveryOpen] = useState(false);
  const [panelDiscoveryInitialTab, setPanelDiscoveryInitialTab] = useState<
    "assets" | "terminations" | "terminal-map" | "internal-wires" | "patterns"
  >("assets");
  const [panelDiscoveryFocusId, setPanelDiscoveryFocusId] = useState<
    string | null
  >(null);
  const [panelReviewAssetId, setPanelReviewAssetId] = useState<string | null>(
    null
  );
  const [isPanelReviewOpen, setIsPanelReviewOpen] = useState(false);
  const [panelRepairFinding, setPanelRepairFinding] =
    useState<PanelDrawingQualityFinding | null>(null);
  const [sheetDeleteCandidateId, setSheetDeleteCandidateId] = useState<
    string | null
  >(null);
  const [assetLinkDialogState, setAssetLinkDialogState] = useState<{
    placementId: string;
    initialMode: AssetLinkDialogMode;
  } | null>(null);
  const [clipboard, setClipboard] = useState<DrawingCanvasClipboard | null>(null);
  const modelRef = useRef(model);
  const activeSheetIdRef = useRef(activeSheetId);
  const selectionRef = useRef(selection);
  const historyRef = useRef(createEmptyDrawingHistory());
  const historyTransactionRef = useRef<DrawingModelHistoryEntry | null>(null);
  const canvasGestureDraftRef = useRef<CanvasGestureDraft | null>(null);
  const gesturePreviewAnimationFrameRef = useRef<number | null>(null);
  const pendingGesturePreviewModelRef = useRef<DrawingModel | null>(null);
  const historyCoalesceRef = useRef<{
    key: string;
    time: number;
  } | null>(null);

  const openLocalDialog = (
    setOpen: (open: boolean) => void,
    returnFocusRef: { current: HTMLElement | null }
  ) => {
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setOpen(true);
  };
  const closeLocalDialog = (
    setOpen: (open: boolean) => void,
    returnFocusRef: { current: HTMLElement | null }
  ) => {
    setOpen(false);
    window.requestAnimationFrame(() => returnFocusRef.current?.focus());
  };
  const clearConnectionInspections = () => {
    setConnectionSourceInspection(null);
    setConnectionHoverInspection(null);
  };
  const openWireCatalog = () => {
    setHasRequestedWireCatalog(true);
    openLocalDialog(setIsWireCatalogOpen, wireCatalogReturnFocusRef);
  };
  const revealPropertiesForWireAuthoring = () => {
    if (propertiesCollapsedBeforeWireModeRef.current === null) {
      propertiesCollapsedBeforeWireModeRef.current = isPropertiesCollapsed;
    }
    if (isPropertiesCollapsed) setIsPropertiesCollapsed(false);
  };
  const restorePropertiesAfterWireMode = () => {
    if (propertiesCollapsedBeforeWireModeRef.current === true) {
      setIsPropertiesCollapsed(true);
    }
    propertiesCollapsedBeforeWireModeRef.current = null;
  };
  const resolvedActiveSheetId = getActiveSheetId(model, activeSheetId);
  const activeSheetCanvasModel = useMemo(
    () => toSheetCanvasModel(model, resolvedActiveSheetId),
    [model, resolvedActiveSheetId]
  );
  const activeSheetRenderableSymbols = useMemo(
    () =>
      buildRenderableDrawingSymbols({
        placements: activeSheetCanvasModel.placements,
        approvedSymbols: symbols,
        assets: model.assets
      }),
    [activeSheetCanvasModel.placements, model.assets, symbols]
  );
  const selectedPlacementId = primaryPlacementId(selection);
  const selectedAssetManagerAssetId = useMemo(() => {
    if (!selectedPlacementId || selection.placementIds.length !== 1) {
      return null;
    }

    const assetId = activeSheetCanvasModel.placements.find(
      (placement) => placement.id === selectedPlacementId
    )?.assetId;

    return assetId && model.assets?.some((asset) => asset.id === assetId)
      ? assetId
      : null;
  }, [
    activeSheetCanvasModel.placements,
    model.assets,
    selectedPlacementId,
    selection.placementIds.length
  ]);
  const selectedScheduleSource = useMemo(() => {
    if (!selectedPlacementId || selection.placementIds.length !== 1) {
      return undefined;
    }
    const placement = activeSheetCanvasModel.placements.find(
      (candidate) => candidate.id === selectedPlacementId
    );
    if (
      !placement?.assetId ||
      !["device", "terminal_block"].includes(placement.role) ||
      placement.layoutKind ||
      placement.panelReference
    ) {
      return undefined;
    }
    const symbol = getRenderableSymbolForPlacement(
      placement,
      symbols,
      model.assets
    );
    if (!symbol || (symbol.metadata.terminals?.length ?? 0) === 0) {
      return undefined;
    }
    return { placement, symbol };
  }, [
    activeSheetCanvasModel.placements,
    model.assets,
    selectedPlacementId,
    selection.placementIds.length,
    symbols
  ]);
  const visibleSheetContainers = useMemo(
    () => getVisibleSheetContainers(activeSheetCanvasModel),
    [activeSheetCanvasModel]
  );
  const drawingSectionIndex = useMemo(
    () => buildDrawingSectionIndex(model),
    [model]
  );
  const sheetLoaderGroups = useMemo(
    () => buildSheetLoaderGroups(model, drawingSectionIndex),
    [drawingSectionIndex, model]
  );
  const selectedAnnotationId = primaryAnnotationId(selection);
  const activeSheet =
    model.sheets.find((sheet) => sheet.id === resolvedActiveSheetId) ??
    model.sheets[0];
  const activeSectionMembership = drawingSectionIndex.membershipBySheetId.get(
    activeSheet.id
  );
  const activeDrawingSection =
    activeSectionMembership?.kind === "section"
      ? drawingSectionIndex.sections.find(
          (section) => section.id === activeSectionMembership.sectionId
        )
      : undefined;
  const activeSectionLabel = activeDrawingSection
    ? `Section ${activeDrawingSection.number} - ${activeDrawingSection.title}`
    : "Front Matter";
  const activeSectionMoveOptions =
    activeSheet.kind === "section_title"
      ? []
      : [
          ...(activeSectionMembership?.kind === "front_matter"
            ? []
            : [{ id: "front_matter", label: "Front Matter" }]),
          ...drawingSectionIndex.sections
            .filter(
              (section) =>
                activeSectionMembership?.kind !== "section" ||
                section.id !== activeSectionMembership.sectionId
            )
            .map((section) => ({
              id: section.id,
              label: `Section ${section.number} - ${section.title}`
            }))
        ];
  const activeSheetPresentation = getDrawingSheetPresentation(activeSheet);
  const placementWireContextRequests = useMemo(
    () => collectPlacementWireContextRequests(model),
    [model]
  );
  const placementConnectionDisplayModes = useMemo(
    () => buildPlacementConnectionDisplayModeIndex(model),
    [model]
  );
  const connectedWireSchedulesBySheetId = useMemo(() => {
    const index = new Map<string, ConnectedWireScheduleAnnotation[]>();
    for (const sheet of model.sheets) {
      const schedules = sheet.annotations.filter(
        isConnectedWireScheduleAnnotation
      );
      if (schedules.length > 0) index.set(sheet.id, schedules);
    }
    return index;
  }, [model.sheets]);
  const hasConnectedWireSchedules = connectedWireSchedulesBySheetId.size > 0;
  const activeSheetHasCompleteWiringDisplay =
    sheetHasCompleteWiringDisplay(activeSheet);
  const isDetailedPanelDrawing =
    activeSheetPresentation.workspaceContext === "detailed_panel";
  const detailedPanelReadOnly =
    isDetailedPanelDrawing && !detailedPanelDrawingsEnabled;
  const detailedPanelAssetIds = useMemo(
    () => [
      ...new Set(
        model.sheets.flatMap((sheet) =>
          sheet.panelDrawingContext ? [sheet.panelDrawingContext.panelAssetId] : []
        )
      )
    ],
    [model.sheets]
  );
  const panelWiringSource = useMemo(
    () =>
      measureDrawingOperation(
        "panel.source",
        () => createPanelWiringSource(model, symbols),
        {
          sheets: model.sheets.length,
          assets: model.assets?.length ?? 0
        }
      ),
    [model, symbols]
  );
  const compatiblePanelOptions = useMemo(
    () => buildCompatiblePanelOptions(panelWiringSource),
    [panelWiringSource]
  );
  const detailedPanelContext = useMemo(
    () =>
      isDetailedPanelDrawing
        ? getDetailedPanelDrawingContext(
            panelWiringSource,
            resolvedActiveSheetId
          )
        : undefined,
    [isDetailedPanelDrawing, panelWiringSource, resolvedActiveSheetId]
  );
  const detailedPanelContextWarning = useMemo(() => {
    if (!isDetailedPanelDrawing) {
      return undefined;
    }

    return validatePanelDrawingContext(
      panelWiringSource,
      resolvedActiveSheetId
    )[0]?.message;
  }, [isDetailedPanelDrawing, panelWiringSource, resolvedActiveSheetId]);
  const effectivePanelReviewAssetId =
    detailedPanelContext?.panelAssetId ?? panelReviewAssetId ?? undefined;
  const panelEngineeringSnapshotRequired =
    isDetailedPanelDrawing ||
    activeSheetHasCompleteWiringDisplay ||
    hasConnectedWireSchedules ||
    viewMode === "preview" ||
    Boolean(panelReviewAssetId) ||
    Boolean(selectedPlacementId);
  const panelEngineeringSnapshotCache = useMemo(
    () => createDrawingPanelEngineeringSnapshotCache(),
    []
  );
  const panelEngineeringSnapshot = useMemo(
    () => {
      if (!panelEngineeringSnapshotRequired) return undefined;
      return panelEngineeringSnapshotCache.getOrCreate(
        panelWiringSource,
        () => measureDrawingOperation(
          "panel.graph",
          () => buildPanelEngineeringSnapshotFromValidatedSource(
            panelWiringSource,
            `edit:${editRevision}`
          ),
          {
            sheets: panelWiringSource.sheets.length,
            assets: panelWiringSource.assets.length
          }
        )
      );
    },
    [
      editRevision,
      panelEngineeringSnapshotCache,
      panelEngineeringSnapshotRequired,
      panelWiringSource,
    ]
  );
  const panelConnectivityGraph = panelEngineeringSnapshot?.graph;
  const placementWireContextDisplayIndex = useMemo<
    PlacementWireContextDisplayIndex
  >(
    () =>
      panelConnectivityGraph
        ? measureDrawingOperation("panel.placement-wire-context", () =>
            buildPlacementWireContextDisplayIndex({
              graph: panelConnectivityGraph,
              requests: placementWireContextRequests
            }))
        : {
            rowsBySheetId: new Map(),
            summariesBySheetPlacement: new Map()
          },
    [panelConnectivityGraph, placementWireContextRequests]
  );
  const connectedWireScheduleIndex = useMemo<ConnectedWireScheduleIndex>(
    () =>
      panelConnectivityGraph
        ? measureDrawingOperation("panel.connected-wire-schedule", () =>
            buildConnectedWireScheduleIndex({
              graph: panelConnectivityGraph,
              schedulesBySheetId: connectedWireSchedulesBySheetId,
              displayModesBySheetPlacement: placementConnectionDisplayModes
            }))
        : new Map(),
    [
      connectedWireSchedulesBySheetId,
      placementConnectionDisplayModes,
      panelConnectivityGraph
    ]
  );
  const deferredPanelEngineeringSnapshot = useDeferredValue(
    panelEngineeringSnapshot
  );
  const panelQualityGraph = deferredPanelEngineeringSnapshot?.graph;
  const panelReviewUpdating =
    isPanelReviewOpen &&
    Boolean(panelEngineeringSnapshot) &&
    deferredPanelEngineeringSnapshot !== panelEngineeringSnapshot;
  const panelQualityReport = useMemo(() => {
    if (
      !isPanelReviewOpen ||
      !panelQualityGraph ||
      !effectivePanelReviewAssetId
    ) {
      return undefined;
    }
    return measureDrawingOperation(
      "panel.quality",
      () =>
        runPanelDrawingQualityChecks(
          buildPanelQualityIndex({
            graph: panelQualityGraph,
            panelAssetId: effectivePanelReviewAssetId
          })
        ),
      { panelAssetId: effectivePanelReviewAssetId }
    );
  }, [
    effectivePanelReviewAssetId,
    isPanelReviewOpen,
    panelQualityGraph
  ]);
  const panelDiscoveryIndex = useMemo(() => {
    if (!panelConnectivityGraph || !detailedPanelContext) {
      return undefined;
    }

    return measureDrawingOperation(
      "panel.discovery",
      () =>
        buildPanelDiscoveryIndex({
          graph: panelConnectivityGraph,
          panelAssetId: detailedPanelContext.panelAssetId,
          detailedSheetId: resolvedActiveSheetId
        }),
      { panelAssetId: detailedPanelContext.panelAssetId }
    );
  }, [
    detailedPanelContext,
    panelConnectivityGraph,
    resolvedActiveSheetId
  ]);
  const panelInternalWireEndpointCatalog = useMemo<PanelInternalWireEndpointCatalog>(
    () =>
      panelConnectivityGraph && detailedPanelContext
        ? buildPanelInternalWireEndpointCatalog({
            graph: panelConnectivityGraph,
            panelAssetId: detailedPanelContext.panelAssetId,
            detailedSheetId: resolvedActiveSheetId
          })
        : {
            panelAssetId: detailedPanelContext?.panelAssetId ?? "unavailable",
            sheetId: resolvedActiveSheetId,
            equipment: []
          },
    [detailedPanelContext, panelConnectivityGraph, resolvedActiveSheetId]
  );
  const panelWireEndpointsByAnchorId = useMemo(() => {
    const endpoints = new Map<string, PanelWireOccurrenceEndpoint>();
    panelInternalWireEndpointCatalog.equipment.forEach((equipment) =>
      equipment.endpoints.forEach((endpoint) =>
        endpoints.set(endpoint.id, {
          terminal: endpoint.terminal,
          placementId: endpoint.placementId,
          anchorKey: endpoint.anchorKey,
          assetTag: endpoint.assetTag,
          terminalLabel: endpoint.terminalLabel
        })
      )
    );
    return endpoints;
  }, [panelInternalWireEndpointCatalog]);
  const panelInternalWires = useMemo(
    () =>
      panelConnectivityGraph && detailedPanelContext
        ? buildPanelInternalWireCatalog({
            graph: panelConnectivityGraph,
            panelAssetId: detailedPanelContext.panelAssetId
          })
        : [],
    [detailedPanelContext, panelConnectivityGraph]
  );
  const panelConnectionPatterns = useMemo(
    () =>
      panelConnectivityGraph && detailedPanelContext
        ? buildPanelConnectionPatternCatalog({
            graph: panelConnectivityGraph,
            panelAssetId: detailedPanelContext.panelAssetId
          })
        : [],
    [detailedPanelContext, panelConnectivityGraph]
  );
  const panelPatternDeleteRecord = useMemo(
    () =>
      panelPatternDeleteId
        ? panelConnectionPatterns.find(
            (pattern) => pattern.patternId === panelPatternDeleteId
          )
        : undefined,
    [panelConnectionPatterns, panelPatternDeleteId]
  );
  const proposedInternalWireNumber = useMemo(
    () =>
      detailedPanelContext
        ? allocateInternalWireNumber(panelWiringSource).wireNumber
        : undefined,
    [detailedPanelContext, panelWiringSource]
  );
  const previousInternalWireDescription = useMemo(
    () =>
      proposedInternalWireNumber
        ? getPreviousInternalWireDescription(
            model.panelWiring?.internalWires ?? [],
            proposedInternalWireNumber
          )
        : "",
    [model.panelWiring?.internalWires, proposedInternalWireNumber]
  );
  const defaultWireSpecification = useMemo(() => {
    const entry = getDefaultWireCatalogEntry(wireCatalogEntries);
    return entry ? createWireSpecificationSnapshot(entry) : undefined;
  }, [wireCatalogEntries]);
  const legacyWireUpgradePreview = useMemo(
    () => buildLegacyWireIdentityUpgradePreview(panelWiringSource),
    [panelWiringSource]
  );
  const internalWireDeleteRecord = useMemo(
    () =>
      internalWireDeleteCandidate
        ? model.panelWiring?.internalWires.find(
            (wire) => wire.id === internalWireDeleteCandidate.wireRecordId
          )
        : undefined,
    [internalWireDeleteCandidate, model.panelWiring?.internalWires]
  );
  const panelPatternSelectedLabels = useMemo(
    () =>
      panelPatternDraft?.selected.map(
        (endpoint) => `${endpoint.assetTag}:${endpoint.terminalLabel}/${endpoint.terminal.side}`
      ) ?? [],
    [panelPatternDraft?.selected]
  );
  const canReviewPanelPattern = useMemo(() => {
    if (!panelPatternDraft || panelPatternDraft.stage !== "selecting") return false;
    const count = panelPatternDraft.selected.length;
    if (panelPatternDraft.topology === "fused_distribution") {
      return count >= 4 && (count - 1) % 3 === 0;
    }
    if (panelPatternDraft.topology === "distribution") return count >= 2;
    if (["shield", "protective_earth", "signal_ground"].includes(panelPatternDraft.topology)) {
      return panelPatternDraft.targetMode === "terminal" ? count === 2 : count === 1;
    }
    return count >= 2;
  }, [panelPatternDraft]);
  const panelTerminalDomainsByRef = useMemo(() => {
    const index = new Map<string, PanelElectricalDomain[]>();
    panelDiscoveryIndex?.terminalCatalog.rowsByTerminalId.forEach((row) => {
      index.set(
        `${row.terminal.assetId}:${row.terminal.terminalKey}`,
        row.allowedDomains ?? []
      );
    });
    return index;
  }, [panelDiscoveryIndex]);
  const getConnectionAnchorState = useCallback(
    (endpoint: DrawingEndpoint): DrawingAnchorAvailability => {
      if (!isDetailedPanelDrawing) {
        return { status: "available", enabled: true, occupants: [] };
      }
      const candidate = panelWireEndpointsByAnchorId.get(
        `${endpoint.placementId}:${endpoint.anchorKey}`
      );
      const resolveAvailability = (
        incompatibleReason?: string,
        channel: "conductor" | "structural" = "conductor"
      ) =>
        resolveDrawingAnchorAvailability({
          endpoint,
          terminalMappings: panelWireEndpointsByAnchorId,
          terminalCatalog: panelDiscoveryIndex?.terminalCatalog,
          channel,
          incompatibleReason
        });

      if (!candidate || !panelDiscoveryIndex) return resolveAvailability();

      if (panelPatternDraft?.stage === "selecting") {
        let incompatibleReason: string | undefined;
        const selectedKey = `${candidate.terminal.assetId}:${candidate.terminal.terminalKey}:${candidate.terminal.side}`;
        if (
          panelPatternDraft.selected.some(
            (entry) =>
              `${entry.terminal.assetId}:${entry.terminal.terminalKey}:${entry.terminal.side}` === selectedKey
          )
        ) {
          incompatibleReason = "This terminal is already in the pattern.";
        }
        const domain: PanelElectricalDomain =
          panelPatternDraft.topology === "shield" ||
          panelPatternDraft.topology === "protective_earth" ||
          panelPatternDraft.topology === "signal_ground"
            ? panelPatternDraft.topology
            : panelPatternDraft.domain;
        const allowedDomains = panelTerminalDomainsByRef.get(
          `${candidate.terminal.assetId}:${candidate.terminal.terminalKey}`
        );
        if (
          !incompatibleReason &&
          allowedDomains?.length &&
          !allowedDomains.includes(domain)
        ) {
          incompatibleReason = `This terminal does not allow the ${domain.replaceAll("_", " ")} domain.`;
        }
        const structural = [
          "terminal_jumper",
          "bridge_bar",
          "shield",
          "protective_earth",
          "signal_ground"
        ].includes(panelPatternDraft.topology);
        if (
          !incompatibleReason &&
          panelPatternDraft.topology === "fused_distribution" &&
          panelPatternDraft.selected.length >= 2 &&
          (panelPatternDraft.selected.length - 1) % 3 === 1
        ) {
          const input = panelPatternDraft.selected.at(-1);
          if (input && input.terminal.assetId !== candidate.terminal.assetId) {
            incompatibleReason =
              "Protection input and output must belong to the same device.";
          }
        }
        return resolveAvailability(
          incompatibleReason,
          structural ? "structural" : "conductor"
        );
      }

      let incompatibleReason: string | undefined;
      const source = connectionDraft.from
        ? panelWireEndpointsByAnchorId.get(
            `${connectionDraft.from.placementId}:${connectionDraft.from.anchorKey}`
          )
        : undefined;
      if (
        source &&
        source.terminal.assetId === candidate.terminal.assetId &&
        source.terminal.terminalKey === candidate.terminal.terminalKey
      ) {
        incompatibleReason =
          "A wire cannot connect both ends of the same logical terminal.";
      }
      if (!incompatibleReason && source && panelConnectivityGraph) {
        const pair = [source.terminal, candidate.terminal]
          .map(
            (terminal) =>
              `${terminal.assetId}:${terminal.terminalKey}:${terminal.side}`
          )
          .sort()
          .join("::");
        const duplicate = [...panelConnectivityGraph.internalWiresById.values()].find(
          (wire) =>
            [wire.from, wire.to]
              .map(
                (terminal) =>
                  `${terminal.assetId}:${terminal.terminalKey}:${terminal.side}`
              )
              .sort()
              .join("::") === pair
        );
        if (duplicate) {
          incompatibleReason = `${duplicate.wireId} already connects these terminals.`;
        }
      }
      return resolveAvailability(incompatibleReason);
    },
    [
      connectionDraft.from,
      isDetailedPanelDrawing,
      panelPatternDraft,
      panelConnectivityGraph,
      panelDiscoveryIndex,
      panelTerminalDomainsByRef,
      panelWireEndpointsByAnchorId
    ]
  );
  const selectedTerminalAvailabilitySummary = useMemo(() => {
    if (
      !isDetailedPanelDrawing ||
      !selectedPlacementId ||
      !panelDiscoveryIndex
    ) {
      return undefined;
    }

    const entries = [...panelWireEndpointsByAnchorId.entries()].flatMap(
      ([anchorId, mapping]) => {
        if (mapping.placementId !== selectedPlacementId) return [];
        const endpoint = {
          placementId: mapping.placementId,
          anchorKey: mapping.anchorKey
        };
        return [
          {
            canonicalTerminalSideKey: drawingTerminalSideKey(mapping.terminal),
            fallbackKey: anchorId,
            terminal: mapping.terminal,
            terminalLabel: mapping.terminalLabel,
            availability: resolveDrawingAnchorAvailability({
              endpoint,
              terminalMappings: panelWireEndpointsByAnchorId,
              terminalCatalog: panelDiscoveryIndex.terminalCatalog
            })
          }
        ];
      }
    );

    return summarizeDrawingTerminalAvailability(entries);
  }, [
    isDetailedPanelDrawing,
    panelDiscoveryIndex,
    panelWireEndpointsByAnchorId,
    selectedPlacementId
  ]);
  const activeSheetNumber = Math.max(
    1,
    model.sheets.findIndex((sheet) => sheet.id === activeSheet.id) + 1
  );
  const symbolLibraryContext = getSymbolLibraryContextForSheetKind(
    activeSheet.kind ?? "drawing"
  );
  const sheetDeleteCandidate = sheetDeleteCandidateId
    ? model.sheets.find((sheet) => sheet.id === sheetDeleteCandidateId) ?? null
    : null;
  const sheetDeleteCandidateNumber = sheetDeleteCandidate
    ? model.sheets.findIndex((sheet) => sheet.id === sheetDeleteCandidate.id) + 1
    : 0;
  const sheetDeleteSection =
    sheetDeleteCandidate?.kind === "section_title"
      ? drawingSectionIndex.sections.find(
          (section) => section.id === sheetDeleteCandidate.id
        )
      : undefined;
  const sheetDeleteMergeDestination = sheetDeleteSection
    ? sheetDeleteSection.number === 1
      ? "Front Matter"
      : `Section ${sheetDeleteSection.number - 1}`
    : undefined;
  const assetLinkPlacement = assetLinkDialogState
    ? model.sheets
        .flatMap((sheet) => sheet.placements)
        .find((placement) => placement.id === assetLinkDialogState.placementId) ??
      null
    : null;

  const setSelection = useCallback((nextSelection: DrawingCanvasSelection) => {
    selectionRef.current = nextSelection;
    setSelectionState(nextSelection);
  }, []);

  const setActiveSheet = useCallback((sheetId: string) => {
    activeSheetIdRef.current = sheetId;
    setActiveSheetId(sheetId);
  }, []);

  const currentHistoryEntry = useCallback(
    (entryModel: DrawingModel = modelRef.current): DrawingModelHistoryEntry => ({
      model: entryModel,
      activeSheetId: activeSheetIdRef.current,
      selection: selectionRef.current
    }),
    []
  );

  const applyHistoryEntry = useCallback(
    (entry: DrawingModelHistoryEntry) => {
      modelRef.current = entry.model;
      setModelState(entry.model);
      setActiveSheet(entry.activeSheetId);
      setSelection(entry.selection);
      setSelectedConnectionId(undefined);
      setConnectionMode("idle");
      setConnectionDraft({});
      clearConnectionInspections();
      restorePropertiesAfterWireMode();
      setPendingInternalWire(null);
      setInternalWireDeleteCandidate(null);
      setPanelPatternDraft(null);
      setPendingPanelPatternReview(null);
      setPanelPatternDeleteId(null);
      setDragState(null);
      canvasGestureDraftRef.current = null;
      setGesturePreviewModel(null);
      setEditRevision((current) => current + 1);
      setSheetFocusRequestKey((current) => current + 1);
    },
    [setActiveSheet, setSelection]
  );

  const commitModel = useCallback(
    (
      updater: DrawingModel | ((current: DrawingModel) => DrawingModel),
      options: {
        history?: "record" | "skip";
        coalesceKey?: string;
      } = {}
    ) => {
      if (!detailedPanelDrawingsEnabled) {
        const activeId = getActiveSheetId(
          modelRef.current,
          activeSheetIdRef.current
        );
        const active = modelRef.current.sheets.find(
          (sheet) => sheet.id === activeId
        );
        if (active?.panelDrawingContext) {
          setMessage(
            "Detailed Panel Drawings are read-only in this deployment."
          );
          return;
        }
      }

      if (historyTransactionRef.current) {
        const currentDraft =
          canvasGestureDraftRef.current ?? beginCanvasGesture(modelRef.current);
        const nextDraft = measureDrawingOperation(
          "canvas.gesture-preview",
          () => updateCanvasGesturePreview(currentDraft, updater),
          { activeSheetId: activeSheetIdRef.current }
        );
        canvasGestureDraftRef.current = nextDraft;
        if (nextDraft !== currentDraft) {
          pendingGesturePreviewModelRef.current = nextDraft.previewModel;
          if (gesturePreviewAnimationFrameRef.current === null) {
            gesturePreviewAnimationFrameRef.current = window.requestAnimationFrame(
              () => {
                gesturePreviewAnimationFrameRef.current = null;
                const preview = pendingGesturePreviewModelRef.current;
                pendingGesturePreviewModelRef.current = null;
                if (preview) {
                  setGesturePreviewModel(preview);
                }
              }
            );
          }
        }
        return;
      }

      setModelState((current) => {
        const rawNextModel =
          typeof updater === "function" ? updater(current) : updater;

        if (rawNextModel === current) {
          return current;
        }

        const nextModel = measureDrawingOperation(
          "canvas.normalize", () => normalizeCanvasModel(rawNextModel, symbols)
        );
        const beforeEntry = currentHistoryEntry(current);
        const shouldRecord = options.history !== "skip";

        if (shouldRecord && !historyTransactionRef.current) {
          const now = Date.now();
          const coalesceKey = options.coalesceKey;
          const previousCoalesce = historyCoalesceRef.current;
          const shouldCoalesce =
            coalesceKey !== undefined &&
            previousCoalesce !== null &&
            previousCoalesce.key === coalesceKey &&
            now - previousCoalesce.time < 900;

          if (!shouldCoalesce) {
            historyRef.current = measureDrawingOperation(
              "canvas.history-commit",
              () => pushDrawingHistoryEntry(historyRef.current, beforeEntry)
            );
          }

          historyCoalesceRef.current = coalesceKey
            ? { key: coalesceKey, time: now }
            : null;
        }

        modelRef.current = nextModel;
        return nextModel;
      });
      setEditRevision((current) => current + 1);
    },
    [currentHistoryEntry, detailedPanelDrawingsEnabled, symbols]
  );

  const beginModelHistoryTransaction = useCallback(() => {
    if (!historyTransactionRef.current) {
      historyTransactionRef.current = currentHistoryEntry();
      canvasGestureDraftRef.current = beginCanvasGesture(modelRef.current);
      historyCoalesceRef.current = null;
    }
  }, [currentHistoryEntry]);

  const endModelHistoryTransaction = useCallback(() => {
    const entry = historyTransactionRef.current;
    const draft = canvasGestureDraftRef.current;

    if (!entry || !draft) {
      return;
    }

    historyTransactionRef.current = null;
    canvasGestureDraftRef.current = null;
    if (gesturePreviewAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(gesturePreviewAnimationFrameRef.current);
      gesturePreviewAnimationFrameRef.current = null;
    }
    pendingGesturePreviewModelRef.current = null;
    setGesturePreviewModel(null);

    const result = commitCanvasGesture(draft);

    if (result.changed) {
      const nextModel = measureDrawingOperation(
        "canvas.normalize", () => normalizeCanvasModel(result.model, symbols)
      );
      historyRef.current = measureDrawingOperation(
        "canvas.history-commit",
        () => pushDrawingHistoryEntry(historyRef.current, entry)
      );
      modelRef.current = nextModel;
      setModelState(nextModel);
      setEditRevision((current) => current + 1);
    }
  }, [symbols]);

  const cancelModelHistoryTransaction = useCallback(() => {
    const draft = canvasGestureDraftRef.current;
    if (draft) cancelCanvasGesture(draft);
    historyTransactionRef.current = null;
    canvasGestureDraftRef.current = null;
    if (gesturePreviewAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(gesturePreviewAnimationFrameRef.current);
      gesturePreviewAnimationFrameRef.current = null;
    }
    pendingGesturePreviewModelRef.current = null;
    setGesturePreviewModel(null);
    setDragState(null);
  }, []);

  const undo = useCallback(() => {
    const result = undoDrawingHistory(
      historyRef.current,
      currentHistoryEntry()
    );

    if (!result.entry) {
      setMessage("Nothing to undo.");
      return;
    }

    historyRef.current = result.history;
    historyTransactionRef.current = null;
    historyCoalesceRef.current = null;
    applyHistoryEntry(result.entry);
    setMessage("Undo.");
  }, [applyHistoryEntry, currentHistoryEntry]);

  const redo = useCallback(() => {
    const result = redoDrawingHistory(
      historyRef.current,
      currentHistoryEntry()
    );

    if (!result.entry) {
      setMessage("Nothing to redo.");
      return;
    }

    historyRef.current = result.history;
    historyTransactionRef.current = null;
    historyCoalesceRef.current = null;
    applyHistoryEntry(result.entry);
    setMessage("Redo.");
  }, [applyHistoryEntry, currentHistoryEntry]);

  useEffect(() => {
    if (!message) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setMessage(null);
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [message]);

  useEffect(() => {
    updateDrawingPerformanceContext({ revision: `edit:${editRevision}` });
  }, [editRevision]);

  useEffect(() => {
    if (editRevision === savedRevision) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [editRevision, savedRevision]);

  const clearActiveSheetSelection = () => {
    setSelection({ ...EMPTY_CANVAS_SELECTION });
    setSelectedConnectionId(undefined);
    setConnectionMode("idle");
    setConnectionDraft({});
    clearConnectionInspections();
    restorePropertiesAfterWireMode();
    setPendingInternalWire(null);
    setInternalWireDeleteCandidate(null);
    setPanelPatternDraft(null);
    setPendingPanelPatternReview(null);
    setPanelPatternDeleteId(null);
    setDragState(null);
  };

  const updateActiveSheet = (
    updater: (current: DrawingSheetCanvasModel) => DrawingSheetCanvasModel,
    options?: {
      history?: "record" | "skip";
      coalesceKey?: string;
    }
  ) => {
    commitModel((current) => {
      const sheetId = getActiveSheetId(current, activeSheetId);
      const currentCanvasModel = toSheetCanvasModel(current, sheetId);

      return replaceSheetFromCanvasModel(
        current,
        sheetId,
        updater(currentCanvasModel)
      );
    }, options);
  };

  const selectSheet = (sheetId: string) => {
    if (sheetId === resolvedActiveSheetId) {
      return;
    }

    cancelModelHistoryTransaction();

    const sheet = model.sheets.find((candidate) => candidate.id === sheetId);
    const restoredViewport = sheetViewportTransformsRef.current[sheetId] ?? {
      zoom: 1,
      panX: 0,
      panY: 0
    };
    const restoredCenter = sheetViewportCentersRef.current[sheetId] ??
      (sheet
        ? {
            x: sheet.page.width / 2,
            y: sheet.page.height / 2
          }
        : viewportCenter);

    sheetViewportTransformsRef.current[resolvedActiveSheetId] =
      viewportTransform;
    sheetViewportCentersRef.current[resolvedActiveSheetId] = viewportCenter;
    setActiveSheet(sheetId);
    setViewportTransform(restoredViewport);
    setViewportCenter(restoredCenter);
    setIsTerminalBlockGroupOpen(false);
    setIsPanelDiscoveryOpen(false);
    setPendingInternalWire(null);
    setInternalWireDeleteCandidate(null);
    setPanelPatternDraft(null);
    setPendingPanelPatternReview(null);
    setPanelPatternDeleteId(null);
    clearActiveSheetSelection();
  };

  const loadSheetFromDialog = (sheetId: string) => {
    measureDrawingOperation(
      "canvas.sheet-dispatch",
      () => selectSheet(sheetId),
      { fromSheetId: resolvedActiveSheetId, toSheetId: sheetId }
    );
    setIsSheetLoaderOpen(false);
    setSheetFocusRequestKey((current) => current + 1);
    setMessage("Sheet loaded.");
  };

  const loadSheetFromAssetManager = (sheetId: string) => {
    loadSheetFromDialog(sheetId);
    setIsAssetManagerOpen(false);
    setAssetManagerInitialAssetId(null);
  };

  const selectCanvasObject = (
    kind: SelectionKind,
    id: string | undefined,
    options: { additive?: boolean } = {}
  ) => {
    setSelection(
      id
        ? replaceCanvasSelection(
            selectionRef.current,
            kind,
            id,
            Boolean(options.additive)
          )
        : { ...EMPTY_CANVAS_SELECTION }
    );

    if (id) {
      setSelectedConnectionId(undefined);
    }
  };

  const selectPlacement = (
    placementId: string | undefined,
    options?: { additive?: boolean }
  ) => {
    selectCanvasObject("placement", placementId, options);
  };

  const replaceSelection = (nextSelection: DrawingCanvasSelection) => {
    setSelection(normalizeCanvasSelection(nextSelection, activeSheetCanvasModel));
    setSelectedConnectionId(undefined);
    setConnectionDraft({});
  };

  const addSymbol = ({
    symbol,
    assetId,
    tag,
    componentSelections
  }: AddSymbolAssetSubmission) => {
    const placement: DrawingPlacement = {
      id: `pl_${Date.now()}`,
      assetId,
      symbolId: symbol.symbolId,
      versionId: symbol.versionId,
      role: roleFromSymbol(symbol),
      tag,
      x: 35 + activeSheetCanvasModel.placements.length * 18,
      y: 45 + activeSheetCanvasModel.placements.length * 12,
      rotation: 0,
      scale: defaultPlacementScale(symbol)
    };

    commitModel((current) => {
      const sheetId = getActiveSheetId(current, activeSheetId);
      const currentCanvasModel = toSheetCanvasModel(current, sheetId);
      const withPlacement = replaceSheetFromCanvasModel(
        current,
        sheetId,
        addPlacementCommand(currentCanvasModel, placement)
      );

      if (componentSelections === undefined) {
        return withPlacement;
      }

      const asset: DrawingAssetRecord = {
        id: assetId,
        tag,
        type: classifyManagedAssetFromPlacement(placement, symbols),
        title: symbol.displayName,
        symbolId: symbol.symbolId,
        versionId: symbol.versionId,
        componentSelections,
        metadata: { symbolKey: symbol.symbolKey }
      };

      return {
        ...withPlacement,
        assets: [
          ...withPlacement.assets.filter((candidate) => candidate.id !== assetId),
          asset
        ]
      };
    });
    selectPlacement(placement.id);
    setSelectedConnectionId(undefined);
    setPendingSymbol(null);
  };

  const placeBackplaneInPanel = (panelPlacement: DrawingPlacement) => {
    const placement = createBackplanePlacement({
      panelPlacement,
      sheet: activeSheetCanvasModel.sheet
    });

    updateActiveSheet((current) => addPlacementCommand(current, placement));
    selectPlacement(placement.id);
    setSelectedConnectionId(undefined);
    setIsBackplanePanelPickerOpen(false);
    setMessage("Backplane added.");
  };

  const addBackplaneFromLibrary = () => {
    const containers = visibleSheetContainers;

    if (containers.length === 0) {
      setMessage("Add or select a panel before adding a backplane.");
      return;
    }

    const selectedContainer = selectedPlacementId
      ? containers.find(
          (container) => container.placement.id === selectedPlacementId
        )
      : undefined;

    if (selectedContainer) {
      placeBackplaneInPanel(selectedContainer.placement);
      return;
    }

    if (containers.length === 1) {
      placeBackplaneInPanel(containers[0].placement);
      return;
    }

    setIsBackplanePanelPickerOpen(true);
    setMessage("Choose the panel for this backplane.");
  };

  const selectedBackplane = selectedPlacementId
    ? activeSheetCanvasModel.placements.find(
        (placement) =>
          placement.id === selectedPlacementId && isBackplanePlacement(placement)
      )
    : undefined;
  const selectedPanelConnectionView = selectedPlacementId
    ? activeSheetCanvasModel.placements.find(
        (placement) =>
          placement.id === selectedPlacementId &&
          isPanelConnectionViewPlacement(placement)
      )
    : undefined;
  const activeAssociatedBackplane = useMemo(() => {
    const backplanes = getBackplanesForSheet(activeSheetCanvasModel);

    if (selectedBackplane) {
      return selectedBackplane;
    }

    const selectedPanel = selectedPlacementId
      ? visibleSheetContainers.find(
          (container) => container.placement.id === selectedPlacementId
        )
      : undefined;

    if (selectedPanel) {
      return backplanes.find(
        (backplane) => backplane.containerAssetId === selectedPanel.assetId
      );
    }

    return backplanes[0];
  }, [
    activeSheetCanvasModel,
    selectedBackplane,
    selectedPlacementId,
    visibleSheetContainers
  ]);
  const activeAssociatedPanel = activeAssociatedBackplane?.containerAssetId
    ? visibleSheetContainers.find(
        (container) =>
          container.assetId === activeAssociatedBackplane.containerAssetId
      )
    : undefined;
  const activeAssociatedTarget = useMemo<
    PanelAssetPlacementTarget | undefined
  >(
    () =>
      selectedPanelConnectionView
        ? {
            kind: "connection_reference",
            placementId: selectedPanelConnectionView.id
          }
        : activeAssociatedBackplane
          ? {
              kind: "physical_backplane",
              placementId: activeAssociatedBackplane.id
            }
          : undefined,
    [activeAssociatedBackplane, selectedPanelConnectionView]
  );
  const activeAssociatedPanelAssetId =
    selectedPanelConnectionView?.assetId ??
    activeAssociatedBackplane?.containerAssetId;
  const activeAssociatedPanelLabel = selectedPanelConnectionView
    ? `${selectedPanelConnectionView.tag} / ${selectedPanelConnectionView.title ?? selectedPanelConnectionView.tag}`
    : activeAssociatedPanel
      ? `${activeAssociatedPanel.placement.tag} / ${getPanelEnclosureTitle(
          activeAssociatedPanel.placement
        )}`
      : undefined;
  const associatedPanelAssets = useMemo(
    () =>
      activeAssociatedPanelAssetId && activeAssociatedTarget
        ? buildAssociatedPanelAssetCatalog(
            model,
            symbols,
            activeAssociatedPanelAssetId,
            activeAssociatedTarget.placementId
          )
        : [],
    [activeAssociatedPanelAssetId, activeAssociatedTarget, model, symbols]
  );

  const addLayoutSymbol = (
    symbol: ApprovedDrawingSymbol,
    submission?: AddSymbolAssetSubmission
  ) => {
    const backplanes = getBackplanesForSheet(activeSheetCanvasModel);
    const backplane = selectedBackplane ?? backplanes[0];

    if (!hasPanelLayoutPhysicalDimensions(symbol)) {
      setMessage(
        `${symbol.displayName} needs physical width and height before it can be placed on a backplane.`
      );
      return;
    }

    if (!backplane) {
      setMessage("Add a backplane before placing panel layout symbols.");
      return;
    }

    const lengthMm =
      symbol.metadata.physicalWidthMm ?? symbol.metadata.viewBox.width;
    const widthMm =
      symbol.metadata.physicalHeightMm ?? symbol.metadata.viewBox.height;
    const placementId = `pl_${Date.now()}`;
    const isTerminalBlockLayoutSymbol =
      (symbol.technicalKind ?? symbol.category) === "terminal_block" ||
      (symbol.technicalKind ?? symbol.category) === "termination";
    const createsPhysicalAsset = Boolean(
      isTerminalBlockLayoutSymbol ||
        symbol.metadata.panelWiring ||
        symbol.metadata.componentPositions?.length
    );
    const tag =
      submission?.tag ??
      (createsPhysicalAsset
        ? allocateNextPackageTag(model, symbol)
        : symbol.displayName);
    const assetId =
      submission?.assetId ?? (createsPhysicalAsset ? createDrawingAssetId(placementId) : undefined);
    const placement = autosizeLayoutHelperToBackplane({
      backplane,
      symbol,
      sheet: activeSheetCanvasModel.sheet,
      parentPanel: visibleSheetContainers.find(
        (container) => container.assetId === backplane.containerAssetId
      )?.placement,
      placement: {
        id: placementId,
        ...(createsPhysicalAsset
          ? {
              assetId,
              title: symbol.displayName
            }
          : {}),
        symbolId: symbol.symbolId,
        versionId: symbol.versionId,
        role: createsPhysicalAsset ? roleFromSymbol(symbol) : "other",
        tag,
        x: backplane.x,
        y: backplane.y,
        rotation: 0,
        scale: 1,
        layoutKind: "layout_helper",
        layoutDimensions: {
          lengthMm,
          widthMm
        }
      }
    });

    commitModel((current) => {
      const sheetId = getActiveSheetId(current, activeSheetId);
      const currentCanvasModel = toSheetCanvasModel(current, sheetId);
      const withPlacement = replaceSheetFromCanvasModel(
        current,
        sheetId,
        addPlacementCommand(currentCanvasModel, placement)
      );

      if (!assetId || submission?.componentSelections === undefined) {
        return withPlacement;
      }

      const asset: DrawingAssetRecord = {
        id: assetId,
        tag,
        type: classifyManagedAssetFromPlacement(placement, symbols),
        title: symbol.displayName,
        symbolId: symbol.symbolId,
        versionId: symbol.versionId,
        componentSelections: submission.componentSelections,
        metadata: { symbolKey: symbol.symbolKey }
      };

      return {
        ...withPlacement,
        assets: [
          ...withPlacement.assets.filter((candidate) => candidate.id !== assetId),
          asset
        ]
      };
    });
    selectPlacement(placement.id);
    setSelectedConnectionId(undefined);
    setMessage(
      isTerminalBlockLayoutSymbol
        ? `${tag} terminal block added to backplane.`
        : createsPhysicalAsset
          ? `${tag} added to backplane as a physical asset.`
          : `${symbol.displayName} added to backplane.`
    );
  };

  const addLayoutDimensionFromLibrary = (symbol: ApprovedDrawingSymbol) => {
    const orientation = layoutDimensionOrientationFromSymbol(symbol);
    const backplanes = getBackplanesForSheet(activeSheetCanvasModel);
    const backplane = selectedBackplane ?? backplanes[0];

    if (!orientation) {
      setMessage("Dimension symbol is not configured correctly.");
      return;
    }

    if (!backplane) {
      setMessage("Add a backplane before placing dimensions.");
      return;
    }

    const placement = createLayoutDimensionPlacement({
      backplane,
      sheet: activeSheetCanvasModel.sheet,
      orientation
    });

    updateActiveSheet((current) => addPlacementCommand(current, placement));
    selectPlacement(placement.id);
    setSelectedConnectionId(undefined);
    setMessage(`${symbol.displayName} added to backplane.`);
  };

  const placeAssociatedPanelAsset = (assetId: string) => {
    if (!activeAssociatedTarget) {
      setMessage("Select a backplane or panel connection reference first.");
      return;
    }

    try {
      const result =
        activeAssociatedTarget.kind === "connection_reference"
          ? placeAssociatedPanelAssetOnConnectionView({
              model,
              sheetId: resolvedActiveSheetId,
              connectionViewId: activeAssociatedTarget.placementId,
              assetId,
              symbols
            })
          : placeAssociatedPanelAssetOnBackplane({
              model,
              sheetId: resolvedActiveSheetId,
              backplaneId: activeAssociatedTarget.placementId,
              assetId,
              symbols
            });

      commitModel(result.model);
      selectPlacement(result.placement.id);
      setSelectedConnectionId(undefined);
      setMessage(
        activeAssociatedTarget.kind === "connection_reference"
          ? `${result.placement.tag} added to panel connection view.`
          : `${result.placement.tag} placed on backplane.`
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Panel asset could not be placed."
      );
    }
  };

  const addPanel = (submission: AddPanelEnclosureSubmission) => {
    const { mode, assetId, tag, title } = submission;
    try {
      const target = {
        x: viewportCenter.x - 59,
        y: viewportCenter.y - 46
      };
      const panel =
        mode === "reference"
          ? createPanelConnectionView({
              model,
              activeSheet,
              assetId,
              tag,
              title,
              sourceBackplanePlacementId:
                submission.sourceBackplanePlacementId,
              preferredPosition: target
            })
          : createPanelEnclosurePlacement({
                model,
                activeSheet,
                assetId,
                tag,
                title,
                ...target
              });

      updateActiveSheet((current) =>
        addPlacementCommand(current, panel)
      );
      selectPlacement(panel.id);
      setSelectedConnectionId(undefined);
      setIsAddPanelOpen(false);
      setMessage(
        mode === "reference"
          ? `${panel.tag} schematic connection reference added.`
          : `${panel.tag} panel added.`
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The panel reference could not be placed."
      );
    }
  };

  const fitPanelConnectionView = (placementId: string) => {
    updateActiveSheet((current) => {
      const placement = current.placements.find(
        (candidate) => candidate.id === placementId
      );
      return isPanelConnectionViewPlacement(placement)
        ? fitPanelConnectionViewContents({
            model: current,
            placement,
            symbols,
            assets: model.assets
          })
        : current;
    });
    setMessage("Panel connection contents fitted.");
  };

  const submitTerminalStrip = (
    submission: TerminalStripBuilderSubmission
  ): TerminalStripBuilderSubmissionResult => {
    try {
      if (submission.mode === "edit") {
        const nextModel = updateStructuredTerminalStrip({
          model,
          symbols,
          assetId: submission.assetId,
          name: submission.name,
          description: submission.description,
          strip: submission.strip
        });
        commitModel(nextModel);
        setEditingTerminalStripAssetId(null);
        setMessage("Terminal strip updated.");
        return { ok: true };
      }
      const result = createAndPlaceStructuredTerminalStrip({
        model,
        symbols,
        input: {
          sheetId: resolvedActiveSheetId,
          backplaneId: submission.backplaneId,
          name: submission.name,
          description: submission.description,
          strip: submission.strip,
          x: viewportCenter.x - 35,
          y: viewportCenter.y - 25
        }
      });

      commitModel(result.model);
      selectPlacement(result.placement.id);
      setSelectedConnectionId(undefined);
      setIsTerminalBlockGroupOpen(false);
      setIsAddTerminalBlockOpen(false);
      setMessage(`${result.placement.tag} terminal strip placed.`);
      return { ok: true };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Terminal strip could not be placed.";
      setMessage(message);
      return { ok: false, error: message };
    }
  };

  const applyTerminalStripReuse = (
    input: StructuredTerminalStripReuseInput,
    onSuccess: (placementTag: string, createdNewAsset: boolean) => void
  ): { ok: true } | { ok: false; error: string } => {
    try {
      const result = reuseStructuredTerminalStrip({ model, symbols, input });
      commitModel(result.model);
      selectSheet(input.targetSheetId);
      selectPlacement(result.placement.id);
      setSelectedConnectionId(undefined);
      onSuccess(result.placement.tag, result.createdNewAsset);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "The terminal strip could not be reused."
      };
    }
  };

  const submitTerminalStripReuse = (
    input: StructuredTerminalStripReuseInput
  ): { ok: true } | { ok: false; error: string } =>
    applyTerminalStripReuse(input, (placementTag, createdNewAsset) => {
      setTerminalStripReuseSource(null);
      setMessage(
        createdNewAsset
          ? `${placementTag} created as an independent terminal strip.`
          : `${placementTag} representation placed.`
      );
    });

  const submitDestinationTerminalStripCopy = (
    input: StructuredTerminalStripReuseInput
  ): { ok: true } | { ok: false; error: string } => {
    const sourceTag = model.sheets
      .find((sheet) => sheet.id === input.sourceSheetId)
      ?.placements.find(
        (placement) => placement.id === input.sourcePlacementId
      )?.tag;
    return applyTerminalStripReuse(input, (placementTag) => {
      setIsCopyTerminalBlockOpen(false);
      setMessage(
        sourceTag
          ? `${placementTag} created from ${sourceTag}.`
          : `${placementTag} created as an independent terminal strip.`
      );
    });
  };

  const updatePlacement = (
    placementId: string,
    updates: Partial<DrawingPlacement>
  ) => {
    updateActiveSheet((current) =>
      updatePlacementProperties(current, placementId, updates)
    );
  };

  const moveSelection = ({
    selection: targetSelection,
    delta,
    baseModel
  }: {
    selection: DrawingCanvasSelection;
    delta: { x: number; y: number };
    baseModel?: DrawingSheetCanvasModel;
  }) => {
    if (
      targetSelection.placementIds.length === 0 &&
      targetSelection.annotationIds.length === 0
    ) {
      return;
    }

    updateActiveSheet((current) =>
      moveCanvasSelection({
        model: baseModel ?? current,
        selection: targetSelection,
        delta,
        symbols
      })
    );
  };

  const previewSelectionDrag = ({
    delta
  }: {
    selection: DrawingCanvasSelection;
    delta: { x: number; y: number };
    baseModel?: DrawingSheetCanvasModel;
  }) => {
    setDragState((current) =>
      current
        ? {
            ...current,
            previewDelta: delta
          }
        : current
    );
  };

  const commitSelectionDrag = () => {
    const currentDragState = dragState;

    if (!currentDragState?.previewDelta) {
      setDragState(null);
      return;
    }

    const { previewDelta } = currentDragState;

    if (previewDelta.x !== 0 || previewDelta.y !== 0) {
      updateActiveSheet(() =>
        moveCanvasSelection({
          model: currentDragState.startModel,
          selection: {
            placementIds: currentDragState.placementIds,
            annotationIds: []
          },
          delta: previewDelta,
          symbols
        })
      );
    }

    setDragState(null);
  };

  const openAssetLinkDialog = (mode: AssetLinkDialogMode) => {
    if (!selectedPlacementId) {
      return;
    }
    if (isDetailedPanelDrawing && mode === "create") {
      setMessage(
        "Add physical equipment from the panel layout, then reference it from this drawing."
      );
      return;
    }

    setAssetLinkDialogState({
      placementId: selectedPlacementId,
      initialMode: mode
    });
  };

  const createNewAssetLink = (
    targets: DrawingAssetPlacementTarget[],
    tag: string
  ) => {
    const placementId = assetLinkDialogState?.placementId;

    if (!placementId) {
      return;
    }

    try {
      commitModel((current) =>
        createNewAssetFromPlacement(current, placementId, {
          symbols,
          tag,
          placementTargets: targets
        })
      );
      setAssetLinkDialogState(null);
      setMessage("New asset link created.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Asset link could not be created."
      );
    }
  };

  const referenceExistingAssetLink = (
    targets: DrawingAssetPlacementTarget[],
    targetAssetId: string
  ) => {
    if (isDetailedPanelDrawing) {
      const targetAsset = model.assets?.find(
        (asset) => asset.id === targetAssetId
      );
      const representedOnActiveSheet = activeSheet.placements.some(
        (placement) => placement.assetId === targetAssetId
      );
      const associatedWithPanel = model.sheets.some((sheet) =>
        sheet.placements.some(
          (placement) =>
            placement.assetId === targetAssetId &&
            placement.containerAssetId ===
              activeSheet.panelDrawingContext?.panelAssetId
        )
      );
      if (
        !targetAsset ||
        targetAsset.symbolId !== assetLinkPlacement?.symbolId ||
        targetAsset.versionId !== assetLinkPlacement?.versionId ||
        representedOnActiveSheet ||
        !associatedWithPanel
      ) {
        setMessage(
          "Choose a compatible unrepresented asset associated with this panel."
        );
        return;
      }
    }
    commitModel((current) =>
      relinkPlacementsToExistingAsset(current, targets, targetAssetId, symbols)
    );
    setAssetLinkDialogState(null);
    setMessage("Asset reference updated.");
  };

  const createAssetManagerAsset = (input: ManagedAssetCreateInput) => {
    const currentModel = modelRef.current;
    const existingAssetIds = new Set(
      currentModel.assets?.map((asset) => asset.id) ?? []
    );
    const nextModel = createManagedAsset(currentModel, input, symbols);
    const createdAsset = nextModel.assets?.find(
      (asset) => !existingAssetIds.has(asset.id)
    );

    if (!createdAsset) {
      throw new Error("The created asset could not be resolved.");
    }

    commitModel(nextModel);
    setMessage("Asset created.");
    return {
      id: createdAsset.id,
      tag: createdAsset.tag,
      title: createdAsset.title
    };
  };

  const updateAssetManagerAsset = (
    assetId: string,
    updates: ManagedAssetUpdateInput,
    engineeringAttributeChange?: EngineeringAttributeChange
  ) => {
    const coalesceKey = engineeringAttributeChange
      ? engineeringAttributeChange.operation === "update"
        ? `engineering-attribute:${assetId}:${engineeringAttributeChange.definitionKey}`
        : undefined
      : `asset-manager:${assetId}:${Object.keys(updates).join(",")}`;
    commitModel(
      (current) => updateManagedAsset(current, assetId, updates, symbols),
      { coalesceKey }
    );
  };

  const updateConnectionDisplayMode = (
    placementId: string,
    mode: PanelConnectionDisplayMode
  ) => {
    commitModel((current) =>
      updateDrawingConnectionDisplayMode({
        model: current,
        sheetId: resolvedActiveSheetId,
        placementId,
        mode
      })
    );
    setMessage("Connection display updated.");
  };

  const arrangeSelection = (action: PlacementArrangementAction) => {
    const targetSelection = selectionRef.current;

    if (targetSelection.annotationIds.length > 0) {
      setMessage("Deselect notes before arranging equipment symbols.");
      return;
    }

    const result = resolvePlacementArrangement({
      model: activeSheetCanvasModel,
      symbols,
      placementIds: targetSelection.placementIds,
      action
    });

    if (!result.ok) {
      setMessage(result.message);
      return;
    }

    if (result.deltas.every((delta) => delta.x === 0 && delta.y === 0)) {
      setMessage("The selected symbols are already arranged.");
      return;
    }

    updateActiveSheet((current) =>
      applyPlacementArrangement({ model: current, deltas: result.deltas })
    );
    setMessage(
      placementArrangementMessage(action, targetSelection.placementIds.length)
    );
  };

  const updateSelectedAsset = (
    assetId: string,
    updates: Pick<
      ManagedAssetUpdateInput,
      "tag" | "title" | "description" | "engineeringAttributes"
    >,
    engineeringAttributeChange?: EngineeringAttributeChange
  ) => {
    try {
      updateAssetManagerAsset(assetId, updates, engineeringAttributeChange);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The selected asset could not be updated."
      );
    }
  };

  const deleteAssetManagerAsset = (
    assetId: string
  ): { ok: true } | { ok: false; error: string } => {
    try {
      commitModel((current) => deleteManagedAsset(current, assetId));
      setMessage("Asset deleted.");
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error ? error.message : "Asset could not be deleted."
      };
    }
  };

  const removePlacement = (placementId: string) => {
    const detailedOccurrence = isDetailedPanelDrawing
      ? activeSheet.placements.find(
          (placement) =>
            placement.id === placementId &&
            Boolean(placement.assetId) &&
            placement.containerAssetId ===
              activeSheet.panelDrawingContext?.panelAssetId
        )
      : undefined;

    if (detailedOccurrence) {
      try {
        const result = removePanelAssetOccurrence({
          model,
          sheetId: resolvedActiveSheetId,
          placementId
        });

        commitModel(result.model);
        setSelectedConnectionId(undefined);
        setSelection({ ...EMPTY_CANVAS_SELECTION });
        setConnectionDraft({});
        setMessage(
          `${detailedOccurrence.tag} returned to the Panel Engineering Workbench.`
        );
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "The panel asset representation could not be removed."
        );
      }
      return;
    }

    updateActiveSheet((current) => deletePlacementCommand(current, placementId));
    setSelectedConnectionId(undefined);
    setSelection({
      placementIds: selectionRef.current.placementIds.filter(
        (id) => id !== placementId
      ),
      annotationIds: selectionRef.current.annotationIds
    });
    setConnectionDraft({});
  };

  const addNote = () => {
    const annotation = createDefaultNoteAnnotation({
      id: `note_${Date.now()}`,
      point: {
        x: viewportCenter.x - 35,
        y: viewportCenter.y - 12
      },
      sheet: activeSheetCanvasModel.sheet
    });

    updateActiveSheet((current) => addAnnotationCommand(current, annotation));
    selectCanvasObject("annotation", annotation.id);
    setSelectedConnectionId(undefined);
    setConnectionDraft({});
    setMessage("Note added.");
  };

  const addConnectedWireSchedule = () => {
    if (!selectedScheduleSource?.placement.assetId) {
      setMessage("Select one managed electrical symbol first.");
      return;
    }
    const placementBounds = getPlacementBounds(
      selectedScheduleSource.placement,
      selectedScheduleSource.symbol.metadata
    );
    const position = defaultConnectedWireSchedulePosition({
      sheet: activeSheetCanvasModel.sheet,
      placementBounds: {
        left: placementBounds.x,
        right: placementBounds.x + placementBounds.width,
        top: placementBounds.y
      }
    });
    const annotation: ConnectedWireScheduleAnnotation = {
      id: `wire_schedule_${Date.now()}`,
      kind: "connected_wire_schedule",
      ...position,
      schedule: {
        assetId: selectedScheduleSource.placement.assetId,
        sourcePlacementId: selectedScheduleSource.placement.id,
        scope: "all_connected"
      }
    };
    commitModel((current) => {
      const sheetId = getActiveSheetId(current, resolvedActiveSheetId);
      const withAnnotation = replaceSheetFromCanvasModel(
        current,
        sheetId,
        addAnnotationCommand(toSheetCanvasModel(current, sheetId), annotation)
      );

      return updateDrawingConnectionDisplayMode({
        model: withAnnotation,
        sheetId,
        placementId: selectedScheduleSource.placement.id,
        mode: "all_connected"
      });
    });
    selectCanvasObject("annotation", annotation.id);
    setSelectedConnectionId(undefined);
    setConnectionDraft({});
    setMessage("Connected Wire Schedule added.");
  };

  const updateAnnotation = (
    annotationId: string,
    updates: Partial<DrawingAnnotation>
  ) => {
    updateActiveSheet((current) =>
      updateAnnotationCommand(current, annotationId, updates)
    );
  };

  const synchronizeConnectedWireScheduleContinuations = (
    annotationId: string,
    rowsPerPage: number
  ) => {
    const annotation = activeSheet.annotations.find(
      (candidate) => candidate.id === annotationId
    );
    const sourceAnnotation =
      annotation && isConnectedWireScheduleAnnotation(annotation)
        ? annotation
        : undefined;

    try {
      const result = createOrSynchronizeConnectedWireScheduleContinuations({
        model: modelRef.current,
        sourceSheetId: resolvedActiveSheetId,
        sourceAnnotationId: annotationId,
        rowsPerPage,
        symbols
      });
      const wasPaginated = Boolean(sourceAnnotation?.schedule.pagination);
      commitModel(result.model);

      const createdSheetId = result.createdSheetIds[0];
      if (createdSheetId) {
        const createdSheet = result.model.sheets.find(
          (sheet) => sheet.id === createdSheetId
        );
        const createdSchedule = createdSheet?.annotations.find(
          (annotation) =>
            isConnectedWireScheduleAnnotation(annotation) &&
            annotation.schedule.pagination?.continuationSetId ===
              result.continuationSetId
        );
        if (createdSheet && createdSchedule) {
          clearActiveSheetSelection();
          setActiveSheet(createdSheet.id);
          setViewportTransform({ zoom: 1, panX: 0, panY: 0 });
          setViewportCenter({
            x: createdSheet.page.width / 2,
            y: createdSheet.page.height / 2
          });
          setSelection({
            placementIds: [],
            annotationIds: [createdSchedule.id]
          });
          setSheetFocusRequestKey((current) => current + 1);
        }
      }

      const assetTag = modelRef.current.assets.find(
        (asset) => asset.id === sourceAnnotation?.schedule.assetId
      )?.tag;
      setMessage(
        wasPaginated
          ? `${assetTag ?? "Connected wire schedule"} continuation sheets synchronized.`
          : `${result.pageCount}-part schedule created for ${assetTag ?? "the selected equipment"}.`
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The continuation sheets could not be synchronized."
      );
    }
  };

  const removeConnectedWireScheduleContinuations = (annotationId: string) => {
    try {
      const result = removeConnectedWireSchedulePagination({
        model: modelRef.current,
        sourceSheetId: resolvedActiveSheetId,
        sourceAnnotationId: annotationId
      });
      commitModel(result.model);
      setSelection({ placementIds: [], annotationIds: [annotationId] });
      setMessage("Connected wire schedule pagination removed.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Pagination could not be removed safely."
      );
    }
  };

  const openConnectedWireSchedulePartOne = (continuationSetId: string) => {
    const partOne = model.sheets.flatMap((sheet) =>
      sheet.annotations.flatMap((annotation) =>
        isConnectedWireScheduleAnnotation(annotation) &&
        annotation.schedule.pagination?.continuationSetId ===
          continuationSetId &&
        annotation.schedule.pagination.pageIndex === 0
          ? [{ sheet, annotation }]
          : []
      )
    )[0];
    if (!partOne) {
      setMessage("Part 1 of this continuation set is unavailable.");
      return;
    }
    selectSheet(partOne.sheet.id);
    setSelection({
      placementIds: [],
      annotationIds: [partOne.annotation.id]
    });
    setSheetFocusRequestKey((current) => current + 1);
    setMessage("Part 1 loaded.");
  };

  const updateAnnotationGroup = (
    updates: Array<{
      annotationId: string;
      updates: Partial<DrawingAnnotation>;
    }>
  ) => {
    if (updates.length === 0) {
      return;
    }

    updateActiveSheet((current) => ({
      ...current,
      annotations: current.annotations.map((annotation): DrawingAnnotation => {
        const update = updates.find(
          (candidate) => candidate.annotationId === annotation.id
        );

        if (!update) {
          return annotation;
        }

        const delta = {
          x:
            update.updates.x === undefined
              ? 0
              : update.updates.x - annotation.x,
          y:
            update.updates.y === undefined
              ? 0
              : update.updates.y - annotation.y
        };

        if (
          isConnectedWireScheduleAnnotation(annotation) ||
          !annotation.leader?.enabled ||
          (delta.x === 0 && delta.y === 0)
        ) {
          return {
            ...annotation,
            ...update.updates,
            id: annotation.id,
            kind: annotation.kind
          } as DrawingAnnotation;
        }

        const leaderTarget = clampPointToSheet(
          {
            x: annotation.leader.targetX + delta.x,
            y: annotation.leader.targetY + delta.y
          },
          current.sheet
        );

        return {
          ...annotation,
          ...update.updates,
          id: annotation.id,
          kind: annotation.kind,
          leader: {
            ...annotation.leader,
            targetX: leaderTarget.x,
            targetY: leaderTarget.y
          }
        } as DrawingAnnotation;
      })
    }));
  };

  const removeAnnotation = (annotationId: string) => {
    updateActiveSheet((current) =>
      deleteAnnotationCommand(current, annotationId)
    );
    setSelection({
      placementIds: selectionRef.current.placementIds,
      annotationIds: selectionRef.current.annotationIds.filter(
        (id) => id !== annotationId
      )
    });
  };

  const removeSelection = () => {
    const currentSelection = selectionRef.current;

    if (
      currentSelection.placementIds.length === 0 &&
      currentSelection.annotationIds.length === 0
    ) {
      return;
    }

    const placementIds = new Set(currentSelection.placementIds);
    const annotationIds = new Set(currentSelection.annotationIds);

    if (isDetailedPanelDrawing) {
      try {
        let nextModel = model;
        const representationIds = activeSheet.placements
          .filter(
            (placement) =>
              placementIds.has(placement.id) &&
              Boolean(placement.assetId) &&
              placement.containerAssetId ===
                activeSheet.panelDrawingContext?.panelAssetId
          )
          .map((placement) => placement.id);

        representationIds.forEach((placementId) => {
          nextModel = removePanelAssetOccurrence({
            model: nextModel,
            sheetId: resolvedActiveSheetId,
            placementId
          }).model;
        });

        const remainingPlacementIds = new Set(
          [...placementIds].filter((id) => !representationIds.includes(id))
        );
        const currentCanvasModel = toSheetCanvasModel(
          nextModel,
          resolvedActiveSheetId
        );
        const withoutPlacements = currentCanvasModel.placements.reduce(
          (nextCanvasModel, placement) =>
            remainingPlacementIds.has(placement.id)
              ? deletePlacementCommand(nextCanvasModel, placement.id)
              : nextCanvasModel,
          currentCanvasModel
        );

        nextModel = replaceSheetFromCanvasModel(
          nextModel,
          resolvedActiveSheetId,
          {
            ...withoutPlacements,
            annotations: withoutPlacements.annotations.filter(
              (annotation) => !annotationIds.has(annotation.id)
            )
          }
        );
        commitModel(nextModel);
        setSelection({ ...EMPTY_CANVAS_SELECTION });
        setSelectedConnectionId(undefined);
        setConnectionDraft({});
        if (representationIds.length > 0) {
          setMessage("Panel asset representations returned to the work queue.");
        }
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "The selected panel asset representations could not be removed."
        );
      }
      return;
    }

    updateActiveSheet((current) => {
      const withoutPlacements = current.placements.reduce(
        (nextModel, placement) =>
          placementIds.has(placement.id)
            ? deletePlacementCommand(nextModel, placement.id)
            : nextModel,
        current
      );

      return {
        ...withoutPlacements,
        annotations: withoutPlacements.annotations.filter(
          (annotation) => !annotationIds.has(annotation.id)
        )
      };
    });
    setSelection({ ...EMPTY_CANVAS_SELECTION });
    setSelectedConnectionId(undefined);
    setConnectionDraft({});
  };

  const copySelection = () => {
    const nextClipboard = copySelectionToClipboard({
      model,
      sheetId: resolvedActiveSheetId,
      selection
    });

    if (!nextClipboard) {
      setMessage("Select symbols or notes to copy.");
      return;
    }

    setClipboard(nextClipboard);
    setMessage("Selection copied.");
  };

  const pasteSelection = () => {
    if (!clipboard) {
      setMessage("Nothing copied.");
      return;
    }

    try {
      const result = pasteClipboardToSheet({
        model,
        sheetId: resolvedActiveSheetId,
        clipboard,
        symbols
      });

      commitModel(result.model);
      replaceSelection(result.selection);
      setSelectedConnectionId(undefined);
      setConnectionDraft({});
      setMessage("Selection pasted.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Selection could not be pasted."
      );
    }
  };

  const updateConnection = (
    connectionId: string,
    updates: Partial<DrawingConnection>
  ) => {
    updateActiveSheet((current) =>
      updateConnectionCommand(current, connectionId, updates)
    );
  };

  const updateConnectionRoute = (
    connectionId: string,
    route: DrawingConnectionRoute
  ) => {
    updateActiveSheet((current) =>
      updateConnectionRouteCommand(current, connectionId, route)
    );
  };

  const resetConnectionRoute = (connectionId: string) => {
    commitModel((current) => {
      const sheetId = getActiveSheetId(current, activeSheetId);
      const currentCanvasModel = toSheetCanvasModel(current, sheetId);
      const connection = currentCanvasModel.connections.find(
        (candidate) => candidate.id === connectionId
      );

      if (!connection) {
        return current;
      }

      const currentRenderableSymbols = buildRenderableDrawingSymbols({
        placements: currentCanvasModel.placements,
        approvedSymbols: symbols,
        assets: current.assets
      });

      const route = generateDefaultOrthogonalRoute({
        model: currentCanvasModel,
        symbols: currentRenderableSymbols,
        connection,
        mode: "auto"
      });

      return route
        ? replaceSheetFromCanvasModel(
            current,
            sheetId,
            updateConnectionRouteCommand(currentCanvasModel, connectionId, route)
          )
        : current;
    });
  };

  const removeConnection = (connectionId: string) => {
    const connection = activeSheetCanvasModel.connections.find(
      (candidate) => candidate.id === connectionId
    );
    if (connection?.panelPatternId) {
      setPanelPatternDeleteId(connection.panelPatternId);
      return;
    }
    if (connection?.panelConnectionId) {
      requestInternalWireDelete(connection.panelConnectionId, connectionId);
      return;
    }
    updateActiveSheet((current) => deleteConnectionCommand(current, connectionId));
    setSelectedConnectionId((current) =>
      current === connectionId ? undefined : current
    );
  };

  const selectConnection = (connectionId: string | undefined) => {
    setSelectedConnectionId(connectionId);

    if (connectionId) {
      setSelection({ ...EMPTY_CANVAS_SELECTION });
    }
  };

  const selectAnnotation = (
    annotationId: string | undefined,
    options?: { additive?: boolean }
  ) => {
    selectCanvasObject("annotation", annotationId, options);

    if (annotationId) {
      setSelectedConnectionId(undefined);
      setConnectionDraft({});
    }
  };

  const toggleConnectMode = () => {
    const next = connectionMode === "connecting" ? "idle" : "connecting";
    setConnectionMode(next);
    setMessage(
      next === "connecting"
        ? isDetailedPanelDrawing
          ? "Select a free internal terminal."
          : "Select a connection start anchor."
        : null
    );
    setConnectionDraft({});
    clearConnectionInspections();
    if (next === "idle") restorePropertiesAfterWireMode();
    setPendingInternalWire(null);
    setPanelPatternDraft(null);
    setPendingPanelPatternReview(null);
    setSelectedConnectionId(undefined);
  };

  const cancelConnectionAuthoring = () => {
    if (panelPatternDraft) {
      setPanelPatternDraft(null);
      setPendingPanelPatternReview(null);
      setConnectionDraft({});
      setConnectionMode("idle");
      clearConnectionInspections();
      restorePropertiesAfterWireMode();
      setMessage(null);
      return;
    }
    if (connectionDraft.from) {
      setConnectionDraft({});
      clearConnectionInspections();
      setMessage("Connection start cleared.");
      return;
    }

    setConnectionMode("idle");
    clearConnectionInspections();
    restorePropertiesAfterWireMode();
    setPendingInternalWire(null);
    setSelectedConnectionId(undefined);
    setMessage(null);
  };

  const handleConnectionAnchorClick = (
    endpoint: DrawingEndpoint,
    inspection: DrawingAnchorInspection
  ) => {
    if (connectionMode !== "connecting") {
      return;
    }

    if (panelPatternDraft?.stage === "selecting") {
      const currentEndpoint = panelWireEndpointsByAnchorId.get(
        `${endpoint.placementId}:${endpoint.anchorKey}`
      );
      const state = getConnectionAnchorState(endpoint);
      if (!currentEndpoint || !state.enabled) {
        setMessage(
          state.reason ?? "This terminal cannot participate in the selected pattern."
        );
        return;
      }
      setPanelPatternDraft((current) =>
        current
          ? { ...current, selected: [...current.selected, currentEndpoint] }
          : current
      );
      selectPlacement(endpoint.placementId);
      setSelectedConnectionId(undefined);
      setMessage("Terminal added to the connection pattern.");
      return;
    }

    if (isDetailedPanelDrawing) {
      const currentEndpoint = panelWireEndpointsByAnchorId.get(
        `${endpoint.placementId}:${endpoint.anchorKey}`
      );
      if (!currentEndpoint || !panelDiscoveryIndex || !panelConnectivityGraph || !detailedPanelContext) {
        setMessage(
          "Internal wires require a resolved internal or single-sided terminal."
        );
        return;
      }
      const occupancy = getTerminalSideOccupancy(
        panelDiscoveryIndex.terminalCatalog,
        currentEndpoint.terminal
      );
      if (occupancy && occupancy.conductorStatus !== "available") {
        setMessage(
          occupancy.conductorStatus === "conflicting"
            ? "This terminal side has conflicting occupancy and must be repaired first."
            : `${occupancy.conductorOccupants[0]?.label ?? "Another connection"} already occupies this terminal side.`
        );
        return;
      }
      if (!connectionDraft.from) {
        setConnectionDraft({ from: endpoint, waypoints: [] });
        setConnectionSourceInspection(inspection);
        setConnectionHoverInspection(inspection);
        revealPropertiesForWireAuthoring();
        selectPlacement(endpoint.placementId);
        setSelectedConnectionId(undefined);
        setMessage(null);
        return;
      }
      const sourceEndpoint = panelWireEndpointsByAnchorId.get(
        `${connectionDraft.from.placementId}:${connectionDraft.from.anchorKey}`
      );
      if (!sourceEndpoint) {
        setConnectionDraft({});
        clearConnectionInspections();
        setMessage("The selected source terminal is no longer available.");
        return;
      }
      const validation = validateInternalWireEndpoints({
        graph: panelConnectivityGraph,
        panelAssetId: detailedPanelContext.panelAssetId,
        from: sourceEndpoint.terminal,
        to: currentEndpoint.terminal
      });
      if (!validation.valid) {
        setMessage(validation.findings[0]?.message ?? "The wire endpoints are invalid.");
        return;
      }
      const routePreview = buildGuidedConnectionPreview({
        model: activeSheetCanvasModel,
        symbols: activeSheetRenderableSymbols,
        from: connectionDraft.from,
        destination: endpoint,
        waypoints: connectionDraft.waypoints ?? []
      });
      if (routePreview.warning || routePreview.points.length < 2) {
        setMessage(
          routePreview.warning ??
            "The guided route cannot be completed inside the printable sheet."
        );
        return;
      }
      setPendingInternalWire({
        from: sourceEndpoint,
        to: currentEndpoint,
        waypoints: [...(connectionDraft.waypoints ?? [])]
      });
      setConnectionMode("idle");
      setConnectionDraft((current) => ({
        ...current,
        pointer: undefined,
        hoveredDestination: endpoint,
        alignmentFeedback: [],
        warning: undefined
      }));
      setConnectionHoverInspection(inspection);
      setMessage(null);
      return;
    }

    if (!connectionDraft.from) {
      setConnectionDraft({ from: endpoint, waypoints: [] });
      selectPlacement(endpoint.placementId);
      setSelectedConnectionId(undefined);
      setMessage(null);
      return;
    }

    const result = createConnectionFromEndpoints({
      model: activeSheetCanvasModel,
      symbols: activeSheetRenderableSymbols,
      from: connectionDraft.from,
      to: endpoint
    });

    if (!result.ok) {
      setMessage(result.error);
      return;
    }

    const route = buildGuidedConnectionRoute({
      model: activeSheetCanvasModel,
      symbols: activeSheetRenderableSymbols,
      connection: result.connection,
      waypoints: connectionDraft.waypoints ?? []
    });
    if (!route) {
      setMessage(
        "The guided route cannot be completed inside the printable sheet. Adjust a bend and try again."
      );
      return;
    }
    const routedConnection = route
      ? { ...result.connection, route }
      : result.connection;

    updateActiveSheet((current) => addConnectionCommand(current, routedConnection));
    setSelectedConnectionId(routedConnection.id);
    setSelection({ ...EMPTY_CANVAS_SELECTION });
    setConnectionDraft({ waypoints: [] });
    setMessage("Connection added. Select another connection start anchor.");
  };

  const handleConnectionPointerMove = (
    pointer: { x: number; y: number },
    options: GuidedConnectionPointerOptions
  ) => {
    setConnectionDraft((current) => {
      if (!current.from) return current;
      if (panelPatternDraft) return current;

      const resolution = resolveGuidedConnectionPointer({
        model: activeSheetCanvasModel,
        symbols: activeSheetRenderableSymbols,
        from: current.from,
        destination: current.hoveredDestination,
        waypoints: current.waypoints ?? [],
        proposedPoint: pointer,
        pixelsPerUnit: options.pixelsPerUnit,
        activeSnapState: current.snapState,
        bypassSnapping: options.bypassSnapping
      });

      return {
        ...current,
        pointer: resolution.point,
        snapState: resolution.snapState,
        alignmentFeedback: resolution.alignmentFeedback,
        warning: resolution.warning
      };
    });
  };

  const handleConnectionWaypointAdd = (
    pointer: { x: number; y: number },
    options: GuidedConnectionPointerOptions
  ) => {
    setConnectionDraft((current) => {
      if (!current.from || panelPatternDraft) {
        return current;
      }

      const resolution = resolveGuidedConnectionPointer({
        model: activeSheetCanvasModel,
        symbols: activeSheetRenderableSymbols,
        from: current.from,
        waypoints: current.waypoints ?? [],
        proposedPoint: pointer,
        pixelsPerUnit: options.pixelsPerUnit,
        activeSnapState: current.snapState,
        bypassSnapping: options.bypassSnapping
      });
      if (resolution.warning) {
        setMessage(resolution.warning);
        return current;
      }

      const fixedPreview = buildGuidedConnectionPreview({
        model: activeSheetCanvasModel,
        symbols: activeSheetRenderableSymbols,
        from: current.from,
        waypoints: current.waypoints ?? []
      });
      const waypoints = addGuidedConnectionWaypoint({
        waypoints: current.waypoints ?? [],
        point: resolution.point,
        previousPoint: fixedPreview.points.at(-1),
        sheet: activeSheetCanvasModel.sheet,
        pixelsPerUnit: options.pixelsPerUnit
      });

      if (waypoints === current.waypoints || waypoints.length === (current.waypoints ?? []).length) {
        return current;
      }

      return {
        ...current,
        pointer: resolution.point,
        hoveredDestination: undefined,
        waypoints,
        snapState: {},
        alignmentFeedback: [],
        warning: undefined
      };
    });
  };

  const handleConnectionAnchorHover = (
    endpoint: DrawingEndpoint | undefined
  ) => {
    if (panelPatternDraft) return;
    setConnectionDraft((current) =>
      current.from
        ? {
            ...current,
            hoveredDestination: endpoint,
            alignmentFeedback: endpoint ? [] : current.alignmentFeedback,
            warning: undefined
          }
        : current
    );
  };

  const handleConnectionAnchorInspectionChange = (
    inspection: DrawingAnchorInspection | undefined
  ) => {
    if (!isDetailedPanelDrawing || !connectionDraft.from || panelPatternDraft) {
      setConnectionHoverInspection(null);
      return;
    }
    setConnectionHoverInspection(inspection ?? null);
  };

  const removeLastConnectionWaypoint = () => {
    setConnectionDraft((current) => {
      const waypoints = current.waypoints ?? [];
      if (waypoints.length === 0) return current;
      return {
        ...current,
        waypoints: removeLastGuidedConnectionWaypoint(waypoints),
        hoveredDestination: undefined,
        snapState: {},
        alignmentFeedback: [],
        warning: undefined
      };
    });
  };

  const createDetailedPanelInternalWire = (
    submission: InternalWireDialogSubmission,
    routeWaypoints: GuidedConnectionWaypoint[] = []
  ): boolean => {
    try {
      const result = createInternalPanelWireRoute({
        model,
        symbols,
        sheetId: resolvedActiveSheetId,
        from: submission.from,
        to: submission.to,
        specification: submission.specification,
        attributes: submission.attributes,
        routeWaypoints
      });
      commitModel(result.model);
      setSelectedConnectionId(result.connection.id);
      setSelection({ ...EMPTY_CANVAS_SELECTION });
      setMessage(`${result.wire.wireId} added.`);
      return true;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The internal wire could not be created.";
      setMessage(message);
      return false;
    }
  };

  const createPendingInternalWire = (
    submission: InternalWireDialogSubmission
  ) => {
    if (!pendingInternalWire) {
      return;
    }
    let routeWaypoints = pendingInternalWire.waypoints;
    if (submission.endpointsSwapped && pendingInternalWire.waypoints.length > 0) {
      const preview = buildGuidedConnectionPreview({
        model: activeSheetCanvasModel,
        symbols: activeSheetRenderableSymbols,
        from: {
          placementId: pendingInternalWire.from.placementId,
          anchorKey: pendingInternalWire.from.anchorKey
        },
        destination: {
          placementId: pendingInternalWire.to.placementId,
          anchorKey: pendingInternalWire.to.anchorKey
        },
        waypoints: pendingInternalWire.waypoints
      });
      routeWaypoints = preview.points
        .slice(1, -1)
        .reverse()
        .map((point, index) => ({
          id: `swapped_route_${index + 1}`,
          x: point.x,
          y: point.y
        }));
    }
    const result = createDetailedPanelInternalWire(
      {
        from: submission.from,
        to: submission.to,
        endpointsSwapped: submission.endpointsSwapped,
        specification: submission.specification,
        attributes: submission.attributes
      },
      routeWaypoints
    );
    if (result) {
      setPendingInternalWire(null);
      setConnectionMode("connecting");
      setConnectionDraft({ waypoints: [] });
      clearConnectionInspections();
    }
  };

  const startPanelPatternAuthoring = () => {
    if (!isDetailedPanelDrawing || !detailedPanelContext) return;
    setPanelPatternDraft({
      topology: "terminal_jumper",
      domain: "signal",
      targetDomain: "protective_earth",
      targetMode: "panel_reference",
      stage: "configure",
      selected: []
    });
    setPendingPanelPatternReview(null);
    setPendingInternalWire(null);
    setConnectionMode("idle");
    setConnectionDraft({});
    clearConnectionInspections();
    restorePropertiesAfterWireMode();
    setSelectedConnectionId(undefined);
    setMessage("Configure the connection pattern, then select its terminals.");
  };

  const cancelPanelPatternAuthoring = () => {
    setPanelPatternDraft(null);
    setPendingPanelPatternReview(null);
    setConnectionMode("idle");
    setConnectionDraft({});
    clearConnectionInspections();
    restorePropertiesAfterWireMode();
    setMessage(null);
  };

  const buildPendingPanelPatternResult = (): PanelPatternCommandResult | null => {
    if (!panelPatternDraft || !detailedPanelContext) return null;
    if (
      ["daisy_chain", "distribution", "fused_distribution"].includes(
        panelPatternDraft.topology
      ) &&
      !defaultWireSpecification
    ) {
      throw new Error(
        "Set up a default Wire Catalog entry before creating a wire-producing pattern."
      );
    }
    const selected = panelPatternDraft.selected.map((entry) => entry.terminal);
    const common = {
      panelAssetId: detailedPanelContext.panelAssetId,
      createdOnSheetId: resolvedActiveSheetId
    };
    if (
      panelPatternDraft.topology === "terminal_jumper" ||
      panelPatternDraft.topology === "bridge_bar"
    ) {
      return createTerminalJumper(panelWiringSource, {
        ...common,
        topology: panelPatternDraft.topology,
        domain: panelPatternDraft.domain,
        members: selected
      });
    }
    if (panelPatternDraft.topology === "daisy_chain") {
      return createDistributionGroup(panelWiringSource, {
        ...common,
        topology: "daisy_chain",
        domain: panelPatternDraft.domain,
        members: selected,
        specification: defaultWireSpecification
      });
    }
    if (panelPatternDraft.topology === "distribution") {
      return createDistributionGroup(panelWiringSource, {
        ...common,
        topology: "distribution",
        domain: panelPatternDraft.domain,
        source: selected[0],
        targets: selected.slice(1),
        specification: defaultWireSpecification
      });
    }
    if (panelPatternDraft.topology === "fused_distribution") {
      const branches = [];
      for (let index = 1; index < selected.length; index += 3) {
        branches.push({
          protectionAssetId: selected[index].assetId,
          protectionInput: selected[index],
          protectionOutput: selected[index + 1],
          target: selected[index + 2]
        });
      }
      return createDistributionGroup(panelWiringSource, {
        ...common,
        topology: "fused_distribution",
        domain: panelPatternDraft.domain,
        source: selected[0],
        branches,
        specification: defaultWireSpecification
      });
    }
    const target = panelPatternDraft.targetMode === "terminal"
      ? { kind: "terminal" as const, terminal: selected[1] }
      : {
          kind: "panel_reference" as const,
          panelAssetId: detailedPanelContext.panelAssetId,
          referenceKind: panelPatternDraft.targetDomain
        };
    const bondInput = {
      ...common,
      source: selected[0],
      target,
      targetDomain: panelPatternDraft.targetDomain
    };
    return panelPatternDraft.topology === "shield"
      ? createShieldTermination(panelWiringSource, bondInput)
      : createEarthTermination(panelWiringSource, {
          ...bondInput,
          kind: panelPatternDraft.topology
        });
  };

  const reviewPanelPattern = () => {
    if (!canReviewPanelPattern) return;
    try {
      const result = buildPendingPanelPatternResult();
      if (!result) return;
      setPendingPanelPatternReview({
        result,
        memberLabels: panelPatternSelectedLabels
      });
      setConnectionMode("idle");
      setMessage(null);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "The connection pattern could not be reviewed."
      );
    }
  };

  const confirmPanelPattern = () => {
    if (!pendingPanelPatternReview) return;
    try {
      const created = createPanelPatternWithRoutes({
        model,
        symbols,
        sheetId: resolvedActiveSheetId,
        result: pendingPanelPatternReview.result
      });
      commitModel(created.model);
      setSelectedConnectionId(created.connections[0]?.id);
      setSelection({ ...EMPTY_CANVAS_SELECTION });
      const code = pendingPanelPatternReview.result.pattern?.record.patternCode;
      setPanelPatternDraft(null);
      setPendingPanelPatternReview(null);
      setMessage(`${code ?? "Connection pattern"} added.`);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "The connection pattern could not be created."
      );
    }
  };

  const updateDetailedPanelInternalWire = (
    wireRecordId: string,
    updates: {
      wireId?: string;
      specification?: WireSpecificationSnapshot;
      attributes?: PanelWireAttributes;
    }
  ) => {
    try {
      commitModel(
        updateInternalPanelWireCommand({
          model,
          symbols,
          id: wireRecordId,
          wireId: updates.wireId,
          specification: updates.specification,
          attributes: updates.attributes
        })
      );
      setMessage("Internal wire updated.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "The internal wire could not be updated."
      );
    }
  };

  const requestInternalWireDelete = (
    wireRecordId: string,
    connectionId?: string
  ) => {
    setInternalWireDeleteCandidate({ wireRecordId, connectionId });
  };

  const removeInternalWireRoute = () => {
    if (!internalWireDeleteCandidate?.connectionId) {
      return;
    }
    commitModel(
      deleteInternalWireRouteOccurrence({
        model,
        sheetId: resolvedActiveSheetId,
        connectionId: internalWireDeleteCandidate.connectionId
      })
    );
    setSelectedConnectionId(undefined);
    setInternalWireDeleteCandidate(null);
    setMessage("Wire route removed. The physical wire remains in the work queue.");
  };

  const deletePhysicalInternalWire = () => {
    if (!internalWireDeleteCandidate) {
      return;
    }
    const wireId = internalWireDeleteRecord?.wireId ?? "Internal wire";
    commitModel(
      deleteInternalWireAndRoutes({
        model,
        symbols,
        wireRecordId: internalWireDeleteCandidate.wireRecordId
      })
    );
    setSelectedConnectionId(undefined);
    setInternalWireDeleteCandidate(null);
    setMessage(`${wireId} deleted.`);
  };

  const addDetailedPanelWireRoute = (wireRecordId: string) => {
    try {
      const result = addInternalWireRouteOccurrence({
        model,
        symbols,
        sheetId: resolvedActiveSheetId,
        wireRecordId
      });
      commitModel(result.model);
      setSelectedConnectionId(result.connection.id);
      setSelection({ ...EMPTY_CANVAS_SELECTION });
      setMessage(`${result.wire.wireId} represented on this sheet.`);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "The route could not be represented."
      );
    }
  };

  const selectDetailedPanelWireRoute = (connectionId: string) => {
    setIsPanelDiscoveryOpen(false);
    selectConnection(connectionId);
    setMessage("Internal wire route selected.");
  };

  const addDetailedPanelPatternRoute = (patternId: string) => {
    try {
      const result = addPanelPatternRouteOccurrence({
        model,
        symbols,
        sheetId: resolvedActiveSheetId,
        patternId
      });
      commitModel(result.model);
      setSelectedConnectionId(result.connections[0]?.id);
      setSelection({ ...EMPTY_CANVAS_SELECTION });
      setMessage(`${result.pattern.record.patternCode ?? "Pattern"} represented on this sheet.`);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "The pattern could not be represented."
      );
    }
  };

  const selectDetailedPanelPatternRoute = (connectionId: string) => {
    setIsPanelDiscoveryOpen(false);
    selectConnection(connectionId);
    setMessage("Connection pattern route selected.");
  };

  const removeDetailedPanelPatternRoute = (patternId: string) => {
    commitModel(
      removePanelPatternRouteOccurrence({
        model,
        sheetId: resolvedActiveSheetId,
        patternId
      })
    );
    setSelectedConnectionId(undefined);
    setPanelPatternDeleteId(null);
    setMessage("Pattern representation removed. The physical pattern remains in the work queue.");
  };

  const deletePhysicalPanelPattern = (patternId: string) => {
    const code = panelConnectionPatterns.find(
      (pattern) => pattern.patternId === patternId
    )?.patternCode;
    commitModel(
      deletePanelPatternAndRoutes({ model, symbols, patternId })
    );
    setSelectedConnectionId(undefined);
    setPanelPatternDeleteId(null);
    setMessage(`${code ?? "Connection pattern"} deleted.`);
  };

  const updateDetailedPanelPattern = (
    patternId: string,
    updates: { label?: string; description?: string }
  ) => {
    const row = panelConnectionPatterns.find(
      (pattern) => pattern.patternId === patternId
    );
    if (!row) return;
    const pattern = row.recordType === "bridge"
      ? {
          recordType: "bridge" as const,
          record: { ...row.record, ...updates }
        }
      : {
          recordType: "bond" as const,
          record: { ...row.record, ...updates }
        };
    const result = updatePanelConnectionPattern(panelWiringSource, pattern);
    if (result.mutations.length === 0) {
      setMessage(result.warnings[0]?.message ?? "The pattern could not be updated.");
      return;
    }
    commitModel(applyPanelWiringMutations(model, result.mutations));
    setMessage(`${row.patternCode} updated.`);
  };

  const updatePanelPatternLegendVisibility = (visible: boolean) => {
    commitModel(
      setPanelPatternLegendVisibility({
        model,
        sheetId: resolvedActiveSheetId,
        visible
      })
    );
  };

  const addSheet = (submission: AddSheetDialogSubmission) => {
    try {
      const insertAt =
        submission.kind === "section_title"
          ? getSectionInsertionIndex(model, resolvedActiveSheetId)
          : getSheetInsertionIndex(model, resolvedActiveSheetId);
      const result =
        submission.kind === "section_title"
          ? addSectionTitlePageCommand(model, {
              name: submission.name,
              title: submission.title,
              subtitle: submission.subtitle
            }, { insertAt })
          : submission.kind === "detailed_panel"
            ? createDetailedPanelDrawingSheet(
                model,
                submission,
                symbols,
                { insertAt }
              )
            : addDrawingSheetCommand(model, submission.name, { insertAt });
      const newSheet = result.model.sheets.find(
        (sheet) => sheet.id === result.sheetId
      );

      commitModel(result.model);
      setIsAddSheetOpen(false);
      setActiveSheet(result.sheetId);
      setSheetFocusRequestKey((current) => current + 1);
      clearActiveSheetSelection();

      if (newSheet) {
        setViewportCenter({
          x: newSheet.page.width / 2,
          y: newSheet.page.height / 2
        });
      }

      setMessage(
        submission.kind === "section_title"
          ? "Section title page added."
          : submission.kind === "detailed_panel"
            ? "Detailed Panel Drawing added."
            : "Sheet added."
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Sheet could not be added."
      );
    }
  };

  const placeDetailedPanelAssets = (assetIds: string[]): boolean => {
    try {
      const result = placePanelAssetOccurrences({
        model,
        sheetId: resolvedActiveSheetId,
        assetIds,
        symbols
      });

      commitModel(result.model);
      const lastPlacement = result.placements.at(-1);
      if (lastPlacement) {
        selectPlacement(lastPlacement.id);
      }
      setMessage(
        result.placements.length === 1
          ? `${result.placements[0].tag} placed from the existing panel asset.`
          : `${result.placements.length} equipment items added to the sheet.`
      );
      return true;
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The selected panel equipment could not be added to this sheet."
      );
      return false;
    }
  };

  const centerDetailedPanelAssets = () => {
    try {
      const result = centerDetailedPanelEquipment({
        model,
        sheetId: resolvedActiveSheetId,
        symbols
      });
      if (result.placementIds.length === 0) {
        setMessage("Add equipment to this drawing before centering it.");
        return;
      }
      if (result.delta.x === 0 && result.delta.y === 0) {
        setMessage("Equipment is already centered.");
        return;
      }
      commitModel(result.model);
      setMessage("Equipment centered on the drawing.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The equipment could not be centered."
      );
    }
  };

  const removeDetailedPanelAsset = (placementId: string) => {
    const placement = activeSheet.placements.find(
      (candidate) => candidate.id === placementId
    );

    try {
      const result = removePanelAssetOccurrence({
        model,
        sheetId: resolvedActiveSheetId,
        placementId
      });

      commitModel(result.model);
      if (selectionRef.current.placementIds.includes(placementId)) {
        setSelection({ ...EMPTY_CANVAS_SELECTION });
      }
      setMessage(
        `${placement?.tag ?? "Panel asset"} returned to the Panel Engineering Workbench.`
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The panel asset representation could not be removed."
      );
    }
  };

  const selectDetailedPanelAsset = (placementId: string) => {
    selectPlacement(placementId);
    setMessage("Panel asset occurrence selected.");
  };

  const mapDetailedPanelTermination = (
    terminationId: string,
    target: PanelTerminalSideRef
  ) => {
    if (!detailedPanelContext) {
      setMessage("The detailed panel context is not available.");
      return;
    }

    const result = mapExternalTerminationToTerminal(panelWiringSource, {
      panelAssetId: detailedPanelContext.panelAssetId,
      terminationId,
      target
    });
    const blocking = result.warnings.find(
      (warning) => warning.severity === "error"
    );

    if (blocking) {
      setMessage(blocking.message);
      return;
    }

    if (result.mutations.length === 0) {
      setMessage("The automatic terminal mapping is already active.");
      return;
    }

    commitModel((current) =>
      applyPanelWiringMutations(current, result.mutations)
    );
    setMessage("External termination mapping updated.");
  };

  const resetDetailedPanelTerminationMapping = (terminationId: string) => {
    if (!detailedPanelContext) {
      setMessage("The detailed panel context is not available.");
      return;
    }

    const result = resetExternalTerminationMapping(panelWiringSource, {
      panelAssetId: detailedPanelContext.panelAssetId,
      terminationId
    });
    const blocking = result.warnings.find(
      (warning) => warning.severity === "error"
    );

    if (blocking) {
      setMessage(blocking.message);
      return;
    }

    if (result.mutations.length === 0) {
      setMessage("This termination is already using automatic mapping.");
      return;
    }

    commitModel((current) =>
      applyPanelWiringMutations(current, result.mutations)
    );
    setMessage("Automatic terminal mapping restored.");
  };

  const addSymbolFromLibrary = (symbol: ApprovedDrawingSymbol) => {
    if (symbolLibraryContext === "wiring") {
      if (isGeneratedBackplaneSymbolReference(symbol)) {
        addBackplaneFromLibrary();
        return;
      }

      if (isGeneratedLayoutDimensionSymbolReference(symbol)) {
        addLayoutDimensionFromLibrary(symbol);
        return;
      }

      if (isGeneratedTerminalBlockGroupLibrarySymbolReference(symbol)) {
        setIsTerminalBlockGroupOpen(true);
        return;
      }

      if (symbol.metadata.componentPositions?.length) {
        setPendingSymbol(symbol);
        return;
      }

      if (isPanelLayoutLibrarySymbol(symbol)) {
        addLayoutSymbol(symbol);
        return;
      }

      setPendingSymbol(symbol);
    }
  };

  const updateAssetComponentSelections = (
    assetId: string,
    componentSelections: NonNullable<
      DrawingAssetRecord["componentSelections"]
    >
  ) => {
    commitModel((current) =>
      replaceDrawingAssetComponentSelections(
        current,
        assetId,
        componentSelections
      )
    );
    setMessage("Component configuration updated for every asset occurrence.");
  };

  const moveSheet = (sheetId: string, direction: -1 | 1) => {
    commitModel((current) => {
      const index = buildDrawingSectionIndex(current);
      const membership = index.membershipBySheetId.get(sheetId);

      return membership?.kind === "section" && membership.isTitlePage
        ? moveDrawingSection(current, membership.sectionId, direction)
        : moveSheetWithinSection(current, sheetId, direction);
    });
  };

  const moveSheetToEnd = (sheetId: string) => {
    commitModel((current) => {
      const index = buildDrawingSectionIndex(current);
      const membership = index.membershipBySheetId.get(sheetId);

      return membership?.kind === "section" && membership.isTitlePage
        ? moveDrawingSection(current, membership.sectionId, "last")
        : moveSheetToSectionEnd(current, sheetId);
    });
  };

  const moveSectionFromLoader = (
    sectionId: string,
    direction: DrawingSectionMoveDirection
  ) => {
    commitModel((current) =>
      moveDrawingSection(current, sectionId, direction)
    );
    setMessage("Section moved with all of its sheets.");
  };

  const moveSheetToSection = (
    sheetId: string,
    targetSectionId: string | "front_matter"
  ) => {
    commitModel((current) =>
      moveSheetToDrawingSection(current, sheetId, targetSectionId)
    );
    setMessage("Sheet moved to the selected section.");
  };

  const requestDeleteSheet = (sheetId: string) => {
    setSheetDeleteCandidateId(sheetId);
  };

  const deleteSheet = (sheetId: string) => {
    const sectionIndex = buildDrawingSectionIndex(model);
    const section = sectionIndex.sections.find(
      (candidate) => candidate.id === sheetId
    );
    const result = section
      ? (() => {
          const nextModel = removeSectionDivider(model, sheetId);
          const removedIndex = model.sheets.findIndex(
            (candidate) => candidate.id === sheetId
          );
          const activeSheetId =
            section.memberSheetIds[0] ??
            nextModel.sheets[Math.min(removedIndex, nextModel.sheets.length - 1)]
              ?.id ??
            nextModel.sheets[0].id;

          return { model: nextModel, activeSheetId };
        })()
      : deleteSheetCommand(model, sheetId);
    const activeSheet = result.model.sheets.find(
      (candidate) => candidate.id === result.activeSheetId
    );

    setSheetDeleteCandidateId(null);
    commitModel(result.model);
    setActiveSheet(result.activeSheetId);
    clearActiveSheetSelection();

    if (activeSheet) {
      setViewportCenter({
        x: activeSheet.page.width / 2,
        y: activeSheet.page.height / 2
      });
    }
  };

  const recoverConnectionRoute = (connectionId: string) => {
    updateActiveSheet((current) => {
      const connection = current.connections.find(
        (candidate) => candidate.id === connectionId
      );
      if (!connection?.route) {
        return current;
      }

      return updateConnectionRouteCommand(current, connectionId, {
        ...bringConnectionRouteOntoSheet({
          route: connection.route,
          sheet: current.sheet
        }),
        mode: "manual"
      });
    });
    setMessage("Route brought back inside the sheet.");
  };

  const openAddSheetFromLoader = () => {
    setIsSheetLoaderOpen(false);
    setIsAddSheetOpen(true);
  };

  const requestDeleteSheetFromLoader = (sheetId: string) => {
    setIsSheetLoaderOpen(false);
    requestDeleteSheet(sheetId);
  };

  const save = () => {
    const revisionToSave = editRevision;
    setIsSaving(true);
    startTransition(async () => {
      try {
        const modelToSave = normalizeCanvasModel(model, symbols);
        const result = await saveDrawingAction({
          drawingId: drawing.id,
          title,
          model: modelToSave,
          expectedUpdatedAt: serverUpdatedAt
        });

        if (!result.ok) {
          if (result.code === "conflict") {
            setSaveConflict({ latestUpdatedAt: result.latestUpdatedAt });
          }
          setMessage(result.error);
          return;
        }

        setServerUpdatedAt(result.data.updatedAt);
        setSavedRevision(revisionToSave);
        setMessage("Drawing saved.");
        // Keep the completed save transition local. Refreshing the route here can
        // leave large drawing canvases suspended with the entire toolbar disabled.
      } finally {
        setIsSaving(false);
      }
    });
  };

  const applyDrawingSettings = (settings: DrawingSettingsDraft) => {
    setTitle(settings.title);
    commitModel(
      (current) => ({
        ...updatePackageTitleBlock(current, settings.titleBlock),
        measurementUnit: settings.measurementUnit
      }),
      { coalesceKey: "drawing-settings" }
    );
    closeLocalDialog(
      setIsDrawingSettingsOpen,
      drawingSettingsReturnFocusRef
    );
    setMessage("Drawing settings updated. Use Save to persist the changes.");
  };

  const applySheetSettings = (settings: SheetSettingsDraft) => {
    const currentPanelAssetId = activeSheet.panelDrawingContext?.panelAssetId;
    const nextPanelAssetId = settings.panelAssetId;
    const panelContextResult =
      nextPanelAssetId && nextPanelAssetId !== currentPanelAssetId
        ? updateDetailedPanelDrawingContext(panelWiringSource, {
            sheetId: resolvedActiveSheetId,
            panelAssetId: nextPanelAssetId
          })
        : undefined;
    const blockingPanelIssue = panelContextResult?.warnings.find(
      (warning) => warning.severity === "error"
    );

    if (blockingPanelIssue) {
      setMessage(blockingPanelIssue.message);
      return;
    }

    commitModel(
      (current) => {
        let next = updateSheetMetadata(current, resolvedActiveSheetId, {
          name: settings.name,
          description: settings.description
        });

        if (settings.sectionTitlePage) {
          next = updateSectionTitlePage(
            next,
            resolvedActiveSheetId,
            settings.sectionTitlePage
          );
        }

        if (settings.targetSectionId) {
          next = moveSheetToDrawingSection(
            next,
            resolvedActiveSheetId,
            settings.targetSectionId
          );
        }

        if (panelContextResult) {
          next = applyPanelWiringMutations(next, panelContextResult.mutations);
        }

        return next;
      },
      { coalesceKey: `sheet-settings:${resolvedActiveSheetId}` }
    );
    closeLocalDialog(setIsSheetSettingsOpen, sheetSettingsReturnFocusRef);
    setMessage("Sheet settings updated. Use Save to persist the changes.");
  };

  const startPanelPatternFromWorkbench = () => {
    setIsPanelDiscoveryOpen(false);
    setIsSymbolsCollapsed(false);
    startPanelPatternAuthoring();
  };

  const navigateFromPanelFinding = (finding: PanelDrawingQualityFinding) => {
    const target = navigateToPanelFinding(finding);
    if (!target) {
      setMessage("This finding has no drawing object to navigate to.");
      return;
    }
    setPanelReviewAssetId(finding.panelAssetId);
    setIsPanelReviewOpen(false);
    if (target.kind === "work_queue") {
      const detailSheet = model.sheets.find(
        (sheet) =>
          sheet.panelDrawingContext?.panelAssetId === target.panelAssetId
      );
      if (detailSheet && detailSheet.id !== resolvedActiveSheetId) {
        selectSheet(detailSheet.id);
      }
      setPanelDiscoveryInitialTab(target.tab);
      setPanelDiscoveryFocusId(target.objectId ?? null);
      setIsPanelDiscoveryOpen(true);
      setMessage(
        "Panel Engineering Workbench opened at the related engineering records."
      );
      return;
    }
    const { location } = target;
    if (location.sheetId !== resolvedActiveSheetId) {
      selectSheet(location.sheetId);
    }
    if (location.objectKind === "placement" && location.objectId) {
      setSelection({
        placementIds: [location.objectId],
        annotationIds: []
      });
      setSelectedConnectionId(undefined);
    } else if (location.objectKind === "connection" && location.objectId) {
      setSelection({ ...EMPTY_CANVAS_SELECTION });
      setSelectedConnectionId(location.objectId);
    }
    setSheetFocusRequestKey((current) => current + 1);
    setMessage(`Loaded Sheet ${location.sheetNumber}: ${location.sheetName}.`);
  };

  const confirmPanelRepair = () => {
    if (!panelRepairFinding) return;
    try {
      const repaired = applyApprovedPanelRepair({
        model,
        symbols,
        finding: panelRepairFinding
      });
      if (repaired.modelChanged) {
        commitModel(repaired.model);
      }
      setPanelRepairFinding(null);
      setMessage("Approved panel repair applied.");
    } catch (error) {
      setPanelRepairFinding(null);
      setMessage(
        error instanceof Error
          ? error.message
          : "The approved repair could not be applied."
      );
    }
  };

  const approve = () => {
    const revisionToSave = editRevision;
    startTransition(async () => {
      const modelToSave = normalizeCanvasModel(model, symbols);
      const result = await approveDrawingAction({
        drawingId: drawing.id,
        title,
        model: modelToSave,
        expectedUpdatedAt: serverUpdatedAt
      });

      if (!result.ok) {
        if (result.code === "conflict") {
          setSaveConflict({ latestUpdatedAt: result.latestUpdatedAt });
        }
        setMessage(result.error);
        return;
      }
      setServerUpdatedAt(result.data.drawing.updatedAt);
      setSavedRevision(revisionToSave);
      if (!result.data.approved) {
        const blocked = result.data.quality.firstBlockingFinding;
        const report = blocked
          ? result.data.quality.reports.find(
              (candidate) => candidate.panelAssetId === blocked.panelAssetId
            )
          : undefined;
        const detailSheet = report
          ? model.sheets.find(
              (sheet) =>
                sheet.panelDrawingContext?.panelAssetId === report.panelAssetId
            )
          : undefined;
        if (detailSheet && detailSheet.id !== resolvedActiveSheetId) {
          selectSheet(detailSheet.id);
        }
        if (report) {
          setPanelReviewAssetId(report.panelAssetId);
          setIsPanelReviewOpen(true);
        }
        setMessage(
          `Approval blocked by ${result.data.quality.counts.blockingErrors} panel drawing error${result.data.quality.counts.blockingErrors === 1 ? "" : "s"}.`
        );
        router.refresh();
        return;
      }

      setMessage(
        result.data.quality.counts.warnings > 0
          ? `Drawing approved with ${result.data.quality.counts.warnings} warning${result.data.quality.counts.warnings === 1 ? "" : "s"}.`
          : "Drawing approved."
      );
      router.refresh();
    });
  };

  const previewPdfHref = `/drawings/${drawing.id}/pdf`;

  const downloadLocalDrawingCopy = () => {
    const payload = JSON.stringify(
      {
        drawingId: drawing.id,
        drawingKey: drawing.drawingKey,
        title,
        basedOnUpdatedAt: serverUpdatedAt,
        exportedAt: new Date().toISOString(),
        model
      },
      null,
      2
    );
    const url = URL.createObjectURL(
      new Blob([payload], { type: "application/json;charset=utf-8" })
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${drawing.drawingKey || "drawing"}-local-recovery.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const openPackagePreview = () => {
    cancelModelHistoryTransaction();
    setConnectionMode("idle");
    setConnectionDraft({});
    clearConnectionInspections();
    restorePropertiesAfterWireMode();
    setSelectedConnectionId(undefined);
    setDragState(null);
    setIsSheetLoaderOpen(false);
    setIsAddSheetOpen(false);
    setIsAddPanelOpen(false);
    setIsAddTerminalBlockOpen(false);
    setIsTerminalBlockGroupOpen(false);
    setIsBackplanePanelPickerOpen(false);
    setIsPanelDiscoveryOpen(false);
    setPendingSymbol(null);
    setPendingInternalWire(null);
    setInternalWireDeleteCandidate(null);
    setPanelPatternDraft(null);
    setPendingPanelPatternReview(null);
    setPanelPatternDeleteId(null);
    setIsPanelReviewOpen(false);
    setPanelRepairFinding(null);
    setViewMode("preview");
  };

  return (
    <div className="space-y-5">
      {isDrawingSettingsOpen ? (
        <DrawingSettingsDialog
          drawingTitle={title}
          titleBlock={model.titleBlock}
          measurementUnit={model.measurementUnit}
          onCancel={() =>
            closeLocalDialog(
              setIsDrawingSettingsOpen,
              drawingSettingsReturnFocusRef
            )
          }
          onApply={applyDrawingSettings}
        />
      ) : null}
      {isSheetSettingsOpen ? (
        <SheetSettingsDialog
          key={activeSheet.id}
          sheet={activeSheet}
          sheetNumber={activeSheetNumber}
          sheetCount={model.sheets.length}
          sectionLabel={activeSectionLabel}
          sectionMoveOptions={activeSectionMoveOptions}
          showPanelContext={isDetailedPanelDrawing}
          panelOptions={compatiblePanelOptions}
          panelContextWarning={detailedPanelContextWarning}
          onCancel={() =>
            closeLocalDialog(
              setIsSheetSettingsOpen,
              sheetSettingsReturnFocusRef
            )
          }
          onApply={applySheetSettings}
        />
      ) : null}
      {isConnectionsOpen ? (
        <ConnectionsDialog
          model={activeSheetCanvasModel}
          packageModel={model}
          symbols={symbols}
          selectedConnectionId={selectedConnectionId}
          onCancel={() =>
            closeLocalDialog(setIsConnectionsOpen, connectionsReturnFocusRef)
          }
          onSelect={(connectionId) => {
            selectConnection(connectionId);
            closeLocalDialog(
              setIsConnectionsOpen,
              connectionsReturnFocusRef
            );
          }}
        />
      ) : null}
      {saveConflict ? (
        <DrawingSaveConflictDialog
          latestUpdatedAt={saveConflict.latestUpdatedAt}
          onDownloadLocalCopy={downloadLocalDrawingCopy}
          onReloadLatest={() => window.location.reload()}
          onCancel={() => setSaveConflict(null)}
        />
      ) : null}
      {pendingSymbol ? (
        <AddSymbolAssetDialog
          symbol={pendingSymbol}
          model={model}
          symbols={symbols}
          onCancel={() => setPendingSymbol(null)}
          onPlace={(submission) =>
            isPanelLayoutLibrarySymbol(submission.symbol)
              ? addLayoutSymbol(submission.symbol, submission)
              : addSymbol(submission)
          }
        />
      ) : null}
      {isAddPanelOpen ? (
        <AddPanelEnclosureDialog
          model={model}
          onCancel={() => setIsAddPanelOpen(false)}
          onPlace={addPanel}
        />
      ) : null}
      {isAddTerminalBlockOpen ? (
        <TerminalStripBuilder
          model={model}
          activeSheetModel={activeSheetCanvasModel}
          symbols={symbols}
          onCancel={() => setIsAddTerminalBlockOpen(false)}
          onSubmit={submitTerminalStrip}
        />
      ) : null}
      {isBackplanePanelPickerOpen ? (
        <BackplanePanelPickerDialog
          panels={visibleSheetContainers.map((container) => container.placement)}
          onCancel={() => setIsBackplanePanelPickerOpen(false)}
          onSelect={placeBackplaneInPanel}
        />
      ) : null}
      {isAddSheetOpen ? (
        <AddSheetDialog
          nextSheetNumber={model.sheets.length + 1}
          nextSectionNumber={(activeDrawingSection?.number ?? 0) + 1}
          panelOptions={compatiblePanelOptions}
          allowDetailedPanel={detailedPanelDrawingsEnabled}
          suggestedPanelTag={allocateNextManagedAssetTag(model, "panel")}
          suggestedJunctionBoxTag={allocateNextManagedAssetTag(
            model,
            "junction_box"
          )}
          onCancel={() => setIsAddSheetOpen(false)}
          onAdd={addSheet}
        />
      ) : null}
      {isSheetLoaderOpen ? (
        <SheetLoaderDialog
          groups={sheetLoaderGroups}
          activeSheetId={resolvedActiveSheetId}
          onCancel={() => setIsSheetLoaderOpen(false)}
          onAddSheet={openAddSheetFromLoader}
          onLoadSheet={loadSheetFromDialog}
          onMoveSection={moveSectionFromLoader}
          onMoveSheet={moveSheet}
          onMoveSheetToEnd={moveSheetToEnd}
          onMoveSheetToSection={moveSheetToSection}
          onRequestDeleteSheet={requestDeleteSheetFromLoader}
        />
      ) : null}
      {sheetDeleteCandidate ? (
        <DeleteSheetConfirmationDialog
          sheetName={sheetDeleteCandidate.name}
          sheetNumber={sheetDeleteCandidateNumber}
          sheetCount={model.sheets.length}
          sectionMemberCount={
            sheetDeleteSection && sheetDeleteSection.memberSheetIds.length > 0
              ? sheetDeleteSection.memberSheetIds.length
              : undefined
          }
          sectionMergeDestination={
            sheetDeleteSection && sheetDeleteSection.memberSheetIds.length > 0
              ? sheetDeleteMergeDestination
              : undefined
          }
          onCancel={() => setSheetDeleteCandidateId(null)}
          onConfirm={() => deleteSheet(sheetDeleteCandidate.id)}
        />
      ) : null}
      {assetLinkDialogState && assetLinkPlacement ? (
        <AssetLinkDialog
          placement={assetLinkPlacement}
          activeSheetId={resolvedActiveSheetId}
          packageModel={model}
          symbols={symbols}
          initialMode={assetLinkDialogState.initialMode}
          allowCreate={!isDetailedPanelDrawing}
          panelAssetId={
            isDetailedPanelDrawing
              ? activeSheet.panelDrawingContext?.panelAssetId
              : undefined
          }
          proposedTag={
            isDetailedPanelDrawing
              ? (() => {
                  const symbol = symbols.find(
                    (candidate) =>
                      candidate.symbolId === assetLinkPlacement.symbolId &&
                      candidate.versionId === assetLinkPlacement.versionId
                  );
                  return symbol?.metadata.panelWiring
                    ? allocateNextTagFromPrefix({
                        model,
                        prefix: symbol.metadata.panelWiring.tagPrefix
                      })
                    : undefined;
                })()
              : undefined
          }
          onCancel={() => setAssetLinkDialogState(null)}
          onCreateNewAsset={createNewAssetLink}
          onReferenceExisting={referenceExistingAssetLink}
        />
      ) : null}
      {isAssetManagerOpen ? (
        <AssetManagerDialog
          model={model}
          symbols={symbols}
          initialAssetId={assetManagerInitialAssetId ?? undefined}
          onCancel={() => {
            setIsAssetManagerOpen(false);
            setAssetManagerInitialAssetId(null);
          }}
          onCreateAsset={createAssetManagerAsset}
          onUpdateAsset={updateAssetManagerAsset}
          onLoadSheet={loadSheetFromAssetManager}
          onDeleteAsset={deleteAssetManagerAsset}
        />
      ) : null}
      {isTerminalBlockGroupOpen ? (
        <TerminalStripBuilder
          model={model}
          activeSheetModel={activeSheetCanvasModel}
          symbols={symbols}
          preferredBackplaneId={activeAssociatedBackplane?.id}
          requireBackplane
          onCancel={() => setIsTerminalBlockGroupOpen(false)}
          onSubmit={submitTerminalStrip}
        />
      ) : null}
      {pendingInternalWire && proposedInternalWireNumber ? (
        <InternalWireDialog
          from={{
            ref: pendingInternalWire.from.terminal,
            assetTag: pendingInternalWire.from.assetTag,
            label: `${pendingInternalWire.from.assetTag}:${pendingInternalWire.from.terminalLabel}`
          }}
          to={{
            ref: pendingInternalWire.to.terminal,
            assetTag: pendingInternalWire.to.assetTag,
            label: `${pendingInternalWire.to.assetTag}:${pendingInternalWire.to.terminalLabel}`
          }}
          wireNumber={proposedInternalWireNumber}
          initialDescription={previousInternalWireDescription}
          catalogEntries={wireCatalogEntries}
          onManageCatalog={openWireCatalog}
          onCancel={() => {
            const draft = pendingInternalWire;
            setPendingInternalWire(null);
            setConnectionMode("connecting");
            setConnectionDraft({
              from: draft
                ? {
                    placementId: draft.from.placementId,
                    anchorKey: draft.from.anchorKey
                  }
                : connectionDraft.from,
              waypoints: draft?.waypoints ?? connectionDraft.waypoints ?? [],
              snapState: {},
              alignmentFeedback: []
            });
            setConnectionHoverInspection(null);
            setMessage("Select another destination terminal or adjust the route.");
          }}
          onConfirm={createPendingInternalWire}
        />
      ) : null}
      {pendingPanelPatternReview ? (
        <PanelPatternReviewDialog
          result={pendingPanelPatternReview.result}
          memberLabels={pendingPanelPatternReview.memberLabels}
          onCancel={() => {
            setPendingPanelPatternReview(null);
            setConnectionMode("connecting");
            setMessage("Continue selecting pattern terminals or review again.");
          }}
          onConfirm={confirmPanelPattern}
        />
      ) : null}
      {isPanelDiscoveryOpen &&
      panelDiscoveryIndex &&
      panelConnectivityGraph &&
      detailedPanelContext ? (
        <PanelDiscoveryDialog
          index={panelDiscoveryIndex}
          graph={panelConnectivityGraph}
          panelLabel={`${detailedPanelContext.tag} / ${detailedPanelContext.title}`}
          activeSheetId={resolvedActiveSheetId}
          internalWires={panelInternalWires}
          connectionPatterns={panelConnectionPatterns}
          legacyWireCount={legacyWireUpgradePreview.rows.length}
          readOnly={detailedPanelReadOnly}
          initialTab={panelDiscoveryInitialTab}
          initialFocusId={panelDiscoveryFocusId ?? undefined}
          onCancel={() => setIsPanelDiscoveryOpen(false)}
          onPlaceAssets={placeDetailedPanelAssets}
          onSelectPlacement={selectDetailedPanelAsset}
          onRemovePlacement={removeDetailedPanelAsset}
          onMapTermination={mapDetailedPanelTermination}
          onResetTerminationMapping={
            resetDetailedPanelTerminationMapping
          }
          onSelectInternalWireRoute={selectDetailedPanelWireRoute}
          onAddInternalWireRoute={addDetailedPanelWireRoute}
          onDeleteInternalWire={requestInternalWireDelete}
          onManageWireCatalog={openWireCatalog}
          onUpgradeLegacyWires={() => setIsLegacyWireUpgradeOpen(true)}
          onSelectPatternRoute={selectDetailedPanelPatternRoute}
          onAddPatternRepresentation={addDetailedPanelPatternRoute}
          onRemovePatternRepresentation={removeDetailedPanelPatternRoute}
          onDeletePattern={setPanelPatternDeleteId}
          onCenterEquipment={centerDetailedPanelAssets}
          onStartPattern={startPanelPatternFromWorkbench}
        />
      ) : null}
      {editingTerminalStripAssetId ? (
        <TerminalStripBuilder
          model={model}
          activeSheetModel={activeSheetCanvasModel}
          symbols={symbols}
          editingAssetId={editingTerminalStripAssetId}
          onCancel={() => setEditingTerminalStripAssetId(null)}
          onSubmit={submitTerminalStrip}
        />
      ) : null}
      {terminalStripReuseSource ? (
        <TerminalStripReuseDialog
          model={model}
          symbols={symbols}
          sourceSheetId={terminalStripReuseSource.sheetId}
          sourcePlacementId={terminalStripReuseSource.placementId}
          onCancel={() => setTerminalStripReuseSource(null)}
          onSubmit={submitTerminalStripReuse}
        />
      ) : null}
      {isCopyTerminalBlockOpen ? (
        <TerminalStripCopyDialog
          model={model}
          symbols={symbols}
          targetSheetId={resolvedActiveSheetId}
          onCancel={() => setIsCopyTerminalBlockOpen(false)}
          onSubmit={submitDestinationTerminalStripCopy}
        />
      ) : null}
      {/* Defer the first mount; retain the instance afterward so closing keeps its draft. */}
      {hasRequestedWireCatalog ? (
        <WireCatalogManager
          open={isWireCatalogOpen}
          initialEntries={wireCatalogEntries}
          onClose={() => closeLocalDialog(setIsWireCatalogOpen, wireCatalogReturnFocusRef)}
          onEntriesUpdated={setWireCatalogEntries}
        />
      ) : null}
      {isLegacyWireUpgradeOpen ? (
        <LegacyWireIdentityUpgradeDialog
          preview={legacyWireUpgradePreview}
          onCancel={() => setIsLegacyWireUpgradeOpen(false)}
          onApply={() => {
            try {
              const mutations = upgradeLegacyWireIdentities(panelWiringSource);
              commitModel(applyPanelWiringMutations(model, mutations));
              setIsLegacyWireUpgradeOpen(false);
              setMessage(
                `${legacyWireUpgradePreview.rows.length} internal wire identifier${
                  legacyWireUpgradePreview.rows.length === 1 ? "" : "s"
                } upgraded.`
              );
            } catch (error) {
              setMessage(
                error instanceof Error
                  ? error.message
                  : "Wire identifiers could not be upgraded."
              );
            }
          }}
        />
      ) : null}
      {isPanelReviewOpen && panelQualityReport ? (
        <PanelDrawingReviewDialog
          report={panelQualityReport}
          isUpdating={panelReviewUpdating}
          onCancel={() => setIsPanelReviewOpen(false)}
          onNavigate={navigateFromPanelFinding}
          onRepair={setPanelRepairFinding}
        />
      ) : null}
      {panelRepairFinding ? (
        <PanelRepairConfirmationDialog
          finding={panelRepairFinding}
          onCancel={() => setPanelRepairFinding(null)}
          onConfirm={confirmPanelRepair}
        />
      ) : null}
      {internalWireDeleteCandidate && internalWireDeleteRecord ? (
        <InternalWireDeleteDialog
          wireId={internalWireDeleteRecord.wireId}
          canRemoveRoute={Boolean(internalWireDeleteCandidate.connectionId)}
          onCancel={() => setInternalWireDeleteCandidate(null)}
          onRemoveRoute={removeInternalWireRoute}
          onDeleteWire={deletePhysicalInternalWire}
        />
      ) : null}
      {panelPatternDeleteRecord ? (
        <PanelPatternDeleteDialog
          patternCode={panelPatternDeleteRecord.patternCode}
          canRemoveRepresentation={panelPatternDeleteRecord.routeOccurrences.some(
            (route) => route.sheetId === resolvedActiveSheetId
          )}
          ownedWireCount={panelPatternDeleteRecord.ownedWireIds.length}
          onCancel={() => setPanelPatternDeleteId(null)}
          onRemoveRepresentation={() =>
            removeDetailedPanelPatternRoute(panelPatternDeleteRecord.patternId)
          }
          onDeletePattern={() =>
            deletePhysicalPanelPattern(panelPatternDeleteRecord.patternId)
          }
        />
      ) : null}

      <DrawingPackageToolbar
        title={title}
        viewMode={viewMode}
        isDirty={editRevision !== savedRevision}
        isSaving={isSaving}
        isPending={isPending}
        readOnly={detailedPanelReadOnly}
        approveDisabled={
          !detailedPanelDrawingsEnabled && detailedPanelAssetIds.length > 0
        }
        onOpenAssetManager={() => {
          setAssetManagerInitialAssetId(selectedAssetManagerAssetId);
          setIsAssetManagerOpen(true);
        }}
        onOpenDrawingSettings={() =>
          openLocalDialog(
            setIsDrawingSettingsOpen,
            drawingSettingsReturnFocusRef
          )
        }
        onSave={save}
        onPackagePreview={openPackagePreview}
        previewPdfHref={previewPdfHref}
        onApprove={approve}
        onExitPreview={() => setViewMode("edit")}
      />

      {detailedPanelReadOnly ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-900">
          Detailed Panel Drawings are read-only in this deployment. Existing
          sheets, review data, Package Preview, and exports remain available.
        </div>
      ) : null}

      {viewMode === "preview" ? (
        <PackagePreviewSurface
          model={model}
          sectionIndex={drawingSectionIndex}
          drawingTitle={title}
          symbols={symbols}
          placementWireContextRowsBySheetId={
            placementWireContextDisplayIndex.rowsBySheetId
          }
          connectedWireScheduleProjections={connectedWireScheduleIndex}
          onExitPreview={() => setViewMode("edit")}
          previewPdfHref={previewPdfHref}
        />
      ) : (
        <div
          className={[
            "drawing-canvas-layout",
            isSymbolsCollapsed
              ? "drawing-canvas-layout-symbols-collapsed"
              : "",
            isPropertiesCollapsed
              ? "drawing-canvas-layout-properties-collapsed"
              : ""
          ].join(" ")}
        >
        <aside
          className={[
            "drawing-symbols-sidebar",
            isSymbolsCollapsed
              ? "drawing-symbols-sidebar-collapsed"
              : "drawing-symbols-sidebar-expanded"
          ].join(" ")}
          aria-label="Symbol library"
        >
          {isSymbolsCollapsed ? (
            <div
              className="tool-panel drawing-sidebar-rail"
              data-testid="drawing-symbols-rail"
            >
              <button
                type="button"
                className="sidebar-toggle"
                onClick={() => setIsSymbolsCollapsed(false)}
                aria-label="Expand symbol library panel"
                title="Expand symbol library panel"
              >
                <PanelLeftOpen aria-hidden="true" size={17} />
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {isDetailedPanelDrawing ? (
                <>
                <PanelDrawingSummary
                  context={detailedPanelContext}
                  warning={detailedPanelContextWarning}
                  discovery={panelDiscoveryIndex}
                  onOpenWorkQueue={
                    panelDiscoveryIndex
                      ? () => {
                          setPanelDiscoveryInitialTab("assets");
                          setPanelDiscoveryFocusId(null);
                          setIsPanelDiscoveryOpen(true);
                        }
                      : undefined
                  }
                  headerAction={
                    <button
                      type="button"
                      className="sidebar-toggle"
                      onClick={() => setIsSymbolsCollapsed(true)}
                      aria-label="Collapse panel drawing summary"
                      title="Collapse panel drawing summary"
                    >
                      <PanelLeftClose aria-hidden="true" size={17} />
                    </button>
                  }
                />
                {panelPatternDraft && !detailedPanelReadOnly ? (
                  <PanelPatternAuthoringPanel
                    topology={panelPatternDraft.topology}
                    domain={panelPatternDraft.domain}
                    targetDomain={panelPatternDraft.targetDomain}
                    targetMode={panelPatternDraft.targetMode}
                    stage={panelPatternDraft.stage}
                    selectedLabels={panelPatternSelectedLabels}
                    canReview={canReviewPanelPattern}
                    onTopologyChange={(topology) =>
                      setPanelPatternDraft((current) =>
                        current
                          ? {
                              ...current,
                              topology,
                              targetDomain:
                                topology === "protective_earth" ||
                                topology === "signal_ground"
                                  ? topology
                                  : current.targetDomain,
                              selected: [],
                              stage: "configure"
                            }
                          : current
                      )
                    }
                    onDomainChange={(domain) =>
                      setPanelPatternDraft((current) =>
                        current ? { ...current, domain } : current
                      )
                    }
                    onTargetDomainChange={(targetDomain) =>
                      setPanelPatternDraft((current) =>
                        current ? { ...current, targetDomain } : current
                      )
                    }
                    onTargetModeChange={(targetMode) =>
                      setPanelPatternDraft((current) =>
                        current
                          ? { ...current, targetMode, selected: [], stage: "configure" }
                          : current
                      )
                    }
                    onStartSelecting={() => {
                      setPanelPatternDraft((current) =>
                        current
                          ? { ...current, stage: "selecting", selected: [] }
                          : current
                      );
                      setConnectionMode("connecting");
                      setConnectionDraft({});
                      setMessage("Select the first pattern terminal.");
                    }}
                    onReview={reviewPanelPattern}
                    onRemoveLast={() =>
                      setPanelPatternDraft((current) =>
                        current
                          ? { ...current, selected: current.selected.slice(0, -1) }
                          : current
                      )
                    }
                    onCancel={cancelPanelPatternAuthoring}
                  />
                ) : null}
                </>
              ) : (
                <>
                  <SymbolLibraryPanel
                    symbols={symbols}
                    context={symbolLibraryContext}
                    headerAction={
                      <button
                        type="button"
                        className="sidebar-toggle"
                        onClick={() => setIsSymbolsCollapsed(true)}
                        aria-label="Collapse symbol library panel"
                        title="Collapse symbol library panel"
                      >
                        <PanelLeftClose aria-hidden="true" size={17} />
                      </button>
                    }
                    onAddSymbol={addSymbolFromLibrary}
                  />
                  {activeAssociatedPanelLabel ? (
                    <PanelAssociatedAssetsSection
                      panelLabel={activeAssociatedPanelLabel}
                      targetKind={activeAssociatedTarget?.kind}
                      items={associatedPanelAssets}
                      onPlaceAsset={placeAssociatedPanelAsset}
                    />
                  ) : null}
                </>
              )}
            </div>
          )}
        </aside>
        <SvgDrawingSurface
          model={gesturePreviewModel ?? model}
          sectionIndex={drawingSectionIndex}
          drawingTitle={title}
          workspaceContext={activeSheetPresentation.workspaceContext}
          activeSheetId={resolvedActiveSheetId}
          focusSheetRequestKey={sheetFocusRequestKey}
          symbols={symbols}
          placementWireContextRows={
            placementWireContextDisplayIndex.rowsBySheetId.get(
              resolvedActiveSheetId
            ) ?? []
          }
          connectedWireScheduleProjections={connectedWireScheduleIndex}
          selection={selection}
          selectedPlacementId={selectedPlacementId}
          viewportTransform={viewportTransform}
          viewportCenter={viewportCenter}
          setViewportTransform={setViewportTransform}
          dragState={dragState}
          onOpenSheetLoader={() => setIsSheetLoaderOpen(true)}
          onEditActiveSheet={() =>
            openLocalDialog(
              setIsSheetSettingsOpen,
              sheetSettingsReturnFocusRef
            )
          }
          onOpenConnections={() =>
            openLocalDialog(setIsConnectionsOpen, connectionsReturnFocusRef)
          }
          onAddPanel={() => setIsAddPanelOpen(true)}
          onAddTerminalBlock={() => setIsAddTerminalBlockOpen(true)}
          onCopyTerminalBlock={() => setIsCopyTerminalBlockOpen(true)}
          onAddNote={addNote}
          onAddConnectedWireSchedule={addConnectedWireSchedule}
          canAddConnectedWireSchedule={Boolean(selectedScheduleSource)}
          toolbarDisabled={isPending}
          readOnly={detailedPanelReadOnly}
          showConnectAction={
            !isDetailedPanelDrawing || !detailedPanelReadOnly
          }
          connectLabel={isDetailedPanelDrawing ? "Wire" : "Connect"}
          connectActive={
            connectionMode === "connecting" && !panelPatternDraft
          }
          onToggleConnect={toggleConnectMode}
          showPatternAction={
            isDetailedPanelDrawing && !detailedPanelReadOnly
          }
          patternActive={Boolean(panelPatternDraft)}
          onTogglePattern={
            panelPatternDraft
              ? cancelPanelPatternAuthoring
              : startPanelPatternAuthoring
          }
          onSelectPlacement={selectPlacement}
          onSelectionChange={replaceSelection}
          onPlacementChange={updatePlacement}
          onSelectionMove={moveSelection}
          onPlacementRemove={removePlacement}
          onSelectionRemove={removeSelection}
          selectedAnnotationId={selectedAnnotationId}
          onAnnotationSelect={selectAnnotation}
          onAnnotationChange={updateAnnotation}
          onAnnotationGroupChange={updateAnnotationGroup}
          onDragStart={setDragState}
          onDragMove={previewSelectionDrag}
          onDragEnd={commitSelectionDrag}
          onGestureStart={beginModelHistoryTransaction}
          onGestureEnd={endModelHistoryTransaction}
          onGestureCancel={cancelModelHistoryTransaction}
          onCopySelection={copySelection}
          onPasteSelection={pasteSelection}
          onUndo={undo}
          onRedo={redo}
          connectionMode={connectionMode}
          connectionDraft={
            pendingInternalWire
              ? {
                  from: {
                    placementId: pendingInternalWire.from.placementId,
                    anchorKey: pendingInternalWire.from.anchorKey
                  },
                  hoveredDestination: {
                    placementId: pendingInternalWire.to.placementId,
                    anchorKey: pendingInternalWire.to.anchorKey
                  },
                  waypoints: pendingInternalWire.waypoints,
                  alignmentFeedback: []
                }
              : connectionDraft
          }
          enableGuidedConnectionRouting={!panelPatternDraft}
          selectedConnectionId={selectedConnectionId}
          onConnectionAnchorClick={handleConnectionAnchorClick}
          onConnectionAnchorHover={handleConnectionAnchorHover}
          onConnectionAnchorInspectionChange={
            handleConnectionAnchorInspectionChange
          }
          onConnectionPointerMove={handleConnectionPointerMove}
          onConnectionWaypointAdd={handleConnectionWaypointAdd}
          onConnectionWaypointRemove={removeLastConnectionWaypoint}
          onConnectionSelect={selectConnection}
          onConnectionRouteChange={updateConnectionRoute}
          onConnectionRemove={removeConnection}
          onConnectionCancel={cancelConnectionAuthoring}
          getConnectionAnchorState={getConnectionAnchorState}
          onViewportCenterChange={setViewportCenter}
          statusMessage={message}
        />
        <aside
          className={[
            "drawing-properties-sidebar",
            isPropertiesCollapsed
              ? "drawing-properties-sidebar-collapsed"
              : "drawing-properties-sidebar-expanded"
          ].join(" ")}
          aria-label="Drawing properties"
        >
          {isPropertiesCollapsed ? (
            <div
              className="tool-panel drawing-sidebar-rail"
              data-testid="drawing-properties-rail"
            >
              <button
                type="button"
                className="sidebar-toggle"
                onClick={() => setIsPropertiesCollapsed(false)}
                aria-label="Expand drawing properties panel"
                title="Expand drawing properties panel"
              >
                <PanelRightOpen aria-hidden="true" size={17} />
              </button>
            </div>
          ) : (
            <div
              className="drawing-properties-scroll-region"
              data-testid="drawing-properties-scroll-region"
              aria-label="Drawing properties editor"
              tabIndex={0}
            >
              {isDetailedPanelDrawing &&
              connectionDraft.from &&
              connectionSourceInspection ? (
                <ConnectionEndpointInspector
                  source={connectionSourceInspection}
                  hovered={connectionHoverInspection ?? undefined}
                />
              ) : null}
              <fieldset
                disabled={detailedPanelReadOnly}
                className="min-w-0 border-0 p-0 disabled:opacity-75"
              >
              <DrawingObjectInspector
              model={activeSheetCanvasModel}
              packageModel={model}
              activeSheet={activeSheet}
              symbols={activeSheetRenderableSymbols}
              measurementUnit={model.measurementUnit}
              headerAction={
                <button
                  type="button"
                  className="sidebar-toggle"
                  onClick={() => setIsPropertiesCollapsed(true)}
                  aria-label="Collapse drawing properties panel"
                  title="Collapse drawing properties panel"
                >
                  <PanelRightClose aria-hidden="true" size={17} />
                </button>
              }
              selection={selection}
              onArrangeSelection={arrangeSelection}
              onAssetChange={updateSelectedAsset}
              onOpenAssetLinkDialog={openAssetLinkDialog}
              onPlacementChange={updatePlacement}
              onConnectionDisplayModeChange={updateConnectionDisplayMode}
              onFitPanelConnectionView={fitPanelConnectionView}
              placementWireContextSummary={
                selectedPlacementId
                  ? placementWireContextDisplayIndex.summariesBySheetPlacement.get(
                      placementWireContextKey(
                        resolvedActiveSheetId,
                        selectedPlacementId
                      )
                    )
                  : undefined
              }
              terminalAvailabilitySummary={
                selectedTerminalAvailabilitySummary
              }
              connectedWireScheduleProjection={
                selectedAnnotationId
                  ? connectedWireScheduleIndex.get(selectedAnnotationId)
                  : undefined
              }
              onEditTerminalStrip={setEditingTerminalStripAssetId}
              onReuseTerminalStrip={(placementId) =>
                setTerminalStripReuseSource({
                  sheetId: resolvedActiveSheetId,
                  placementId
                })
              }
              onAssetComponentSelectionsChange={updateAssetComponentSelections}
              selectedConnectionId={selectedConnectionId}
              onConnectionChange={updateConnection}
              onConnectionRemove={removeConnection}
              onConnectionRouteRecover={recoverConnectionRoute}
              onConnectionRouteReset={resetConnectionRoute}
              onInternalWireChange={updateDetailedPanelInternalWire}
              wireCatalogEntries={wireCatalogEntries}
              onManageWireCatalog={openWireCatalog}
              onPanelPatternChange={updateDetailedPanelPattern}
              onPanelPatternLegendVisibilityChange={
                updatePanelPatternLegendVisibility
              }
              showConnections={!isDetailedPanelDrawing}
              onAnnotationChange={updateAnnotation}
              onAnnotationRemove={removeAnnotation}
              onConnectedWireScheduleSynchronize={
                synchronizeConnectedWireScheduleContinuations
              }
              onConnectedWireSchedulePaginationRemove={
                removeConnectedWireScheduleContinuations
              }
              onConnectedWireScheduleOpenPartOne={
                openConnectedWireSchedulePartOne
              }
              />
              </fieldset>
            </div>
          )}
        </aside>
        </div>
      )}
    </div>
  );
}

function BackplanePanelPickerDialog({
  panels,
  onCancel,
  onSelect
}: {
  panels: DrawingPlacement[];
  onCancel: () => void;
  onSelect: (panel: DrawingPlacement) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm">
      <div
        className="w-full max-w-lg overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="backplane-panel-picker-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2
              id="backplane-panel-picker-title"
              className="text-base font-bold text-slate-950"
            >
              Add Backplane
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Choose the visible panel that will contain this backplane.
            </p>
          </div>
          <button
            type="button"
            className="dialog-close"
            onClick={onCancel}
            aria-label="Close backplane panel picker"
          >
            <X aria-hidden="true" size={22} strokeWidth={2.25} />
          </button>
        </div>
        <div className="max-h-80 space-y-2 overflow-auto p-5">
          {panels.map((panel) => (
            <button
              key={panel.id}
              type="button"
              className="w-full rounded-md border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-teal-200 hover:bg-teal-50"
              onClick={() => onSelect(panel)}
            >
              <span className="block text-sm font-bold text-slate-950">
                {panel.tag}
              </span>
              <span className="mt-0.5 block text-xs font-medium text-slate-500">
                {getPanelEnclosureTitle(panel)}
              </span>
            </button>
          ))}
        </div>
        <div className="flex justify-end border-t border-slate-200 px-5 py-4">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
