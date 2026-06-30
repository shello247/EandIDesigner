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
import type { DrawingModel } from "../../data/schema";
import type {
  DrawingConnection,
  DrawingConnectionRoute,
  DrawingEndpoint
} from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import type {
  SymbolAnchor,
  SymbolTerminal
} from "@/features/symbol_registry/data/schema";
import {
  getAnchorWorldPoint,
  getPlacementBounds
} from "../../logic/services/drawing-geometry";
import { renderDrawingToSvg } from "../../logic/services/drawing-svg-renderer";
import {
  addRouteControlPoint,
  removeRouteControlPoint,
  updateRouteLabelPosition,
  updateRoutePoint
} from "../../logic/services/connection-route-geometry";
import {
  getRenderableConnectionRoute,
  routeLabelBox,
  visibleRouteControlPoints
} from "../../logic/services/connection-route-renderer";
import {
  calculateFitTransform,
  clampZoom,
  type ViewportSize,
  type ViewportTransform,
  zoomAtPoint,
  zoomAtViewportCenter
} from "../../logic/services/viewport-transform";
import { DrawingViewportToolbar } from "./drawing-viewport-toolbar";

type DragState = {
  placementId: string;
  startPointer: { x: number; y: number };
  startPlacement: { x: number; y: number };
};

type ResizeHandle = "nw" | "ne" | "sw" | "se";

type ResizeState = {
  placementId: string;
  handle: ResizeHandle;
  fixedPoint: { x: number; y: number };
  baseSize: { width: number; height: number };
};

type PanState = {
  pointerId: number;
  startPointer: { x: number; y: number };
  startPan: { panX: number; panY: number };
};

type AnchorHotspot = {
  id: string;
  placementId: string;
  placementTag: string;
  symbolName: string;
  symbolModel?: string | null;
  anchor: SymbolAnchor;
  terminal?: SymbolTerminal;
  point: { x: number; y: number };
};

type ConnectionDraft = {
  from?: DrawingEndpoint;
  pointer?: { x: number; y: number };
};

type ConnectionSegment = {
  connection: DrawingConnection;
  route: DrawingConnectionRoute;
  pathData: string;
  label: string | null;
  labelPoint: { x: number; y: number; anchor: "start" | "middle" };
};

type RouteDragState = {
  connectionId: string;
  pointId: string;
  pointerId: number;
};

type RouteLabelDragState = {
  connectionId: string;
  pointerId: number;
  labelOffset: { x: number; y: number };
};

const SHEET_PIXEL_SCALE = 2;
const ZOOM_STEP = 1.2;
const MIN_PLACEMENT_SCALE = 0.05;
const MAX_PLACEMENT_SCALE = 6;
const LABEL_MOVE_CURSOR =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='10' fill='%23fbbf24' stroke='%23783d05' stroke-width='2'/%3E%3Cpath d='M12 5v14M5 12h14M9 8l3-3 3 3M9 16l3 3 3-3M8 9l-3 3 3 3M16 9l3 3-3 3' stroke='%231f2937' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\") 12 12, move";

function packageKey(symbolId: string, versionId: string): string {
  return `${symbolId}:${versionId}`;
}

function toSvgPoint(
  event: {
    currentTarget: SVGElement;
    clientX: number;
    clientY: number;
  },
  sheet: DrawingModel["sheet"]
) {
  const svgElement = event.currentTarget.ownerSVGElement ?? event.currentTarget;
  const rect = svgElement.getBoundingClientRect();

  return {
    x: ((event.clientX - rect.left) / rect.width) * sheet.width,
    y: ((event.clientY - rect.top) / rect.height) * sheet.height
  };
}

function snap(value: number, gridSize: number): number {
  return Number((Math.round(value / gridSize) * gridSize).toFixed(2));
}

function clampPlacementScale(scale: number): number {
  return Math.min(MAX_PLACEMENT_SCALE, Math.max(MIN_PLACEMENT_SCALE, scale));
}

function getViewportSize(element: HTMLDivElement): ViewportSize {
  const rect = element.getBoundingClientRect();

  return {
    width: rect.width,
    height: rect.height
  };
}

function getTooltipPosition(
  point: { x: number; y: number },
  sheet: DrawingModel["sheet"]
) {
  const left = Math.max(0, Math.min(100, (point.x / sheet.width) * 100));
  const top = Math.max(0, Math.min(100, (point.y / sheet.height) * 100));
  const translateX = left > 68 ? "-100%" : "12px";
  const translateY = top > 72 ? "-100%" : "12px";

  return {
    left: `${left}%`,
    top: `${top}%`,
    transform: `translate(${translateX}, ${translateY})`
  };
}

function getAnchorLabel(hotspot: AnchorHotspot): string {
  if (hotspot.terminal) {
    return `Show data for ${hotspot.placementTag} terminal ${hotspot.terminal.key}`;
  }

  return `Show data for ${hotspot.placementTag} anchor ${hotspot.anchor.key}`;
}

export function SvgDrawingSurface({
  model,
  symbols,
  selectedPlacementId,
  viewportTransform,
  setViewportTransform,
  dragState,
  onSelectPlacement,
  onPlacementChange,
  onPlacementRemove,
  onDragStart,
  onDragMove,
  onDragEnd,
  connectionMode,
  connectionDraft,
  selectedConnectionId,
  onConnectionAnchorClick,
  onConnectionPointerMove,
  onConnectionSelect,
  onConnectionRouteChange,
  onConnectionCancel
}: {
  model: DrawingModel;
  symbols: ApprovedDrawingSymbol[];
  selectedPlacementId?: string;
  viewportTransform: ViewportTransform;
  setViewportTransform: Dispatch<SetStateAction<ViewportTransform>>;
  dragState: DragState | null;
  onSelectPlacement: (placementId: string | undefined) => void;
  onPlacementChange: (
    placementId: string,
    updates: Partial<DrawingModel["placements"][number]>
  ) => void;
  onPlacementRemove: (placementId: string) => void;
  onDragStart: (state: DragState) => void;
  onDragMove: (placementId: string, x: number, y: number) => void;
  onDragEnd: () => void;
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
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const didInitialFitRef = useRef(false);
  const resizeStateRef = useRef<ResizeState | null>(null);
  const panStateRef = useRef<PanState | null>(null);
  const routeDragStateRef = useRef<RouteDragState | null>(null);
  const routeLabelDragStateRef = useRef<RouteLabelDragState | null>(null);
  const [activeAnchorId, setActiveAnchorId] = useState<string | null>(null);
  const [selectedRoutePointId, setSelectedRoutePointId] = useState<string | null>(
    null
  );
  const [isPanning, setIsPanning] = useState(false);
  const sheetPixelSize = useMemo(
    () => ({
      width: model.sheet.width * SHEET_PIXEL_SCALE,
      height: model.sheet.height * SHEET_PIXEL_SCALE
    }),
    [model.sheet.height, model.sheet.width]
  );
  const zoomedSheetPixelSize = useMemo(
    () => ({
      width: Number((sheetPixelSize.width * viewportTransform.zoom).toFixed(3)),
      height: Number((sheetPixelSize.height * viewportTransform.zoom).toFixed(3))
    }),
    [sheetPixelSize, viewportTransform.zoom]
  );
  const symbolsByKey = useMemo(
    () =>
      new Map(
        symbols.map((symbol) => [
          packageKey(symbol.symbolId, symbol.versionId),
          symbol
        ])
      ),
    [symbols]
  );
  const anchorHotspots = useMemo(
    () =>
      model.placements.flatMap((placement) => {
        const symbol = symbolsByKey.get(
          packageKey(placement.symbolId, placement.versionId)
        );

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
    [model.placements, symbolsByKey]
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
  const selectedConnectionSegment =
    connectionSegments.find(
      (segment) => segment.connection.id === selectedConnectionId
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
  const renderedSvg = useMemo(
    () =>
      renderDrawingToSvg({
        model,
        approvedSymbols: symbols,
        showAnchors: false,
        showConnections: false
      }),
    [model, symbols]
  );

  const fitToViewport = useCallback(() => {
    const viewportElement = viewportRef.current;

    if (!viewportElement) {
      return;
    }

    const viewportSize = getViewportSize(viewportElement);
    setViewportTransform(
      calculateFitTransform(viewportSize, sheetPixelSize)
    );
  }, [setViewportTransform, sheetPixelSize]);

  const setActualSize = useCallback(() => {
    const viewportElement = viewportRef.current;

    if (!viewportElement) {
      setViewportTransform((current) => ({ ...current, zoom: 1 }));
      return;
    }

    setViewportTransform((current) =>
      zoomAtViewportCenter({
        current,
        nextZoom: 1,
        viewport: getViewportSize(viewportElement)
      })
    );
  }, [setViewportTransform]);

  const zoomByStep = useCallback(
    (direction: "in" | "out") => {
      const viewportElement = viewportRef.current;

      if (!viewportElement) {
        return;
      }

      setViewportTransform((current) =>
        zoomAtViewportCenter({
          current,
          nextZoom:
            direction === "in"
              ? clampZoom(current.zoom * ZOOM_STEP)
              : clampZoom(current.zoom / ZOOM_STEP),
          viewport: getViewportSize(viewportElement)
        })
      );
    },
    [setViewportTransform]
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
      setViewportTransform(
        calculateFitTransform(viewportSize, sheetPixelSize)
      );
    };

    runInitialFit();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(runInitialFit);
    observer.observe(viewportElement);

    return () => observer.disconnect();
  }, [setViewportTransform, sheetPixelSize]);

  const handleWheel = useCallback(
    (event: WheelEvent<HTMLDivElement>) => {
      event.preventDefault();

      const rect = event.currentTarget.getBoundingClientRect();

      if (event.ctrlKey) {
        const pointerX = event.clientX - rect.left;
        const pointerY = event.clientY - rect.top;

        setViewportTransform((current) =>
          zoomAtPoint({
            current,
            nextZoom: clampZoom(current.zoom * Math.exp(-event.deltaY * 0.0015)),
            pointerX,
            pointerY
          })
        );
        return;
      }

      setViewportTransform((current) => ({
        ...current,
        panX: Number((current.panX - event.deltaX).toFixed(3)),
        panY: Number((current.panY - event.deltaY).toFixed(3))
      }));
    },
    [setViewportTransform]
  );

  const endMiddleButtonPan = useCallback(() => {
    panStateRef.current = null;
    setIsPanning(false);
  }, []);

  const startMiddleButtonPan = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (event.button !== 1) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      viewportRef.current?.focus();
      event.currentTarget.setPointerCapture(event.pointerId);
      setActiveAnchorId(null);
      setIsPanning(true);
      panStateRef.current = {
        pointerId: event.pointerId,
        startPointer: { x: event.clientX, y: event.clientY },
        startPan: {
          panX: viewportTransform.panX,
          panY: viewportTransform.panY
        }
      };
    },
    [viewportTransform.panX, viewportTransform.panY]
  );

  const updateMiddleButtonPan = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const panState = panStateRef.current;

      if (!panState || panState.pointerId !== event.pointerId) {
        return;
      }

      event.preventDefault();
      setViewportTransform((current) => ({
        ...current,
        panX: Number(
          (panState.startPan.panX + event.clientX - panState.startPointer.x).toFixed(3)
        ),
        panY: Number(
          (panState.startPan.panY + event.clientY - panState.startPointer.y).toFixed(3)
        )
      }));
    },
    [setViewportTransform]
  );

  const updateConnectionPointer = useCallback(
    (event: PointerEvent<SVGElement>) => {
      if (connectionMode !== "connecting" || !connectionDraft.from) {
        return;
      }

      onConnectionPointerMove(toSvgPoint(event, model.sheet));
    },
    [connectionDraft.from, connectionMode, model.sheet, onConnectionPointerMove]
  );

  const updateDraggedRoutePoint = useCallback(
    (event: PointerEvent<SVGElement>) => {
      const routeDragState = routeDragStateRef.current;

      if (!routeDragState || routeDragState.pointerId !== event.pointerId) {
        return;
      }

      const segment = connectionSegments.find(
        (candidate) => candidate.connection.id === routeDragState.connectionId
      );

      if (!segment) {
        return;
      }

      event.preventDefault();
      onConnectionRouteChange(
        routeDragState.connectionId,
        updateRoutePoint({
          route: segment.route,
          pointId: routeDragState.pointId,
          point: toSvgPoint(event, model.sheet),
          sheet: model.sheet
        })
      );
    },
    [connectionSegments, model.sheet, onConnectionRouteChange]
  );

  const updateDraggedRouteLabel = useCallback(
    (event: PointerEvent<SVGElement>) => {
      const routeLabelDragState = routeLabelDragStateRef.current;

      if (
        !routeLabelDragState ||
        routeLabelDragState.pointerId !== event.pointerId
      ) {
        return;
      }

      const segment = connectionSegments.find(
        (candidate) =>
          candidate.connection.id === routeLabelDragState.connectionId
      );

      if (!segment) {
        return;
      }

      event.preventDefault();
      const pointer = toSvgPoint(event, model.sheet);
      onConnectionRouteChange(
        routeLabelDragState.connectionId,
        updateRouteLabelPosition({
          route: segment.route,
          point: {
            x: pointer.x + routeLabelDragState.labelOffset.x,
            y: pointer.y + routeLabelDragState.labelOffset.y
          },
          sheet: model.sheet
        })
      );
    },
    [connectionSegments, model.sheet, onConnectionRouteChange]
  );

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
    },
    [connectionMode, onConnectionSelect, onSelectPlacement]
  );

  const updatePlacementFromResize = useCallback(
    (event: PointerEvent<SVGElement>) => {
      const resizeState = resizeStateRef.current;

      if (!resizeState) {
        return;
      }

      const placement = model.placements.find(
        (candidate) => candidate.id === resizeState.placementId
      );
      const symbol = placement
        ? symbolsByKey.get(packageKey(placement.symbolId, placement.versionId))
        : undefined;

      if (!placement || !symbol) {
        return;
      }

      const pointer = toSvgPoint(event, model.sheet);
      const horizontalDistance =
        resizeState.handle === "nw" || resizeState.handle === "sw"
          ? resizeState.fixedPoint.x - pointer.x
          : pointer.x - resizeState.fixedPoint.x;
      const verticalDistance =
        resizeState.handle === "nw" || resizeState.handle === "ne"
          ? resizeState.fixedPoint.y - pointer.y
          : pointer.y - resizeState.fixedPoint.y;
      const nextScale = clampPlacementScale(
        Math.max(
          horizontalDistance / resizeState.baseSize.width,
          verticalDistance / resizeState.baseSize.height
        )
      );
      const nextWidth = resizeState.baseSize.width * nextScale;
      const nextHeight = resizeState.baseSize.height * nextScale;
      const nextX =
        resizeState.handle === "nw" || resizeState.handle === "sw"
          ? resizeState.fixedPoint.x - nextWidth
          : resizeState.fixedPoint.x;
      const nextY =
        resizeState.handle === "nw" || resizeState.handle === "ne"
          ? resizeState.fixedPoint.y - nextHeight
          : resizeState.fixedPoint.y;

      onPlacementChange(resizeState.placementId, {
        x: Number(nextX.toFixed(2)),
        y: Number(nextY.toFixed(2)),
        scale: Number(nextScale.toFixed(3))
      });
    },
    [model.placements, model.sheet, onPlacementChange, symbolsByKey]
  );

  return (
    <section className="tool-panel drawing-canvas-panel overflow-hidden">
      <div className="drawing-canvas-header">
        <h2 className="text-sm font-bold">Drawing Sheet</h2>
        <DrawingViewportToolbar
          zoom={viewportTransform.zoom}
          onFit={fitToViewport}
          onActualSize={setActualSize}
          onZoomIn={() => zoomByStep("in")}
          onZoomOut={() => zoomByStep("out")}
        />
      </div>
      <div
        ref={viewportRef}
        className={[
          "drawing-canvas-viewport",
          isPanning ? "is-panning" : ""
        ].join(" ")}
        data-testid="drawing-canvas-viewport"
        onWheel={handleWheel}
        onPointerDownCapture={startMiddleButtonPan}
        onPointerMove={updateMiddleButtonPan}
        onPointerUp={endMiddleButtonPan}
        onPointerCancel={endMiddleButtonPan}
        onAuxClick={(event) => {
          if (event.button === 1) {
            event.preventDefault();
          }
        }}
        onPointerDown={(event) => {
          if (event.target !== event.currentTarget) {
            return;
          }

          viewportRef.current?.focus();
          onSelectPlacement(undefined);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            if (connectionMode === "connecting") {
              onConnectionCancel();
              return;
            }

            onSelectPlacement(undefined);
            onConnectionSelect(undefined);
            return;
          }

          if (
            selectedConnectionSegment &&
            selectedRoutePointId &&
            (event.key === "Delete" || event.key === "Backspace")
          ) {
            event.preventDefault();
            onConnectionRouteChange(
              selectedConnectionSegment.connection.id,
              removeRouteControlPoint(
                selectedConnectionSegment.route,
                selectedRoutePointId
              )
            );
            setSelectedRoutePointId(null);
            return;
          }

          if (
            selectedPlacementId &&
            (event.key === "Delete" || event.key === "Backspace")
          ) {
            event.preventDefault();
            onPlacementRemove(selectedPlacementId);
          }
        }}
        tabIndex={0}
      >
        <div
          className="drawing-sheet-stage"
          data-testid="drawing-sheet-stage"
          style={{
            width: `${zoomedSheetPixelSize.width}px`,
            height: `${zoomedSheetPixelSize.height}px`,
            transform: `translate(${viewportTransform.panX}px, ${viewportTransform.panY}px)`
          }}
        >
          <div className="drawing-sheet-paper">
            <div
              className="drawing-sheet-rendered"
              dangerouslySetInnerHTML={{ __html: renderedSvg }}
            />
            <svg
              className="absolute inset-0 h-full w-full"
              viewBox={`0 0 ${model.sheet.width} ${model.sheet.height}`}
              aria-label="Interactive drawing overlay"
              pointerEvents="all"
              onPointerDownCapture={selectHotspotPlacement}
              onPointerDown={(event) => {
                if (event.target !== event.currentTarget) {
                  return;
                }

                viewportRef.current?.focus();
                onSelectPlacement(undefined);
                onConnectionSelect(undefined);
                setSelectedRoutePointId(null);
              }}
              onPointerMove={updateConnectionPointer}
            >
              {connectionSegments.map((segment) => {
                const isSelected = selectedConnectionId === segment.connection.id;

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
                          const box = routeLabelBox(segment.label, segment.labelPoint);

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
                      <title>{segment.connection.label || segment.connection.id}</title>
                    </path>
                  </g>
                );
              })}
              {sourceAnchorHotspot && connectionDraft.pointer ? (
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
              {model.placements.map((placement) => {
                const symbol = symbolsByKey.get(
                  packageKey(placement.symbolId, placement.versionId)
                );

                if (!symbol) {
                  return null;
                }

                const bounds = getPlacementBounds(placement, symbol.metadata);
                const isSelected = selectedPlacementId === placement.id;
                const handleSize = Math.max(
                  3,
                  Math.min(6, 5 / viewportTransform.zoom)
                );
                const handles: Array<{
                  key: ResizeHandle;
                  x: number;
                  y: number;
                  cursor: string;
                  fixedPoint: { x: number; y: number };
                }> = [
                  {
                    key: "nw",
                    x: bounds.x,
                    y: bounds.y,
                    cursor: "nwse-resize",
                    fixedPoint: {
                      x: bounds.x + bounds.width,
                      y: bounds.y + bounds.height
                    }
                  },
                  {
                    key: "ne",
                    x: bounds.x + bounds.width,
                    y: bounds.y,
                    cursor: "nesw-resize",
                    fixedPoint: {
                      x: bounds.x,
                      y: bounds.y + bounds.height
                    }
                  },
                  {
                    key: "sw",
                    x: bounds.x,
                    y: bounds.y + bounds.height,
                    cursor: "nesw-resize",
                    fixedPoint: {
                      x: bounds.x + bounds.width,
                      y: bounds.y
                    }
                  },
                  {
                    key: "se",
                    x: bounds.x + bounds.width,
                    y: bounds.y + bounds.height,
                    cursor: "nwse-resize",
                    fixedPoint: {
                      x: bounds.x,
                      y: bounds.y
                    }
                  }
                ];

                return (
                  <g key={placement.id}>
                    <rect
                      data-placement-id={placement.id}
                      x={bounds.x}
                      y={bounds.y}
                      width={bounds.width}
                      height={bounds.height}
                      className={[
                        "cursor-move fill-transparent",
                        isSelected ? "stroke-sky-600" : "stroke-transparent"
                      ].join(" ")}
                      pointerEvents="all"
                      strokeDasharray={isSelected ? "3 2" : undefined}
                      strokeWidth={isSelected ? 1 : 0}
                      onPointerDown={(event) => {
                        if (event.button !== 0) {
                          return;
                        }

                        if (connectionMode === "connecting") {
                          return;
                        }

                        const pointer = toSvgPoint(event, model.sheet);
                        event.currentTarget.setPointerCapture(event.pointerId);
                        viewportRef.current?.focus();
                        onSelectPlacement(placement.id);
                        onConnectionSelect(undefined);
                        onDragStart({
                          placementId: placement.id,
                          startPointer: pointer,
                          startPlacement: { x: placement.x, y: placement.y }
                        });
                      }}
                      onMouseDown={(event) => {
                        if (event.button !== 0 || connectionMode === "connecting") {
                          return;
                        }

                        viewportRef.current?.focus();
                        onSelectPlacement(placement.id);
                        onConnectionSelect(undefined);
                      }}
                      onPointerMove={(event) => {
                        if (!dragState || dragState.placementId !== placement.id) {
                          return;
                        }

                        const pointer = toSvgPoint(event, model.sheet);
                        onDragMove(
                          placement.id,
                          snap(
                            dragState.startPlacement.x +
                              pointer.x -
                              dragState.startPointer.x,
                            model.sheet.gridSize
                          ),
                          snap(
                            dragState.startPlacement.y +
                              pointer.y -
                              dragState.startPointer.y,
                            model.sheet.gridSize
                          )
                        );
                      }}
                      onPointerUp={onDragEnd}
                      onPointerCancel={onDragEnd}
                    />
                    {isSelected ? (
                      <g>
                        {handles.map((handle) => (
                          <rect
                            key={handle.key}
                            data-resize-handle={handle.key}
                            x={handle.x - handleSize / 2}
                            y={handle.y - handleSize / 2}
                            width={handleSize}
                            height={handleSize}
                            rx={handleSize * 0.2}
                            className="fill-white stroke-sky-600"
                            strokeWidth={0.8}
                            style={{ cursor: handle.cursor }}
                            onPointerDown={(event) => {
                              if (event.button !== 0) {
                                return;
                              }

                              event.stopPropagation();
                              event.currentTarget.setPointerCapture(event.pointerId);
                              viewportRef.current?.focus();
                              onSelectPlacement(placement.id);
                              resizeStateRef.current = {
                                placementId: placement.id,
                                handle: handle.key,
                                fixedPoint: handle.fixedPoint,
                                baseSize: {
                                  width: symbol.metadata.viewBox.width,
                                  height: symbol.metadata.viewBox.height
                                }
                              };
                            }}
                            onPointerMove={updatePlacementFromResize}
                            onPointerUp={() => {
                              resizeStateRef.current = null;
                            }}
                            onPointerCancel={() => {
                              resizeStateRef.current = null;
                            }}
                          >
                            <title>Resize placement</title>
                          </rect>
                        ))}
                        <g
                          data-testid="canvas-placement-delete"
                          role="button"
                          aria-label={`Delete ${placement.tag}`}
                          tabIndex={0}
                          transform={`translate(${bounds.x + bounds.width + 3} ${bounds.y - 10})`}
                          className="cursor-pointer"
                          onPointerDown={(event) => {
                            if (event.button !== 0) {
                              return;
                            }

                            event.stopPropagation();
                            onPlacementRemove(placement.id);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              onPlacementRemove(placement.id);
                            }
                          }}
                        >
                          <rect
                            x="0"
                            y="0"
                            width="16"
                            height="8"
                            rx="2"
                            className="fill-white stroke-red-500"
                            strokeWidth="0.6"
                          />
                          <text
                            x="8"
                            y="5.7"
                            textAnchor="middle"
                            fontSize="5"
                            fontWeight="700"
                            fill="#dc2626"
                          >
                            x
                          </text>
                          <title>Delete placement</title>
                        </g>
                      </g>
                    ) : null}
                    {symbol.metadata.anchors.map((anchor) => {
                      const hotspotId = `${placement.id}:${anchor.key}`;
                      const hotspot = anchorHotspots.find(
                        (candidate) => candidate.id === hotspotId
                      );

                      if (!hotspot) {
                        return null;
                      }

                      const isActive = activeAnchorId === hotspot.id;
                      const endpoint = {
                        placementId: placement.id,
                        anchorKey: anchor.key
                      };
                      const isConnectionSource =
                        sourceAnchorHotspot?.id === hotspot.id;
                      const isValidConnectionTarget =
                        connectionMode === "connecting" &&
                        Boolean(connectionDraft.from) &&
                        !isConnectionSource;

                      return (
                        <g key={hotspot.id}>
                          {isActive || isConnectionSource ? (
                            <circle
                              cx={hotspot.point.x}
                              cy={hotspot.point.y}
                              r={isConnectionSource ? anchorGlowRadius * 1.35 : anchorGlowRadius}
                              className={[
                                "pointer-events-none",
                                isConnectionSource
                                  ? "fill-sky-400 opacity-25"
                                  : "fill-teal-400 opacity-20"
                              ].join(" ")}
                            />
                          ) : null}
                          <circle
                            data-testid="canvas-anchor-marker"
                            cx={hotspot.point.x}
                            cy={hotspot.point.y}
                            r={anchorMarkerRadius}
                            className={[
                              "pointer-events-none transition-colors",
                              isConnectionSource
                                ? "fill-sky-50 stroke-sky-600"
                                : isValidConnectionTarget
                                  ? "fill-emerald-50 stroke-emerald-600"
                                  : isActive
                                ? "fill-teal-50 stroke-teal-600"
                                : "fill-white stroke-teal-600 opacity-80"
                            ].join(" ")}
                            strokeWidth={
                              isConnectionSource || isValidConnectionTarget
                                ? anchorStrokeWidth * 1.5
                                : anchorStrokeWidth
                            }
                          />
                          <circle
                            data-testid="canvas-anchor-hotspot"
                            data-anchor-hotspot={hotspot.id}
                            role="button"
                            tabIndex={0}
                            aria-label={getAnchorLabel(hotspot)}
                            cx={hotspot.point.x}
                            cy={hotspot.point.y}
                            r={anchorHitRadius}
                            className={[
                              "pointer-events-auto fill-transparent",
                              connectionMode === "connecting"
                                ? "cursor-crosshair"
                                : "cursor-help"
                            ].join(" ")}
                            onPointerEnter={() => setActiveAnchorId(hotspot.id)}
                            onPointerLeave={() => setActiveAnchorId(null)}
                            onPointerDown={(event) => {
                              if (event.button !== 0) {
                                return;
                              }

                              if (connectionMode !== "connecting") {
                                viewportRef.current?.focus();
                                onSelectPlacement(placement.id);
                                onConnectionSelect(undefined);
                                return;
                              }

                              event.preventDefault();
                              event.stopPropagation();
                              viewportRef.current?.focus();
                              onConnectionAnchorClick(endpoint);
                            }}
                            onClick={() => {
                              if (connectionMode === "connecting") {
                                return;
                              }

                              viewportRef.current?.focus();
                              onSelectPlacement(placement.id);
                              onConnectionSelect(undefined);
                            }}
                            onMouseDown={(event) => {
                              if (
                                event.button !== 0 ||
                                connectionMode === "connecting"
                              ) {
                                return;
                              }

                              viewportRef.current?.focus();
                              onSelectPlacement(placement.id);
                              onConnectionSelect(undefined);
                            }}
                            onPointerUp={(event) => {
                              if (
                                event.button !== 0 ||
                                connectionMode === "connecting"
                              ) {
                                return;
                              }

                              viewportRef.current?.focus();
                              onSelectPlacement(placement.id);
                              onConnectionSelect(undefined);
                            }}
                            onMouseUp={(event) => {
                              if (
                                event.button !== 0 ||
                                connectionMode === "connecting"
                              ) {
                                return;
                              }

                              viewportRef.current?.focus();
                              onSelectPlacement(placement.id);
                              onConnectionSelect(undefined);
                            }}
                            onFocus={() => setActiveAnchorId(hotspot.id)}
                            onBlur={() => setActiveAnchorId(null)}
                          >
                            <title>{getAnchorLabel(hotspot)}</title>
                          </circle>
                        </g>
                      );
                    })}
                  </g>
                );
              })}
              {selectedConnectionSegment ? (
                <g data-testid="canvas-route-handles">
                  {visibleRouteControlPoints(selectedConnectionSegment.route).map(
                    (point) => {
                      const isRoutePointSelected = selectedRoutePointId === point.id;
                      const size = Math.max(
                        2.6,
                        Math.min(4.8, 4 / viewportTransform.zoom)
                      );
                      const deleteSize = Math.max(
                        4,
                        Math.min(7, 6 / viewportTransform.zoom)
                      );

                      return (
                        <g key={point.id}>
                          <rect
                            data-testid="canvas-route-point"
                            data-route-point-id={point.id}
                            x={point.x - size / 2}
                            y={point.y - size / 2}
                            width={size}
                            height={size}
                            rx={size * 0.22}
                            className={[
                              "cursor-move fill-white",
                              isRoutePointSelected
                                ? "stroke-sky-700"
                                : "stroke-sky-500"
                            ].join(" ")}
                            strokeWidth={0.65 / viewportTransform.zoom}
                            onPointerDown={(event) => {
                              if (event.button !== 0) {
                                return;
                              }

                              event.preventDefault();
                              event.stopPropagation();
                              event.currentTarget.setPointerCapture(event.pointerId);
                              viewportRef.current?.focus();
                              onConnectionSelect(
                                selectedConnectionSegment.connection.id
                              );
                              setSelectedRoutePointId(point.id);
                              routeDragStateRef.current = {
                                connectionId:
                                  selectedConnectionSegment.connection.id,
                                pointId: point.id,
                                pointerId: event.pointerId
                              };
                            }}
                            onPointerMove={updateDraggedRoutePoint}
                            onPointerUp={() => {
                              routeDragStateRef.current = null;
                            }}
                            onPointerCancel={() => {
                              routeDragStateRef.current = null;
                            }}
                          >
                            <title>
                              Drag route point. Press Delete or use the red x to
                              remove.
                            </title>
                          </rect>
                          {isRoutePointSelected ? (
                            <g
                              data-testid="canvas-route-point-delete"
                              role="button"
                              tabIndex={0}
                              aria-label="Delete route point"
                              transform={`translate(${point.x + size / 2 + 1.5} ${point.y - size / 2 - deleteSize - 1.2})`}
                              className="cursor-pointer"
                              onPointerDown={(event) => {
                                if (event.button !== 0) {
                                  return;
                                }

                                event.preventDefault();
                                event.stopPropagation();
                                routeDragStateRef.current = null;
                                onConnectionRouteChange(
                                  selectedConnectionSegment.connection.id,
                                  removeRouteControlPoint(
                                    selectedConnectionSegment.route,
                                    point.id
                                  )
                                );
                                setSelectedRoutePointId(null);
                              }}
                              onKeyDown={(event) => {
                                if (event.key !== "Enter" && event.key !== " ") {
                                  return;
                                }

                                event.preventDefault();
                                onConnectionRouteChange(
                                  selectedConnectionSegment.connection.id,
                                  removeRouteControlPoint(
                                    selectedConnectionSegment.route,
                                    point.id
                                  )
                                );
                                setSelectedRoutePointId(null);
                              }}
                            >
                              <rect
                                x="0"
                                y="0"
                                width={deleteSize}
                                height={deleteSize}
                                rx={deleteSize * 0.28}
                                className="fill-white stroke-red-500"
                                strokeWidth={0.55 / viewportTransform.zoom}
                              />
                              <text
                                x={deleteSize / 2}
                                y={deleteSize * 0.72}
                                textAnchor="middle"
                                className="pointer-events-none fill-red-600 font-bold"
                                fontSize={deleteSize * 0.78}
                              >
                                x
                              </text>
                              <title>Delete route point</title>
                            </g>
                          ) : null}
                        </g>
                      );
                    }
                  )}
                </g>
              ) : null}
              {selectedConnectionSegment && selectedConnectionSegment.label ? (
                <g data-testid="canvas-route-label-handle-layer">
                  {(() => {
                    const box = routeLabelBox(
                      selectedConnectionSegment.label,
                      selectedConnectionSegment.labelPoint
                    );
                    const handleRadius = Math.max(
                      1.15,
                      Math.min(2.2, 2 / viewportTransform.zoom)
                    );
                    const handlePoint = {
                      x: Number((box.x - handleRadius - 0.7).toFixed(2)),
                      y: Number(
                        (selectedConnectionSegment.labelPoint.y - 1.25).toFixed(2)
                      )
                    };

                    return (
                      <circle
                        data-testid="canvas-route-label-handle"
                        cx={handlePoint.x}
                        cy={handlePoint.y}
                        r={handleRadius}
                        className="fill-amber-300 stroke-amber-700"
                        style={{ cursor: LABEL_MOVE_CURSOR }}
                        strokeWidth={0.45 / viewportTransform.zoom}
                        onPointerDown={(event) => {
                          if (event.button !== 0) {
                            return;
                          }

                          event.preventDefault();
                          event.stopPropagation();
                          event.currentTarget.setPointerCapture(event.pointerId);
                          viewportRef.current?.focus();
                          onConnectionSelect(
                            selectedConnectionSegment.connection.id
                          );
                          setSelectedRoutePointId(null);
                          routeLabelDragStateRef.current = {
                            connectionId:
                              selectedConnectionSegment.connection.id,
                            pointerId: event.pointerId,
                            labelOffset: {
                              x:
                                selectedConnectionSegment.labelPoint.x -
                                handlePoint.x,
                              y:
                                selectedConnectionSegment.labelPoint.y -
                                handlePoint.y
                            }
                          };
                        }}
                        onPointerMove={updateDraggedRouteLabel}
                        onPointerUp={() => {
                          routeLabelDragStateRef.current = null;
                        }}
                        onPointerCancel={() => {
                          routeLabelDragStateRef.current = null;
                        }}
                      >
                        <title>Drag wire label</title>
                      </circle>
                    );
                  })()}
                </g>
              ) : null}
            </svg>
            {activeAnchorHotspot ? (
              <div
                data-testid="canvas-anchor-tooltip"
                data-anchor-tooltip={activeAnchorHotspot.id}
                className="pointer-events-none absolute z-20 w-64 rounded-md border border-teal-200 bg-white/95 p-3 text-[11px] leading-snug text-slate-700 shadow-lg shadow-slate-900/10"
                style={getTooltipPosition(
                  activeAnchorHotspot.point,
                  model.sheet
                )}
                role="status"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold text-slate-950">
                      {activeAnchorHotspot.placementTag}
                    </div>
                    <div className="truncate text-[10px] font-medium text-slate-500">
                      {activeAnchorHotspot.symbolName}
                    </div>
                  </div>
                  <div className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-700">
                    {activeAnchorHotspot.terminal?.requiredForWiring
                      ? "Required"
                      : "Reference"}
                  </div>
                </div>
                <dl className="space-y-1.5">
                  <div className="grid grid-cols-[68px_minmax(0,1fr)] gap-2">
                    <dt className="font-semibold text-slate-500">Anchor</dt>
                    <dd>{activeAnchorHotspot.anchor.key}</dd>
                  </div>
                  <div className="grid grid-cols-[68px_minmax(0,1fr)] gap-2">
                    <dt className="font-semibold text-slate-500">Type</dt>
                    <dd className="capitalize">
                      {activeAnchorHotspot.anchor.kind}
                    </dd>
                  </div>
                  <div className="grid grid-cols-[68px_minmax(0,1fr)] gap-2">
                    <dt className="font-semibold text-slate-500">Terminal</dt>
                    <dd>{activeAnchorHotspot.terminal?.key ?? "-"}</dd>
                  </div>
                  <div className="grid grid-cols-[68px_minmax(0,1fr)] gap-2">
                    <dt className="font-semibold text-slate-500">Label</dt>
                    <dd>{activeAnchorHotspot.terminal?.label ?? "-"}</dd>
                  </div>
                  <div className="grid grid-cols-[68px_minmax(0,1fr)] gap-2">
                    <dt className="font-semibold text-slate-500">Function</dt>
                    <dd>{activeAnchorHotspot.terminal?.function ?? "-"}</dd>
                  </div>
                  {activeAnchorHotspot.symbolModel ? (
                    <div className="grid grid-cols-[68px_minmax(0,1fr)] gap-2">
                      <dt className="font-semibold text-slate-500">Model</dt>
                      <dd>{activeAnchorHotspot.symbolModel}</dd>
                    </div>
                  ) : null}
                </dl>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
