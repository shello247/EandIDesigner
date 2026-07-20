"use client";

import {
  useEffect,
  useRef,
  type KeyboardEvent,
  type PointerEvent
} from "react";
import type {
  NetworkMapSelection,
  NetworkPlacementToolState,
  ApprovedNetworkSymbol
} from "../../types";
import type {
  NetworkMapAnnotation,
  NetworkMapNode,
  NetworkMapSheet
} from "../../data/schema";
import {
  clientPointToNetworkSheetPoint,
  constrainNetworkNodeOrigin,
  getNetworkNodeBounds,
  getNetworkNodeCenter,
  getNetworkNodeSize,
  normalizeNetworkNodeRotation,
  type NetworkNodeSize,
  type NetworkPoint
} from "../../logic/services/network-node-geometry";
import { networkSymbolReferenceKey } from "../../logic/services/network-link-routing";

type DragGesture = {
  pointerId: number;
  nodeId: string;
  startPointer: NetworkPoint;
  startNode: Pick<NetworkMapNode, "x" | "y">;
  latestNode: Pick<NetworkMapNode, "x" | "y">;
  size: NetworkNodeSize;
};

function annotationWidth(annotation: NetworkMapAnnotation): number {
  return annotation.width ?? 80;
}

function annotationHeight(annotation: NetworkMapAnnotation): number {
  return annotation.height ?? 22;
}

function toSheetPoint(
  event: PointerEvent<SVGElement>,
  sheet: NetworkMapSheet
): NetworkPoint {
  const svg = event.currentTarget.ownerSVGElement ?? event.currentTarget;

  return clientPointToNetworkSheetPoint({
    clientX: event.clientX,
    clientY: event.clientY,
    bounds: svg.getBoundingClientRect(),
    page: sheet.page
  });
}

export function NetworkNodeOverlay({
  sheet,
  symbolsByReference,
  selection,
  placementTool,
  viewportZoom,
  onPlace,
  onSelectionChange,
  onNodePreview,
  onNodeMove,
  onNodeDelete,
  onPlacementCancel
}: {
  sheet: NetworkMapSheet;
  symbolsByReference: ReadonlyMap<string, ApprovedNetworkSymbol>;
  selection: NetworkMapSelection;
  placementTool: NetworkPlacementToolState;
  viewportZoom: number;
  onPlace: (point: NetworkPoint) => void;
  onSelectionChange: (selection: NetworkMapSelection) => void;
  onNodePreview: (
    nodeId: string,
    position: Pick<NetworkMapNode, "x" | "y"> | null
  ) => void;
  onNodeMove: (
    nodeId: string,
    delta: NetworkPoint,
    size: NetworkNodeSize
  ) => void;
  onNodeDelete: (nodeId: string) => void;
  onPlacementCancel: () => void;
}) {
  const dragRef = useRef<DragGesture | null>(null);
  const frameRequestRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (frameRequestRef.current !== null) {
        window.cancelAnimationFrame(frameRequestRef.current);
      }
    },
    []
  );

  const schedulePreview = (drag: DragGesture) => {
    if (frameRequestRef.current !== null) {
      window.cancelAnimationFrame(frameRequestRef.current);
    }

    frameRequestRef.current = window.requestAnimationFrame(() => {
      frameRequestRef.current = null;
      onNodePreview(drag.nodeId, drag.latestNode);
    });
  };

  const finishDrag = (event: PointerEvent<SVGRectElement>) => {
    const drag = dragRef.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    if (frameRequestRef.current !== null) {
      window.cancelAnimationFrame(frameRequestRef.current);
      frameRequestRef.current = null;
    }

    dragRef.current = null;
    onNodePreview(drag.nodeId, null);
    const delta = {
      x: Number((drag.latestNode.x - drag.startNode.x).toFixed(2)),
      y: Number((drag.latestNode.y - drag.startNode.y).toFixed(2))
    };

    if (delta.x !== 0 || delta.y !== 0) {
      onNodeMove(drag.nodeId, delta, drag.size);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (placementTool.mode !== "idle") {
        onPlacementCancel();
      } else {
        onSelectionChange(null);
      }
      return;
    }

    if (
      selection?.kind === "node" &&
      (event.key === "Delete" || event.key === "Backspace")
    ) {
      event.preventDefault();
      onNodeDelete(selection.id);
    }
  };

  return (
    <svg
      className={[
        "absolute inset-0 h-full w-full",
        placementTool.mode === "placing" ? "cursor-crosshair" : ""
      ].join(" ")}
      viewBox={`0 0 ${sheet.page.width} ${sheet.page.height}`}
      aria-label="Interactive network map overlay"
      data-testid="network-map-interaction-overlay"
      pointerEvents="all"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onPointerDownCapture={(event) => {
        if (event.button !== 0 || placementTool.mode !== "placing") {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.focus();
        onPlace(toSheetPoint(event, sheet));
      }}
      onPointerDown={(event) => {
        if (event.target !== event.currentTarget || event.button !== 0) {
          return;
        }

        event.currentTarget.focus();
        onSelectionChange(null);
      }}
    >
      {sheet.nodes.map((node) => {
        const symbol = symbolsByReference.get(
          networkSymbolReferenceKey(node.symbolId, node.versionId)
        );
        const bounds = getNetworkNodeBounds(node, symbol);
        const center = getNetworkNodeCenter(node, symbol);
        const isSelected = selection?.kind === "node" && selection.id === node.id;
        const rotation = normalizeNetworkNodeRotation(node.rotation);
        const transform = rotation
          ? `rotate(${rotation} ${center.x} ${center.y})`
          : undefined;
        const strokeWidth = Number((0.9 / Math.max(0.35, viewportZoom)).toFixed(3));

        return (
          <g key={node.id}>
            <rect
              data-testid="network-map-node-hit"
              data-network-node-hit={node.id}
              x={bounds.x}
              y={bounds.y}
              width={bounds.width}
              height={bounds.height}
              transform={transform}
              className={[
                "cursor-move fill-transparent",
                isSelected ? "stroke-sky-600" : "stroke-transparent"
              ].join(" ")}
              strokeWidth={isSelected ? strokeWidth : 0}
              strokeDasharray={isSelected ? "3 2" : undefined}
              pointerEvents="all"
              onPointerDown={(event) => {
                if (event.button !== 0 || placementTool.mode !== "idle") {
                  return;
                }

                event.preventDefault();
                event.stopPropagation();
                event.currentTarget.ownerSVGElement?.focus();
                event.currentTarget.setPointerCapture(event.pointerId);
                const point = toSheetPoint(event, sheet);
                const size = getNetworkNodeSize(node, symbol);
                dragRef.current = {
                  pointerId: event.pointerId,
                  nodeId: node.id,
                  startPointer: point,
                  startNode: { x: node.x, y: node.y },
                  latestNode: { x: node.x, y: node.y },
                  size
                };
                onSelectionChange({ kind: "node", id: node.id });
              }}
              onPointerMove={(event) => {
                const drag = dragRef.current;

                if (
                  !drag ||
                  drag.nodeId !== node.id ||
                  drag.pointerId !== event.pointerId
                ) {
                  return;
                }

                const point = toSheetPoint(event, sheet);
                drag.latestNode = constrainNetworkNodeOrigin({
                  point: {
                    x: drag.startNode.x + point.x - drag.startPointer.x,
                    y: drag.startNode.y + point.y - drag.startPointer.y
                  },
                  size: drag.size,
                  page: sheet.page
                });
                schedulePreview(drag);
              }}
              onPointerUp={finishDrag}
              onPointerCancel={finishDrag}
            >
              <title>{node.tag}</title>
            </rect>
            {isSelected ? (
              <g
                role="button"
                tabIndex={0}
                aria-label={`Delete ${node.tag}`}
                data-testid="network-map-node-delete"
                transform={`translate(${bounds.x + bounds.width + 3} ${bounds.y - 10})`}
                className="cursor-pointer"
                onPointerDown={(event) => {
                  if (event.button !== 0) {
                    return;
                  }
                  event.preventDefault();
                  event.stopPropagation();
                  onNodeDelete(node.id);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onNodeDelete(node.id);
                  }
                }}
              >
                <rect
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
                <title>Delete network device</title>
              </g>
            ) : null}
          </g>
        );
      })}

      {sheet.annotations.map((annotation) => {
        const isSelected =
          selection?.kind === "annotation" && selection.id === annotation.id;

        return (
          <rect
            key={annotation.id}
            data-testid="network-map-annotation-hit"
            data-network-annotation-id={annotation.id}
            x={annotation.x}
            y={annotation.y}
            width={annotationWidth(annotation)}
            height={annotationHeight(annotation)}
            rx={2}
            className={[
              "cursor-pointer fill-transparent",
              isSelected ? "stroke-sky-600" : "stroke-transparent"
            ].join(" ")}
            strokeWidth={isSelected ? 0.8 : 0}
            onPointerDown={(event) => {
              if (event.button !== 0 || placementTool.mode !== "idle") {
                return;
              }

              event.stopPropagation();
              event.currentTarget.ownerSVGElement?.focus();
              onSelectionChange({ kind: "annotation", id: annotation.id });
            }}
          />
        );
      })}
    </svg>
  );
}
