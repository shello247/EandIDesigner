"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  SvgCoordinateStage,
  useSvgCoordinateStageGeometry
} from "@/shared/svg/svg-coordinate-stage";
import {
  findNearestAnchorInScreenSpace,
  isUsableSvgViewBox,
  SVG_ANCHOR_SELECTION_RADIUS_PX,
  SVG_MARKER_DIAMETER_PX,
  SVG_MARKER_INNER_GLOW_DIAMETER_PX,
  SVG_MARKER_OUTER_GLOW_DIAMETER_PX,
  SVG_MARKER_STROKE_PX,
  svgUserUnitsForPixels
} from "@/shared/svg/svg-coordinate-geometry";
import type {
  SymbolAnchor,
  SymbolMetadata,
  SymbolNetworkPort,
  SymbolTerminal
} from "../../data/schema";

type SymbolHotspot =
  | {
      id: string;
      kind: "terminal";
      terminal: SymbolTerminal;
      anchor: SymbolAnchor;
    }
  | {
      id: string;
      kind: "network_port";
      port: SymbolNetworkPort;
      anchor: SymbolAnchor;
    };

function getSymbolHotspots(metadata?: SymbolMetadata): SymbolHotspot[] {
  if (!metadata) {
    return [];
  }

  const anchorsByKey = new Map(
    metadata.anchors.map((anchor) => [anchor.key, anchor])
  );

  if (metadata.category === "network_device" && metadata.networkProfile) {
    return metadata.networkProfile.ports.flatMap((port) => {
      const anchor = anchorsByKey.get(port.anchorKey);

      return anchor
        ? [
            {
              id: `network_port:${port.key}`,
              kind: "network_port" as const,
              port,
              anchor
            }
          ]
        : [];
    });
  }

  return metadata.terminals.flatMap((terminal) => {
    const anchor = anchorsByKey.get(terminal.anchorKey);

    return anchor
      ? [
          {
            id: `terminal:${terminal.key}`,
            kind: "terminal" as const,
            terminal,
            anchor
          }
        ]
      : [];
  });
}

function getTooltipPosition(anchor: SymbolAnchor, metadata: SymbolMetadata) {
  const left =
    ((anchor.x - metadata.viewBox.x) / metadata.viewBox.width) * 100;
  const top =
    ((anchor.y - metadata.viewBox.y) / metadata.viewBox.height) * 100;
  const translateX = left > 62 ? "-100%" : "12px";
  const translateY = top > 68 ? "-100%" : "12px";

  return {
    left: `${Math.max(0, Math.min(100, left))}%`,
    top: `${Math.max(0, Math.min(100, top))}%`,
    transform: `translate(${translateX}, ${translateY})`
  };
}

function hotspotKey(hotspot: SymbolHotspot): string {
  return hotspot.kind === "terminal" ? hotspot.terminal.key : hotspot.port.key;
}

function hotspotAriaLabel(hotspot: SymbolHotspot): string {
  return hotspot.kind === "terminal"
    ? `Show data for terminal ${hotspot.terminal.key}`
    : `Show data for network port ${hotspot.port.key}`;
}

function HotspotTooltip({
  hotspot,
  metadata
}: {
  hotspot: SymbolHotspot;
  metadata: SymbolMetadata;
}) {
  if (hotspot.kind === "network_port") {
    const { port, anchor } = hotspot;

    return (
      <div
        data-network-port-tooltip={port.key}
        className="pointer-events-none absolute z-20 w-64 rounded-md border border-teal-200 bg-white/95 p-3 text-xs text-slate-700 shadow-lg shadow-slate-900/10"
        style={getTooltipPosition(anchor, metadata)}
        role="status"
      >
        <div className="mb-2 text-sm font-semibold text-slate-950">
          Network port {port.key}
        </div>
        <dl className="space-y-1.5">
          <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2">
            <dt className="font-semibold text-slate-500">Label</dt>
            <dd>{port.label}</dd>
          </div>
          <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2">
            <dt className="font-semibold text-slate-500">Media</dt>
            <dd className="capitalize">{port.media}</dd>
          </div>
          <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2">
            <dt className="font-semibold text-slate-500">Speed</dt>
            <dd>{port.speedMbps ? `${port.speedMbps} Mbps` : "-"}</dd>
          </div>
          <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2">
            <dt className="font-semibold text-slate-500">Protocols</dt>
            <dd>{port.protocolHints.join(", ") || "-"}</dd>
          </div>
          <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2">
            <dt className="font-semibold text-slate-500">Anchor</dt>
            <dd>{port.anchorKey}</dd>
          </div>
        </dl>
      </div>
    );
  }

  const { terminal, anchor } = hotspot;

  return (
    <div
      data-terminal-tooltip={terminal.key}
      className="pointer-events-none absolute z-20 w-64 rounded-md border border-teal-200 bg-white/95 p-3 text-xs text-slate-700 shadow-lg shadow-slate-900/10"
      style={getTooltipPosition(anchor, metadata)}
      role="status"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-sm font-semibold text-slate-950">
          Terminal {terminal.key}
        </div>
        <div className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-700">
          {terminal.requiredForWiring ? "Required" : "Reference"}
        </div>
      </div>
      <dl className="space-y-1.5">
        <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2">
          <dt className="font-semibold text-slate-500">Label</dt>
          <dd>{terminal.label}</dd>
        </div>
        <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2">
          <dt className="font-semibold text-slate-500">Function</dt>
          <dd>{terminal.function || "-"}</dd>
        </div>
        <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2">
          <dt className="font-semibold text-slate-500">Anchor</dt>
          <dd>{terminal.anchorKey}</dd>
        </div>
        <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2">
          <dt className="font-semibold text-slate-500">Type</dt>
          <dd className="capitalize">{anchor.kind}</dd>
        </div>
      </dl>
    </div>
  );
}

export function SvgPreviewPanel({
  svg,
  title = "SVG preview",
  metadata
}: {
  svg: string;
  title?: string;
  metadata?: SymbolMetadata;
}) {
  const [hoveredHotspotId, setHoveredHotspotId] = useState<string | null>(null);
  const [pinnedHotspotId, setPinnedHotspotId] = useState<string | null>(null);
  const [focusedHotspotId, setFocusedHotspotId] = useState<string | null>(null);
  const hotspots = useMemo(() => getSymbolHotspots(metadata), [metadata]);
  const viewBox = metadata?.viewBox;

  if (!metadata || !viewBox || !isUsableSvgViewBox(viewBox)) {
    return (
      <section className="tool-panel overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-bold">{title}</h2>
        </div>
        <div className="flex min-h-[320px] items-center justify-center overflow-auto bg-white p-5">
          <div
            className="svg-preview-fallback flex max-h-[620px] w-full max-w-[620px] items-center justify-center"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </div>
      </section>
    );
  }

  return (
    <SvgPreviewPanelWithMetadata
      svg={svg}
      title={title}
      metadata={metadata}
      hotspots={hotspots}
      hoveredHotspotId={hoveredHotspotId}
      pinnedHotspotId={pinnedHotspotId}
      focusedHotspotId={focusedHotspotId}
      setHoveredHotspotId={setHoveredHotspotId}
      setPinnedHotspotId={setPinnedHotspotId}
      setFocusedHotspotId={setFocusedHotspotId}
    />
  );
}

function SvgPreviewPanelWithMetadata({
  svg,
  title,
  metadata,
  hotspots,
  hoveredHotspotId,
  pinnedHotspotId,
  focusedHotspotId,
  setHoveredHotspotId,
  setPinnedHotspotId,
  setFocusedHotspotId
}: {
  svg: string;
  title: string;
  metadata: SymbolMetadata;
  hotspots: SymbolHotspot[];
  hoveredHotspotId: string | null;
  pinnedHotspotId: string | null;
  focusedHotspotId: string | null;
  setHoveredHotspotId: (id: string | null) => void;
  setPinnedHotspotId: (
    value: string | null | ((current: string | null) => string | null)
  ) => void;
  setFocusedHotspotId: (id: string | null) => void;
}) {
  const viewBox = metadata.viewBox;
  const { overlayRef, pixelsPerUserUnit, clientToViewBoxPoint } =
    useSvgCoordinateStageGeometry(viewBox);
  const hotspotPoints = useMemo(
    () =>
      hotspots.map((hotspot) => ({
        x: hotspot.anchor.x,
        y: hotspot.anchor.y,
        hotspot
      })),
    [hotspots]
  );
  const findNearestHotspot = useCallback(
    (clientX: number, clientY: number) => {
      const pointer = clientToViewBoxPoint(clientX, clientY);
      if (!pointer) {
        return null;
      }

      return (
        findNearestAnchorInScreenSpace(
          hotspotPoints,
          pointer,
          pixelsPerUserUnit,
          SVG_ANCHOR_SELECTION_RADIUS_PX
        )?.hotspot ?? null
      );
    },
    [clientToViewBoxPoint, hotspotPoints, pixelsPerUserUnit]
  );
  const activeMarkerId =
    focusedHotspotId ?? hoveredHotspotId ?? pinnedHotspotId;
  const tooltipHotspotId = hoveredHotspotId ?? pinnedHotspotId;
  const activeHotspot =
    hotspots.find((hotspot) => hotspot.id === tooltipHotspotId) ?? null;
  const hotspotRadius = svgUserUnitsForPixels(
    SVG_MARKER_DIAMETER_PX / 2,
    pixelsPerUserUnit
  );
  const markerStrokeWidth = svgUserUnitsForPixels(
    SVG_MARKER_STROKE_PX,
    pixelsPerUserUnit
  );
  const innerGlowRadius = svgUserUnitsForPixels(
    SVG_MARKER_INNER_GLOW_DIAMETER_PX / 2,
    pixelsPerUserUnit
  );
  const outerGlowRadius = svgUserUnitsForPixels(
    SVG_MARKER_OUTER_GLOW_DIAMETER_PX / 2,
    pixelsPerUserUnit
  );

  const togglePinnedHotspot = (hotspotId: string) => {
    setPinnedHotspotId((current) =>
      current === hotspotId ? null : hotspotId
    );
  };

  useEffect(() => {
    if (!pinnedHotspotId) {
      return;
    }

    const clearPinnedTooltip = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPinnedHotspotId(null);
      }
    };

    window.addEventListener("keydown", clearPinnedTooltip);
    return () => window.removeEventListener("keydown", clearPinnedTooltip);
  }, [pinnedHotspotId, setPinnedHotspotId]);

  return (
    <section className="tool-panel overflow-hidden">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-bold">{title}</h2>
      </div>
      <div className="flex min-h-[320px] items-center justify-center overflow-auto bg-white p-5">
        <SvgCoordinateStage
          svg={svg}
          viewBox={viewBox}
          overlayRef={overlayRef}
          overlayLabel={
            metadata.category === "network_device"
              ? "Network port data overlay"
              : "Terminal data overlay"
          }
          overlayClassName={hotspots.length > 0 ? "cursor-help" : ""}
          onPointerMove={(event) => {
            const nearest = findNearestHotspot(event.clientX, event.clientY);
            setHoveredHotspotId(nearest?.id ?? null);
          }}
          onPointerLeave={() => setHoveredHotspotId(null)}
          onClick={(event) => {
            const nearest = findNearestHotspot(event.clientX, event.clientY);
            setHoveredHotspotId(nearest?.id ?? null);
            if (nearest) {
              togglePinnedHotspot(nearest.id);
            } else {
              setPinnedHotspotId(null);
            }
          }}
          onStageKeyDown={(event) => {
            if (event.key === "Escape") {
              setPinnedHotspotId(null);
            }
          }}
          overlayChildren={
            hotspots.length > 0 ? (
              <>
                {hotspots.map((hotspot) => {
                  const isActive = hotspot.id === activeMarkerId;
                  const key = hotspotKey(hotspot);

                  return (
                    <g key={hotspot.id}>
                      {isActive ? (
                        <>
                          <circle
                            cx={hotspot.anchor.x}
                            cy={hotspot.anchor.y}
                            r={outerGlowRadius}
                            className="fill-teal-400 opacity-20"
                            pointerEvents="none"
                          />
                          <circle
                            cx={hotspot.anchor.x}
                            cy={hotspot.anchor.y}
                            r={innerGlowRadius}
                            className="fill-teal-400 opacity-25"
                            pointerEvents="none"
                          />
                        </>
                      ) : null}
                      <circle
                        cx={hotspot.anchor.x}
                        cy={hotspot.anchor.y}
                        r={hotspotRadius}
                        className={[
                          "stroke-teal-700 transition-all",
                          isActive
                            ? "fill-teal-500 opacity-95"
                            : "fill-white opacity-70"
                        ].join(" ")}
                        strokeWidth={markerStrokeWidth}
                        pointerEvents="none"
                      />
                      <circle
                        data-terminal-hotspot={
                          hotspot.kind === "terminal" ? key : undefined
                        }
                        data-network-port-hotspot={
                          hotspot.kind === "network_port" ? key : undefined
                        }
                        role="button"
                        tabIndex={0}
                        aria-label={hotspotAriaLabel(hotspot)}
                        aria-pressed={pinnedHotspotId === hotspot.id}
                        cx={hotspot.anchor.x}
                        cy={hotspot.anchor.y}
                        r={hotspotRadius}
                        className="fill-transparent"
                        pointerEvents="none"
                        onFocus={() => setFocusedHotspotId(hotspot.id)}
                        onBlur={() => setFocusedHotspotId(null)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            event.stopPropagation();
                            togglePinnedHotspot(hotspot.id);
                          } else if (event.key === "Escape") {
                            setPinnedHotspotId(null);
                          }
                        }}
                      />
                    </g>
                  );
                })}
              </>
            ) : null
          }
          htmlOverlay={
            activeHotspot ? (
              <HotspotTooltip hotspot={activeHotspot} metadata={metadata} />
            ) : null
          }
        />
      </div>
    </section>
  );
}
