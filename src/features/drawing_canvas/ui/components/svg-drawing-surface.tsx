"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type PointerEvent,
  type SetStateAction
} from "react";
import type { DrawingModel } from "../../data/schema";
import type {
  DrawingConnectionRoute,
  DrawingEndpoint
} from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import { getAnchorWorldPoint } from "../../logic/services/drawing-geometry";
import { renderDrawingToSvg } from "../../logic/services/drawing-svg-renderer";
import { addRouteControlPoint } from "../../logic/services/connection-route-geometry";
import {
  getRenderableConnectionRoute,
  routeLabelBox
} from "../../logic/services/connection-route-renderer";
import {
  calculateFitTransform,
  clampZoom,
  type ViewportTransform,
  zoomAtViewportCenter
} from "../../logic/services/viewport-transform";
import { AnchorOverlay, AnchorTooltip } from "../canvas/AnchorOverlay";
import { PlacementOverlay } from "../canvas/PlacementOverlay";
import { RouteHandlesOverlay } from "../canvas/RouteHandlesOverlay";
import { RouteLabelOverlay } from "../canvas/RouteLabelOverlay";
import { useCanvasKeyboardShortcuts } from "../canvas/hooks/useCanvasKeyboardShortcuts";
import { usePlacementResize } from "../canvas/hooks/usePlacementResize";
import { useRouteLabelDrag } from "../canvas/hooks/useRouteLabelDrag";
import { useRoutePointDrag } from "../canvas/hooks/useRoutePointDrag";
import { useViewportPan } from "../canvas/hooks/useViewportPan";
import type {
  ConnectionDraft,
  ConnectionSegment,
  DragState
} from "../canvas/types";
import {
  getViewportSize,
  packageKey,
  toSvgPoint
} from "../canvas/utils/canvasGeometry";
import { DrawingViewportToolbar } from "./drawing-viewport-toolbar";

const SHEET_PIXEL_SCALE = 2;
const ZOOM_STEP = 1.2;

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
  const [activeAnchorId, setActiveAnchorId] = useState<string | null>(null);
  const [selectedRoutePointId, setSelectedRoutePointId] = useState<string | null>(
    null
  );
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

  const {
    isPanning,
    handleWheel,
    startMiddleButtonPan,
    updateMiddleButtonPan,
    endMiddleButtonPan
  } = useViewportPan({
    viewportRef,
    viewportTransform,
    setViewportTransform,
    onActiveAnchorChange: setActiveAnchorId
  });

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
    setSelectedRoutePointId
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
    setSelectedRoutePointId
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
    },
    [connectionMode, onConnectionSelect, onSelectPlacement]
  );

  const {
    handlePlacementResizeStart,
    updatePlacementFromResize,
    endPlacementResize
  } = usePlacementResize({
    model,
    symbolsByKey,
    onPlacementChange
  });

  const clearCanvasSelection = useCallback(() => {
    onSelectPlacement(undefined);
    onConnectionSelect(undefined);
  }, [onConnectionSelect, onSelectPlacement]);

  const deleteSelectedRoutePoint = useCallback(() => {
    if (!selectedRoutePointId) {
      return;
    }

    deleteRoutePoint(selectedRoutePointId);
  }, [deleteRoutePoint, selectedRoutePointId]);

  const handleCanvasKeyDown = useCanvasKeyboardShortcuts({
    connectionMode,
    selectedPlacementId,
    canDeleteSelectedRoutePoint: Boolean(
      selectedConnectionSegment && selectedRoutePointId
    ),
    onConnectionCancel,
    onClearSelection: clearCanvasSelection,
    onDeleteSelectedRoutePoint: deleteSelectedRoutePoint,
    onPlacementRemove
  });

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
        onKeyDown={handleCanvasKeyDown}
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
              <PlacementOverlay
                model={model}
                symbolsByKey={symbolsByKey}
                selectedPlacementId={selectedPlacementId}
                connectionMode={connectionMode}
                viewportZoom={viewportTransform.zoom}
                dragState={dragState}
                onFocusCanvas={focusCanvas}
                onSelectPlacement={onSelectPlacement}
                onConnectionSelect={onConnectionSelect}
                onDragStart={onDragStart}
                onDragMove={onDragMove}
                onDragEnd={onDragEnd}
                onPlacementRemove={onPlacementRemove}
                onResizeStart={handlePlacementResizeStart}
                onResizeMove={updatePlacementFromResize}
                onResizeEnd={endPlacementResize}
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
            </svg>
            <AnchorTooltip hotspot={activeAnchorHotspot} sheet={model.sheet} />
          </div>
        </div>
      </div>
    </section>
  );
}
