"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition
} from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Eye,
  FileDown,
  Link2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  PackageSearch,
  Save,
  StickyNote
} from "lucide-react";
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
  moveSheet as moveSheetCommand,
  moveSheetToEnd as moveSheetToEndCommand,
  replaceSheetFromCanvasModel,
  toSheetCanvasModel,
  updatePackageTitleBlock,
  updateSectionTitlePage,
  updateSheetMetadata
} from "../../logic/commands/drawing-sheet-commands";
import { createDetailedPanelDrawingSheet } from "../../logic/commands/drawing-detailed-panel-sheet-commands";
import {
  placePanelAssetOccurrence,
  removePanelAssetOccurrence
} from "../../logic/commands/drawing-panel-occurrence-commands";
import {
  applyPanelWiringMutations,
  createPanelWiringSource
} from "../../api/panel-wiring-contracts";
import {
  buildCompatiblePanelOptions,
  buildPackageConnectivityGraph,
  buildPanelDiscoveryIndex,
  getDetailedPanelDrawingContext,
  updateDetailedPanelDrawingContext,
  validatePanelDrawingContext
} from "@/features/drawing_panel_wiring/api/public";
import {
  PanelDrawingContextEditor,
  PanelDiscoveryDialog,
  PanelDrawingSummary
} from "@/features/drawing_panel_wiring/ui/public";
import { generateDefaultOrthogonalRoute } from "../../logic/services/connection-route-geometry";
import {
  clampPointToSheet,
  createDefaultNoteAnnotation
} from "../../logic/services/drawing-annotations";
import {
  allocateNextPackageTag,
  createDrawingAssetId,
  defaultPlacementScale,
  placementAssetId,
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
import {
  createEmptyDrawingHistory,
  pushDrawingHistoryEntry,
  redoDrawingHistory,
  undoDrawingHistory,
  type DrawingModelHistoryEntry
} from "../../logic/services/drawing-model-history";
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
  AddSheetDialog,
  type AddSheetDialogSubmission
} from "./add-sheet-dialog";
import { SheetLoaderDialog } from "./sheet-loader-dialog";
import {
  AssetLinkDialog,
  type AssetLinkDialogMode
} from "./asset-link-dialog";
import { DeleteSheetConfirmationDialog } from "./delete-sheet-confirmation-dialog";
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
import { AssetManagerDialog } from "@/features/drawing_asset_manager/ui/components/asset-manager-dialog";
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
import { buildSheetLoaderRows } from "../../logic/services/sheet-loader-rows";
import { getDrawingSheetPresentation } from "../../logic/services/drawing-sheet-presentation";
import { createTerminalBlockPlacement } from "../../logic/services/drawing-terminal-blocks";
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

function normalizeCanvasModel(
  model: DrawingModel,
  symbols: ApprovedDrawingSymbol[]
): DrawingModel {
  return reconcileDrawingAssets(model, symbols);
}

export function DrawingCanvasShell({
  drawing,
  symbols
}: {
  drawing: DrawingDetail;
  symbols: ApprovedDrawingSymbol[];
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
  const [viewMode, setViewMode] = useState<CanvasViewMode>("edit");
  const [model, setModelState] = useState<DrawingModel>(() =>
    normalizeCanvasModel(drawing.model, symbols)
  );
  const [activeSheetId, setActiveSheetId] = useState(initialSheet.id);
  const [selection, setSelectionState] =
    useState<DrawingCanvasSelection>(initialSelection);
  const [selectedConnectionId, setSelectedConnectionId] = useState<
    string | undefined
  >(undefined);
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>("idle");
  const [connectionDraft, setConnectionDraft] = useState<ConnectionDraft>({});
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
  const [isBackplanePanelPickerOpen, setIsBackplanePanelPickerOpen] =
    useState(false);
  const [isAssetManagerOpen, setIsAssetManagerOpen] = useState(false);
  const [isPanelDiscoveryOpen, setIsPanelDiscoveryOpen] = useState(false);
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
  const sheetLoaderRows = useMemo(
    () => buildSheetLoaderRows(model),
    [model]
  );
  const selectedAnnotationId = primaryAnnotationId(selection);
  const activeSheet =
    model.sheets.find((sheet) => sheet.id === resolvedActiveSheetId) ??
    model.sheets[0];
  const activeSheetPresentation = getDrawingSheetPresentation(activeSheet);
  const isDetailedPanelDrawing =
    activeSheetPresentation.workspaceContext === "detailed_panel";
  const panelWiringSource = useMemo(
    () => createPanelWiringSource(model, symbols),
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
  const panelConnectivityGraph = useMemo(
    () =>
      isDetailedPanelDrawing
        ? buildPackageConnectivityGraph(panelWiringSource)
        : undefined,
    [isDetailedPanelDrawing, panelWiringSource]
  );
  const panelDiscoveryIndex = useMemo(() => {
    if (!panelConnectivityGraph || !detailedPanelContext) {
      return undefined;
    }

    return buildPanelDiscoveryIndex({
      graph: panelConnectivityGraph,
      panelAssetId: detailedPanelContext.panelAssetId,
      detailedSheetId: resolvedActiveSheetId
    });
  }, [
    detailedPanelContext,
    panelConnectivityGraph,
    resolvedActiveSheetId
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
      setDragState(null);
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
    },
    [currentHistoryEntry, symbols]
  );

  const beginModelHistoryTransaction = useCallback(() => {
    if (!historyTransactionRef.current) {
      historyTransactionRef.current = currentHistoryEntry();
      historyCoalesceRef.current = null;
    }
  }, [currentHistoryEntry]);

  const endModelHistoryTransaction = useCallback(() => {
    const entry = historyTransactionRef.current;

    if (!entry) {
      return;
    }

    historyTransactionRef.current = null;

    if (entry.model !== modelRef.current) {
      historyRef.current = pushDrawingHistoryEntry(historyRef.current, entry);
    }
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

  const clearActiveSheetSelection = () => {
    setSelection({ ...EMPTY_CANVAS_SELECTION });
    setSelectedConnectionId(undefined);
    setConnectionMode("idle");
    setConnectionDraft({});
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
    setIsPanelDiscoveryOpen(false);
    clearActiveSheetSelection();
  };

  const loadSheetFromDialog = (sheetId: string) => {
    selectSheet(sheetId);
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
    const tag = isTerminalBlockLayoutSymbol
      ? allocateNextPackageTag(model, symbol)
      : symbol.displayName;
    const placement = autosizeLayoutHelperToBackplane({
      backplane,
      symbol,
      sheet: activeSheetCanvasModel.sheet,
      placement: {
        id: placementId,
        ...(isTerminalBlockLayoutSymbol
          ? {
              assetId: createDrawingAssetId(placementId),
              title: symbol.displayName
            }
          : {}),
        symbolId: symbol.symbolId,
        versionId: symbol.versionId,
        role: isTerminalBlockLayoutSymbol ? roleFromSymbol(symbol) : "other",
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
    terminalBlock: TerminalBlockPlacement
  ) => {
    commitModel(
      (current) => ({
        ...current,
        sheets: current.sheets.map((sheet) => ({
          ...sheet,
          placements: sheet.placements.map((placement) =>
            placementAssetId(placement) === assetId && placement.terminalBlock
              ? { ...placement, terminalBlock }
              : placement
          )
        }))
      }),
      { coalesceKey: `terminal-block:${assetId}` }
    );
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
    setConnectionMode((current) => (current === "connecting" ? "idle" : "connecting"));
    setConnectionDraft({});
    setSelectedConnectionId(undefined);
    setMessage(null);
  };

  const cancelConnectionAuthoring = () => {
    if (connectionDraft.from) {
      setConnectionDraft({});
      setMessage("Connection start cleared.");
      return;
    }

    setConnectionMode("idle");
    setSelectedConnectionId(undefined);
    setMessage(null);
  };

  const handleConnectionAnchorClick = (endpoint: DrawingEndpoint) => {
    if (connectionMode !== "connecting") {
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

  const addSheet = (submission: AddSheetDialogSubmission) => {
    try {
      const result =
        submission.kind === "section_title"
          ? addSectionTitlePageCommand(model, {
              name: submission.name,
              title: submission.title,
              subtitle: submission.subtitle,
              sectionNumber: submission.sectionNumber
            })
          : submission.kind === "detailed_panel"
            ? createDetailedPanelDrawingSheet(model, submission, symbols)
            : addDrawingSheetCommand(model, submission.name);
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

      if (isPanelLayoutLibrarySymbol(symbol)) {
        addLayoutSymbol(symbol);
        return;
      }

      setPendingSymbol(symbol);
    }
  };

  const moveSheet = (sheetId: string, direction: -1 | 1) => {
    commitModel((current) => moveSheetCommand(current, sheetId, direction));
  };

  const moveSheetToEnd = (sheetId: string) => {
    commitModel((current) => moveSheetToEndCommand(current, sheetId));
  };

  const requestDeleteSheet = (sheetId: string) => {
    setSheetDeleteCandidateId(sheetId);
  };

  const deleteSheet = (sheetId: string) => {
    const result = deleteSheetCommand(model, sheetId);
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
    startTransition(async () => {
      const modelToSave = normalizeCanvasModel(model, symbols);
      const result = await saveDrawingAction({
        drawingId: drawing.id,
        title,
        model: modelToSave
      });

      if (!result.ok) {
        setMessage(result.error);
        return;
      }

      setMessage("Drawing saved.");
      router.refresh();
    });
  };

  const approve = () => {
    startTransition(async () => {
      const modelToSave = normalizeCanvasModel(model, symbols);
      const saveResult = await saveDrawingAction({
        drawingId: drawing.id,
        title,
        model: modelToSave
      });

      if (!saveResult.ok) {
        setMessage(saveResult.error);
        return;
      }

      const result = await approveDrawingAction(drawing.id);

      if (!result.ok) {
        setMessage(result.error);
        return;
      }

      setMessage("Drawing approved.");
      router.refresh();
    });
  };

  const exportPdf = () => {
    window.location.assign(
      new URL(`/drawings/${drawing.id}/pdf`, window.location.origin).toString()
    );
  };

  const openPackagePreview = () => {
    setConnectionMode("idle");
    setConnectionDraft({});
    setSelectedConnectionId(undefined);
    setDragState(null);
    setIsSheetLoaderOpen(false);
    setIsAddSheetOpen(false);
    setIsAddPanelOpen(false);
    setIsAddTerminalBlockOpen(false);
    setIsBackplanePanelPickerOpen(false);
    setIsPanelDiscoveryOpen(false);
    setPendingSymbol(null);
    setViewMode("preview");
  };

  return (
    <div className="space-y-5">
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
          panelOptions={compatiblePanelOptions}
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
          rows={sheetLoaderRows}
          activeSheetId={resolvedActiveSheetId}
          onCancel={() => setIsSheetLoaderOpen(false)}
          onLoadSheet={loadSheetFromDialog}
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
          onCancel={() => setAssetLinkDialogState(null)}
          onCreateNewAsset={createNewAssetLink}
          onReferenceExisting={referenceExistingAssetLink}
        />
      ) : null}
      {isAssetManagerOpen ? (
        <AssetManagerDialog
          model={model}
          symbols={symbols}
          onCancel={() => setIsAssetManagerOpen(false)}
          onCreateAsset={createAssetManagerAsset}
          onUpdateAsset={updateAssetManagerAsset}
          onDeleteAsset={deleteAssetManagerAsset}
        />
      ) : null}
      {isPanelDiscoveryOpen && panelDiscoveryIndex && detailedPanelContext ? (
        <PanelDiscoveryDialog
          index={panelDiscoveryIndex}
          panelLabel={`${detailedPanelContext.tag} / ${detailedPanelContext.title}`}
          onCancel={() => setIsPanelDiscoveryOpen(false)}
          onPlaceAsset={placeDetailedPanelAsset}
          onSelectPlacement={selectDetailedPanelAsset}
          onRemovePlacement={removeDetailedPanelAsset}
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
                onClick={() => setIsAssetManagerOpen(true)}
              >
                <PackageSearch aria-hidden="true" size={14} />
                Asset Manager
              </button>
              <button
                type="button"
                className="icon-button"
                disabled={isPending}
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
              <button
                type="button"
                className="icon-button"
                disabled={isPending}
                onClick={addNote}
              >
                <StickyNote aria-hidden="true" size={14} />
                Add note
              </button>
              <button
                type="button"
                className="icon-button icon-button-primary"
                disabled={isPending}
                onClick={approve}
              >
                <CheckCircle2 aria-hidden="true" size={14} />
                Approve
              </button>
              {!isDetailedPanelDrawing ? <button
                type="button"
                className={[
                  "icon-button",
                  connectionMode === "connecting" ? "icon-button-primary" : ""
                ].join(" ")}
                aria-pressed={connectionMode === "connecting"}
                disabled={isPending}
                onClick={toggleConnectMode}
              >
                <Link2 aria-hidden="true" size={14} />
                Connect
              </button> : null}
            </>
          )}
        </div>
      </div>

      {viewMode === "preview" ? (
        <PackagePreviewSurface
          model={model}
          drawingTitle={title}
          symbols={symbols}
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
                <PanelDrawingSummary
                  context={detailedPanelContext}
                  warning={detailedPanelContextWarning}
                  discovery={panelDiscoveryIndex}
                  onOpenWorkQueue={
                    panelDiscoveryIndex
                      ? () => setIsPanelDiscoveryOpen(true)
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
          model={model}
          drawingTitle={title}
          workspaceContext={activeSheetPresentation.workspaceContext}
          activeSheetId={resolvedActiveSheetId}
          focusSheetRequestKey={sheetFocusRequestKey}
          symbols={symbols}
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
          onConnectionCancel={cancelConnectionAuthoring}
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
              {isDetailedPanelDrawing ? (
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
              <PlacementPropertiesPanel
              title={title}
              model={activeSheetCanvasModel}
              packageModel={model}
              activeSheet={activeSheet}
              activeSheetNumber={activeSheetNumber}
              sheetCount={model.sheets.length}
              symbols={symbols}
              headerAction={isDetailedPanelDrawing ? undefined :
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
              onTitleChange={setTitle}
              onTitleBlockChange={updateTitleBlock}
              onSheetMetadataChange={updateActiveSheetMetadata}
              onSectionTitlePageChange={updateActiveSectionTitlePage}
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
              showConnections={!isDetailedPanelDrawing}
              onAnnotationChange={updateAnnotation}
              onAnnotationRemove={removeAnnotation}
              />
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
