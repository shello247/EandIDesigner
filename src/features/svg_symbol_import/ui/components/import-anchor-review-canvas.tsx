"use client";

import type { PointerEvent } from "react";
import type {
  SymbolAnchor,
  SymbolMetadata
} from "@/features/symbol_registry/data/schema";

export function ImportAnchorReviewCanvas({
  svg,
  metadata,
  onAnchorMove
}: {
  svg: string;
  metadata: Pick<SymbolMetadata, "viewBox"> & { anchors: SymbolAnchor[] };
  onAnchorMove: (key: string, x: number, y: number) => void;
}) {
  const viewBox = metadata.viewBox;
  const markerRadius = Math.max(viewBox.width, viewBox.height) * 0.012;

  const handlePointerMove = (
    event: PointerEvent<SVGCircleElement>,
    key: string
  ) => {
    if (event.buttons !== 1) {
      return;
    }

    const svgElement = event.currentTarget.ownerSVGElement;
    if (!svgElement) {
      return;
    }

    const rect = svgElement.getBoundingClientRect();
    const x =
      viewBox.x + ((event.clientX - rect.left) / rect.width) * viewBox.width;
    const y =
      viewBox.y + ((event.clientY - rect.top) / rect.height) * viewBox.height;

    onAnchorMove(key, Number(x.toFixed(2)), Number(y.toFixed(2)));
  };

  return (
    <section className="tool-panel overflow-hidden">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-bold">SVG Preview</h2>
      </div>
      <div className="relative mx-auto aspect-[4/3] max-h-[620px] min-h-[380px] w-full overflow-auto bg-white p-5">
        <div
          className="absolute inset-5 flex items-center justify-center"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <svg
          className="absolute inset-5 h-[calc(100%-40px)] w-[calc(100%-40px)]"
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
          aria-label="Imported symbol anchor overlay"
        >
          {metadata.anchors.map((anchor) => (
            <g key={anchor.key}>
              <circle
                cx={anchor.x}
                cy={anchor.y}
                r={markerRadius}
                className="cursor-move fill-teal-500 stroke-white"
                strokeWidth={Math.max(viewBox.width, viewBox.height) * 0.004}
                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerMove={(event) => handlePointerMove(event, anchor.key)}
              />
              <text
                x={anchor.x + viewBox.width * 0.015}
                y={anchor.y - viewBox.height * 0.015}
                className="fill-teal-800 text-[10px] font-bold"
              >
                {anchor.key}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </section>
  );
}

