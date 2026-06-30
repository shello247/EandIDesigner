import type { KeyboardEvent, PointerEvent } from "react";
import { visibleRouteControlPoints } from "../../logic/services/connection-route-renderer";
import type { ConnectionSegment } from "./types";

export function RouteHandlesOverlay({
  selectedConnectionSegment,
  selectedRoutePointId,
  viewportZoom,
  onRoutePointPointerDown,
  onRoutePointPointerMove,
  onRoutePointPointerEnd,
  onRoutePointDelete
}: {
  selectedConnectionSegment: ConnectionSegment | null;
  selectedRoutePointId: string | null;
  viewportZoom: number;
  onRoutePointPointerDown: (
    pointId: string,
    event: PointerEvent<SVGRectElement>
  ) => void;
  onRoutePointPointerMove: (event: PointerEvent<SVGRectElement>) => void;
  onRoutePointPointerEnd: () => void;
  onRoutePointDelete: (pointId: string) => void;
}) {
  if (!selectedConnectionSegment) {
    return null;
  }

  return (
    <g data-testid="canvas-route-handles">
      {visibleRouteControlPoints(selectedConnectionSegment.route).map((point) => {
        const isRoutePointSelected = selectedRoutePointId === point.id;
        const size = Math.max(2.6, Math.min(4.8, 4 / viewportZoom));
        const deleteSize = Math.max(4, Math.min(7, 6 / viewportZoom));

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
                isRoutePointSelected ? "stroke-sky-700" : "stroke-sky-500"
              ].join(" ")}
              strokeWidth={0.65 / viewportZoom}
              onPointerDown={(event) => onRoutePointPointerDown(point.id, event)}
              onPointerMove={onRoutePointPointerMove}
              onPointerUp={onRoutePointPointerEnd}
              onPointerCancel={onRoutePointPointerEnd}
            >
              <title>
                Drag route point. Press Delete or use the red x to remove.
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
                  onRoutePointDelete(point.id);
                }}
                onKeyDown={(event: KeyboardEvent<SVGGElement>) => {
                  if (event.key !== "Enter" && event.key !== " ") {
                    return;
                  }

                  event.preventDefault();
                  onRoutePointDelete(point.id);
                }}
              >
                <rect
                  x="0"
                  y="0"
                  width={deleteSize}
                  height={deleteSize}
                  rx={deleteSize * 0.28}
                  className="fill-white stroke-red-500"
                  strokeWidth={0.55 / viewportZoom}
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
      })}
    </g>
  );
}
