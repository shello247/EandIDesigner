"use client";

import { useMemo, type PointerEvent } from "react";
import type { DrawingMeasurementUnit } from "../../data/schema";
import {
  deriveDrawingRulerTicks,
  type DrawingGuideAxis
} from "../../logic/services/drawing-guides";

type RulerPointerEvent = PointerEvent<HTMLDivElement>;

export function DrawingGuideRulers({
  sheetWidth,
  sheetHeight,
  pixelsPerUnit,
  measurementUnit,
  visible,
  disabled,
  onPointerStart,
  onPointerMove,
  onPointerEnd,
  onPointerCancel
}: {
  sheetWidth: number;
  sheetHeight: number;
  pixelsPerUnit: number;
  measurementUnit: DrawingMeasurementUnit;
  visible: boolean;
  disabled: boolean;
  onPointerStart: (axis: DrawingGuideAxis, event: RulerPointerEvent) => void;
  onPointerMove: (event: RulerPointerEvent) => void;
  onPointerEnd: (event: RulerPointerEvent) => void;
  onPointerCancel: (event: RulerPointerEvent) => void;
}) {
  const horizontalTicks = useMemo(
    () =>
      deriveDrawingRulerTicks({
        length: sheetWidth,
        pixelsPerUnit,
        measurementUnit
      }),
    [measurementUnit, pixelsPerUnit, sheetWidth]
  );
  const verticalTicks = useMemo(
    () =>
      deriveDrawingRulerTicks({
        length: sheetHeight,
        pixelsPerUnit,
        measurementUnit
      }),
    [measurementUnit, pixelsPerUnit, sheetHeight]
  );

  if (!visible) return null;

  const pointerHandlers = {
    onPointerMove,
    onPointerUp: onPointerEnd,
    onPointerCancel
  };

  return (
    <>
      <div
        className="drawing-guide-ruler drawing-guide-ruler-horizontal"
        data-testid="drawing-horizontal-ruler"
        aria-label="Horizontal ruler. Drag onto the sheet to create a horizontal guide."
        title="Drag onto the sheet to create a horizontal guide"
        onPointerDown={(event) => {
          if (disabled || event.button !== 0) return;
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          onPointerStart("horizontal", event);
        }}
        {...pointerHandlers}
      >
        {horizontalTicks.map((tick) => (
          <span
            key={`${tick.position}:${tick.major ? "major" : "minor"}`}
            className={[
              "drawing-guide-ruler-tick",
              tick.major ? "drawing-guide-ruler-tick-major" : ""
            ].join(" ")}
            style={{ left: `${tick.position * pixelsPerUnit}px` }}
          >
            {tick.label ? (
              <span className="drawing-guide-ruler-label">{tick.label}</span>
            ) : null}
          </span>
        ))}
      </div>
      <div
        className="drawing-guide-ruler drawing-guide-ruler-vertical"
        data-testid="drawing-vertical-ruler"
        aria-label="Vertical ruler. Drag onto the sheet to create a vertical guide."
        title="Drag onto the sheet to create a vertical guide"
        onPointerDown={(event) => {
          if (disabled || event.button !== 0) return;
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          onPointerStart("vertical", event);
        }}
        {...pointerHandlers}
      >
        {verticalTicks.map((tick) => (
          <span
            key={`${tick.position}:${tick.major ? "major" : "minor"}`}
            className={[
              "drawing-guide-ruler-tick",
              tick.major ? "drawing-guide-ruler-tick-major" : ""
            ].join(" ")}
            style={{ top: `${tick.position * pixelsPerUnit}px` }}
          >
            {tick.label ? (
              <span className="drawing-guide-ruler-label">{tick.label}</span>
            ) : null}
          </span>
        ))}
      </div>
    </>
  );
}
