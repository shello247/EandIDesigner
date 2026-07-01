import type { PointerEvent } from "react";
import type { PlacementTitleLabel } from "./types";

const TITLE_MOVE_CURSOR =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='10' fill='%23c084fc' stroke='%237e22ce' stroke-width='2'/%3E%3Cpath d='M12 5v14M5 12h14M9 8l3-3 3 3M9 16l3 3 3-3M8 9l-3 3 3 3M16 9l3 3-3 3' stroke='%231f2937' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\") 12 12, move";

export function PlacementTitleOverlay({
  selectedPlacementTitle,
  viewportZoom,
  onPlacementTitlePointerDown,
  onPlacementTitlePointerMove,
  onPlacementTitlePointerEnd
}: {
  selectedPlacementTitle: PlacementTitleLabel | null;
  viewportZoom: number;
  onPlacementTitlePointerDown: (
    handlePoint: { x: number; y: number },
    event: PointerEvent<SVGCircleElement>
  ) => void;
  onPlacementTitlePointerMove: (event: PointerEvent<SVGCircleElement>) => void;
  onPlacementTitlePointerEnd: () => void;
}) {
  if (!selectedPlacementTitle) {
    return null;
  }

  const handleRadius = Math.max(1.2, Math.min(2.4, 2.1 / viewportZoom));
  const handlePoint = {
    x: Number((selectedPlacementTitle.point.x - handleRadius - 0.9).toFixed(2)),
    y: Number((selectedPlacementTitle.point.y - 1.25).toFixed(2))
  };

  return (
    <g data-testid="canvas-placement-title-handle-layer">
      <circle
        data-testid="canvas-placement-title-handle"
        cx={handlePoint.x}
        cy={handlePoint.y}
        r={handleRadius}
        className="fill-purple-300 stroke-purple-700"
        style={{ cursor: TITLE_MOVE_CURSOR }}
        strokeWidth={0.5 / viewportZoom}
        onPointerDown={(event) =>
          onPlacementTitlePointerDown(handlePoint, event)
        }
        onPointerMove={onPlacementTitlePointerMove}
        onPointerUp={onPlacementTitlePointerEnd}
        onPointerCancel={onPlacementTitlePointerEnd}
      >
        <title>Drag symbol tag and title</title>
      </circle>
    </g>
  );
}
