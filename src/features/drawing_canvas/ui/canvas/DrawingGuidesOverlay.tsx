import type { PointerEvent } from "react";
import type { DrawingMeasurementUnit } from "../../data/schema";
import {
  formatDrawingGuidePosition,
  type DrawingGuide,
  type DrawingGuideSnapState
} from "../../logic/services/drawing-guides";

type GuidePointerEvent = PointerEvent<SVGLineElement>;

export function DrawingGuidesOverlay({
  guides,
  sheet,
  measurementUnit,
  screenScale,
  selectedGuideId,
  activeSnapState,
  visible,
  disabled,
  onGuidePointerDown,
  onGuidePointerMove,
  onGuidePointerEnd,
  onGuidePointerCancel
}: {
  guides: DrawingGuide[];
  sheet: { width: number; height: number };
  measurementUnit: DrawingMeasurementUnit;
  screenScale: number;
  selectedGuideId?: string;
  activeSnapState: DrawingGuideSnapState;
  visible: boolean;
  disabled: boolean;
  onGuidePointerDown: (guide: DrawingGuide, event: GuidePointerEvent) => void;
  onGuidePointerMove: (event: GuidePointerEvent) => void;
  onGuidePointerEnd: (event: GuidePointerEvent) => void;
  onGuidePointerCancel: (event: GuidePointerEvent) => void;
}) {
  if (!visible || guides.length === 0) return null;

  return (
    <g data-testid="drawing-guides-overlay">
      {guides.map((guide) => {
        const horizontal = guide.axis === "horizontal";
        const selected = selectedGuideId === guide.id;
        const snapped =
          activeSnapState.horizontalGuideId === guide.id ||
          activeSnapState.verticalGuideId === guide.id;
        const label = formatDrawingGuidePosition(guide, measurementUnit);
        const labelWidth = Math.max(38, label.length * 5.3) / screenScale;
        const labelHeight = 14 / screenScale;
        const labelX = horizontal
          ? 5 / screenScale
          : Math.min(
              sheet.width - labelWidth - 2 / screenScale,
              guide.position + 4 / screenScale
            );
        const labelY = horizontal
          ? Math.max(2 / screenScale, guide.position - labelHeight - 3 / screenScale)
          : 5 / screenScale;
        const lineCoordinates = horizontal
          ? {
              x1: 0,
              y1: guide.position,
              x2: sheet.width,
              y2: guide.position
            }
          : {
              x1: guide.position,
              y1: 0,
              x2: guide.position,
              y2: sheet.height
            };

        return (
          <g
            key={guide.id}
            data-testid="drawing-guide"
            data-guide-id={guide.id}
            data-guide-axis={guide.axis}
            data-guide-position={guide.position}
          >
            <line
              {...lineCoordinates}
              stroke="transparent"
              strokeWidth={6 / screenScale}
              pointerEvents={disabled ? "none" : "stroke"}
              cursor={horizontal ? "ns-resize" : "ew-resize"}
              onPointerDown={(event) => {
                if (disabled || event.button !== 0) return;
                event.preventDefault();
                event.stopPropagation();
                event.currentTarget.setPointerCapture(event.pointerId);
                onGuidePointerDown(guide, event);
              }}
              onPointerMove={onGuidePointerMove}
              onPointerUp={onGuidePointerEnd}
              onPointerCancel={onGuidePointerCancel}
              onLostPointerCapture={onGuidePointerCancel}
            />
            <line
              {...lineCoordinates}
              stroke={snapped ? "#0284c7" : selected ? "#0ea5e9" : "#38bdf8"}
              strokeWidth={snapped ? 2 : selected ? 1.5 : 1}
              strokeDasharray={snapped ? undefined : "6 4"}
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
            {selected ? (
              <g pointerEvents="none" aria-hidden="true">
                <rect
                  x={labelX}
                  y={labelY}
                  width={labelWidth}
                  height={labelHeight}
                  rx={3 / screenScale}
                  fill="#f0f9ff"
                  stroke="#0ea5e9"
                  strokeWidth={1 / screenScale}
                />
                <text
                  x={labelX + 5 / screenScale}
                  y={labelY + 10 / screenScale}
                  fill="#0369a1"
                  fontSize={9 / screenScale}
                  fontWeight={700}
                >
                  {label}
                </text>
              </g>
            ) : null}
          </g>
        );
      })}
    </g>
  );
}
