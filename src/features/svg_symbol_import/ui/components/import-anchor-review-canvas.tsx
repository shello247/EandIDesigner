"use client";

import { useMemo, useRef, type PointerEvent } from "react";
import type {
  SymbolAnchor,
  SymbolMetadata
} from "@/features/symbol_registry/data/schema";
import {
  SvgCoordinateStage,
  useSvgCoordinateStageGeometry
} from "@/shared/svg/svg-coordinate-stage";
import {
  clampPointToViewBox,
  findNearestAnchorInScreenSpace,
  getAdaptiveSvgMarkerDiameterPx,
  roundSvgPoint,
  SVG_ANCHOR_SELECTION_RADIUS_PX,
  SVG_MARKER_DIAMETER_PX,
  SVG_MARKER_STROKE_PX,
  svgUserUnitsForPixels
} from "@/shared/svg/svg-coordinate-geometry";
import type { SymbolComponentPosition } from "@/features/symbol_components/api/public";

export function ImportAnchorReviewCanvas({
  svg,
  metadata,
  componentPositions = [],
  onAnchorMove
}: {
  svg: string;
  metadata: Pick<SymbolMetadata, "viewBox"> & { anchors: SymbolAnchor[] };
  componentPositions?: SymbolComponentPosition[];
  onAnchorMove: (key: string, x: number, y: number) => void;
}) {
  const viewBox = metadata.viewBox;
  const draggingAnchorKeyRef = useRef<string | null>(null);
  const { overlayRef, pixelsPerUserUnit, clientToViewBoxPoint } =
    useSvgCoordinateStageGeometry(viewBox);
  const anchorPoints = useMemo(
    () =>
      metadata.anchors.map((anchor) => ({
        x: anchor.x,
        y: anchor.y,
        anchor
      })),
    [metadata.anchors]
  );
  const markerGeometryByAnchorKey = useMemo(
    () =>
      new Map(
        anchorPoints.map((point, index) => {
          const diameterPx = getAdaptiveSvgMarkerDiameterPx(
            anchorPoints,
            index,
            pixelsPerUserUnit
          );

          return [
            point.anchor.key,
            {
              radius: svgUserUnitsForPixels(
                diameterPx / 2,
                pixelsPerUserUnit
              ),
              strokeWidth: svgUserUnitsForPixels(
                Math.min(SVG_MARKER_STROKE_PX, diameterPx / 6),
                pixelsPerUserUnit
              )
            }
          ] as const;
        })
      ),
    [anchorPoints, pixelsPerUserUnit]
  );
  const componentStrokeWidth = svgUserUnitsForPixels(
    SVG_MARKER_STROKE_PX,
    pixelsPerUserUnit
  );
  const labelFontSize = svgUserUnitsForPixels(11, pixelsPerUserUnit);
  const labelOffset = svgUserUnitsForPixels(12, pixelsPerUserUnit);

  const findNearestAnchor = (clientX: number, clientY: number) => {
    const pointer = clientToViewBoxPoint(clientX, clientY);
    if (!pointer) {
      return null;
    }

    return (
      findNearestAnchorInScreenSpace(
        anchorPoints,
        pointer,
        pixelsPerUserUnit,
        SVG_ANCHOR_SELECTION_RADIUS_PX
      )?.anchor ?? null
    );
  };

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const anchorKey = draggingAnchorKeyRef.current;
    if (!anchorKey) {
      return;
    }

    const pointer = clientToViewBoxPoint(event.clientX, event.clientY);
    if (!pointer) {
      return;
    }

    const nextPoint = roundSvgPoint(clampPointToViewBox(pointer, viewBox));
    onAnchorMove(anchorKey, nextPoint.x, nextPoint.y);
  };

  const finishDragging = (event: PointerEvent<SVGSVGElement>) => {
    draggingAnchorKeyRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <section className="tool-panel overflow-hidden">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-bold">SVG Preview</h2>
      </div>
      <div className="flex min-h-[320px] items-center justify-center overflow-auto bg-white p-5">
        <SvgCoordinateStage
          svg={svg}
          viewBox={viewBox}
          overlayRef={overlayRef}
          overlayLabel="Imported symbol anchor overlay"
          overlayClassName="cursor-crosshair touch-none"
          onPointerDown={(event) => {
            if (event.button !== 0) {
              return;
            }

            const nearest = findNearestAnchor(event.clientX, event.clientY);
            if (!nearest) {
              return;
            }

            event.preventDefault();
            draggingAnchorKeyRef.current = nearest.key;
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={handlePointerMove}
          onPointerUp={finishDragging}
          onPointerCancel={finishDragging}
          onLostPointerCapture={() => {
            draggingAnchorKeyRef.current = null;
          }}
          overlayChildren={
            <>
              {componentPositions.flatMap((position) =>
                position.components.map((component) => (
                  <g
                    key={`${position.key}:${component.key}`}
                    pointerEvents="none"
                    transform={`rotate(${component.box.rotationDeg} ${component.box.centerX} ${component.box.centerY})`}
                  >
                    <rect
                      data-import-component-position={`${position.key}:${component.key}`}
                      x={component.box.centerX - component.box.width / 2}
                      y={component.box.centerY - component.box.height / 2}
                      width={component.box.width}
                      height={component.box.height}
                      rx={svgUserUnitsForPixels(3, pixelsPerUserUnit)}
                      className="fill-violet-500/10 stroke-violet-600"
                      strokeDasharray={`${svgUserUnitsForPixels(5, pixelsPerUserUnit)} ${svgUserUnitsForPixels(3, pixelsPerUserUnit)}`}
                      strokeWidth={componentStrokeWidth}
                    />
                    <text
                      x={component.box.centerX - component.box.width / 2}
                      y={component.box.centerY - component.box.height / 2 - labelOffset}
                      className="fill-violet-800 font-bold"
                      fontSize={labelFontSize}
                    >
                      {position.label} · {component.label}
                    </text>
                  </g>
                ))
              )}
              {metadata.anchors.map((anchor) => {
                const markerGeometry = markerGeometryByAnchorKey.get(
                  anchor.key
                );

                return (
                  <g key={anchor.key} pointerEvents="none">
                    <circle
                      data-import-anchor-marker={anchor.key}
                      cx={anchor.x}
                      cy={anchor.y}
                      r={
                        markerGeometry?.radius ??
                        svgUserUnitsForPixels(
                          SVG_MARKER_DIAMETER_PX / 2,
                          pixelsPerUserUnit
                        )
                      }
                      className="fill-teal-500 stroke-white"
                      strokeWidth={
                        markerGeometry?.strokeWidth ?? componentStrokeWidth
                      }
                    />
                    <text
                      x={anchor.x + labelOffset}
                      y={anchor.y - labelOffset}
                      className="fill-teal-800 font-bold"
                      fontSize={labelFontSize}
                    >
                      {anchor.key}
                    </text>
                  </g>
                );
              })}
            </>
          }
        />
      </div>
      <div className="border-t border-slate-200 px-4 py-3 text-xs text-slate-600">
        {componentPositions.length === 0
          ? "No component positions detected."
          : `${componentPositions.length} component position${componentPositions.length === 1 ? "" : "s"} detected. Violet boxes are read-only and sourced from Figma.`}
      </div>
    </section>
  );
}

