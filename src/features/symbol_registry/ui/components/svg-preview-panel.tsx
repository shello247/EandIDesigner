"use client";

import { useMemo, useState } from "react";
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
  const [activeHotspotId, setActiveHotspotId] = useState<string | null>(null);
  const hotspots = useMemo(() => getSymbolHotspots(metadata), [metadata]);
  const activeHotspot =
    hotspots.find((hotspot) => hotspot.id === activeHotspotId) ?? null;
  const viewBox = metadata?.viewBox;
  const hotspotRadius = viewBox
    ? Math.max(viewBox.width, viewBox.height) * 0.018
    : 8;
  const hitRadius = viewBox ? Math.max(hotspotRadius * 2.2, 14) : 18;

  return (
    <section className="tool-panel overflow-hidden">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-bold">{title}</h2>
      </div>
      <div className="flex min-h-[320px] items-center justify-center overflow-auto bg-white p-5">
        <div
          className="svg-preview-stage relative w-full max-w-[620px]"
          style={
            viewBox
              ? { aspectRatio: `${viewBox.width} / ${viewBox.height}` }
              : undefined
          }
        >
          <div dangerouslySetInnerHTML={{ __html: svg }} />
          {metadata && viewBox && hotspots.length > 0 ? (
            <>
              <svg
                className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
                viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
                aria-label={
                  metadata.category === "network_device"
                    ? "Network port data overlay"
                    : "Terminal data overlay"
                }
              >
                {hotspots.map((hotspot) => {
                  const isActive = hotspot.id === activeHotspotId;
                  const key = hotspotKey(hotspot);

                  return (
                    <g key={hotspot.id}>
                      {isActive ? (
                        <>
                          <circle
                            cx={hotspot.anchor.x}
                            cy={hotspot.anchor.y}
                            r={hotspotRadius * 2.5}
                            className="fill-teal-400 opacity-20"
                          />
                          <circle
                            cx={hotspot.anchor.x}
                            cy={hotspot.anchor.y}
                            r={hotspotRadius * 1.6}
                            className="fill-teal-400 opacity-25"
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
                        strokeWidth={Math.max(viewBox.width, viewBox.height) * 0.004}
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
                        cx={hotspot.anchor.x}
                        cy={hotspot.anchor.y}
                        r={hitRadius}
                        className="pointer-events-auto cursor-help fill-transparent"
                        onPointerEnter={() => setActiveHotspotId(hotspot.id)}
                        onPointerLeave={() => setActiveHotspotId(null)}
                        onMouseEnter={() => setActiveHotspotId(hotspot.id)}
                        onMouseLeave={() => setActiveHotspotId(null)}
                        onClick={() => setActiveHotspotId(hotspot.id)}
                        onFocus={() => setActiveHotspotId(hotspot.id)}
                        onBlur={() => setActiveHotspotId(null)}
                      />
                    </g>
                  );
                })}
              </svg>
              {activeHotspot ? (
                <HotspotTooltip hotspot={activeHotspot} metadata={metadata} />
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
