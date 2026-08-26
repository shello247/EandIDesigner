import type { MouseEvent, PointerEvent } from "react";
import { buildEditableRouteSegments } from "../../logic/services/connection-route-alignment";
import type { ConnectionSegment } from "./types";

export function RouteSegmentsOverlay({
  selectedConnectionSegment,
  screenScale,
  onRouteSegmentPointerDown,
  onRouteSegmentPointerMove,
  onRouteSegmentPointerEnd,
  onRouteSegmentPointerCancel,
  onRouteSegmentDoubleClick
}: {
  selectedConnectionSegment: ConnectionSegment | null;
  screenScale: number;
  onRouteSegmentPointerDown: (
    segmentKey: string,
    event: PointerEvent<SVGPathElement>
  ) => void;
  onRouteSegmentPointerMove: (event: PointerEvent<SVGPathElement>) => void;
  onRouteSegmentPointerEnd: () => void;
  onRouteSegmentPointerCancel: () => void;
  onRouteSegmentDoubleClick: (event: MouseEvent<SVGPathElement>) => void;
}) {
  if (!selectedConnectionSegment) {
    return null;
  }

  const segments = buildEditableRouteSegments(
    selectedConnectionSegment.route
  ).filter((segment) => segment.editablePointIds.length > 0);

  return (
    <g data-testid="canvas-route-segments">
      {segments.map((segment) => (
        <path
          key={segment.key}
          data-testid="canvas-route-segment-handle"
          data-route-segment-key={segment.key}
          data-route-segment-axis={segment.axis}
          d={`M ${segment.from.x} ${segment.from.y} L ${segment.to.x} ${segment.to.y}`}
          fill="none"
          className={[
            "stroke-transparent hover:stroke-cyan-400/40",
            segment.axis === "horizontal"
              ? "cursor-ns-resize"
              : "cursor-ew-resize"
          ].join(" ")}
          strokeWidth={8 / screenScale}
          strokeLinecap="round"
          pointerEvents="stroke"
          onPointerDown={(event) =>
            onRouteSegmentPointerDown(segment.key, event)
          }
          onPointerMove={onRouteSegmentPointerMove}
          onPointerUp={onRouteSegmentPointerEnd}
          onPointerCancel={onRouteSegmentPointerCancel}
          onLostPointerCapture={onRouteSegmentPointerCancel}
          onDoubleClick={onRouteSegmentDoubleClick}
        >
          <title>
            {segment.axis === "horizontal"
              ? "Drag vertically to move this route segment."
              : "Drag horizontally to move this route segment."}
          </title>
        </path>
      ))}
    </g>
  );
}
