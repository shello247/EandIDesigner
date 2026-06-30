import type { PointerEvent } from "react";
import type { DrawingEndpoint, DrawingModel } from "../../data/schema";
import type { AnchorHotspot } from "./types";
import { getAnchorLabel, getTooltipPosition } from "./utils/canvasGeometry";

export function AnchorOverlay({
  anchorHotspots,
  activeAnchorId,
  sourceAnchorHotspot,
  connectionMode,
  connectionDraftFrom,
  anchorMarkerRadius,
  anchorHitRadius,
  anchorGlowRadius,
  anchorStrokeWidth,
  onActiveAnchorChange,
  onFocusCanvas,
  onSelectPlacement,
  onConnectionSelect,
  onConnectionAnchorClick
}: {
  anchorHotspots: AnchorHotspot[];
  activeAnchorId: string | null;
  sourceAnchorHotspot?: AnchorHotspot;
  connectionMode: "idle" | "connecting";
  connectionDraftFrom?: DrawingEndpoint;
  anchorMarkerRadius: number;
  anchorHitRadius: number;
  anchorGlowRadius: number;
  anchorStrokeWidth: number;
  onActiveAnchorChange: (anchorId: string | null) => void;
  onFocusCanvas: () => void;
  onSelectPlacement: (placementId: string | undefined) => void;
  onConnectionSelect: (connectionId: string | undefined) => void;
  onConnectionAnchorClick: (endpoint: DrawingEndpoint) => void;
}) {
  return (
    <g data-testid="canvas-anchor-overlay">
      {anchorHotspots.map((hotspot) => {
        const isActive = activeAnchorId === hotspot.id;
        const endpoint = {
          placementId: hotspot.placementId,
          anchorKey: hotspot.anchor.key
        };
        const isConnectionSource = sourceAnchorHotspot?.id === hotspot.id;
        const isValidConnectionTarget =
          connectionMode === "connecting" &&
          Boolean(connectionDraftFrom) &&
          !isConnectionSource;

        return (
          <g key={hotspot.id}>
            {isActive || isConnectionSource ? (
              <circle
                cx={hotspot.point.x}
                cy={hotspot.point.y}
                r={isConnectionSource ? anchorGlowRadius * 1.35 : anchorGlowRadius}
                className={[
                  "pointer-events-none",
                  isConnectionSource
                    ? "fill-sky-400 opacity-25"
                    : "fill-teal-400 opacity-20"
                ].join(" ")}
              />
            ) : null}
            <circle
              data-testid="canvas-anchor-marker"
              cx={hotspot.point.x}
              cy={hotspot.point.y}
              r={anchorMarkerRadius}
              className={[
                "pointer-events-none transition-colors",
                isConnectionSource
                  ? "fill-sky-50 stroke-sky-600"
                  : isValidConnectionTarget
                    ? "fill-emerald-50 stroke-emerald-600"
                    : isActive
                      ? "fill-teal-50 stroke-teal-600"
                      : "fill-white stroke-teal-600 opacity-80"
              ].join(" ")}
              strokeWidth={
                isConnectionSource || isValidConnectionTarget
                  ? anchorStrokeWidth * 1.5
                  : anchorStrokeWidth
              }
            />
            <circle
              data-testid="canvas-anchor-hotspot"
              data-anchor-hotspot={hotspot.id}
              role="button"
              tabIndex={0}
              aria-label={getAnchorLabel(hotspot)}
              cx={hotspot.point.x}
              cy={hotspot.point.y}
              r={anchorHitRadius}
              className={[
                "pointer-events-auto fill-transparent",
                connectionMode === "connecting"
                  ? "cursor-crosshair"
                  : "cursor-help"
              ].join(" ")}
              onPointerEnter={() => onActiveAnchorChange(hotspot.id)}
              onPointerLeave={() => onActiveAnchorChange(null)}
              onPointerDown={(event: PointerEvent<SVGCircleElement>) => {
                if (event.button !== 0) {
                  return;
                }

                if (connectionMode !== "connecting") {
                  onFocusCanvas();
                  onSelectPlacement(hotspot.placementId);
                  onConnectionSelect(undefined);
                  return;
                }

                event.preventDefault();
                event.stopPropagation();
                onFocusCanvas();
                onConnectionAnchorClick(endpoint);
              }}
              onClick={() => {
                if (connectionMode === "connecting") {
                  return;
                }

                onFocusCanvas();
                onSelectPlacement(hotspot.placementId);
                onConnectionSelect(undefined);
              }}
              onMouseDown={(event) => {
                if (event.button !== 0 || connectionMode === "connecting") {
                  return;
                }

                onFocusCanvas();
                onSelectPlacement(hotspot.placementId);
                onConnectionSelect(undefined);
              }}
              onPointerUp={(event) => {
                if (event.button !== 0 || connectionMode === "connecting") {
                  return;
                }

                onFocusCanvas();
                onSelectPlacement(hotspot.placementId);
                onConnectionSelect(undefined);
              }}
              onMouseUp={(event) => {
                if (event.button !== 0 || connectionMode === "connecting") {
                  return;
                }

                onFocusCanvas();
                onSelectPlacement(hotspot.placementId);
                onConnectionSelect(undefined);
              }}
              onFocus={() => onActiveAnchorChange(hotspot.id)}
              onBlur={() => onActiveAnchorChange(null)}
            >
              <title>{getAnchorLabel(hotspot)}</title>
            </circle>
          </g>
        );
      })}
    </g>
  );
}

export function AnchorTooltip({
  hotspot,
  sheet
}: {
  hotspot: AnchorHotspot | null;
  sheet: DrawingModel["sheet"];
}) {
  if (!hotspot) {
    return null;
  }

  return (
    <div
      data-testid="canvas-anchor-tooltip"
      data-anchor-tooltip={hotspot.id}
      className="pointer-events-none absolute z-20 w-64 rounded-md border border-teal-200 bg-white/95 p-3 text-[11px] leading-snug text-slate-700 shadow-lg shadow-slate-900/10"
      style={getTooltipPosition(hotspot.point, sheet)}
      role="status"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold text-slate-950">
            {hotspot.placementTag}
          </div>
          <div className="truncate text-[10px] font-medium text-slate-500">
            {hotspot.symbolName}
          </div>
        </div>
        <div className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-700">
          {hotspot.terminal?.requiredForWiring ? "Required" : "Reference"}
        </div>
      </div>
      <dl className="space-y-1.5">
        <div className="grid grid-cols-[68px_minmax(0,1fr)] gap-2">
          <dt className="font-semibold text-slate-500">Anchor</dt>
          <dd>{hotspot.anchor.key}</dd>
        </div>
        <div className="grid grid-cols-[68px_minmax(0,1fr)] gap-2">
          <dt className="font-semibold text-slate-500">Type</dt>
          <dd className="capitalize">{hotspot.anchor.kind}</dd>
        </div>
        <div className="grid grid-cols-[68px_minmax(0,1fr)] gap-2">
          <dt className="font-semibold text-slate-500">Terminal</dt>
          <dd>{hotspot.terminal?.key ?? "-"}</dd>
        </div>
        <div className="grid grid-cols-[68px_minmax(0,1fr)] gap-2">
          <dt className="font-semibold text-slate-500">Label</dt>
          <dd>{hotspot.terminal?.label ?? "-"}</dd>
        </div>
        <div className="grid grid-cols-[68px_minmax(0,1fr)] gap-2">
          <dt className="font-semibold text-slate-500">Function</dt>
          <dd>{hotspot.terminal?.function ?? "-"}</dd>
        </div>
        {hotspot.symbolModel ? (
          <div className="grid grid-cols-[68px_minmax(0,1fr)] gap-2">
            <dt className="font-semibold text-slate-500">Model</dt>
            <dd>{hotspot.symbolModel}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
