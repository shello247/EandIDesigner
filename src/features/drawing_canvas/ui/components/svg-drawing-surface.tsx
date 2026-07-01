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
import type { DrawingAnnotation, DrawingModel } from "../../data/schema";
import type {
  DrawingConnectionRoute,
  DrawingEndpoint
} from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
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
  clampAnnotationPosition,
  clampPointToSheet,
  NOTE_NUDGE_STEP
} from "../../logic/services/drawing-annotations";
import {
  getPlacementTitlePoint,
  shouldShowPlacementTitle
} from "../../logic/services/placement-title-labels";
import {
  calculateFitTransform,
  clampZoom,
  type ViewportTransform,
  zoomAtViewportCenter
} from "../../logic/services/viewport-transform";
import { AnchorOverlay, AnchorTooltip } from "../canvas/AnchorOverlay";
import { NoteBlockOverlay } from "../canvas/NoteBlockOverlay";
import { PlacementOverlay } from "../canvas/PlacementOverlay";
import { PlacementTitleOverlay } from "../canvas/PlacementTitleOverlay";
import { RouteHandlesOverlay } from "../canvas/RouteHandlesOverlay";
import { RouteLabelOverlay } from "../canvas/RouteLabelOverlay";
import { useCanvasKeyboardShortcuts } from "../canvas/hooks/useCanvasKeyboardShortcuts";
import { usePlacementResize } from "../canvas/hooks/usePlacementResize";
import { usePlacementTitleDrag } from "../canvas/hooks/usePlacementTitleDrag";
import { useRouteLabelDrag } from "../canvas/hooks/useRouteLabelDrag";
import { useRoutePointDrag } from "../canvas/hooks/useRoutePointDrag";
import { useViewportPan } from "../canvas/hooks/useViewportPan";
import type {
  ConnectionDraft,
  ConnectionSegment,
  DragState,
  PlacementTitleLabel
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
  selectedAnnotationId,
  onAnnotationSelect,
  onAnnotationChange,
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
  onConnectionCancel,
  onViewportCenterChange
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
  selectedAnnotationId?: string;
  onAnnotationSelect: (annotationId: string | undefined) => void;
  onAnnotationChange: (
    annotationId: string,
    updates: Partial<DrawingAnnotation>
  ) => void;
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
  onViewportCenterChange?: (point: { x: number; y: number }) => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const didInitialFitRef = useRef(false);
  const [activeAnchorId, setActiveAnchorId] = useState<string | null>(null);
  const [selectedRoutePointId, setSelectedRoutePointId] = useState<string | null>(
    null
  );
  const [selectedAnnotationLeaderId, setSelectedAnnotationLeaderId] = useState<
    string | null
  >(null);
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
  const placementTitleLabels: PlacementTitleLabel[] = useMemo(
    () =>
      model.placements.flatMap((placement) => {
        const symbol = symbolsByKey.get(
          packageKey(placement.symbolId, placement.versionId)
        );

        if (!symbol || !shouldShowPlacementTitle(symbol)) {
          return [];
        }

        return [
          {
            placementId: placement.id,
            label: symbol.displayName,
            point: getPlacementTitlePoint(placement)
          }
        ];
      }),
    [model.placements, symbolsByKey]
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

  useEffect(() => {
    const viewportElement = viewportRef.current;

    if (!viewportElement || !onViewportCenterChange) {
      return;
    }

    const viewportSize = getViewportSize(viewportElement);
    const scale = SHEET_PIXEL_SCALE * viewportTransform.zoom;
    const x = (viewportSize.width / 2 - viewportTransform.panX) / scale;
    const y = (viewportSize.height / 2 - viewportTransform.panY) / scale;

    onViewportCenterChange({
      x: Number(Math.max(0, Math.min(model.sheet.width, x)).toFixed(2)),
      y: Number(Math.max(0, Math.min(model.sheet.height, y)).toFixed(2))
    });
  }, [model.sheet.height, model.sheet.width, onViewportCenterChange, viewportTransform]);

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
    onPlacementChange
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
      onAnnotationSelect(undefined);
      setSelectedAnnotationLeaderId(null);
    },
    [connectionMode, onAnnotationSelect, onConnectionSelect, onSelectPlacement]
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
    onAnnotationSelect(undefined);
    setSelectedAnnotationLeaderId(null);
  }, [onAnnotationSelect, onConnectionSelect, onSelectPlacement]);

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

      if (selectedAnnotationId) {
        const annotation = model.annotations.find(
          (candidate) => candidate.id === selectedAnnotationId
        );

        if (annotation) {
          onAnnotationChange(
            annotation.id,
            clampAnnotationPosition(
              annotation,
              { x: annotation.x + delta.x, y: annotation.y + delta.y },
              model.sheet
            )
          );
        }

        return;
      }

      if (selectedPlacementId) {
        const placement = model.placements.find(
          (candidate) => candidate.id === selectedPlacementId
        );

        if (placement) {
          onPlacementChange(placement.id, {
            x: Number((placement.x + delta.x).toFixed(2)),
            y: Number((placement.y + delta.y).toFixed(2))
          });
        }
      }
    },
    [
      model.annotations,
      model.placements,
      model.sheet,
      onAnnotationChange,
      onConnectionRouteChange,
      onPlacementChange,
      selectedAnnotationId,
      selectedAnnotationLeaderId,
      selectedConnectionSegment,
      selectedPlacementId,
      selectedRoutePointId
    ]
  );

  const selectAnnotation = useCallback(
    (annotationId: string | undefined) => {
      onAnnotationSelect(annotationId);

      if (annotationId) {
        onSelectPlacement(undefined);
        onConnectionSelect(undefined);
        setSelectedRoutePointId(null);
      } else {
        setSelectedAnnotationLeaderId(null);
      }
    },
    [onAnnotationSelect, onConnectionSelect, onSelectPlacement]
  );

  const handleCanvasKeyDown = useCanvasKeyboardShortcuts({
    connectionMode,
    selectedPlacementId,
    canDeleteSelectedRoutePoint: Boolean(
      selectedConnectionSegment && selectedRoutePointId
    ),
    onConnectionCancel,
    onClearSelection: clearCanvasSelection,
    onDeleteSelectedRoutePoint: deleteSelectedRoutePoint,
    onPlacementRemove,
    onNudgeSelected: nudgeSelected
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
          onAnnotationSelect(undefined);
          setSelectedAnnotationLeaderId(null);
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
                onAnnotationSelect(undefined);
                setSelectedAnnotationLeaderId(null);
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
              <NoteBlockOverlay
                model={model}
                selectedAnnotationId={selectedAnnotationId}
                selectedAnnotationLeaderId={selectedAnnotationLeaderId}
                viewportZoom={viewportTransform.zoom}
                onFocusCanvas={focusCanvas}
                onAnnotationSelect={selectAnnotation}
                onAnnotationLeaderSelect={setSelectedAnnotationLeaderId}
                onAnnotationChange={onAnnotationChange}
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
              <PlacementTitleOverlay
                selectedPlacementTitle={selectedPlacementTitle}
                viewportZoom={viewportTransform.zoom}
                onPlacementTitlePointerDown={handlePlacementTitlePointerDown}
                onPlacementTitlePointerMove={updateDraggedPlacementTitle}
                onPlacementTitlePointerEnd={endPlacementTitleDrag}
              />
            </svg>
            <AnchorTooltip hotspot={activeAnchorHotspot} sheet={model.sheet} />
          </div>
        </div>
      </div>
    </section>
  );
}
