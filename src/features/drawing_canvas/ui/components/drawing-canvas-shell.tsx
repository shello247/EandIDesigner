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
import {
  Cable,
  CheckCircle2,
  Eye,
  FileDown,
  FileSpreadsheet,
  Link2,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  PackageSearch,
  Save,
  ShieldCheck,
  StickyNote
} from "lucide-react";
import type { SymbolBomTemplateDetail } from "@/features/bom_creator/types";
import { loadPanelBomTemplatesAction } from "@/features/drawing_panel_reports/api/actions";
import type { PanelReportTraceRef } from "@/features/drawing_panel_reports/api/public";
import type {
  DrawingAnnotation,
  DrawingConnection,
  DrawingConnectionRoute,
  DrawingEndpoint,
  DrawingModel,
  DrawingPlacement,
  DrawingSheetCanvasModel
} from "../../data/schema";
import type { ApprovedDrawingSymbol, DrawingDetail } from "../../types";
import {
  approveDrawingAction,
  saveDrawingAction
} from "../../api/actions";
import {
  getSheetTemplateAction,
  listSheetTemplatesAction,
  saveSheetTemplateAction
} from "@/features/drawing_sheet_templates/api/actions";
import {
  instantiateTemplateSheet,
  type TemplateAssetResolutionChoice
} from "@/features/drawing_sheet_templates/logic/use_cases/drawing-sheet-template-use-cases";
import type {
  DrawingSheetTemplateDetail,
  DrawingSheetTemplateListItem
} from "@/features/drawing_sheet_templates/types";
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
  createAndPlaceTerminalBlockGroup,
  updateTerminalBlockGroup
} from "../../logic/commands/drawing-terminal-block-group-commands";
import {
  centerDetailedPanelEquipment,
  placePanelAssetOccurrence,
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
  buildPanelExternalTerminationDisplayIndex,
  buildPanelGuidedWorkflowSnapshot,
  buildPanelInternalWireEndpointCatalog,
  buildPanelQualityIndex,
  allocateInternalWireId,
  createDistributionGroup,
  createEarthTermination,
  createShieldTermination,
  createTerminalJumper,
  getDetailedPanelDrawingContext,
  getPanelWireSettings,
  getTerminalSideOccupancy,
  mapExternalTerminationToTerminal,
  resetExternalTerminationMapping,
  runPackagePanelDrawingQualityChecks,
  runPanelDrawingQualityChecks,
  updatePanelWireSettings,
  updatePanelConnectionPattern,
  updatePanelWorkflowFocus,
  validateInternalWireEndpoints,
  updateDetailedPanelDrawingContext,
  validatePanelDrawingContext,
  type PanelDrawingQualityFinding,
  type PanelExternalTerminationDisplayRow,
  type PanelGuidedWorkflowSnapshot,
  type PanelInternalWireEndpointCatalog,
  type PanelElectricalDomain,
  type PanelPatternCommandResult,
  type PanelTerminalSideRef,
  type PanelWireAttributes,
  type PanelWireSettings
} from "@/features/drawing_panel_wiring/api/public";
import {
  InternalWireDeleteDialog,
  InternalWireDialog,
  type InternalWireDialogSubmission,
  type PanelInternalWireFormResult,
  type PanelInternalWireFormSubmission,
  PanelDrawingContextEditor,
  PanelDrawingSummary,
  PanelPatternAuthoringPanel,
  PanelPatternDeleteDialog,
  PanelPatternReviewDialog,
  PanelRepairConfirmationDialog,
  type PanelPatternAuthoringStage,
  type PanelPatternAuthoringTopology
} from "@/features/drawing_panel_wiring/ui/public";
import { generateDefaultOrthogonalRoute } from "../../logic/services/connection-route-geometry";
import {
  clampPointToSheet,
  createDefaultNoteAnnotation
} from "../../logic/services/drawing-annotations";
import {
  allocateNextPackageTag,
  allocateNextTagFromPrefix,
  createDrawingAssetId,
  defaultPlacementScale,
  roleFromSymbol,
  renameDrawingAssetTag
} from "../../logic/services/drawing-asset-identity";
import {
  assignPlacementToContainer,
  clearPlacementContainer,
  createPanelEnclosurePlacement,
  getPanelEnclosureTitle,
  getVisibleSheetContainers,
  updatePanelEnclosureTitle
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
import { measureDrawingOperation } from "../../logic/services/drawing-performance-diagnostics";
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
  AddTerminalBlockDialog,
  type AddTerminalBlockSubmission
} from "./add-terminal-block-dialog";
import {
  TerminalBlockGroupDialog,
  type TerminalBlockGroupDialogSubmission
} from "./terminal-block-group-dialog";
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
import { DuplicateSheetWizardDialog } from "./duplicate-sheet-wizard-dialog";
import {
  AddSheetTemplateDialog
} from "@/features/drawing_sheet_templates/ui/components/add-sheet-template-dialog";
import {
  allocateNextManagedAssetTag,
  createManagedAsset,
  deleteManagedAsset,
  reconcileDrawingAssets,
  updateManagedAsset
} from "@/features/drawing_asset_manager/logic/use_cases/drawing-asset-manager-use-cases";
import type {
  ManagedAssetCreateInput,
  ManagedAssetUpdateInput
} from "@/features/drawing_asset_manager/data/schema";

import { PlacementPropertiesPanel } from "./placement-properties-panel";
import { PackagePreviewSurface } from "./package-preview-surface";
import {
  SaveSheetTemplateDialog,
  type SaveSheetTemplateForm
} from "@/features/drawing_sheet_templates/ui/components/save-sheet-template-dialog";
import { SvgDrawingSurface } from "./svg-drawing-surface";
import { SymbolLibraryPanel } from "./symbol-library-panel";
import {
  buildAssociatedPanelAssetCatalog,
  placeAssociatedPanelAssetOnBackplane
} from "@/features/drawing_panel_asset_placement/logic/services/panel-associated-assets";
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
import { createTerminalBlockPlacement } from "../../logic/services/drawing-terminal-blocks";
import { isGeneratedTerminalBlockGroupLibrarySymbolReference } from "../../logic/services/drawing-terminal-block-groups";
import { isTerminalBlockModuleSymbol } from "@/features/drawing_terminal_blocks/logic/services/terminal-block-groups";
import {
  createNewAssetFromPlacement,
  relinkPlacementsToExistingAsset,
  type DrawingAssetPlacementTarget
} from "../../logic/services/drawing-asset-resolution";
import {
  applySheetDuplicatePlan,
  type SheetDuplicatePlan
} from "../../logic/services/drawing-sheet-duplication";
import type { TerminalBlockPlacement } from "@/features/drawing_terminal_blocks/types";

const PanelDeliverablesDialog = dynamic(
  () =>
    import("@/features/drawing_panel_reports/ui/public").then(
      (module) => module.PanelDeliverablesDialog
    ),
  {
    ssr: false,
    loading: () => <EngineeringDialogLoading label="Loading deliverables" />
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

type ConnectionDraft = {
  from?: DrawingEndpoint;
  pointer?: { x: number; y: number };
};

type PendingInternalWire = {
  from: PanelWireOccurrenceEndpoint;
  to: PanelWireOccurrenceEndpoint;
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
  return reconcileDrawingAssets(model, symbols);
}

export function DrawingCanvasShell({
  drawing,
  symbols,
  detailedPanelDrawingsEnabled = true
}: {
  drawing: DrawingDetail;
  symbols: ApprovedDrawingSymbol[];
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
  const [connectionDraft, setConnectionDraft] = useState<ConnectionDraft>({});
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
  const [message, setMessage] = useState<string | null>(null);
  const [pendingSymbol, setPendingSymbol] = useState<ApprovedDrawingSymbol | null>(
    null
  );
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [isSheetLoaderOpen, setIsSheetLoaderOpen] = useState(false);
  const [isAddPanelOpen, setIsAddPanelOpen] = useState(false);
  const [isAddTerminalBlockOpen, setIsAddTerminalBlockOpen] = useState(false);
  const [isTerminalBlockGroupOpen, setIsTerminalBlockGroupOpen] =
    useState(false);
  const [isBackplanePanelPickerOpen, setIsBackplanePanelPickerOpen] =
    useState(false);
  const [isAssetManagerOpen, setIsAssetManagerOpen] = useState(false);
  const [assetManagerInitialAssetId, setAssetManagerInitialAssetId] = useState<
    string | null
  >(null);
  const [isPanelDeliverablesOpen, setIsPanelDeliverablesOpen] = useState(false);
  const [panelBomTemplates, setPanelBomTemplates] = useState<
    SymbolBomTemplateDetail[]
  >([]);
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
  const [isSaveTemplateOpen, setIsSaveTemplateOpen] = useState(false);
  const [isTemplateLibraryOpen, setIsTemplateLibraryOpen] = useState(false);
  const [sheetDeleteCandidateId, setSheetDeleteCandidateId] = useState<
    string | null
  >(null);
  const [sheetDuplicateCandidateId, setSheetDuplicateCandidateId] = useState<
    string | null
  >(null);
  const [assetLinkDialogState, setAssetLinkDialogState] = useState<{
    placementId: string;
    initialMode: AssetLinkDialogMode;
  } | null>(null);
  const [templateList, setTemplateList] = useState<DrawingSheetTemplateListItem[]>(
    []
  );
  const [selectedTemplate, setSelectedTemplate] =
    useState<DrawingSheetTemplateDetail | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);
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
  const resolvedActiveSheetId = getActiveSheetId(model, activeSheetId);
  const activeSheetCanvasModel = useMemo(
    () => toSheetCanvasModel(model, resolvedActiveSheetId),
    [model, resolvedActiveSheetId]
  );
  const selectedPlacementId = primaryPlacementId(selection);
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
  const panelEngineeringSnapshot = useMemo(
    () =>
      isDetailedPanelDrawing ||
      viewMode === "preview" ||
      Boolean(panelReviewAssetId) ||
      isPanelDeliverablesOpen
        ? measureDrawingOperation(
            "panel.graph",
            () =>
              buildPanelEngineeringSnapshotFromValidatedSource(
                panelWiringSource,
                `edit:${editRevision}`
              ),
            {
              sheets: panelWiringSource.sheets.length,
              assets: panelWiringSource.assets.length
            }
          )
        : undefined,
    [
      editRevision,
      isDetailedPanelDrawing,
      isPanelDeliverablesOpen,
      panelReviewAssetId,
      panelWiringSource,
      viewMode
    ]
  );
  const panelConnectivityGraph = panelEngineeringSnapshot?.graph;
  const panelExternalTerminationDisplayIndex = useMemo<
    ReadonlyMap<string, PanelExternalTerminationDisplayRow[]>
  >(
    () =>
      panelConnectivityGraph
        ? buildPanelExternalTerminationDisplayIndex(panelConnectivityGraph)
        : new Map(),
    [panelConnectivityGraph]
  );
  const deferredPanelEngineeringSnapshot = useDeferredValue(
    panelEngineeringSnapshot
  );
  const panelQualityGraph = deferredPanelEngineeringSnapshot?.graph;
  const panelReviewUpdating =
    (isPanelReviewOpen || isPanelDeliverablesOpen) &&
    Boolean(panelEngineeringSnapshot) &&
    deferredPanelEngineeringSnapshot !== panelEngineeringSnapshot;
  const panelPackageQuality = useMemo(() => {
    if (!isPanelDeliverablesOpen || !panelQualityGraph) return undefined;
    return measureDrawingOperation(
      "panel.quality",
      () => runPackagePanelDrawingQualityChecks(panelQualityGraph),
      { scope: "package" }
    );
  }, [isPanelDeliverablesOpen, panelQualityGraph]);
  const panelQualityReport = useMemo(() => {
    if (
      (!isPanelReviewOpen && !isPanelDeliverablesOpen) ||
      !panelQualityGraph ||
      !effectivePanelReviewAssetId
    ) {
      return undefined;
    }
    const packageReport = panelPackageQuality?.reports.find(
      (report) => report.panelAssetId === effectivePanelReviewAssetId
    );
    if (packageReport) return packageReport;
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
    isPanelDeliverablesOpen,
    isPanelReviewOpen,
    panelPackageQuality,
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
  const panelGuidedWorkflow = useMemo<PanelGuidedWorkflowSnapshot | undefined>(
    () =>
      panelDiscoveryIndex && detailedPanelContext
        ? buildPanelGuidedWorkflowSnapshot({
            index: panelDiscoveryIndex,
            internalWires: panelInternalWires,
            connectionPatterns: panelConnectionPatterns,
            persistedFocusAssetId:
              detailedPanelContext.workflowFocusAssetId,
            qualityReport: panelQualityReport
          })
        : undefined,
    [
      detailedPanelContext,
      panelConnectionPatterns,
      panelDiscoveryIndex,
      panelInternalWires,
      panelQualityReport
    ]
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
  const panelWireSettings = useMemo(
    () =>
      detailedPanelContext
        ? getPanelWireSettings(
            panelWiringSource,
            detailedPanelContext.panelAssetId
          )
        : undefined,
    [detailedPanelContext, panelWiringSource]
  );
  const proposedInternalWire = useMemo(
    () =>
      detailedPanelContext
        ? allocateInternalWireId({
            source: panelWiringSource,
            panelAssetId: detailedPanelContext.panelAssetId
          })
        : undefined,
    [detailedPanelContext, panelWiringSource]
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
    (endpoint: DrawingEndpoint) => {
      if (!isDetailedPanelDrawing) {
        return { enabled: true };
      }
      const candidate = panelWireEndpointsByAnchorId.get(
        `${endpoint.placementId}:${endpoint.anchorKey}`
      );
      if (!candidate || !panelDiscoveryIndex) {
        return {
          enabled: false,
          reason: "Internal wiring requires a resolved internal or single terminal."
        };
      }
      const occupancy = getTerminalSideOccupancy(
        panelDiscoveryIndex.terminalCatalog,
        candidate.terminal
      );
      if (panelPatternDraft?.stage === "selecting") {
        const selectedKey = `${candidate.terminal.assetId}:${candidate.terminal.terminalKey}:${candidate.terminal.side}`;
        if (
          panelPatternDraft.selected.some(
            (entry) =>
              `${entry.terminal.assetId}:${entry.terminal.terminalKey}:${entry.terminal.side}` === selectedKey
          )
        ) {
          return { enabled: false, reason: "This terminal is already in the pattern." };
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
        if (allowedDomains?.length && !allowedDomains.includes(domain)) {
          return {
            enabled: false,
            reason: `This terminal does not allow the ${domain.replaceAll("_", " ")} domain.`
          };
        }
        const structural = [
          "terminal_jumper",
          "bridge_bar",
          "shield",
          "protective_earth",
          "signal_ground"
        ].includes(panelPatternDraft.topology);
        const status = structural
          ? occupancy?.structuralStatus
          : occupancy?.conductorStatus;
        const occupants = structural
          ? occupancy?.structuralOccupants
          : occupancy?.conductorOccupants;
        if (status && status !== "available") {
          return {
            enabled: false,
            reason:
              status === "conflicting"
                ? "This terminal has conflicting pattern occupancy."
                : `${occupants?.[0]?.label ?? "Another relationship"} already uses this terminal channel.`
          };
        }
        if (
          panelPatternDraft.topology === "fused_distribution" &&
          panelPatternDraft.selected.length >= 2 &&
          (panelPatternDraft.selected.length - 1) % 3 === 1
        ) {
          const input = panelPatternDraft.selected.at(-1);
          if (input && input.terminal.assetId !== candidate.terminal.assetId) {
            return {
              enabled: false,
              reason: "Protection input and output must belong to the same device."
            };
          }
        }
        return { enabled: true };
      }
      if (occupancy && occupancy.conductorStatus !== "available") {
        return {
          enabled: false,
          reason:
            occupancy.conductorStatus === "conflicting"
              ? "Terminal occupancy is conflicting."
              : `${occupancy.conductorOccupants[0]?.label ?? "Another connection"} already occupies this terminal.`
        };
      }
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
        return {
          enabled: false,
          reason: "A wire cannot connect both ends of the same logical terminal."
        };
      }
      if (source && panelConnectivityGraph) {
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
          return {
            enabled: false,
            reason: `${duplicate.wireId} already connects these terminals.`
          };
        }
      }
      return { enabled: true };
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
  const sheetDuplicateCandidate = sheetDuplicateCandidateId
    ? model.sheets.find((sheet) => sheet.id === sheetDuplicateCandidateId) ?? null
    : null;
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

        const nextModel = normalizeCanvasModel(rawNextModel, symbols);
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
            historyRef.current = pushDrawingHistoryEntry(
              historyRef.current,
              beforeEntry
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
      const nextModel = normalizeCanvasModel(result.model, symbols);
      historyRef.current = pushDrawingHistoryEntry(historyRef.current, entry);
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
      "canvas.sheet-load",
      () => selectSheet(sheetId),
      { fromSheetId: resolvedActiveSheetId, toSheetId: sheetId }
    );
    setIsSheetLoaderOpen(false);
    setSheetFocusRequestKey((current) => current + 1);
    setMessage("Sheet loaded.");
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
    containerAssetId
  }: AddSymbolAssetSubmission) => {
    const placement: DrawingPlacement = {
      id: `pl_${Date.now()}`,
      assetId,
      containerAssetId,
      symbolId: symbol.symbolId,
      versionId: symbol.versionId,
      role: roleFromSymbol(symbol),
      tag,
      x: 35 + activeSheetCanvasModel.placements.length * 18,
      y: 45 + activeSheetCanvasModel.placements.length * 12,
      rotation: 0,
      scale: defaultPlacementScale(symbol)
    };

    updateActiveSheet((current) => addPlacementCommand(current, placement));
    selectPlacement(placement.id);
    setSelectedConnectionId(undefined);
    setPendingSymbol(null);
  };

  const placeBackplaneInPanel = (panelPlacement: DrawingPlacement) => {
    const placement = createBackplanePlacement({ panelPlacement });

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
  const associatedPanelAssets = useMemo(
    () =>
      activeAssociatedBackplane?.containerAssetId
        ? buildAssociatedPanelAssetCatalog(
            model,
            symbols,
            activeAssociatedBackplane.containerAssetId,
            activeAssociatedBackplane.id
          )
        : [],
    [activeAssociatedBackplane, model, symbols]
  );

  const addLayoutSymbol = (symbol: ApprovedDrawingSymbol) => {
    if (isTerminalBlockModuleSymbol(symbol)) {
      setMessage(
        "Individual terminal modules cannot be placed. Use Terminal Block Group."
      );
      return;
    }

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
      symbol.category === "terminal_block" &&
      symbol.metadata.panelCategory === "termination";
    const createsPhysicalAsset = Boolean(
      isTerminalBlockLayoutSymbol || symbol.metadata.panelWiring
    );
    const tag = createsPhysicalAsset
      ? allocateNextPackageTag(model, symbol)
      : symbol.displayName;
    const placement = autosizeLayoutHelperToBackplane({
      backplane,
      symbol,
      sheet: activeSheetCanvasModel.sheet,
      placement: {
        id: placementId,
        ...(createsPhysicalAsset
          ? {
              assetId: createDrawingAssetId(placementId),
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

    updateActiveSheet((current) => addPlacementCommand(current, placement));
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
    if (!activeAssociatedBackplane) {
      setMessage("Add or select a backplane before placing panel assets.");
      return;
    }

    try {
      const result = placeAssociatedPanelAssetOnBackplane({
        model,
        sheetId: resolvedActiveSheetId,
        backplaneId: activeAssociatedBackplane.id,
        assetId,
        symbols
      });

      commitModel(result.model);
      selectPlacement(result.placement.id);
      setSelectedConnectionId(undefined);
      setMessage(`${result.placement.tag} placed on backplane.`);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Panel asset could not be placed."
      );
    }
  };

  const addPanel = ({ assetId, tag, title }: AddPanelEnclosureSubmission) => {
    const placement = createPanelEnclosurePlacement({
      model,
      activeSheet,
      assetId,
      tag,
      title,
      x: viewportCenter.x - 59,
      y: viewportCenter.y - 46
    });

    updateActiveSheet((current) => addPlacementCommand(current, placement));
    selectPlacement(placement.id);
    setSelectedConnectionId(undefined);
    setIsAddPanelOpen(false);
    setMessage(`${placement.tag} panel added.`);
  };

  const addTerminalBlock = ({
    assetId,
    tag,
    terminalBlock,
    containerAssetId
  }: AddTerminalBlockSubmission) => {
    const placement = createTerminalBlockPlacement({
      model,
      activeSheet,
      assetId,
      tag,
      terminalBlock,
      x: viewportCenter.x - 18,
      y: viewportCenter.y - 31
    });

    updateActiveSheet((current) =>
      addPlacementCommand(current, {
        ...placement,
        containerAssetId
      })
    );
    selectPlacement(placement.id);
    setSelectedConnectionId(undefined);
    setIsAddTerminalBlockOpen(false);
    setMessage(`${placement.tag} terminal block added.`);
  };

  const addTerminalBlockGroup = ({
    backplaneId,
    name,
    description,
    count
  }: TerminalBlockGroupDialogSubmission) => {
    try {
      const result = createAndPlaceTerminalBlockGroup({
        model,
        symbols,
        input: {
          sheetId: resolvedActiveSheetId,
          backplaneId,
          name,
          description,
          count
        }
      });

      commitModel(result.model);
      selectPlacement(result.placement.id);
      setSelectedConnectionId(undefined);
      setIsTerminalBlockGroupOpen(false);
      setMessage(
        `${result.placement.tag} terminal block group added to the backplane.`
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Terminal block group could not be created."
      );
    }
  };

  const updatePlacement = (
    placementId: string,
    updates: Partial<DrawingPlacement>
  ) => {
    updateActiveSheet((current) =>
      updatePlacementProperties(current, placementId, updates)
    );
  };

  const updatePlacementContainer = (
    placementId: string,
    containerAssetId: string | undefined
  ) => {
    updateActiveSheet((current) =>
      containerAssetId
        ? assignPlacementToContainer(current, placementId, containerAssetId)
        : clearPlacementContainer(current, placementId)
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

  const updatePlacementAssetTag = (assetId: string, tag: string) => {
    try {
      commitModel(
        (current) => renameDrawingAssetTag(current, assetId, tag, symbols),
        { coalesceKey: `asset-tag:${assetId}` }
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Asset tag could not be updated."
      );
    }
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
    commitModel((current) => createManagedAsset(current, input, symbols));
    setMessage("Asset created.");
  };

  const updateAssetManagerAsset = (
    assetId: string,
    updates: ManagedAssetUpdateInput
  ) => {
    commitModel(
      (current) => updateManagedAsset(current, assetId, updates, symbols),
      { coalesceKey: `asset-manager:${assetId}:${Object.keys(updates).join(",")}` }
    );
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

  const updatePlacementTitle = (placementId: string, placementTitle: string) => {
    const normalizedTitle = placementTitle.trim();

    updateActiveSheet(
      (current) => ({
        ...current,
        placements: current.placements.map((placement) => {
          if (placement.id !== placementId) {
            return placement;
          }

          if (!normalizedTitle) {
            const placementWithoutTitle = { ...placement };
            delete placementWithoutTitle.title;
            return placementWithoutTitle;
          }

          return {
            ...placement,
            title: normalizedTitle
          };
        })
      }),
      { coalesceKey: `placement-title:${placementId}` }
    );
  };

  const updatePanelTitle = (assetId: string, panelTitle: string) => {
    commitModel(
      (current) => updatePanelEnclosureTitle(current, assetId, panelTitle),
      { coalesceKey: `panel-title:${assetId}` }
    );
  };

  const updateTerminalBlockConfig = (
    assetId: string,
    updates: {
      terminalBlock?: TerminalBlockPlacement;
      title?: string;
      description?: string;
    }
  ) => {
    try {
      const nextModel = updateTerminalBlockGroup({
        model,
        assetId,
        count: updates.terminalBlock?.count,
        name: updates.title,
        description: updates.description
      });

      commitModel(nextModel, { coalesceKey: `terminal-block:${assetId}` });
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Terminal block group could not be updated."
      );
    }
  };

  const updateTitleBlock = (
    updates: Partial<DrawingModel["titleBlock"]>
  ) => {
    commitModel((current) => updatePackageTitleBlock(current, updates), {
      coalesceKey: `title-block:${Object.keys(updates).join(",")}`
    });
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
        setMessage(`${detailedOccurrence.tag} returned to the Panel Work Queue.`);
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

  const updateAnnotation = (
    annotationId: string,
    updates: Partial<DrawingAnnotation>
  ) => {
    updateActiveSheet((current) =>
      updateAnnotationCommand(current, annotationId, updates)
    );
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
      annotations: current.annotations.map((annotation) => {
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

        if (!annotation.leader?.enabled || (delta.x === 0 && delta.y === 0)) {
          return { ...annotation, ...update.updates };
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
          leader: {
            ...annotation.leader,
            targetX: leaderTarget.x,
            targetY: leaderTarget.y
          }
        };
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

      const route = generateDefaultOrthogonalRoute({
        model: currentCanvasModel,
        symbols,
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
    setConnectionMode((current) => {
      const next = current === "connecting" ? "idle" : "connecting";
      setMessage(
        next === "connecting"
          ? isDetailedPanelDrawing
            ? "Select a free internal terminal."
            : "Select a connection start anchor."
          : null
      );
      return next;
    });
    setConnectionDraft({});
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
      setMessage(null);
      return;
    }
    if (connectionDraft.from) {
      setConnectionDraft({});
      setMessage("Connection start cleared.");
      return;
    }

    setConnectionMode("idle");
    setPendingInternalWire(null);
    setSelectedConnectionId(undefined);
    setMessage(null);
  };

  const handleConnectionAnchorClick = (endpoint: DrawingEndpoint) => {
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
        setConnectionDraft({ from: endpoint });
        selectPlacement(endpoint.placementId);
        setSelectedConnectionId(undefined);
        setMessage("Select a free destination terminal.");
        return;
      }
      const sourceEndpoint = panelWireEndpointsByAnchorId.get(
        `${connectionDraft.from.placementId}:${connectionDraft.from.anchorKey}`
      );
      if (!sourceEndpoint) {
        setConnectionDraft({});
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
      setPendingInternalWire({ from: sourceEndpoint, to: currentEndpoint });
      setConnectionMode("idle");
      setConnectionDraft({});
      setMessage(null);
      return;
    }

    if (!connectionDraft.from) {
      setConnectionDraft({ from: endpoint });
      selectPlacement(endpoint.placementId);
      setSelectedConnectionId(undefined);
      setMessage("Select a destination anchor.");
      return;
    }

    const result = createConnectionFromEndpoints({
      model: activeSheetCanvasModel,
      symbols,
      from: connectionDraft.from,
      to: endpoint
    });

    if (!result.ok) {
      setMessage(result.error);
      return;
    }

    const route = generateDefaultOrthogonalRoute({
      model: activeSheetCanvasModel,
      symbols,
      connection: result.connection,
      mode: "auto"
    });
    const routedConnection = route
      ? { ...result.connection, route }
      : result.connection;

    updateActiveSheet((current) => addConnectionCommand(current, routedConnection));
    setSelectedConnectionId(routedConnection.id);
    setSelection({ ...EMPTY_CANVAS_SELECTION });
    setConnectionDraft({});
    setMessage("Connection added.");
  };

  const handleConnectionPointerMove = (pointer: { x: number; y: number }) => {
    setConnectionDraft((current) =>
      current.from ? { ...current, pointer } : current
    );
  };

  const createDetailedPanelInternalWire = (
    submission: PanelInternalWireFormSubmission
  ): PanelInternalWireFormResult => {
    try {
      const result = createInternalPanelWireRoute({
        model,
        symbols,
        sheetId: resolvedActiveSheetId,
        from: submission.from,
        to: submission.to,
        wireId: submission.wireId,
        attributes: submission.attributes
      });
      commitModel(result.model);
      setSelectedConnectionId(result.connection.id);
      setSelection({ ...EMPTY_CANVAS_SELECTION });
      setMessage(`${result.wire.wireId} added.`);
      return { ok: true };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The internal wire could not be created.";
      setMessage(message);
      return { ok: false, error: message };
    }
  };

  const createPendingInternalWire = (
    submission: InternalWireDialogSubmission
  ) => {
    if (!pendingInternalWire) {
      return;
    }
    const result = createDetailedPanelInternalWire({
      from: pendingInternalWire.from.terminal,
      to: pendingInternalWire.to.terminal,
      wireId: submission.wireId,
      attributes: submission.attributes
    });
    if (result.ok) {
      setPendingInternalWire(null);
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
    setSelectedConnectionId(undefined);
    setMessage("Configure the connection pattern, then select its terminals.");
  };

  const cancelPanelPatternAuthoring = () => {
    setPanelPatternDraft(null);
    setPendingPanelPatternReview(null);
    setConnectionMode("idle");
    setConnectionDraft({});
    setMessage(null);
  };

  const buildPendingPanelPatternResult = (): PanelPatternCommandResult | null => {
    if (!panelPatternDraft || !detailedPanelContext) return null;
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
        members: selected
      });
    }
    if (panelPatternDraft.topology === "distribution") {
      return createDistributionGroup(panelWiringSource, {
        ...common,
        topology: "distribution",
        domain: panelPatternDraft.domain,
        source: selected[0],
        targets: selected.slice(1)
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
        branches
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
    updates: { wireId: string; attributes?: PanelWireAttributes }
  ) => {
    try {
      commitModel(
        updateInternalPanelWireCommand({
          model,
          symbols,
          id: wireRecordId,
          wireId: updates.wireId,
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

  const updateDetailedPanelWireSettings = (settings: PanelWireSettings) => {
    try {
      const result = updatePanelWireSettings(panelWiringSource, settings);
      commitModel(applyPanelWiringMutations(model, result.mutations));
      setMessage("Internal wire settings updated.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Wire settings could not be updated."
      );
    }
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

  const requestDuplicateSheet = (sheetId: string) => {
    setSheetDuplicateCandidateId(sheetId);
  };

  const duplicateSheetFromPlan = (plan: SheetDuplicatePlan) => {
    try {
      const result = applySheetDuplicatePlan({ model, symbols, plan });
      const newSheet = result.model.sheets.find(
        (sheet) => sheet.id === result.sheetId
      );

      setSheetDuplicateCandidateId(null);
      commitModel(result.model);
      setActiveSheet(result.sheetId);
      setSheetFocusRequestKey((current) => current + 1);
      clearActiveSheetSelection();

      if (newSheet) {
        setViewportCenter({
          x: newSheet.page.width / 2,
          y: newSheet.page.height / 2
        });
      }

      setMessage("Sheet duplicated.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Sheet could not be duplicated."
      );
    }
  };

  const updateActiveSheetMetadata = (updates: {
    name?: string;
    description?: string;
  }) => {
    commitModel(
      (current) => updateSheetMetadata(current, resolvedActiveSheetId, updates),
      { coalesceKey: `sheet-metadata:${resolvedActiveSheetId}:${Object.keys(updates).join(",")}` }
    );
  };

  const updateActiveSectionTitlePage = (
    updates: Partial<
      NonNullable<DrawingModel["sheets"][number]["sectionTitlePage"]>
    >
  ) => {
    commitModel(
      (current) =>
        updateSectionTitlePage(current, resolvedActiveSheetId, updates),
      { coalesceKey: `section-title-page:${resolvedActiveSheetId}:${Object.keys(updates).join(",")}` }
    );
  };

  const updateActiveDetailedPanelContext = (panelAssetId: string) => {
    const result = updateDetailedPanelDrawingContext(panelWiringSource, {
      sheetId: resolvedActiveSheetId,
      panelAssetId
    });
    const blocking = result.warnings.find(
      (warning) => warning.severity === "error"
    );

    if (blocking) {
      setMessage(blocking.message);
      return;
    }

    commitModel((current) =>
      applyPanelWiringMutations(current, result.mutations)
    );
    clearActiveSheetSelection();
    setMessage("Panel drawing context updated.");
  };

  const focusDetailedPanelWorkflowAsset = (assetId: string) => {
    const result = updatePanelWorkflowFocus(panelWiringSource, {
      sheetId: resolvedActiveSheetId,
      assetId
    });
    const blocking = result.warnings.find(
      (warning) => warning.severity === "error"
    );

    if (blocking) {
      setMessage(blocking.message);
      return;
    }
    if (result.mutations.length > 0) {
      commitModel((current) =>
        applyPanelWiringMutations(current, result.mutations)
      );
    }
    const focused = panelDiscoveryIndex?.assetsById.get(assetId);
    setMessage(`${focused?.tag ?? "Panel asset"} selected for the walkthrough.`);
  };

  const placeDetailedPanelAsset = (assetId: string) => {
    try {
      const result = placePanelAssetOccurrence({
        model,
        sheetId: resolvedActiveSheetId,
        assetId,
        symbols
      });

      commitModel(result.model);
      selectPlacement(result.placement.id);
      setMessage(`${result.placement.tag} placed from the existing panel asset.`);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The panel asset could not be represented on this sheet."
      );
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
        `${placement?.tag ?? "Panel asset"} returned to the Panel Work Queue.`
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

      if (isPanelLayoutLibrarySymbol(symbol)) {
        addLayoutSymbol(symbol);
        return;
      }

      setPendingSymbol(symbol);
    }
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

  const saveActiveSheetAsTemplate = (form: SaveSheetTemplateForm) => {
    startTransition(async () => {
      const result = await saveSheetTemplateAction({
        name: form.name,
        description: form.description,
        category: form.category,
        keywords: form.keywords,
        sourceDrawingId: drawing.id,
        sourceSheetId: resolvedActiveSheetId,
        sheetId: resolvedActiveSheetId,
        model
      });

      if (!result.ok) {
        setTemplateError(result.error);
        setMessage(result.error);
        return;
      }

      setIsSaveTemplateOpen(false);
      setTemplateError(null);
      setMessage("Sheet template saved.");
    });
  };

  const openTemplateLibrary = () => {
    setIsTemplateLibraryOpen(true);
    setSelectedTemplate(null);
    setTemplateError(null);
    startTransition(async () => {
      const result = await listSheetTemplatesAction();

      if (!result.ok) {
        setTemplateError(result.error);
        return;
      }

      setTemplateList(result.data);
    });
  };

  const selectTemplateForImport = (templateId: string) => {
    setTemplateError(null);
    startTransition(async () => {
      const result = await getSheetTemplateAction(templateId);

      if (!result.ok) {
        setTemplateError(result.error);
        return;
      }

      setSelectedTemplate(result.data);
    });
  };

  const importTemplate = (
    template: DrawingSheetTemplateDetail,
    choices: TemplateAssetResolutionChoice[]
  ) => {
    try {
      const result = instantiateTemplateSheet({
        model,
        template: template.model,
        symbols,
        choices,
        insertAfterSheetId: resolvedActiveSheetId
      });
      const newSheet = result.model.sheets.find(
        (candidate) => candidate.id === result.sheetId
      );

      commitModel(result.model);
      setActiveSheet(result.sheetId);
      setSheetFocusRequestKey((current) => current + 1);
      clearActiveSheetSelection();
      setSelectedTemplate(null);
      setIsTemplateLibraryOpen(false);
      setTemplateError(null);
      setMessage(
        result.warnings.length > 0
          ? `Template added with ${result.warnings.length} warning.`
          : "Template added."
      );

      if (newSheet) {
        setViewportCenter({
          x: newSheet.page.width / 2,
          y: newSheet.page.height / 2
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Template could not be imported.";
      setTemplateError(errorMessage);
      setMessage(errorMessage);
    }
  };

  const save = () => {
    const revisionToSave = editRevision;
    startTransition(async () => {
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
      router.refresh();
    });
  };

  const openPanelReview = () => {
    const panelAssetId = detailedPanelContext?.panelAssetId ?? panelReviewAssetId;
    if (!panelAssetId) {
      setMessage("Load a Detailed Panel Drawing before opening Panel Review.");
      return;
    }
    setPanelReviewAssetId(panelAssetId);
    setIsPanelReviewOpen(true);
  };

  const openPanelDeliverables = () => {
    if (detailedPanelAssetIds.length === 0) {
      setMessage("Add a Detailed Panel Drawing before generating panel deliverables.");
      return;
    }
    startTransition(async () => {
      const result = await loadPanelBomTemplatesAction(
        [...new Set([
          ...(model.assets ?? []).flatMap((asset) =>
            asset.symbolId ? [asset.symbolId] : []
          ),
          ...model.sheets.flatMap((sheet) =>
            sheet.placements.map((placement) => placement.symbolId)
          )
        ])].filter((symbolId) => !symbolId.startsWith("__"))
      );
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setPanelBomTemplates(result.data);
      setIsPanelDeliverablesOpen(true);
    });
  };

  const pickGuidedInternalWire = () => {
    setIsPanelDiscoveryOpen(false);
    setPanelPatternDraft(null);
    setPendingPanelPatternReview(null);
    setPendingInternalWire(null);
    setConnectionMode("connecting");
    setConnectionDraft({});
    setSelectedConnectionId(undefined);
    setMessage("Select a free internal terminal for the new panel wire.");
  };

  const startGuidedPanelPattern = () => {
    setIsPanelDiscoveryOpen(false);
    setIsSymbolsCollapsed(false);
    startPanelPatternAuthoring();
  };

  const openGuidedPanelReview = () => {
    setIsPanelDiscoveryOpen(false);
    openPanelReview();
  };

  const openGuidedPanelDeliverables = () => {
    setIsPanelDiscoveryOpen(false);
    openPanelDeliverables();
  };

  const navigateFromPanelReport = (trace: PanelReportTraceRef) => {
    setIsPanelDeliverablesOpen(false);
    if (trace.kind === "asset_manager") {
      setAssetManagerInitialAssetId(trace.assetId);
      setIsAssetManagerOpen(true);
      return;
    }
    if (trace.kind === "work_queue") {
      const detailSheet = model.sheets.find(
        (sheet) => sheet.panelDrawingContext?.panelAssetId === trace.panelAssetId
      );
      if (detailSheet && detailSheet.id !== resolvedActiveSheetId) {
        selectSheet(detailSheet.id);
      }
      setPanelDiscoveryInitialTab(trace.tab);
      setPanelDiscoveryFocusId(trace.objectId ?? null);
      setIsPanelDiscoveryOpen(true);
      setMessage("Panel Work Queue opened at the related report record.");
      return;
    }
    if (trace.sheet.sheetId !== resolvedActiveSheetId) {
      selectSheet(trace.sheet.sheetId);
    }
    if (trace.objectKind === "placement" && trace.sheet.objectId) {
      setSelection({
        placementIds: [trace.sheet.objectId],
        annotationIds: []
      });
      setSelectedConnectionId(undefined);
    } else if (trace.objectKind === "connection" && trace.sheet.objectId) {
      setSelection({ ...EMPTY_CANVAS_SELECTION });
      setSelectedConnectionId(trace.sheet.objectId);
    }
    setSheetFocusRequestKey((current) => current + 1);
    setMessage(
      `Loaded Sheet ${trace.sheet.sheetNumber}: ${trace.sheet.sheetName}.`
    );
  };

  const navigateFromPanelFinding = (finding: PanelDrawingQualityFinding) => {
    const target = navigateToPanelFinding(finding);
    if (!target) {
      setMessage("This finding has no drawing object to navigate to.");
      return;
    }
    setPanelReviewAssetId(finding.panelAssetId);
    setIsPanelReviewOpen(false);
    setIsPanelDeliverablesOpen(false);
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
      setMessage("Panel Work Queue opened at the related engineering records.");
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

  const exportPdf = () => {
    window.location.assign(
      new URL(`/drawings/${drawing.id}/pdf`, window.location.origin).toString()
    );
  };

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
          activeSheetModel={activeSheetCanvasModel}
          symbols={symbols}
          onCancel={() => setPendingSymbol(null)}
          onPlace={addSymbol}
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
        <AddTerminalBlockDialog
          model={model}
          activeSheetModel={activeSheetCanvasModel}
          onCancel={() => setIsAddTerminalBlockOpen(false)}
          onPlace={addTerminalBlock}
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
          onLoadSheet={loadSheetFromDialog}
          onMoveSection={moveSectionFromLoader}
          onMoveSheetToSection={moveSheetToSection}
          onRequestDeleteSheet={requestDeleteSheet}
        />
      ) : null}
      {isSaveTemplateOpen ? (
        <SaveSheetTemplateDialog
          defaultName={`${activeSheet.name} Template`}
          isPending={isPending}
          onCancel={() => {
            setIsSaveTemplateOpen(false);
            setTemplateError(null);
          }}
          onSave={saveActiveSheetAsTemplate}
        />
      ) : null}
      {isTemplateLibraryOpen ? (
        <AddSheetTemplateDialog
          templates={templateList}
          selectedTemplate={selectedTemplate}
          model={model}
          symbols={symbols}
          isPending={isPending}
          error={templateError}
          onCancel={() => {
            setIsTemplateLibraryOpen(false);
            setSelectedTemplate(null);
            setTemplateError(null);
          }}
          onSelectTemplate={selectTemplateForImport}
          onBackToList={() => {
            setSelectedTemplate(null);
            setTemplateError(null);
          }}
          onImport={importTemplate}
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
      {sheetDuplicateCandidate ? (
        <DuplicateSheetWizardDialog
          model={model}
          symbols={symbols}
          activeSheetId={sheetDuplicateCandidate.id}
          onCancel={() => setSheetDuplicateCandidateId(null)}
          onDuplicateSheet={duplicateSheetFromPlan}
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
          onDeleteAsset={deleteAssetManagerAsset}
        />
      ) : null}
      {isTerminalBlockGroupOpen ? (
        <TerminalBlockGroupDialog
          model={model}
          activeSheetModel={activeSheetCanvasModel}
          symbols={symbols}
          preferredBackplaneId={activeAssociatedBackplane?.id}
          onCancel={() => setIsTerminalBlockGroupOpen(false)}
          onPlace={addTerminalBlockGroup}
        />
      ) : null}
      {isPanelDeliverablesOpen && panelQualityGraph && panelPackageQuality ? (
        <PanelDeliverablesDialog
          drawingId={drawing.id}
          drawingKey={drawing.drawingKey}
          drawingTitle={title}
          drawingStatus={drawing.status}
          graph={panelQualityGraph}
          quality={panelPackageQuality}
          symbols={symbols}
          templates={panelBomTemplates}
          initialPanelAssetId={detailedPanelContext?.panelAssetId}
          isSaved={editRevision === savedRevision}
          onCancel={() => setIsPanelDeliverablesOpen(false)}
          onNavigate={navigateFromPanelReport}
        />
      ) : null}
      {pendingInternalWire && proposedInternalWire && panelWireSettings ? (
        <InternalWireDialog
          from={{
            ref: pendingInternalWire.from.terminal,
            label: `${pendingInternalWire.from.assetTag}:${pendingInternalWire.from.terminalLabel}`
          }}
          to={{
            ref: pendingInternalWire.to.terminal,
            label: `${pendingInternalWire.to.assetTag}:${pendingInternalWire.to.terminalLabel}`
          }}
          proposedWireId={proposedInternalWire.wireId}
          defaults={panelWireSettings.defaults}
          onCancel={() => setPendingInternalWire(null)}
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
      panelGuidedWorkflow &&
      detailedPanelContext ? (
        <PanelDiscoveryDialog
          index={panelDiscoveryIndex}
          graph={panelConnectivityGraph}
          panelLabel={`${detailedPanelContext.tag} / ${detailedPanelContext.title}`}
          activeSheetId={resolvedActiveSheetId}
          internalWires={panelInternalWires}
          connectionPatterns={panelConnectionPatterns}
          wireSettings={panelWireSettings!}
          endpointCatalog={panelInternalWireEndpointCatalog}
          proposedWireId={proposedInternalWire?.wireId ?? ""}
          workflow={panelGuidedWorkflow}
          readOnly={detailedPanelReadOnly}
          initialTab={panelDiscoveryInitialTab}
          initialFocusId={panelDiscoveryFocusId ?? undefined}
          onCancel={() => setIsPanelDiscoveryOpen(false)}
          onPlaceAsset={placeDetailedPanelAsset}
          onSelectPlacement={selectDetailedPanelAsset}
          onRemovePlacement={removeDetailedPanelAsset}
          onMapTermination={mapDetailedPanelTermination}
          onResetTerminationMapping={
            resetDetailedPanelTerminationMapping
          }
          onSelectInternalWireRoute={selectDetailedPanelWireRoute}
          onAddInternalWireRoute={addDetailedPanelWireRoute}
          onDeleteInternalWire={requestInternalWireDelete}
          onUpdateWireSettings={updateDetailedPanelWireSettings}
          onSelectPatternRoute={selectDetailedPanelPatternRoute}
          onAddPatternRepresentation={addDetailedPanelPatternRoute}
          onRemovePatternRepresentation={removeDetailedPanelPatternRoute}
          onDeletePattern={setPanelPatternDeleteId}
          onFocusAsset={focusDetailedPanelWorkflowAsset}
          onCreateInternalWire={createDetailedPanelInternalWire}
          onPickInternalWire={pickGuidedInternalWire}
          onCenterEquipment={centerDetailedPanelAssets}
          onStartPattern={startGuidedPanelPattern}
          onOpenReview={openGuidedPanelReview}
          onOpenDeliverables={openGuidedPanelDeliverables}
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

      <div className="tool-panel flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h1 className="text-lg font-semibold">{title}</h1>
          <p className="mt-1 text-xs text-slate-500">
            {drawing.drawingKey} / {drawing.status.replace("_", " ")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {viewMode === "preview" ? (
            <>
              <button
                type="button"
                className="icon-button"
                disabled={isPending}
                onClick={exportPdf}
              >
                <FileDown aria-hidden="true" size={14} />
                Preview PDF
              </button>
              <button
                type="button"
                className="icon-button icon-button-primary"
                onClick={() => setViewMode("edit")}
              >
                Exit preview
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="icon-button"
                disabled={isPending}
                onClick={() => {
                  setAssetManagerInitialAssetId(null);
                  setIsAssetManagerOpen(true);
                }}
              >
                <PackageSearch aria-hidden="true" size={14} />
                Asset Manager
              </button>
              <button
                type="button"
                className="icon-button"
                disabled={isPending || detailedPanelReadOnly}
                onClick={save}
              >
                <Save aria-hidden="true" size={14} />
                Save
              </button>
              <button
                type="button"
                className="icon-button"
                disabled={isPending}
                onClick={openPackagePreview}
              >
                <Eye aria-hidden="true" size={14} />
                Package Preview
              </button>
              <button
                type="button"
                className="icon-button"
                disabled={isPending}
                onClick={exportPdf}
              >
                <FileDown aria-hidden="true" size={14} />
                Preview PDF
              </button>
              {detailedPanelAssetIds.length > 0 ? (
                <button
                  type="button"
                  className="icon-button"
                  disabled={isPending}
                  onClick={openPanelDeliverables}
                >
                  <FileSpreadsheet aria-hidden="true" size={14} />
                  Deliverables
                </button>
              ) : null}
              <button
                type="button"
                className="icon-button"
                disabled={isPending || detailedPanelReadOnly}
                onClick={addNote}
              >
                <StickyNote aria-hidden="true" size={14} />
                Add note
              </button>
              {isDetailedPanelDrawing || panelReviewAssetId ? (
                <button
                  type="button"
                  className="icon-button"
                  disabled={isPending}
                  onClick={openPanelReview}
                >
                  <ShieldCheck aria-hidden="true" size={14} />
                  Panel Review
                  {panelQualityReport?.counts.blockingErrors ? (
                    <span className="inline-flex min-w-5 justify-center rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                      {panelQualityReport.counts.blockingErrors}
                    </span>
                  ) : null}
                </button>
              ) : null}
              <button
                type="button"
                className="icon-button icon-button-primary"
                disabled={
                  isPending ||
                  (!detailedPanelDrawingsEnabled && detailedPanelAssetIds.length > 0)
                }
                onClick={approve}
              >
                <CheckCircle2 aria-hidden="true" size={14} />
                Approve
              </button>
              {isDetailedPanelDrawing && !detailedPanelReadOnly ? (
                <button
                  type="button"
                  className={[
                    "icon-button",
                    panelPatternDraft ? "icon-button-primary" : ""
                  ].join(" ")}
                  aria-pressed={Boolean(panelPatternDraft)}
                  disabled={isPending}
                  onClick={
                    panelPatternDraft
                      ? cancelPanelPatternAuthoring
                      : startPanelPatternAuthoring
                  }
                >
                  <Network aria-hidden="true" size={14} />
                  Pattern
                </button>
              ) : null}
              {!isDetailedPanelDrawing || !detailedPanelReadOnly ? (
                <button
                  type="button"
                  className={[
                    "icon-button",
                    connectionMode === "connecting" && !panelPatternDraft
                      ? "icon-button-primary"
                      : ""
                  ].join(" ")}
                  aria-pressed={
                    connectionMode === "connecting" && !panelPatternDraft
                  }
                  disabled={isPending}
                  onClick={toggleConnectMode}
                >
                  {isDetailedPanelDrawing ? (
                    <Cable aria-hidden="true" size={14} />
                  ) : (
                    <Link2 aria-hidden="true" size={14} />
                  )}
                  {isDetailedPanelDrawing ? "Wire" : "Connect"}
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>

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
          panelExternalTerminationsBySheetId={
            panelExternalTerminationDisplayIndex
          }
          onExitPreview={() => setViewMode("edit")}
          onPreviewPdf={exportPdf}
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
                  workflow={panelGuidedWorkflow}
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
                  {activeAssociatedPanel ? (
                    <PanelAssociatedAssetsSection
                      panelLabel={`${activeAssociatedPanel.placement.tag} / ${getPanelEnclosureTitle(
                        activeAssociatedPanel.placement
                      )}`}
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
          panelExternalTerminations={
            panelExternalTerminationDisplayIndex.get(resolvedActiveSheetId) ?? []
          }
          selection={selection}
          selectedPlacementId={selectedPlacementId}
          viewportTransform={viewportTransform}
          viewportCenter={viewportCenter}
          setViewportTransform={setViewportTransform}
          dragState={dragState}
          onAddSheet={() => setIsAddSheetOpen(true)}
          onOpenSheetLoader={() => setIsSheetLoaderOpen(true)}
          onAddPanel={() => setIsAddPanelOpen(true)}
          onAddTerminalBlock={() => setIsAddTerminalBlockOpen(true)}
          onAddSheetFromTemplate={openTemplateLibrary}
          onSaveSheetTemplate={() => {
            setTemplateError(null);
            setIsSaveTemplateOpen(true);
          }}
          onDuplicateSheet={requestDuplicateSheet}
          onMoveSheet={moveSheet}
          onMoveSheetToEnd={moveSheetToEnd}
          onDeleteSheet={requestDeleteSheet}
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
          connectionDraft={connectionDraft}
          selectedConnectionId={selectedConnectionId}
          onConnectionAnchorClick={handleConnectionAnchorClick}
          onConnectionPointerMove={handleConnectionPointerMove}
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
            <div className="space-y-4">
              {isDetailedPanelDrawing && !detailedPanelReadOnly ? (
                <PanelDrawingContextEditor
                  context={detailedPanelContext}
                  options={compatiblePanelOptions}
                  warning={detailedPanelContextWarning}
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
                  onPanelAssetChange={updateActiveDetailedPanelContext}
                />
              ) : null}
              <fieldset
                disabled={detailedPanelReadOnly}
                className="min-w-0 border-0 p-0 disabled:opacity-75"
              >
              <PlacementPropertiesPanel
              title={title}
              model={activeSheetCanvasModel}
              packageModel={model}
              activeSheet={activeSheet}
              activeSheetNumber={activeSheetNumber}
              sheetCount={model.sheets.length}
              sectionLabel={activeSectionLabel}
              sectionMemberCount={activeDrawingSection?.memberSheetIds.length}
              sectionMoveOptions={activeSectionMoveOptions}
              symbols={symbols}
              headerAction={isDetailedPanelDrawing && !detailedPanelReadOnly ? undefined :
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
              onTitleChange={(nextTitle) => {
                setTitle(nextTitle);
                setEditRevision((current) => current + 1);
              }}
              onTitleBlockChange={updateTitleBlock}
              onSheetMetadataChange={updateActiveSheetMetadata}
              onSectionTitlePageChange={updateActiveSectionTitlePage}
              onMoveSheetToSection={(targetSectionId) =>
                moveSheetToSection(resolvedActiveSheetId, targetSectionId)
              }
              selection={selection}
              selectedPlacementId={selectedPlacementId}
              onPlacementAssetTagChange={updatePlacementAssetTag}
              onOpenAssetLinkDialog={openAssetLinkDialog}
              onPlacementTitleChange={updatePlacementTitle}
              onPlacementChange={updatePlacement}
              onPanelTitleChange={updatePanelTitle}
              onTerminalBlockChange={updateTerminalBlockConfig}
              onPlacementContainerChange={updatePlacementContainer}
              selectedConnectionId={selectedConnectionId}
              selectedAnnotationId={selectedAnnotationId}
              onConnectionSelect={selectConnection}
              onConnectionChange={updateConnection}
              onConnectionRemove={removeConnection}
              onConnectionRouteReset={resetConnectionRoute}
              onInternalWireChange={updateDetailedPanelInternalWire}
              onPanelPatternChange={updateDetailedPanelPattern}
              onPanelPatternLegendVisibilityChange={
                updatePanelPatternLegendVisibility
              }
              showConnections={!isDetailedPanelDrawing}
              onAnnotationChange={updateAnnotation}
              onAnnotationRemove={removeAnnotation}
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
            className="rounded-md border border-slate-200 px-2 py-1 text-sm font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-800"
            onClick={onCancel}
            aria-label="Close backplane panel picker"
          >
            x
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
