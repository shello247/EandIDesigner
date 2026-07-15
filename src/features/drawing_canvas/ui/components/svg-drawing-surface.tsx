"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type PointerEvent,
  type SetStateAction,
  type WheelEvent
} from "react";
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ChevronsDown,
  Copy,
  List,
  Save,
  Trash2
} from "lucide-react";
import type {
  DrawingAnnotation,
  DrawingModel as DrawingPackageModel,
  DrawingSheetCanvasModel
} from "../../data/schema";
import type {
  DrawingConnectionRoute,
  DrawingEndpoint
} from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import type { PanelExternalTerminationDisplayRow } from "@/features/drawing_panel_wiring/api/public";
import { toSheetCanvasModel } from "../../logic/commands/drawing-sheet-commands";
import { getAnchorWorldPoint } from "../../logic/services/drawing-geometry";
import { renderDrawingToSvg } from "../../logic/services/drawing-svg-renderer";
import type { DrawingSectionIndex } from "../../logic/services/drawing-sections";
import { measureDrawingOperation } from "../../logic/services/drawing-performance-diagnostics";
import {
  addRouteControlPoint,
  updateRoutePoint
} from "../../logic/services/connection-route-geometry";
import {
  getRenderableConnectionRoute,
  routeLabelBox
} from "../../logic/services/connection-route-renderer";
import {
  getPanelConnectionPatternStyle,
  getPanelPatternRouteLabel
} from "../../logic/services/panel-connection-pattern-renderer";
import {
  clampPointToSheet,
  NOTE_NUDGE_STEP
} from "../../logic/services/drawing-annotations";
import { moveCanvasSelection } from "../../logic/services/drawing-movement";
import {
  EMPTY_CANVAS_SELECTION,
  getMarqueeSelection,
  type DrawingCanvasSelection
} from "../../logic/services/drawing-selection";
import {
  getPlacementDisplayTitle,
  getPlacementTitlePoint,
  shouldShowPlacementTitle
} from "../../logic/services/placement-title-labels";
import {
  calculateScrollForZoomAnchor,
  calculateFitTransform,
  clampZoom,
  type ViewportTransform
} from "../../logic/services/viewport-transform";
import { getRenderableSymbolForPlacement } from "../../logic/services/drawing-generated-symbols";
import {
  isBackplanePlacement,
  isLayoutHelperPlacement
} from "../../logic/services/drawing-backplane-layouts";
import { resolveLayoutHelperDisplayPlacement } from "../../logic/services/drawing-backplane-scale";
import { AnchorOverlay, AnchorTooltip } from "../canvas/AnchorOverlay";
import { NoteBlockOverlay } from "../canvas/NoteBlockOverlay";
import { PlacementOverlay } from "../canvas/PlacementOverlay";
import { PlacementTitleOverlay } from "../canvas/PlacementTitleOverlay";
import { RouteHandlesOverlay } from "../canvas/RouteHandlesOverlay";
import { RouteLabelOverlay } from "../canvas/RouteLabelOverlay";
import { useCanvasKeyboardShortcuts } from "../canvas/hooks/useCanvasKeyboardShortcuts";
import { usePlacementRotation } from "../canvas/hooks/usePlacementRotation";
import { usePlacementResize } from "../canvas/hooks/usePlacementResize";
import { usePlacementTitleDrag } from "../canvas/hooks/usePlacementTitleDrag";
import { useRouteLabelDrag } from "../canvas/hooks/useRouteLabelDrag";
import { useRoutePointDrag } from "../canvas/hooks/useRoutePointDrag";
import { useSheetScrollPan } from "../canvas/hooks/useSheetScrollPan";
import type {
  ConnectionDraft,
  ConnectionSegment,
  DragState,
  PlacementTitleLabel
} from "../canvas/types";
import {
  getViewportSize,
  toSvgPoint
} from "../canvas/utils/canvasGeometry";
import { DrawingCanvasAddMenu } from "./drawing-canvas-add-menu";
import {
  getDrawingSheetPresentation,
  type DrawingWorkspaceContext
} from "../../logic/services/drawing-sheet-presentation";
import { DrawingViewportToolbar } from "./drawing-viewport-toolbar";

const SHEET_PIXEL_SCALE = 2;
const ZOOM_STEP = 1.2;

type ActiveSheetFrame = {
  sheet: DrawingPackageModel["sheets"][number];
  sheetNumber: number;
  canvasModel: DrawingSheetCanvasModel;
  renderedSvg: string;
};

type ZoomAnchor = {
  sheetId: string;
  sheetX: number;
  sheetY: number;
  clientX: number;
  clientY: number;
  nextZoom: number;
};

function pointIsInsideRect(
  point: { x: number; y: number },
  rect: DOMRect
): boolean {
  return (
    point.x >= rect.left &&
    point.x <= rect.right &&
    point.y >= rect.top &&
    point.y <= rect.bottom
  );
}

function sheetFrameAtPoint(
  clientX: number,
  clientY: number
): HTMLDivElement | null {
  for (const element of document.elementsFromPoint(clientX, clientY)) {
    const frame = element.closest<HTMLDivElement>("[data-sheet-id]");

    if (frame) {
      return frame;
    }
  }

  return null;
}

function zoomAnchorFromPointer(input: {
  clientX: number;
  clientY: number;
  zoom: number;
}): Omit<ZoomAnchor, "nextZoom"> | null {
  const frame = sheetFrameAtPoint(input.clientX, input.clientY);
  const sheetId = frame?.dataset.sheetId;
  const paper = frame?.querySelector<HTMLElement>("[data-sheet-paper]");

  if (!frame || !sheetId || !paper) {
    return null;
  }

  const paperRect = paper.getBoundingClientRect();

  if (!pointIsInsideRect({ x: input.clientX, y: input.clientY }, paperRect)) {
    return null;
  }

  const sheetWidth = Number(frame.dataset.sheetWidth);
  const sheetHeight = Number(frame.dataset.sheetHeight);
  const scaleX =
    Number.isFinite(sheetWidth) && sheetWidth > 0
      ? paperRect.width / sheetWidth
      : SHEET_PIXEL_SCALE * input.zoom;
  const scaleY =
    Number.isFinite(sheetHeight) && sheetHeight > 0
      ? paperRect.height / sheetHeight
      : SHEET_PIXEL_SCALE * input.zoom;

  return {
    sheetId,
    sheetX: (input.clientX - paperRect.left) / scaleX,
    sheetY: (input.clientY - paperRect.top) / scaleY,
    clientX: input.clientX,
    clientY: input.clientY
  };
}

export function SvgDrawingSurface({
  model: drawingModel,
  sectionIndex: drawingSectionIndex,
  drawingTitle,
  workspaceContext,
  activeSheetId,
  focusSheetRequestKey,
  symbols,
  panelExternalTerminations = [],
  selection,
  selectedPlacementId,
  viewportTransform,
  viewportCenter,
  setViewportTransform,
  dragState,
  onOpenSheetLoader,
  onAddSheet,
  onAddPanel,
  onAddTerminalBlock,
  onAddSheetFromTemplate,
  onSaveSheetTemplate,
  onDuplicateSheet,
  onMoveSheet,
  onMoveSheetToEnd,
  onDeleteSheet,
  onSelectPlacement,
  onSelectionChange,
  onPlacementChange,
  onSelectionMove,
  onPlacementRemove,
  onSelectionRemove,
  selectedAnnotationId,
  onAnnotationSelect,
  onAnnotationChange,
  onAnnotationGroupChange,
  onDragStart,
  onDragMove,
  onDragEnd,
  onGestureStart,
  onGestureEnd,
  onGestureCancel,
  onCopySelection,
  onPasteSelection,
  onUndo,
  onRedo,
  connectionMode,
  connectionDraft,
  selectedConnectionId,
  onConnectionAnchorClick,
  onConnectionPointerMove,
  onConnectionSelect,
  onConnectionRouteChange,
  onConnectionRemove,
  onConnectionCancel,
  getConnectionAnchorState,
  onViewportCenterChange,
  statusMessage
}: {
  model: DrawingPackageModel;
  sectionIndex: DrawingSectionIndex;
  drawingTitle: string;
  workspaceContext: DrawingWorkspaceContext;
  activeSheetId: string;
  focusSheetRequestKey?: number;
  symbols: ApprovedDrawingSymbol[];
  panelExternalTerminations?: PanelExternalTerminationDisplayRow[];
  selection: DrawingCanvasSelection;
  selectedPlacementId?: string;
  viewportTransform: ViewportTransform;
  viewportCenter: { x: number; y: number };
  setViewportTransform: Dispatch<SetStateAction<ViewportTransform>>;
  dragState: DragState | null;
  onOpenSheetLoader: () => void;
  onAddSheet: () => void;
  onAddPanel: () => void;
  onAddTerminalBlock: () => void;
  onAddSheetFromTemplate: () => void;
  onSaveSheetTemplate: () => void;
  onDuplicateSheet: (sheetId: string) => void;
  onMoveSheet: (sheetId: string, direction: -1 | 1) => void;
  onMoveSheetToEnd: (sheetId: string) => void;
  onDeleteSheet: (sheetId: string) => void;
  onSelectPlacement: (
    placementId: string | undefined,
    options?: { additive?: boolean }
  ) => void;
  onSelectionChange: (selection: DrawingCanvasSelection) => void;
  onPlacementChange: (
    placementId: string,
    updates: Partial<DrawingSheetCanvasModel["placements"][number]>
  ) => void;
  onSelectionMove: (input: {
    selection: DrawingCanvasSelection;
    delta: { x: number; y: number };
    baseModel?: DrawingSheetCanvasModel;
  }) => void;
  onPlacementRemove: (placementId: string) => void;
  onSelectionRemove: () => void;
  selectedAnnotationId?: string;
  onAnnotationSelect: (
    annotationId: string | undefined,
    options?: { additive?: boolean }
  ) => void;
  onAnnotationChange: (
    annotationId: string,
    updates: Partial<DrawingAnnotation>
  ) => void;
  onAnnotationGroupChange: (
    updates: Array<{
      annotationId: string;
      updates: Partial<DrawingAnnotation>;
    }>
  ) => void;
  onDragStart: (state: DragState) => void;
  onDragMove: (input: {
    selection: DrawingCanvasSelection;
    delta: { x: number; y: number };
    baseModel?: DrawingSheetCanvasModel;
  }) => void;
  onDragEnd: () => void;
  onGestureStart: () => void;
  onGestureEnd: () => void;
  onGestureCancel: () => void;
  onCopySelection: () => void;
  onPasteSelection: () => void;
  onUndo: () => void;
  onRedo: () => void;
  connectionMode: "idle" | "connecting";
  connectionDraft: ConnectionDraft;
  selectedConnectionId?: string;
  onConnectionAnchorClick: (endpoint: DrawingEndpoint) => void;
  onConnectionPointerMove: (pointer: { x: number; y: number }) => void;
  onConnectionSelect: (connectionId: string | undefined) => void;
  onConnectionRouteChange: (
    connectionId: string,
    route: DrawingConnectionRoute
  ) => void;
  onConnectionRemove: (connectionId: string) => void;
  onConnectionCancel: () => void;
  getConnectionAnchorState?: (endpoint: DrawingEndpoint) => {
    enabled: boolean;
    reason?: string;
  };
  onViewportCenterChange?: (point: { x: number; y: number }) => void;
  statusMessage?: string | null;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const didInitialFitRef = useRef(false);
  const lastFocusSheetRequestKeyRef = useRef(focusSheetRequestKey);
  const activeSheetFrameRef = useRef<HTMLDivElement | null>(null);
  const scrollCenterSyncTimeoutRef = useRef<number | null>(null);
  const zoomAnchorAnimationFrameRef = useRef<number | null>(null);
  const latestZoomRef = useRef(viewportTransform.zoom);
  const pendingActiveSheetScrollRef = useRef(false);
  const pendingActiveSheetScrollBehaviorRef = useRef<ScrollBehavior>("smooth");
  const lastViewportCenterRef = useRef<{ x: number; y: number } | null>(null);
  const [activeAnchorId, setActiveAnchorId] = useState<string | null>(null);
  const [selectedRoutePointId, setSelectedRoutePointId] = useState<string | null>(
    null
  );
  const [selectedAnnotationLeaderId, setSelectedAnnotationLeaderId] = useState<
    string | null
  >(null);
  const sheetCount = drawingModel.sheets.length;
  const activeSheetIndex = Math.max(
    0,
    drawingModel.sheets.findIndex((sheet) => sheet.id === activeSheetId)
  );
  const activeSheet =
    drawingModel.sheets[activeSheetIndex] ?? drawingModel.sheets[0]!;
  const effectiveActiveSheetId = activeSheet.id;
  const activeSectionMembership =
    drawingSectionIndex.membershipBySheetId.get(effectiveActiveSheetId);
  const activeSection =
    activeSectionMembership?.kind === "section"
      ? drawingSectionIndex.sections.find(
          (section) => section.id === activeSectionMembership.sectionId
        )
      : undefined;
  const model = useMemo(
    () => toSheetCanvasModel(drawingModel, effectiveActiveSheetId),
    [drawingModel, effectiveActiveSheetId]
  );
  const panelConnectionPatterns = useMemo(
    () => [
      ...(drawingModel.panelWiring?.bridges ?? []).map((record) => ({
        recordType: "bridge" as const,
        record
      })),
      ...(drawingModel.panelWiring?.bonds ?? []).map((record) => ({
        recordType: "bond" as const,
        record
      }))
    ],
    [drawingModel.panelWiring?.bonds, drawingModel.panelWiring?.bridges]
  );
  const panelPatternById = useMemo(
    () =>
      new Map(
        panelConnectionPatterns.map((pattern) => [pattern.record.id, pattern])
      ),
    [panelConnectionPatterns]
  );
  const activeSheetNumber = activeSheetIndex + 1;
  const activeFrame = useMemo<ActiveSheetFrame>(() => {
    const sectionTitle = activeSheet?.sectionTitlePage?.title?.trim();

    return {
      sheet: activeSheet,
      sheetNumber: activeSheetNumber,
      canvasModel: model,
      renderedSvg: measureDrawingOperation(
        "canvas.svg",
        () =>
          renderDrawingToSvg({
            model,
            approvedSymbols: symbols,
            showAnchors: false,
            showConnections: false,
            sheetNumber: activeSheetNumber,
            sheetCount,
            drawingTitle,
            sheetTitle:
              activeSheet?.kind === "section_title" && sectionTitle
                ? sectionTitle
                : activeSheet?.name,
            sheetKind: activeSheet?.kind,
            sectionTitlePage: activeSheet?.sectionTitlePage,
            derivedSectionNumber: activeSection?.number,
            panelConnectionPatterns,
            panelExternalTerminations
          }),
        { sheetId: activeSheet?.id ?? "missing" }
      )
    };
  }, [activeSection?.number, activeSheet, activeSheetNumber, drawingTitle, model, panelConnectionPatterns, panelExternalTerminations, sheetCount, symbols]);
  const activeGroupSheetIds =
    activeSectionMembership?.kind === "section"
      ? activeSectionMembership.isTitlePage
        ? drawingSectionIndex.sections.map((section) => section.id)
        : activeSection?.memberSheetIds ?? []
      : drawingSectionIndex.frontMatterSheetIds;
  const activeGroupIndex = activeGroupSheetIds.indexOf(effectiveActiveSheetId);
  const canMoveActiveSheetUp = activeGroupIndex > 0;
  const canMoveActiveSheetDown =
    activeGroupIndex >= 0 && activeGroupIndex < activeGroupSheetIds.length - 1;
  const canMoveActiveSheetToEnd = canMoveActiveSheetDown;
  const canDeleteActiveSheet = sheetCount > 1;
  const activeSheetPresentation = activeSheet
    ? getDrawingSheetPresentation(activeSheet)
    : undefined;
  const selectedPlacementIds = useMemo(
    () => new Set(selection.placementIds),
    [selection.placementIds]
  );
  const selectedAnnotationIds = useMemo(
    () => new Set(selection.annotationIds),
    [selection.annotationIds]
  );
  const [marquee, setMarquee] = useState<{
    pointerId: number;
    start: { x: number; y: number };
    current: { x: number; y: number };
  } | null>(null);

  useEffect(() => {
    latestZoomRef.current = viewportTransform.zoom;
  }, [viewportTransform.zoom]);

  const sheetPixelSize = useMemo(
    () => ({
      width: model.sheet.width * SHEET_PIXEL_SCALE,
      height: model.sheet.height * SHEET_PIXEL_SCALE
    }),
    [model.sheet.height, model.sheet.width]
  );
  const interactiveModel = useMemo(() => {
    if (!dragState?.previewDelta) {
      return model;
    }

    return moveCanvasSelection({
      model: dragState.startModel,
      selection: {
        placementIds: dragState.placementIds,
        annotationIds: []
      },
      delta: dragState.previewDelta,
      symbols
    });
  }, [dragState, model, symbols]);
  const backplaneById = useMemo(
    () =>
      new Map(
        interactiveModel.placements
          .filter(isBackplanePlacement)
          .map((placement) => [placement.id, placement])
      ),
    [interactiveModel.placements]
  );
  const renderPlacementForSheet = useCallback(
    (placement: DrawingSheetCanvasModel["placements"][number]) => {
      const parentBackplane =
        isLayoutHelperPlacement(placement) && placement.layoutParentId
          ? backplaneById.get(placement.layoutParentId)
          : undefined;

      return parentBackplane
        ? resolveLayoutHelperDisplayPlacement({
            sheet: interactiveModel.sheet,
            placement,
            backplane: parentBackplane
          })
        : placement;
    },
    [backplaneById, interactiveModel.sheet]
  );
  const anchorHotspots = useMemo(
    () =>
      interactiveModel.placements.flatMap((placement) => {
        const symbol = getRenderableSymbolForPlacement(placement, symbols);

        if (!symbol) {
          return [];
        }

        const renderPlacement = renderPlacementForSheet(placement);

        return symbol.metadata.anchors.map((anchor) => ({
          id: `${placement.id}:${anchor.key}`,
          placementId: placement.id,
          placementTag: placement.tag,
          symbolName: symbol.displayName,
          symbolModel: symbol.model,
          anchor,
          terminal: symbol.metadata.terminals.find(
            (terminal) => terminal.anchorKey === anchor.key
          ),
          point: getAnchorWorldPoint(renderPlacement, symbol.metadata, anchor)
        }));
      }),
    [interactiveModel.placements, renderPlacementForSheet, symbols]
  );
  const connectionSegments: ConnectionSegment[] = useMemo(
    () =>
      interactiveModel.connections.flatMap((connection) => {
        if (
          (workspaceContext === "detailed_panel" &&
            !connection.panelConnectionId &&
            !connection.panelPatternId) ||
          (workspaceContext !== "detailed_panel" &&
            (connection.panelConnectionId || connection.panelPatternId))
        ) {
          return [];
        }
        const panelPattern = connection.panelPatternId
          ? panelPatternById.get(connection.panelPatternId)
          : undefined;
        const panelWire = connection.panelConnectionId
          ? drawingModel.panelWiring?.internalWires.find(
              (wire) => wire.id === connection.panelConnectionId
            )
          : undefined;
        const displayConnection = panelPattern
          ? {
              ...connection,
              wireId: getPanelPatternRouteLabel({
                pattern: panelPattern,
                wire: panelWire
              })
            }
          : panelWire
            ? { ...connection, wireId: panelWire.wireId }
            : connection;
        const rendered = getRenderableConnectionRoute({
          model: interactiveModel,
          symbols,
          connection: displayConnection
        });

        if (!rendered) {
          return [];
        }

        return [rendered];
      }),
    [
      drawingModel.panelWiring?.internalWires,
      interactiveModel,
      panelPatternById,
      symbols,
      workspaceContext
    ]
  );
  const placementTitleLabels: PlacementTitleLabel[] = useMemo(
    () =>
      interactiveModel.placements.flatMap((placement) => {
        const symbol = getRenderableSymbolForPlacement(placement, symbols);

        if (isLayoutHelperPlacement(placement)) {
          return [];
        }

        const renderPlacement = renderPlacementForSheet(placement);

        if (!symbol || !shouldShowPlacementTitle(renderPlacement, symbol)) {
          return [];
        }

        return [
          {
            placementId: placement.id,
            label: getPlacementDisplayTitle(renderPlacement, symbol),
            point: getPlacementTitlePoint(renderPlacement)
          }
        ];
      }),
    [interactiveModel.placements, renderPlacementForSheet, symbols]
  );
  const selectedConnectionSegment =
    connectionSegments.find(
      (segment) => segment.connection.id === selectedConnectionId
    ) ?? null;
  const selectedPlacementTitle =
    placementTitleLabels.find(
      (label) => label.placementId === selectedPlacementId
    ) ?? null;
  const activeAnchorHotspot =
    anchorHotspots.find((hotspot) => hotspot.id === activeAnchorId) ?? null;
  const sourceAnchorHotspot =
    connectionDraft.from
      ? anchorHotspots.find(
          (hotspot) =>
            hotspot.placementId === connectionDraft.from?.placementId &&
            hotspot.anchor.key === connectionDraft.from.anchorKey
        )
      : undefined;
  const anchorScreenScale = SHEET_PIXEL_SCALE * viewportTransform.zoom;
  const anchorMarkerRadius = 2.8 / anchorScreenScale;
  const anchorHitRadius = 4 / anchorScreenScale;
  const anchorGlowRadius = 6.5 / anchorScreenScale;
  const anchorStrokeWidth = 0.55 / anchorScreenScale;

  const scrollActiveSheetIntoView = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      const viewportElement = viewportRef.current;
      const frameElement = activeSheetFrameRef.current;
      const paperElement = frameElement?.querySelector<HTMLElement>(
        "[data-sheet-paper]"
      );

      if (!viewportElement || !paperElement) {
        frameElement?.scrollIntoView({
          block: "center",
          inline: "center",
          behavior
        });
        return;
      }

      const viewportRect = viewportElement.getBoundingClientRect();
      const paperRect = paperElement.getBoundingClientRect();
      const scale = SHEET_PIXEL_SCALE * viewportTransform.zoom;
      const desiredLeft =
        viewportElement.scrollLeft +
        paperRect.left -
        viewportRect.left +
        viewportCenter.x * scale -
        viewportRect.width / 2;
      const desiredTop =
        viewportElement.scrollTop +
        paperRect.top -
        viewportRect.top +
        viewportCenter.y * scale -
        viewportRect.height / 2;

      viewportElement.scrollTo({
        left: Math.max(0, desiredLeft),
        top: Math.max(0, desiredTop),
        behavior
      });
    },
    [viewportCenter.x, viewportCenter.y, viewportTransform.zoom]
  );

  const requestActiveSheetScroll = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      pendingActiveSheetScrollRef.current = true;
      pendingActiveSheetScrollBehaviorRef.current = behavior;
    },
    []
  );

  useEffect(() => {
    if (
      focusSheetRequestKey === undefined ||
      focusSheetRequestKey === lastFocusSheetRequestKeyRef.current
    ) {
      return;
    }

    lastFocusSheetRequestKeyRef.current = focusSheetRequestKey;
    requestActiveSheetScroll();
  }, [focusSheetRequestKey, requestActiveSheetScroll]);

  const scheduleZoomAnchorCorrection = useCallback(
    (anchor: ZoomAnchor) => {
      if (zoomAnchorAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(zoomAnchorAnimationFrameRef.current);
      }

      const applyAnchorCorrection = () => {
        const viewportElement = viewportRef.current;
        const frame = activeSheetFrameRef.current;
        const paper = frame?.querySelector<HTMLElement>("[data-sheet-paper]");

        if (
          !viewportElement ||
          !paper ||
          frame?.dataset.sheetId !== anchor.sheetId
        ) {
          return;
        }

        const paperRect = paper.getBoundingClientRect();
        const nextScroll = calculateScrollForZoomAnchor({
          scrollLeft: viewportElement.scrollLeft,
          scrollTop: viewportElement.scrollTop,
          paperLeft: paperRect.left,
          paperTop: paperRect.top,
          pointerClientX: anchor.clientX,
          pointerClientY: anchor.clientY,
          sheetX: anchor.sheetX,
          sheetY: anchor.sheetY,
          nextScale: SHEET_PIXEL_SCALE * anchor.nextZoom
        });
        const previousScrollBehavior = viewportElement.style.scrollBehavior;

        viewportElement.style.scrollBehavior = "auto";
        viewportElement.scrollLeft = nextScroll.left;
        viewportElement.scrollTop = nextScroll.top;
        window.requestAnimationFrame(() => {
          viewportElement.style.scrollBehavior = previousScrollBehavior;
        });
      };

      zoomAnchorAnimationFrameRef.current = window.requestAnimationFrame(() => {
        applyAnchorCorrection();
        zoomAnchorAnimationFrameRef.current = window.requestAnimationFrame(() => {
          zoomAnchorAnimationFrameRef.current = null;
          applyAnchorCorrection();
        });
      });
    },
    []
  );

  useEffect(() => {
    if (!pendingActiveSheetScrollRef.current) {
      return;
    }

    const behavior = pendingActiveSheetScrollBehaviorRef.current;
    const animationFrameId = window.requestAnimationFrame(() => {
      scrollActiveSheetIntoView(behavior);
      pendingActiveSheetScrollRef.current = false;
    });

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      pendingActiveSheetScrollRef.current = false;
    };
  }, [
    activeSheetId,
    drawingModel.sheets,
    scrollActiveSheetIntoView,
    viewportTransform.zoom
  ]);

  const syncViewportCenterState = useCallback(() => {
    const viewportElement = viewportRef.current;
    const frameElement = activeSheetFrameRef.current;
    const paperElement = frameElement?.querySelector<HTMLElement>(
      "[data-sheet-paper]"
    );

    if (!viewportElement || !paperElement || !onViewportCenterChange) {
      return;
    }

    const viewportRect = viewportElement.getBoundingClientRect();
    const viewportCenterX = viewportRect.left + viewportRect.width / 2;
    const viewportCenterY = viewportRect.top + viewportRect.height / 2;
    const paperRect = paperElement.getBoundingClientRect();
    const scale = SHEET_PIXEL_SCALE * viewportTransform.zoom;
    const x = (viewportCenterX - paperRect.left) / scale;
    const y = (viewportCenterY - paperRect.top) / scale;

    const nextViewportCenter = {
      x: Number(
        Math.max(0, Math.min(model.sheet.width, x)).toFixed(2)
      ),
      y: Number(
        Math.max(0, Math.min(model.sheet.height, y)).toFixed(2)
      )
    };
    const lastViewportCenter = lastViewportCenterRef.current;

    if (
      lastViewportCenter?.x === nextViewportCenter.x &&
      lastViewportCenter.y === nextViewportCenter.y
    ) {
      return;
    }

    lastViewportCenterRef.current = nextViewportCenter;
    onViewportCenterChange(nextViewportCenter);
  }, [model.sheet.height, model.sheet.width, onViewportCenterChange, viewportTransform.zoom]);

  const handleViewportScroll = useCallback(() => {
    if (scrollCenterSyncTimeoutRef.current !== null) {
      window.clearTimeout(scrollCenterSyncTimeoutRef.current);
    }

    scrollCenterSyncTimeoutRef.current = window.setTimeout(() => {
      scrollCenterSyncTimeoutRef.current = null;
      syncViewportCenterState();
    }, 120);
  }, [syncViewportCenterState]);

  useEffect(() => {
    syncViewportCenterState();
  }, [syncViewportCenterState]);

  useEffect(
    () => () => {
      if (scrollCenterSyncTimeoutRef.current !== null) {
        window.clearTimeout(scrollCenterSyncTimeoutRef.current);
      }

      if (zoomAnchorAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(zoomAnchorAnimationFrameRef.current);
      }
    },
    []
  );

  const fitToViewport = useCallback(() => {
    const viewportElement = viewportRef.current;

    if (!viewportElement) {
      return;
    }

    const viewportSize = getViewportSize(viewportElement);
    const fitTransform = calculateFitTransform(viewportSize, sheetPixelSize);
    setViewportTransform({
      zoom: fitTransform.zoom,
      panX: 0,
      panY: 0
    });
    requestActiveSheetScroll();
  }, [requestActiveSheetScroll, setViewportTransform, sheetPixelSize]);

  const setActualSize = useCallback(() => {
    setViewportTransform((current) => ({ ...current, zoom: 1, panX: 0, panY: 0 }));
    requestActiveSheetScroll();
  }, [requestActiveSheetScroll, setViewportTransform]);

  const zoomByStep = useCallback(
    (direction: "in" | "out") => {
      setViewportTransform((current) => ({
        ...current,
        zoom:
          direction === "in"
            ? clampZoom(current.zoom * ZOOM_STEP)
            : clampZoom(current.zoom / ZOOM_STEP),
        panX: 0,
        panY: 0
      }));
      requestActiveSheetScroll();
    },
    [requestActiveSheetScroll, setViewportTransform]
  );

  const handleWheel = useCallback(
    (event: WheelEvent<HTMLDivElement>) => {
      if (!event.ctrlKey) {
        return;
      }

      event.preventDefault();
      const currentZoom = latestZoomRef.current;
      const anchor = zoomAnchorFromPointer({
        clientX: event.clientX,
        clientY: event.clientY,
        zoom: currentZoom
      });
      const nextZoom = clampZoom(currentZoom * Math.exp(-event.deltaY * 0.0015));

      latestZoomRef.current = nextZoom;
      pendingActiveSheetScrollRef.current = false;

      setViewportTransform((current) => ({
        ...current,
        zoom: nextZoom,
        panX: 0,
        panY: 0
      }));

      if (anchor) {
        scheduleZoomAnchorCorrection({
          ...anchor,
          nextZoom
        });
      }
    },
    [
      scheduleZoomAnchorCorrection,
      setViewportTransform
    ]
  );

  useEffect(() => {
    const viewportElement = viewportRef.current;

    if (!viewportElement) {
      return;
    }

    const runInitialFit = () => {
      const viewportSize = getViewportSize(viewportElement);

      if (
        didInitialFitRef.current ||
        viewportSize.width <= 0 ||
        viewportSize.height <= 0
      ) {
        return;
      }

      didInitialFitRef.current = true;
      const fitTransform = calculateFitTransform(viewportSize, sheetPixelSize);
      setViewportTransform({
        zoom: fitTransform.zoom,
        panX: 0,
        panY: 0
      });
      requestActiveSheetScroll("auto");
    };

    runInitialFit();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(runInitialFit);
    observer.observe(viewportElement);

    return () => observer.disconnect();
  }, [
    requestActiveSheetScroll,
    setViewportTransform,
    sheetPixelSize
  ]);

  const updateConnectionPointer = useCallback(
    (event: PointerEvent<SVGElement>) => {
      if (connectionMode !== "connecting" || !connectionDraft.from) {
        return;
      }

      onConnectionPointerMove(toSvgPoint(event, model.sheet));
    },
    [connectionDraft.from, connectionMode, model.sheet, onConnectionPointerMove]
  );

  const focusCanvas = useCallback(() => {
    viewportRef.current?.focus();
  }, []);
  const {
    isPanning: isScrollPanning,
    startMiddleButtonPan,
    updateMiddleButtonPan,
    endMiddleButtonPan,
    preventMiddleButtonAutoscroll
  } = useSheetScrollPan({
    viewportRef,
    onPanStart: () => setActiveAnchorId(null)
  });

  const {
    updateDraggedRoutePoint,
    handleRoutePointPointerDown,
    endRoutePointDrag,
    cancelRoutePointDrag,
    deleteRoutePoint
  } = useRoutePointDrag({
    model,
    connectionSegments,
    selectedConnectionSegment,
    onFocusCanvas: focusCanvas,
    onConnectionSelect,
    onConnectionRouteChange,
    setSelectedRoutePointId,
    onGestureStart,
    onGestureEnd,
    onGestureCancel
  });

  const {
    updateDraggedRouteLabel,
    handleRouteLabelPointerDown,
    endRouteLabelDrag,
    cancelRouteLabelDrag
  } = useRouteLabelDrag({
    model,
    connectionSegments,
    selectedConnectionSegment,
    onFocusCanvas: focusCanvas,
    onConnectionSelect,
    onConnectionRouteChange,
    setSelectedRoutePointId,
    onGestureStart,
    onGestureEnd,
    onGestureCancel
  });

  const {
    updateDraggedPlacementTitle,
    handlePlacementTitlePointerDown,
    endPlacementTitleDrag,
    cancelPlacementTitleDrag
  } = usePlacementTitleDrag({
    model,
    placementTitleLabels,
    selectedPlacementTitle,
    onFocusCanvas: focusCanvas,
    onSelectPlacement,
    onConnectionSelect,
    onPlacementChange,
    onGestureStart,
    onGestureEnd,
    onGestureCancel
  });

  const selectHotspotPlacement = useCallback(
    (event: PointerEvent<SVGSVGElement>) => {
      if (event.button !== 0 || connectionMode === "connecting") {
        return;
      }

      const target =
        event.target instanceof Element ? event.target : null;
      const hotspot = target?.closest("[data-anchor-hotspot]");
      const hotspotId = hotspot?.getAttribute("data-anchor-hotspot");
      const placementId = hotspotId?.split(":")[0];

      if (!placementId) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      viewportRef.current?.focus();
      onSelectPlacement(placementId);
      onConnectionSelect(undefined);
      setSelectedAnnotationLeaderId(null);
    },
    [connectionMode, onConnectionSelect, onSelectPlacement]
  );

  const {
    handlePlacementResizeStart: startPlacementResize,
    updatePlacementFromResize,
    endPlacementResize: finishPlacementResize,
    dimensionSnapFeedback,
    clearDimensionSnapFeedback
  } = usePlacementResize({
    model,
    symbols,
    screenScale: anchorScreenScale,
    onPlacementChange
  });
  const {
    handlePlacementRotationStart: startPlacementRotation,
    updatePlacementFromRotation,
    endPlacementRotation: finishPlacementRotation
  } = usePlacementRotation({
    model,
    onPlacementChange
  });

  const handlePlacementResizeStart = useCallback(
    (state: Parameters<typeof startPlacementResize>[0]) => {
      onGestureStart();
      startPlacementResize(state);
    },
    [onGestureStart, startPlacementResize]
  );

  const endPlacementResize = useCallback(() => {
    finishPlacementResize();
    onGestureEnd();
  }, [finishPlacementResize, onGestureEnd]);

  const cancelPlacementResize = useCallback(() => {
    finishPlacementResize();
    onGestureCancel();
  }, [finishPlacementResize, onGestureCancel]);

  useEffect(() => {
    clearDimensionSnapFeedback();
  }, [
    clearDimensionSnapFeedback,
    effectiveActiveSheetId,
    selectedPlacementId
  ]);

  const handlePlacementRotationStart = useCallback(
    (state: Parameters<typeof startPlacementRotation>[0]) => {
      onGestureStart();
      startPlacementRotation(state);
    },
    [onGestureStart, startPlacementRotation]
  );

  const endPlacementRotation = useCallback(() => {
    finishPlacementRotation();
    onGestureEnd();
  }, [finishPlacementRotation, onGestureEnd]);

  const cancelPlacementRotation = useCallback(() => {
    finishPlacementRotation();
    onGestureCancel();
  }, [finishPlacementRotation, onGestureCancel]);

  const clearCanvasSelection = useCallback(() => {
    onSelectPlacement(undefined);
    onConnectionSelect(undefined);
    onAnnotationSelect(undefined);
    setSelectedAnnotationLeaderId(null);
  }, [onAnnotationSelect, onConnectionSelect, onSelectPlacement]);

  const handlePlacementDragStart = useCallback(
    (state: DragState) => {
      onGestureStart();
      onDragStart(state);
    },
    [onDragStart, onGestureStart]
  );

  const handlePlacementDragEnd = useCallback(() => {
    onDragEnd();
    onGestureEnd();
  }, [onDragEnd, onGestureEnd]);

  const handlePlacementDragCancel = useCallback(() => {
    onGestureCancel();
  }, [onGestureCancel]);

  const deleteSelectedRoutePoint = useCallback(() => {
    if (!selectedRoutePointId) {
      return;
    }

    deleteRoutePoint(selectedRoutePointId);
  }, [deleteRoutePoint, selectedRoutePointId]);

  const nudgeSelected = useCallback(
    (direction: "up" | "down" | "left" | "right") => {
      const delta = {
        x:
          direction === "left"
            ? -NOTE_NUDGE_STEP
            : direction === "right"
              ? NOTE_NUDGE_STEP
              : 0,
        y:
          direction === "up"
            ? -NOTE_NUDGE_STEP
            : direction === "down"
              ? NOTE_NUDGE_STEP
              : 0
      };

      if (selectedConnectionSegment && selectedRoutePointId) {
        const routePoint = selectedConnectionSegment.route.points.find(
          (point) => point.id === selectedRoutePointId
        );

        if (routePoint && routePoint.kind !== "endpoint") {
          onConnectionRouteChange(
            selectedConnectionSegment.connection.id,
            updateRoutePoint({
              route: selectedConnectionSegment.route,
              pointId: selectedRoutePointId,
              point: {
                x: routePoint.x + delta.x,
                y: routePoint.y + delta.y
              },
              sheet: model.sheet
            })
          );
        }

        return;
      }

      if (selectedAnnotationLeaderId) {
        const annotation = model.annotations.find(
          (candidate) => candidate.id === selectedAnnotationLeaderId
        );

        if (annotation?.leader?.enabled) {
          const target = clampPointToSheet(
            {
              x: annotation.leader.targetX + delta.x,
              y: annotation.leader.targetY + delta.y
            },
            model.sheet
          );
          onAnnotationChange(annotation.id, {
            leader: {
              ...annotation.leader,
              targetX: target.x,
              targetY: target.y
            }
          });
        }

        return;
      }

      onSelectionMove({ selection, delta });
    },
    [
      model.annotations,
      model.sheet,
      onAnnotationChange,
      onConnectionRouteChange,
      onSelectionMove,
      selection,
      selectedAnnotationLeaderId,
      selectedConnectionSegment,
      selectedRoutePointId
    ]
  );

  const selectAnnotation = useCallback(
    (
      annotationId: string | undefined,
      options?: { additive?: boolean }
    ) => {
      onAnnotationSelect(annotationId, options);

      if (annotationId) {
        onConnectionSelect(undefined);
        setSelectedRoutePointId(null);
      } else {
        setSelectedAnnotationLeaderId(null);
      }
    },
    [onAnnotationSelect, onConnectionSelect]
  );

  const handleCanvasKeyDown = useCanvasKeyboardShortcuts({
    connectionMode,
    selection,
    canDeleteSelectedRoutePoint: Boolean(
      selectedConnectionSegment && selectedRoutePointId
    ),
    hasSelectedConnection: Boolean(selectedConnectionId),
    onConnectionCancel,
    onGestureCancel,
    onClearSelection: clearCanvasSelection,
    onCopySelection,
    onDeleteSelectedRoutePoint: deleteSelectedRoutePoint,
    onDeleteSelectedConnection: () => {
      if (selectedConnectionId) {
        onConnectionRemove(selectedConnectionId);
      }
    },
    onDeleteSelection: onSelectionRemove,
    onNudgeSelected: nudgeSelected,
    onPasteSelection,
    onRedo,
    onUndo
  });

  const handleSheetPointerDown = useCallback(
    (event: PointerEvent<SVGSVGElement>) => {
      if (event.target !== event.currentTarget || event.button !== 0) {
        return;
      }

      viewportRef.current?.focus();
      onConnectionSelect(undefined);
      setSelectedAnnotationLeaderId(null);
      setSelectedRoutePointId(null);

      if (connectionMode === "connecting") {
        return;
      }

      const point = toSvgPoint(event, model.sheet);

      event.currentTarget.setPointerCapture(event.pointerId);
      setMarquee({
        pointerId: event.pointerId,
        start: point,
        current: point
      });
    },
    [
      connectionMode,
      model.sheet,
      onConnectionSelect
    ]
  );

  const handleSheetPointerMove = useCallback(
    (event: PointerEvent<SVGSVGElement>) => {
      updateConnectionPointer(event);
      const point = toSvgPoint(event, model.sheet);

      setMarquee((current) =>
        current?.pointerId === event.pointerId
          ? {
              ...current,
              current: point
            }
          : current
      );
    },
    [
      model.sheet,
      updateConnectionPointer
    ]
  );

  const finishMarquee = useCallback(
    (event: PointerEvent<SVGSVGElement>) => {
      if (!marquee || marquee.pointerId !== event.pointerId) {
        return;
      }

      const end = toSvgPoint(event, model.sheet);
      const deltaX = Math.abs(end.x - marquee.start.x);
      const deltaY = Math.abs(end.y - marquee.start.y);

      setMarquee(null);

      if (deltaX < 1 && deltaY < 1) {
        onSelectionChange({ ...EMPTY_CANVAS_SELECTION });
        return;
      }

      onSelectionChange(
        getMarqueeSelection({
          model,
          symbols,
          start: marquee.start,
          end
        })
      );
    },
    [marquee, model, onSelectionChange, symbols]
  );

  const runSheetAction = useCallback(
    (action: () => void) => {
      requestActiveSheetScroll();
      action();
    },
    [requestActiveSheetScroll]
  );
  const activeFramePixelSize = {
    width: Number(
      (model.sheet.width * SHEET_PIXEL_SCALE * viewportTransform.zoom).toFixed(3)
    ),
    height: Number(
      (model.sheet.height * SHEET_PIXEL_SCALE * viewportTransform.zoom).toFixed(3)
    )
  };

  return (
    <section className="tool-panel drawing-canvas-panel overflow-hidden">
      {statusMessage ? (
        <div
          className="drawing-canvas-toast"
          role="status"
          data-testid="drawing-toast"
        >
          <CheckCircle2 aria-hidden="true" size={16} className="shrink-0" />
          <span>{statusMessage}</span>
        </div>
      ) : null}
      <div className="drawing-canvas-header">
        <div className="min-w-0">
          <h2 className="text-sm font-bold">
            {activeSheetPresentation?.heading ?? "Drawing Sheet"}
          </h2>
          <p
            className="mt-0.5 truncate text-xs font-medium text-slate-500"
            data-testid="active-sheet-readout"
          >
            Sheet {activeSheetNumber} of {sheetCount}
            {activeFrame?.sheet.name ? ` / ${activeFrame.sheet.name}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="icon-button h-8 px-3"
              aria-label="Open sheet loader"
              title="Open sheet loader"
              onClick={onOpenSheetLoader}
            >
              <List aria-hidden="true" size={14} />
              Sheets
            </button>
            <button
              type="button"
              className="icon-button h-8 w-8 p-0"
              aria-label={
                activeSheet.kind === "section_title"
                  ? "Move active section up"
                  : "Move active sheet up within section"
              }
              title={
                activeSheet.kind === "section_title"
                  ? "Move active section up"
                  : "Move sheet up within section"
              }
              disabled={!canMoveActiveSheetUp}
              onClick={() =>
                runSheetAction(() => onMoveSheet(effectiveActiveSheetId, -1))
              }
            >
              <ChevronUp aria-hidden="true" size={14} />
            </button>
            <button
              type="button"
              className="icon-button h-8 w-8 p-0"
              aria-label={
                activeSheet.kind === "section_title"
                  ? "Move active section down"
                  : "Move active sheet down within section"
              }
              title={
                activeSheet.kind === "section_title"
                  ? "Move active section down"
                  : "Move sheet down within section"
              }
              disabled={!canMoveActiveSheetDown}
              onClick={() =>
                runSheetAction(() => onMoveSheet(effectiveActiveSheetId, 1))
              }
            >
              <ChevronDown aria-hidden="true" size={14} />
            </button>
            <button
              type="button"
              className="icon-button h-8 w-8 p-0"
              aria-label={
                activeSheet.kind === "section_title"
                  ? "Move active section to end"
                  : "Move active sheet to end of section"
              }
              title={
                activeSheet.kind === "section_title"
                  ? "Move section to end"
                  : "Move sheet to end of section"
              }
              disabled={!canMoveActiveSheetToEnd}
              onClick={() =>
                runSheetAction(() => onMoveSheetToEnd(effectiveActiveSheetId))
              }
            >
              <ChevronsDown aria-hidden="true" size={14} />
            </button>
            {workspaceContext !== "detailed_panel" &&
            activeSheet.kind !== "section_title" ? <button
              type="button"
              className="icon-button h-8 w-8 p-0"
              aria-label="Save active sheet as template"
              title="Save active sheet as template"
              onClick={onSaveSheetTemplate}
            >
              <Save aria-hidden="true" size={14} />
            </button> : null}
            <button
              type="button"
              className="icon-button h-8 w-8 p-0"
              aria-label="Add sheet from template"
              title="Add sheet from template"
              onClick={onAddSheetFromTemplate}
            >
              <BookOpen aria-hidden="true" size={14} />
            </button>
            <button
              type="button"
              className="icon-button h-8 w-8 p-0"
              aria-label="Duplicate active sheet"
              title="Duplicate active sheet"
              onClick={() =>
                runSheetAction(() => onDuplicateSheet(effectiveActiveSheetId))
              }
            >
              <Copy aria-hidden="true" size={14} />
            </button>
            <button
              type="button"
              className="icon-button h-8 w-8 p-0"
              aria-label="Delete active sheet"
              title="Delete active sheet"
              disabled={!canDeleteActiveSheet}
              onClick={() =>
                runSheetAction(() => onDeleteSheet(effectiveActiveSheetId))
              }
            >
              <Trash2 aria-hidden="true" size={14} />
            </button>
          </div>
          <DrawingViewportToolbar
            zoom={viewportTransform.zoom}
            onFit={fitToViewport}
            onActualSize={setActualSize}
            onZoomIn={() => zoomByStep("in")}
            onZoomOut={() => zoomByStep("out")}
          />
        </div>
      </div>
      <div className="drawing-canvas-viewport-shell">
        <DrawingCanvasAddMenu
          onAddPanel={onAddPanel}
          onAddTerminalBlock={onAddTerminalBlock}
          onAddSheet={() => runSheetAction(onAddSheet)}
          showDrawingItems={workspaceContext === "field_drawing"}
        />
        <div
          ref={viewportRef}
          className={[
            "drawing-canvas-viewport",
            isScrollPanning ? "drawing-canvas-viewport-middle-panning" : ""
          ].join(" ")}
          data-testid="drawing-canvas-viewport"
          onWheel={handleWheel}
          onScroll={handleViewportScroll}
          onAuxClick={preventMiddleButtonAutoscroll}
          onMouseDown={preventMiddleButtonAutoscroll}
          onPointerDownCapture={startMiddleButtonPan}
          onPointerMove={updateMiddleButtonPan}
          onPointerUp={endMiddleButtonPan}
          onPointerCancel={endMiddleButtonPan}
          onPointerDown={(event) => {
            if (event.target !== event.currentTarget) {
              return;
            }

            viewportRef.current?.focus();
            onSelectPlacement(undefined);
            onAnnotationSelect(undefined);
            setSelectedAnnotationLeaderId(null);
          }}
          onKeyDown={handleCanvasKeyDown}
          tabIndex={0}
        >
          <div className="drawing-sheet-stack" data-testid="drawing-sheet-stack">
            <div
              ref={(element) => {
                activeSheetFrameRef.current = element;
              }}
              className="drawing-sheet-frame drawing-sheet-frame-active"
              data-testid="drawing-sheet-frame"
              data-sheet-id={effectiveActiveSheetId}
              data-sheet-width={model.sheet.width}
              data-sheet-height={model.sheet.height}
              data-active-sheet="true"
            >
              <div className="drawing-sheet-caption">
                <span className="drawing-sheet-caption-index">
                  Sheet {activeSheetNumber} of {sheetCount}
                </span>
                <span className="drawing-sheet-caption-name">
                  {activeFrame.sheet.name}
                </span>
              </div>
              <div
                className="drawing-sheet-stage"
                data-testid="drawing-sheet-stage"
                style={{
                  width: `${activeFramePixelSize.width}px`,
                  height: `${activeFramePixelSize.height}px`
                }}
              >
                <div className="drawing-sheet-paper" data-sheet-paper="true">
                  <div
                    className="drawing-sheet-rendered"
                    dangerouslySetInnerHTML={{ __html: activeFrame.renderedSvg }}
                  />
                      <>
                        <svg
                          className="absolute inset-0 h-full w-full"
                          viewBox={`0 0 ${model.sheet.width} ${model.sheet.height}`}
                          aria-label="Interactive drawing overlay"
                          pointerEvents="all"
                          onPointerDownCapture={selectHotspotPlacement}
                          onPointerDown={handleSheetPointerDown}
                          onPointerMove={handleSheetPointerMove}
                          onPointerUp={finishMarquee}
                          onPointerCancel={finishMarquee}
                        >
                          {connectionSegments.map((segment) => {
                            const isSelected =
                              selectedConnectionId === segment.connection.id;
                            const panelPattern = segment.connection.panelPatternId
                              ? panelPatternById.get(segment.connection.panelPatternId)
                              : undefined;
                            const patternStyle = panelPattern
                              ? getPanelConnectionPatternStyle(panelPattern)
                              : undefined;

                            return (
                              <g key={segment.connection.id}>
                                <path
                                  data-testid="canvas-connection-line"
                                  data-connection-id={segment.connection.id}
                                  data-panel-wire-id={segment.connection.panelConnectionId}
                                  data-panel-pattern-id={segment.connection.panelPatternId}
                                  d={segment.pathData}
                                  className={
                                    isSelected
                                      ? "stroke-sky-600"
                                      : patternStyle
                                        ? undefined
                                        : segment.connection.panelConnectionId
                                        ? "stroke-blue-900 opacity-90"
                                        : "stroke-teal-700 opacity-75"
                                  }
                                  stroke={
                                    isSelected
                                      ? undefined
                                      : patternStyle?.stroke
                                  }
                                  fill="none"
                                  strokeWidth={
                                    isSelected
                                      ? 1.05
                                      : patternStyle?.strokeWidth ?? 0.58
                                  }
                                  strokeDasharray={patternStyle?.dashArray}
                                  strokeLinecap={patternStyle?.lineCap ?? "round"}
                                  strokeLinejoin="round"
                                />
                                {segment.label ? (
                                  <g className="pointer-events-none">
                                    {(() => {
                                      const box = routeLabelBox(
                                        segment.label,
                                        segment.labelPoint
                                      );

                                      return (
                                        <rect
                                          x={box.x}
                                          y={box.y}
                                          width={box.width}
                                          height={box.height}
                                          rx={1.2}
                                          className="fill-white opacity-85"
                                        />
                                      );
                                    })()}
                                    <text
                                      x={segment.labelPoint.x}
                                      y={segment.labelPoint.y}
                                      textAnchor={segment.labelPoint.anchor}
                                      className="fill-slate-500 text-[2.7px] font-semibold"
                                    >
                                      {segment.label}
                                    </text>
                                  </g>
                                ) : null}
                                <path
                                  data-testid="canvas-connection-hit"
                                  d={segment.pathData}
                                  className="cursor-pointer stroke-transparent"
                                  fill="none"
                                  strokeWidth={6 / anchorScreenScale}
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  onPointerDown={(event) => {
                                    if (event.button !== 0) {
                                      return;
                                    }

                                    event.stopPropagation();
                                    viewportRef.current?.focus();
                                    onConnectionSelect(segment.connection.id);
                                    onSelectPlacement(undefined);
                                    onAnnotationSelect(undefined);
                                    setSelectedAnnotationLeaderId(null);
                                    setSelectedRoutePointId(null);
                                  }}
                                  onDoubleClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    onConnectionSelect(segment.connection.id);
                                    onConnectionRouteChange(
                                      segment.connection.id,
                                      addRouteControlPoint({
                                        route: segment.route,
                                        connectionId: segment.connection.id,
                                        point: toSvgPoint(event, model.sheet),
                                        sheet: model.sheet
                                      })
                                    );
                                  }}
                                >
                                  <title>
                                    {segment.connection.label ||
                                      segment.connection.id}
                                  </title>
                                </path>
                              </g>
                            );
                          })}
                          {sourceAnchorHotspot &&
                          connectionDraft.pointer ? (
                            <line
                              data-testid="canvas-connection-preview"
                              x1={sourceAnchorHotspot.point.x}
                              y1={sourceAnchorHotspot.point.y}
                              x2={connectionDraft.pointer.x}
                              y2={connectionDraft.pointer.y}
                              className="pointer-events-none stroke-sky-500"
                              strokeWidth={0.9}
                              strokeDasharray="4 2"
                              strokeLinecap="round"
                            />
                          ) : null}
                          {marquee ? (
                            <rect
                              data-testid="canvas-marquee-selection"
                              x={Math.min(marquee.start.x, marquee.current.x)}
                              y={Math.min(marquee.start.y, marquee.current.y)}
                              width={Math.abs(marquee.current.x - marquee.start.x)}
                              height={Math.abs(marquee.current.y - marquee.start.y)}
                              className="pointer-events-none fill-sky-300/15 stroke-sky-500"
                              strokeWidth={0.65 / anchorScreenScale}
                              strokeDasharray="2 1.5"
                            />
                          ) : null}
                          <PlacementOverlay
                            model={interactiveModel}
                            symbols={symbols}
                            selectedPlacementId={selectedPlacementId}
                            selectedPlacementIds={selectedPlacementIds}
                            connectionMode={connectionMode}
                            viewportZoom={viewportTransform.zoom}
                            screenScale={anchorScreenScale}
                            dimensionSnapFeedback={dimensionSnapFeedback}
                            dragState={dragState}
                            onFocusCanvas={focusCanvas}
                            onSelectPlacement={onSelectPlacement}
                            onConnectionSelect={onConnectionSelect}
                            onDragStart={handlePlacementDragStart}
                            onDragMove={onDragMove}
                            onDragEnd={handlePlacementDragEnd}
                            onDragCancel={handlePlacementDragCancel}
                            onPlacementRemove={onPlacementRemove}
                            onResizeStart={handlePlacementResizeStart}
                            onResizeMove={updatePlacementFromResize}
                            onResizeEnd={endPlacementResize}
                            onResizeCancel={cancelPlacementResize}
                            onRotationStart={handlePlacementRotationStart}
                            onRotationMove={updatePlacementFromRotation}
                            onRotationEnd={endPlacementRotation}
                            onRotationCancel={cancelPlacementRotation}
                          />
                          <NoteBlockOverlay
                            model={model}
                            selectedAnnotationId={selectedAnnotationId}
                            selectedAnnotationIds={selectedAnnotationIds}
                            selectedAnnotationLeaderId={selectedAnnotationLeaderId}
                            viewportZoom={viewportTransform.zoom}
                            onFocusCanvas={focusCanvas}
                            onAnnotationSelect={selectAnnotation}
                            onAnnotationLeaderSelect={setSelectedAnnotationLeaderId}
                            onAnnotationChange={onAnnotationChange}
                            onAnnotationGroupChange={onAnnotationGroupChange}
                            onGestureStart={onGestureStart}
                            onGestureEnd={onGestureEnd}
                            onGestureCancel={onGestureCancel}
                          />
                          <AnchorOverlay
                            anchorHotspots={anchorHotspots}
                            activeAnchorId={activeAnchorId}
                            sourceAnchorHotspot={sourceAnchorHotspot}
                            connectionMode={connectionMode}
                            connectionDraftFrom={connectionDraft.from}
                            anchorMarkerRadius={anchorMarkerRadius}
                            anchorHitRadius={anchorHitRadius}
                            anchorGlowRadius={anchorGlowRadius}
                            anchorStrokeWidth={anchorStrokeWidth}
                            onActiveAnchorChange={setActiveAnchorId}
                            onFocusCanvas={focusCanvas}
                            onSelectPlacement={onSelectPlacement}
                            onConnectionSelect={onConnectionSelect}
                            onConnectionPointerMove={onConnectionPointerMove}
                            onConnectionAnchorClick={onConnectionAnchorClick}
                            getConnectionAnchorState={getConnectionAnchorState}
                          />
                          <RouteHandlesOverlay
                            selectedConnectionSegment={selectedConnectionSegment}
                            selectedRoutePointId={selectedRoutePointId}
                            viewportZoom={viewportTransform.zoom}
                            onRoutePointPointerDown={handleRoutePointPointerDown}
                            onRoutePointPointerMove={updateDraggedRoutePoint}
                            onRoutePointPointerEnd={endRoutePointDrag}
                            onRoutePointPointerCancel={cancelRoutePointDrag}
                            onRoutePointDelete={deleteRoutePoint}
                          />
                          <RouteLabelOverlay
                            selectedConnectionSegment={selectedConnectionSegment}
                            viewportZoom={viewportTransform.zoom}
                            onRouteLabelPointerDown={handleRouteLabelPointerDown}
                            onRouteLabelPointerMove={updateDraggedRouteLabel}
                            onRouteLabelPointerEnd={endRouteLabelDrag}
                            onRouteLabelPointerCancel={cancelRouteLabelDrag}
                          />
                          <PlacementTitleOverlay
                            selectedPlacementTitle={selectedPlacementTitle}
                            viewportZoom={viewportTransform.zoom}
                            onPlacementTitlePointerDown={
                              handlePlacementTitlePointerDown
                            }
                            onPlacementTitlePointerMove={updateDraggedPlacementTitle}
                            onPlacementTitlePointerEnd={endPlacementTitleDrag}
                            onPlacementTitlePointerCancel={cancelPlacementTitleDrag}
                          />
                        </svg>
                          <AnchorTooltip
                            hotspot={activeAnchorHotspot}
                            sheet={interactiveModel.sheet}
                          />
                      </>
                  </div>
                </div>
              </div>
        </div>
        </div>
      </div>
    </section>
  );
}
