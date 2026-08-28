import type { PointerEvent } from "react";
import type {
  DrawingEndpoint,
  DrawingSheetCanvasModel as DrawingModel
} from "../../data/schema";
import type { AnchorHotspot, DrawingAnchorInspection } from "./types";
import { getAnchorLabel, getTooltipPosition } from "./utils/canvasGeometry";
import {
  getDrawingAnchorAvailabilityLabel,
  type DrawingAnchorAvailability
} from "../../logic/services/drawing-anchor-availability";
import {
  buildDrawingAnchorInspection,
  ConnectionEndpointDetails
} from "./ConnectionEndpointDetails";

function markerClasses({
  availability,
  isConnectionSource,
  isValidConnectionTarget,
  isActive,
  showAvailability,
  emphasized
}: {
  availability: DrawingAnchorAvailability;
  isConnectionSource: boolean;
  isValidConnectionTarget: boolean;
  isActive: boolean;
  showAvailability: boolean;
  emphasized: boolean;
}): string {
  if (isConnectionSource) return "fill-sky-50 stroke-sky-600";
  if (isValidConnectionTarget) return "fill-emerald-50 stroke-emerald-600";
  if (!showAvailability) {
    return isActive
      ? "fill-teal-50 stroke-teal-600"
      : "fill-white stroke-teal-600 opacity-80";
  }

  const emphasis = emphasized || isActive ? "opacity-100" : "opacity-80";
  if (availability.status === "occupied") {
    return `fill-teal-700 stroke-teal-950 ${emphasis}`;
  }
  if (availability.status === "conflicting") {
    return `fill-rose-600 stroke-rose-900 ${emphasis}`;
  }
  if (
    availability.status === "unresolved" ||
    availability.status === "incompatible"
  ) {
    return `fill-slate-200 stroke-slate-500 ${emphasis}`;
  }

  return `fill-white stroke-teal-600 ${emphasis}`;
}

function AnchorStatusGlyph({
  availability,
  x,
  y,
  radius,
  strokeWidth,
  hidden
}: {
  availability: DrawingAnchorAvailability;
  x: number;
  y: number;
  radius: number;
  strokeWidth: number;
  hidden: boolean;
}) {
  if (hidden || availability.status === "available") return null;

  if (availability.status === "occupied") {
    return (
      <path
        data-anchor-status-glyph="occupied"
        d={`M ${x - radius * 0.48} ${y} L ${x - radius * 0.12} ${y + radius * 0.34} L ${x + radius * 0.52} ${y - radius * 0.4}`}
        fill="none"
        stroke="white"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth * 1.25}
        className="pointer-events-none"
      />
    );
  }

  if (availability.status === "conflicting") {
    return (
      <g
        data-anchor-status-glyph="conflicting"
        className="pointer-events-none"
        fill="white"
        stroke="white"
        strokeLinecap="round"
      >
        <line
          x1={x}
          y1={y - radius * 0.48}
          x2={x}
          y2={y + radius * 0.12}
          strokeWidth={strokeWidth * 1.2}
        />
        <circle cx={x} cy={y + radius * 0.5} r={strokeWidth * 0.62} />
      </g>
    );
  }

  return (
    <line
      data-anchor-status-glyph="unavailable"
      x1={x - radius * 0.48}
      y1={y + radius * 0.48}
      x2={x + radius * 0.48}
      y2={y - radius * 0.48}
      stroke="#475569"
      strokeLinecap="round"
      strokeWidth={strokeWidth * 1.2}
      className="pointer-events-none"
    />
  );
}

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
  showAvailability,
  onActiveAnchorChange,
  onFocusCanvas,
  onSelectPlacement,
  onConnectionSelect,
  onConnectionAnchorHover,
  onConnectionAnchorInspectionChange,
  onConnectionAnchorClick,
  getConnectionAnchorState
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
  showAvailability: boolean;
  onActiveAnchorChange: (anchorId: string | null) => void;
  onFocusCanvas: () => void;
  onSelectPlacement: (placementId: string | undefined) => void;
  onConnectionSelect: (connectionId: string | undefined) => void;
  onConnectionAnchorHover: (endpoint: DrawingEndpoint | undefined) => void;
  onConnectionAnchorInspectionChange: (
    inspection: DrawingAnchorInspection | undefined
  ) => void;
  onConnectionAnchorClick: (
    endpoint: DrawingEndpoint,
    inspection: DrawingAnchorInspection
  ) => void;
  getConnectionAnchorState?: (
    endpoint: DrawingEndpoint
  ) => DrawingAnchorAvailability;
}) {
  return (
    <g data-testid="canvas-anchor-overlay">
      {anchorHotspots.map((hotspot) => {
        const isActive = activeAnchorId === hotspot.id;
        const endpoint = {
          placementId: hotspot.placementId,
          anchorKey: hotspot.anchor.key
        };
        const anchorState = getConnectionAnchorState?.(endpoint) ?? {
          status: "available" as const,
          enabled: true,
          occupants: []
        };
        const inspection = buildDrawingAnchorInspection({
          hotspot,
          availability: anchorState
        });
        const isConnectionSource = sourceAnchorHotspot?.id === hotspot.id;
        const isValidConnectionTarget =
          connectionMode === "connecting" &&
          Boolean(connectionDraftFrom) &&
          !isConnectionSource &&
          anchorState.enabled;
        const isInvalidConnectionAnchor =
          connectionMode === "connecting" && !anchorState.enabled;

        return (
          <g key={hotspot.id}>
            {isActive || isConnectionSource || isValidConnectionTarget ? (
              <circle
                cx={hotspot.point.x}
                cy={hotspot.point.y}
                r={isConnectionSource ? anchorGlowRadius * 1.35 : anchorGlowRadius}
                className={[
                  "pointer-events-none",
                  isConnectionSource
                    ? "fill-sky-400 opacity-25"
                    : isValidConnectionTarget
                      ? "fill-emerald-400 opacity-25"
                    : "fill-teal-400 opacity-20"
                ].join(" ")}
              />
            ) : null}
            <circle
              data-testid="canvas-anchor-marker"
              data-anchor-marker={hotspot.id}
              data-anchor-status={
                showAvailability ? anchorState.status : "default"
              }
              cx={hotspot.point.x}
              cy={hotspot.point.y}
              r={anchorMarkerRadius}
              className={[
                "pointer-events-none transition-colors",
                markerClasses({
                  availability: anchorState,
                  isConnectionSource,
                  isValidConnectionTarget,
                  isActive,
                  showAvailability,
                  emphasized: connectionMode === "connecting"
                })
              ].join(" ")}
              strokeWidth={
                isConnectionSource || isValidConnectionTarget
                  ? anchorStrokeWidth * 1.5
                  : anchorStrokeWidth
              }
            />
            {showAvailability ? (
              <AnchorStatusGlyph
                availability={anchorState}
                x={hotspot.point.x}
                y={hotspot.point.y}
                radius={anchorMarkerRadius}
                strokeWidth={anchorStrokeWidth}
                hidden={isConnectionSource || isValidConnectionTarget}
              />
            ) : null}
            <circle
              data-testid="canvas-anchor-hotspot"
              data-anchor-hotspot={hotspot.id}
              role="button"
              tabIndex={0}
              aria-label={
                showAvailability
                  ? `${getAnchorLabel(hotspot)}. ${getDrawingAnchorAvailabilityLabel(anchorState)}`
                  : getAnchorLabel(hotspot)
              }
              aria-disabled={isInvalidConnectionAnchor}
              cx={hotspot.point.x}
              cy={hotspot.point.y}
              r={anchorHitRadius}
              className={[
                "pointer-events-auto fill-transparent",
                connectionMode === "connecting"
                  ? "cursor-crosshair"
                  : "cursor-help"
              ].join(" ")}
              onPointerEnter={() => {
                onActiveAnchorChange(hotspot.id);
                onConnectionAnchorInspectionChange(inspection);

                if (connectionMode === "connecting" && connectionDraftFrom) {
                  onConnectionAnchorHover(
                    isValidConnectionTarget ? endpoint : undefined
                  );
                }
              }}
              onPointerLeave={() => {
                onActiveAnchorChange(null);
                onConnectionAnchorInspectionChange(undefined);
                if (connectionMode === "connecting" && connectionDraftFrom) {
                  onConnectionAnchorHover(undefined);
                }
              }}
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
                onConnectionAnchorClick(endpoint, inspection);
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
              onFocus={() => {
                onActiveAnchorChange(hotspot.id);
                onConnectionAnchorInspectionChange(inspection);
                if (connectionMode === "connecting" && connectionDraftFrom) {
                  onConnectionAnchorHover(
                    isValidConnectionTarget ? endpoint : undefined
                  );
                }
              }}
              onBlur={() => {
                onActiveAnchorChange(null);
                onConnectionAnchorInspectionChange(undefined);
                onConnectionAnchorHover(undefined);
              }}
            >
              <title>
                {showAvailability
                  ? getDrawingAnchorAvailabilityLabel(anchorState)
                  : anchorState.reason ?? getAnchorLabel(hotspot)}
              </title>
            </circle>
          </g>
        );
      })}
    </g>
  );
}

export function AnchorAvailabilityLegend() {
  return (
    <div
      data-testid="canvas-anchor-availability-legend"
      className="pointer-events-none absolute right-3 top-3 z-10 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-slate-200 bg-white/95 px-2.5 py-1.5 text-[10px] font-semibold text-slate-600 shadow-sm"
      role="note"
      aria-label="Terminal availability legend"
    >
      <span className="inline-flex items-center gap-1">
        <span className="h-2.5 w-2.5 rounded-full border-2 border-teal-600 bg-white" />
        Available
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="inline-flex h-2.5 w-2.5 items-center justify-center rounded-full bg-teal-700 text-[7px] leading-none text-white">
          ✓
        </span>
        Occupied
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="inline-flex h-2.5 w-2.5 items-center justify-center rounded-full bg-slate-300 text-[7px] leading-none text-slate-700">
          /
        </span>
        Unavailable
      </span>
    </div>
  );
}

export function AnchorTooltip({
  hotspot,
  sheet,
  availability
}: {
  hotspot: AnchorHotspot | null;
  sheet: DrawingModel["sheet"];
  availability?: DrawingAnchorAvailability;
}) {
  if (!hotspot) {
    return null;
  }

  const inspection = buildDrawingAnchorInspection({ hotspot, availability });

  return (
    <div
      data-testid="canvas-anchor-tooltip"
      data-anchor-tooltip={hotspot.id}
      className="pointer-events-none absolute z-20 w-64 rounded-md border border-teal-200 bg-white/95 p-3 text-[11px] leading-snug text-slate-700 shadow-lg shadow-slate-900/10"
      style={getTooltipPosition(hotspot.point, sheet)}
      role="status"
    >
      <ConnectionEndpointDetails
        inspection={inspection}
        showAvailability={Boolean(availability)}
      />
    </div>
  );
}
