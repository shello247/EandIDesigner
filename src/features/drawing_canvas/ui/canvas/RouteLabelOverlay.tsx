import type { PointerEvent } from "react";
import { routeLabelBox } from "../../logic/services/connection-route-renderer";
import type { ConnectionSegment } from "./types";

const LABEL_MOVE_CURSOR =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='10' fill='%23fbbf24' stroke='%23783d05' stroke-width='2'/%3E%3Cpath d='M12 5v14M5 12h14M9 8l3-3 3 3M9 16l3 3 3-3M8 9l-3 3 3 3M16 9l3 3-3 3' stroke='%231f2937' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\") 12 12, move";

export function RouteLabelOverlay({
  selectedConnectionSegment,
  viewportZoom,
  onRouteLabelPointerDown,
  onRouteLabelPointerMove,
  onRouteLabelPointerEnd,
  onRouteLabelPointerCancel
}: {
  selectedConnectionSegment: ConnectionSegment | null;
  viewportZoom: number;
  onRouteLabelPointerDown: (
    handlePoint: { x: number; y: number },
    event: PointerEvent<SVGCircleElement>
  ) => void;
  onRouteLabelPointerMove: (event: PointerEvent<SVGCircleElement>) => void;
  onRouteLabelPointerEnd: () => void;
  onRouteLabelPointerCancel: () => void;
}) {
  if (!selectedConnectionSegment?.label) {
    return null;
  }

  const box = routeLabelBox(
    selectedConnectionSegment.label,
    selectedConnectionSegment.labelPoint
  );
  const handleRadius = Math.max(1.15, Math.min(2.2, 2 / viewportZoom));
  const handlePoint = {
    x: Number((box.x - handleRadius - 0.7).toFixed(2)),
    y: Number((selectedConnectionSegment.labelPoint.y - 1.25).toFixed(2))
  };

  return (
    <g data-testid="canvas-route-label-handle-layer">
      <circle
        data-testid="canvas-route-label-handle"
        cx={handlePoint.x}
        cy={handlePoint.y}
        r={handleRadius}
        className="fill-amber-300 stroke-amber-700"
        style={{ cursor: LABEL_MOVE_CURSOR }}
        strokeWidth={0.45 / viewportZoom}
        onPointerDown={(event) => onRouteLabelPointerDown(handlePoint, event)}
        onPointerMove={onRouteLabelPointerMove}
        onPointerUp={onRouteLabelPointerEnd}
        onPointerCancel={onRouteLabelPointerCancel}
      >
        <title>Drag wire label</title>
      </circle>
    </g>
  );
}
