"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type KeyboardEvent,
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
import { toSheetCanvasModel } from "../../logic/commands/drawing-sheet-commands";
import { getAnchorWorldPoint } from "../../logic/services/drawing-geometry";
import { renderDrawingToSvg } from "../../logic/services/drawing-svg-renderer";
import {
  addRouteControlPoint,
  updateRoutePoint
} from "../../logic/services/connection-route-geometry";
import {
  getRenderableConnectionRoute,
  routeLabelBox
} from "../../logic/services/connection-route-renderer";
import {
  clampPointToSheet,
  NOTE_NUDGE_STEP
} from "../../logic/services/drawing-annotations";
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
import { DrawingViewportToolbar } from "./drawing-viewport-toolbar";

const SHEET_PIXEL_SCALE = 2;
const ZOOM_STEP = 1.2;

type SheetFrame = {
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

  const scale = SHEET_PIXEL_SCALE * input.zoom;

  return {
    sheetId,
    sheetX: (input.clientX - paperRect.left) / scale,
    sheetY: (input.clientY - paperRect.top) / scale,
    clientX: input.clientX,
    clientY: input.clientY
  };
}

export function SvgDrawingSurface({
  model: drawingModel,
  drawingTitle,
  activeSheetId,
  focusSheetRequestKey,
  symbols,
  selection,
  selectedPlacementId,
  viewportTransform,
  setViewportTransform,
  dragState,
  onActiveSheetChange,
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
  onConnectionCancel,
  onViewportCenterChange,
  statusMessage
}: {
  model: DrawingPackageModel;
  drawingTitle: string;
  activeSheetId: string;
  focusSheetRequestKey?: number;
  symbols: ApprovedDrawingSymbol[];
  selection: DrawingCanvasSelection;
  selectedPlacementId?: string;
  viewportTransform: ViewportTransform;
  setViewportTransform: Dispatch<SetStateAction<ViewportTransform>>;
  dragState: DragState | null;
  onActiveSheetChange: (sheetId: string) => void;
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
  onConnectionCancel: () => void;
  onViewportCenterChange?: (point: { x: number; y: number }) => void;
  statusMessage?: string | null;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const didInitialFitRef = useRef(false);
  const lastFocusSheetRequestKeyRef = useRef(focusSheetRequestKey);
  const sheetFrameRefs = useRef(new Map<string, HTMLDivElement>());
  const scrollAnimationFrameRef = useRef<number | null>(null);
  const zoomAnchorAnimationFrameRef = useRef<number | null>(null);
  const zoomSyncReleaseTimeoutRef = useRef<number | null>(null);
  const suppressViewportSheetSyncRef = useRef(false);
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
  const sheetFrames = useMemo<SheetFrame[]>(
    () =>
      drawingModel.sheets.map((sheet, index) => {
        const canvasModel = toSheetCanvasModel(drawingModel, sheet.id);
        const sheetNumber = index + 1;
        const sectionTitle = sheet.sectionTitlePage?.title?.trim();

        return {
          sheet,
          sheetNumber,
          canvasModel,
          renderedSvg: renderDrawingToSvg({
            model: canvasModel,
            approvedSymbols: symbols,
            showAnchors: false,
            showConnections: sheet.id !== activeSheetId,
            sheetNumber,
            sheetCount,
            drawingTitle,
            sheetTitle:
              sheet.kind === "section_title" && sectionTitle
                ? sectionTitle
                : sheet.name,
            sheetKind: sheet.kind,
            sectionTitlePage: sheet.sectionTitlePage
          })
        };
      }),
    [activeSheetId, drawingModel, drawingTitle, sheetCount, symbols]
  );
  const activeFrame =
    sheetFrames.find((frame) => frame.sheet.id === activeSheetId) ??
    sheetFrames[0];
  const model =
    activeFrame?.canvasModel ?? toSheetCanvasModel(drawingModel, activeSheetId);
  const activeSheetNumber = activeFrame?.sheetNumber ?? 1;
  const effectiveActiveSheetId = activeFrame?.sheet.id ?? activeSheetId;
  const canMoveActiveSheetUp = activeSheetNumber > 1;
  const canMoveActiveSheetDown = activeSheetNumber < sheetCount;
  const canMoveActiveSheetToEnd = activeSheetNumber < sheetCount;
  const canDeleteActiveSheet = sheetCount > 1;
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
  const anchorHotspots = useMemo(
    () =>
      model.placements.flatMap((placement) => {
        const symbol = getRenderableSymbolForPlacement(placement, symbols);

        if (!symbol) {
          return [];
        }

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
          point: getAnchorWorldPoint(placement, symbol.metadata, anchor)
        }));
      }),
    [model.placements, symbols]
  );
  const connectionSegments: ConnectionSegment[] = useMemo(
    () =>
      model.connections.flatMap((connection) => {
        const rendered = getRenderableConnectionRoute({
          model,
          symbols,
          connection
        });

        if (!rendered) {
          return [];
        }

        return [rendered];
      }),
    [model, symbols]
  );
  const placementTitleLabels: PlacementTitleLabel[] = useMemo(
    () =>
      model.placements.flatMap((placement) => {
        const symbol = getRenderableSymbolForPlacement(placement, symbols);

        if (!symbol || !shouldShowPlacementTitle(placement, symbol)) {
          return [];
        }

        return [
          {
            placementId: placement.id,
            label: getPlacementDisplayTitle(placement, symbol),
            point: getPlacementTitlePoint(placement)
          }
        ];
      }),
    [model.placements, symbols]
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

  const setSheetFrameRef = useCallback(
    (sheetId: string, element: HTMLDivElement | null) => {
      if (element) {
        sheetFrameRefs.current.set(sheetId, element);
        return;
      }

      sheetFrameRefs.current.delete(sheetId);
    },
    []
  );

  const scrollActiveSheetIntoView = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      const activeSheetFrame = sheetFrameRefs.current.get(effectiveActiveSheetId);

      activeSheetFrame?.scrollIntoView({
        block: "center",
        inline: "center",
        behavior
      });
    },
    [effectiveActiveSheetId]
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

  const releaseZoomSheetSyncAfterGesture = useCallback(() => {
    if (zoomSyncReleaseTimeoutRef.current !== null) {
      window.clearTimeout(zoomSyncReleaseTimeoutRef.current);
    }

    zoomSyncReleaseTimeoutRef.current = window.setTimeout(() => {
      suppressViewportSheetSyncRef.current = false;
      zoomSyncReleaseTimeoutRef.current = null;
    }, 180);
  }, []);

  const resumeViewportSheetSync = useCallback(() => {
    suppressViewportSheetSyncRef.current = false;

    if (zoomSyncReleaseTimeoutRef.current !== null) {
      window.clearTimeout(zoomSyncReleaseTimeoutRef.current);
      zoomSyncReleaseTimeoutRef.current = null;
    }
  }, []);

  const scheduleZoomAnchorCorrection = useCallback(
    (anchor: ZoomAnchor) => {
      if (zoomAnchorAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(zoomAnchorAnimationFrameRef.current);
      }

      const applyAnchorCorrection = () => {
        const viewportElement = viewportRef.current;
        const frame = sheetFrameRefs.current.get(anchor.sheetId);
        const paper = frame?.querySelector<HTMLElement>("[data-sheet-paper]");

        if (!viewportElement || !paper) {
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

  const syncViewportSheetState = useCallback(() => {
    if (
      suppressViewportSheetSyncRef.current ||
      pendingActiveSheetScrollRef.current
    ) {
      return;
    }

    const viewportElement = viewportRef.current;

    if (!viewportElement) {
      return;
    }

    const viewportRect = viewportElement.getBoundingClientRect();
    const viewportCenterX = viewportRect.left + viewportRect.width / 2;
    const viewportCenterY = viewportRect.top + viewportRect.height / 2;
    let closestSheetId: string | undefined;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const frame of sheetFrames) {
      const frameElement = sheetFrameRefs.current.get(frame.sheet.id);

      if (!frameElement) {
        continue;
      }

      const frameRect = frameElement.getBoundingClientRect();
      const frameCenterY = frameRect.top + frameRect.height / 2;
      const distance = Math.abs(frameCenterY - viewportCenterY);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestSheetId = frame.sheet.id;
      }
    }

    if (closestSheetId && closestSheetId !== activeSheetId) {
      onActiveSheetChange(closestSheetId);
    }

    const centerSheetId = closestSheetId ?? activeSheetId;
    const centerFrame = sheetFrames.find(
      (frame) => frame.sheet.id === centerSheetId
    );
    const centerFrameElement = centerSheetId
      ? sheetFrameRefs.current.get(centerSheetId)
      : undefined;
    const paperElement = centerFrameElement?.querySelector<HTMLElement>(
      "[data-sheet-paper]"
    );

    if (!paperElement || !centerFrame || !onViewportCenterChange) {
      return;
    }

    const paperRect = paperElement.getBoundingClientRect();
    const scale = SHEET_PIXEL_SCALE * viewportTransform.zoom;
    const x = (viewportCenterX - paperRect.left) / scale;
    const y = (viewportCenterY - paperRect.top) / scale;

    const nextViewportCenter = {
      x: Number(
        Math.max(0, Math.min(centerFrame.canvasModel.sheet.width, x)).toFixed(2)
      ),
      y: Number(
        Math.max(0, Math.min(centerFrame.canvasModel.sheet.height, y)).toFixed(2)
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
  }, [
    activeSheetId,
    onActiveSheetChange,
    onViewportCenterChange,
    sheetFrames,
    viewportTransform.zoom
  ]);

  const handleViewportScroll = useCallback(() => {
    if (suppressViewportSheetSyncRef.current) {
      return;
    }

    if (scrollAnimationFrameRef.current !== null) {
      return;
    }

    scrollAnimationFrameRef.current = window.requestAnimationFrame(() => {
      scrollAnimationFrameRef.current = null;
      syncViewportSheetState();
    });
  }, [syncViewportSheetState]);

  useEffect(() => {
    syncViewportSheetState();
  }, [syncViewportSheetState]);

  useEffect(
    () => () => {
      if (scrollAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollAnimationFrameRef.current);
      }

      if (zoomAnchorAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(zoomAnchorAnimationFrameRef.current);
      }

      if (zoomSyncReleaseTimeoutRef.current !== null) {
        window.clearTimeout(zoomSyncReleaseTimeoutRef.current);
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
        resumeViewportSheetSync();
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
      suppressViewportSheetSyncRef.current = true;
      releaseZoomSheetSyncAfterGesture();

      if (anchor && anchor.sheetId !== effectiveActiveSheetId) {
        onActiveSheetChange(anchor.sheetId);
      }

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
      effectiveActiveSheetId,
      onActiveSheetChange,
      releaseZoomSheetSyncAfterGesture,
      resumeViewportSheetSync,
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
    onGestureEnd
  });

  const {
    updateDraggedRouteLabel,
    handleRouteLabelPointerDown,
    endRouteLabelDrag
  } = useRouteLabelDrag({
    model,
    connectionSegments,
    selectedConnectionSegment,
    onFocusCanvas: focusCanvas,
    onConnectionSelect,
    onConnectionRouteChange,
    setSelectedRoutePointId,
    onGestureStart,
    onGestureEnd
  });

  const {
    updateDraggedPlacementTitle,
    handlePlacementTitlePointerDown,
    endPlacementTitleDrag
  } = usePlacementTitleDrag({
    model,
    placementTitleLabels,
    selectedPlacementTitle,
    onFocusCanvas: focusCanvas,
    onSelectPlacement,
    onConnectionSelect,
    onPlacementChange,
    onGestureStart,
    onGestureEnd
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
    endPlacementResize: finishPlacementResize
  } = usePlacementResize({
    model,
    symbols,
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
    onConnectionCancel,
    onClearSelection: clearCanvasSelection,
    onCopySelection,
    onDeleteSelectedRoutePoint: deleteSelectedRoutePoint,
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

  const activateSheet = useCallback(
    (sheetId: string) => {
      if (sheetId === effectiveActiveSheetId) {
        return;
      }

      requestActiveSheetScroll();
      onActiveSheetChange(sheetId);
    },
    [effectiveActiveSheetId, onActiveSheetChange, requestActiveSheetScroll]
  );

  const handleInactiveSheetKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>, sheetId: string) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      activateSheet(sheetId);
    },
    [activateSheet]
  );

  const runSheetAction = useCallback(
    (action: () => void) => {
      requestActiveSheetScroll();
      action();
    },
    [requestActiveSheetScroll]
  );

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
            {activeFrame?.sheet.kind === "section_title"
              ? "Section Title Page"
              : "Drawing Sheet"}
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
              className="icon-button h-8 w-8 p-0"
              aria-label="Move active sheet up"
              title="Move active sheet up"
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
              aria-label="Move active sheet down"
              title="Move active sheet down"
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
              aria-label="Move active sheet to end"
              title="Move active sheet to end"
              disabled={!canMoveActiveSheetToEnd}
              onClick={() =>
                runSheetAction(() => onMoveSheetToEnd(effectiveActiveSheetId))
              }
            >
              <ChevronsDown aria-hidden="true" size={14} />
            </button>
            <button
              type="button"
              className="icon-button h-8 w-8 p-0"
              aria-label="Save active sheet as template"
              title="Save active sheet as template"
              onClick={onSaveSheetTemplate}
            >
              <Save aria-hidden="true" size={14} />
            </button>
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
          {sheetFrames.map((frame) => {
            const isActive = frame.sheet.id === effectiveActiveSheetId;
            const framePixelSize = {
              width: Number(
                (
                  frame.canvasModel.sheet.width *
                  SHEET_PIXEL_SCALE *
                  viewportTransform.zoom
                ).toFixed(3)
              ),
              height: Number(
                (
                  frame.canvasModel.sheet.height *
                  SHEET_PIXEL_SCALE *
                  viewportTransform.zoom
                ).toFixed(3)
              )
            };

            return (
              <div
                key={frame.sheet.id}
                ref={(element) => setSheetFrameRef(frame.sheet.id, element)}
                className={[
                  "drawing-sheet-frame",
                  isActive ? "drawing-sheet-frame-active" : ""
                ].join(" ")}
                data-testid="drawing-sheet-frame"
                data-sheet-id={frame.sheet.id}
                data-active-sheet={isActive ? "true" : "false"}
                role={isActive ? undefined : "button"}
                tabIndex={isActive ? undefined : 0}
                aria-label={
                  isActive
                    ? undefined
                    : `Activate sheet ${frame.sheetNumber}: ${frame.sheet.name}`
                }
                onPointerDown={(event) => {
                  if (isActive || event.button !== 0) {
                    return;
                  }

                  event.preventDefault();
                  activateSheet(frame.sheet.id);
                }}
                onKeyDown={(event) =>
                  handleInactiveSheetKeyDown(event, frame.sheet.id)
                }
              >
                <div className="drawing-sheet-caption">
                  <span className="drawing-sheet-caption-index">
                    Sheet {frame.sheetNumber} of {sheetCount}
                  </span>
                  <span className="drawing-sheet-caption-name">
                    {frame.sheet.name}
                  </span>
                </div>
                <div
                  className="drawing-sheet-stage"
                  data-testid={
                    isActive ? "drawing-sheet-stage" : "drawing-sheet-preview"
                  }
                  style={{
                    width: `${framePixelSize.width}px`,
                    height: `${framePixelSize.height}px`
                  }}
                >
                  <div className="drawing-sheet-paper" data-sheet-paper="true">
                    <div
                      className="drawing-sheet-rendered"
                      dangerouslySetInnerHTML={{ __html: frame.renderedSvg }}
                    />
                    {isActive ? (
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

                            return (
                              <g key={segment.connection.id}>
                                <path
                                  data-testid="canvas-connection-line"
                                  data-connection-id={segment.connection.id}
                                  d={segment.pathData}
                                  className={
                                    isSelected
                                      ? "stroke-sky-600"
                                      : "stroke-teal-700 opacity-75"
                                  }
                                  fill="none"
                                  strokeWidth={isSelected ? 1.05 : 0.58}
                                  strokeLinecap="round"
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
                            model={model}
                            symbols={symbols}
                            selectedPlacementId={selectedPlacementId}
                            selectedPlacementIds={selectedPlacementIds}
                            connectionMode={connectionMode}
                            viewportZoom={viewportTransform.zoom}
                            dragState={dragState}
                            onFocusCanvas={focusCanvas}
                            onSelectPlacement={onSelectPlacement}
                            onConnectionSelect={onConnectionSelect}
                            onDragStart={handlePlacementDragStart}
                            onDragMove={onDragMove}
                            onDragEnd={handlePlacementDragEnd}
                            onPlacementRemove={onPlacementRemove}
                            onResizeStart={handlePlacementResizeStart}
                            onResizeMove={updatePlacementFromResize}
                            onResizeEnd={endPlacementResize}
                            onRotationStart={handlePlacementRotationStart}
                            onRotationMove={updatePlacementFromRotation}
                            onRotationEnd={endPlacementRotation}
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
                          />
                          <RouteHandlesOverlay
                            selectedConnectionSegment={selectedConnectionSegment}
                            selectedRoutePointId={selectedRoutePointId}
                            viewportZoom={viewportTransform.zoom}
                            onRoutePointPointerDown={handleRoutePointPointerDown}
                            onRoutePointPointerMove={updateDraggedRoutePoint}
                            onRoutePointPointerEnd={endRoutePointDrag}
                            onRoutePointDelete={deleteRoutePoint}
                          />
                          <RouteLabelOverlay
                            selectedConnectionSegment={selectedConnectionSegment}
                            viewportZoom={viewportTransform.zoom}
                            onRouteLabelPointerDown={handleRouteLabelPointerDown}
                            onRouteLabelPointerMove={updateDraggedRouteLabel}
                            onRouteLabelPointerEnd={endRouteLabelDrag}
                          />
                          <PlacementTitleOverlay
                            selectedPlacementTitle={selectedPlacementTitle}
                            viewportZoom={viewportTransform.zoom}
                            onPlacementTitlePointerDown={
                              handlePlacementTitlePointerDown
                            }
                            onPlacementTitlePointerMove={updateDraggedPlacementTitle}
                            onPlacementTitlePointerEnd={endPlacementTitleDrag}
                          />
                        </svg>
                        <AnchorTooltip
                          hotspot={activeAnchorHotspot}
                          sheet={model.sheet}
                        />
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        </div>
      </div>
    </section>
  );
}
