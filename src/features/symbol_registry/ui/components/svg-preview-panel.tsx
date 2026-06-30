"use client";

import { useMemo, useState } from "react";
import type {
  SymbolAnchor,
  SymbolMetadata,
  SymbolTerminal
} from "../../data/schema";

type TerminalHotspot = {
  terminal: SymbolTerminal;
  anchor: SymbolAnchor;
};

function getTerminalHotspots(metadata?: SymbolMetadata): TerminalHotspot[] {
  if (!metadata) {
    return [];
  }

  const anchorsByKey = new Map(
    metadata.anchors.map((anchor) => [anchor.key, anchor])
  );

  return metadata.terminals.flatMap((terminal) => {
    const anchor = anchorsByKey.get(terminal.anchorKey);

    return anchor ? [{ terminal, anchor }] : [];
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

export function SvgPreviewPanel({
  svg,
  title = "SVG preview",
  metadata
}: {
  svg: string;
  title?: string;
  metadata?: SymbolMetadata;
}) {
  const [activeTerminalKey, setActiveTerminalKey] = useState<string | null>(null);
  const hotspots = useMemo(() => getTerminalHotspots(metadata), [metadata]);
  const activeHotspot =
    hotspots.find((hotspot) => hotspot.terminal.key === activeTerminalKey) ??
    null;
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
        <div className="svg-preview-stage relative inline-block max-h-[620px] max-w-full">
          <div dangerouslySetInnerHTML={{ __html: svg }} />
          {metadata && viewBox && hotspots.length > 0 ? (
            <>
              <svg
                className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
                viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
                aria-label="Terminal data overlay"
              >
                {hotspots.map(({ terminal, anchor }) => {
                  const isActive = terminal.key === activeTerminalKey;

                  return (
                    <g key={`${terminal.key}-${anchor.key}`}>
                      {isActive ? (
                        <>
                          <circle
                            cx={anchor.x}
                            cy={anchor.y}
                            r={hotspotRadius * 2.5}
                            className="fill-teal-400 opacity-20"
                          />
                          <circle
                            cx={anchor.x}
                            cy={anchor.y}
                            r={hotspotRadius * 1.6}
                            className="fill-teal-400 opacity-25"
                          />
                        </>
                      ) : null}
                      <circle
                        cx={anchor.x}
                        cy={anchor.y}
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
                        data-terminal-hotspot={terminal.key}
                        role="button"
                        tabIndex={0}
                        aria-label={`Show data for terminal ${terminal.key}`}
                        cx={anchor.x}
                        cy={anchor.y}
                        r={hitRadius}
                        className="pointer-events-auto cursor-help fill-transparent"
                        onPointerEnter={() => setActiveTerminalKey(terminal.key)}
                        onPointerLeave={() => setActiveTerminalKey(null)}
                        onMouseEnter={() => setActiveTerminalKey(terminal.key)}
                        onMouseLeave={() => setActiveTerminalKey(null)}
                        onClick={() => setActiveTerminalKey(terminal.key)}
                        onFocus={() => setActiveTerminalKey(terminal.key)}
                        onBlur={() => setActiveTerminalKey(null)}
                      />
                    </g>
                  );
                })}
              </svg>
              {activeHotspot ? (
                <div
                  data-terminal-tooltip={activeHotspot.terminal.key}
                  className="pointer-events-none absolute z-20 w-64 rounded-md border border-teal-200 bg-white/95 p-3 text-xs text-slate-700 shadow-lg shadow-slate-900/10"
                  style={getTooltipPosition(activeHotspot.anchor, metadata)}
                  role="status"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-slate-950">
                      Terminal {activeHotspot.terminal.key}
                    </div>
                    <div className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-700">
                      {activeHotspot.terminal.requiredForWiring
                        ? "Required"
                        : "Reference"}
                    </div>
                  </div>
                  <dl className="space-y-1.5">
                    <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2">
                      <dt className="font-semibold text-slate-500">Label</dt>
                      <dd>{activeHotspot.terminal.label}</dd>
                    </div>
                    <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2">
                      <dt className="font-semibold text-slate-500">Function</dt>
                      <dd>{activeHotspot.terminal.function || "-"}</dd>
                    </div>
                    <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2">
                      <dt className="font-semibold text-slate-500">Anchor</dt>
                      <dd>{activeHotspot.terminal.anchorKey}</dd>
                    </div>
                    <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2">
                      <dt className="font-semibold text-slate-500">Type</dt>
                      <dd className="capitalize">{activeHotspot.anchor.kind}</dd>
                    </div>
                  </dl>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
