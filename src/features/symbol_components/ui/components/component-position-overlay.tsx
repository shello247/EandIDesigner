import type { KeyboardEvent } from "react";
import type {
  SymbolComponentDefinition,
  SymbolComponentPosition
} from "../../api/public";

export type ComponentPositionHotspot = {
  id: string;
  position: SymbolComponentPosition;
  component: SymbolComponentDefinition;
};

export function getComponentPositionHotspots(
  positions: SymbolComponentPosition[]
): ComponentPositionHotspot[] {
  return positions.flatMap((position) =>
    position.components.map((component) => ({
      id: `component:${position.key}:${component.key}`,
      position,
      component
    }))
  );
}

export function pointInsideComponentBox(
  point: { x: number; y: number },
  component: SymbolComponentDefinition
): boolean {
  const box = component.box;
  const radians = (-box.rotationDeg * Math.PI) / 180;
  const dx = point.x - box.centerX;
  const dy = point.y - box.centerY;
  const localX = dx * Math.cos(radians) - dy * Math.sin(radians);
  const localY = dx * Math.sin(radians) + dy * Math.cos(radians);

  return (
    Math.abs(localX) <= box.width / 2 &&
    Math.abs(localY) <= box.height / 2
  );
}

export function findComponentPositionHotspot(
  hotspots: ComponentPositionHotspot[],
  point: { x: number; y: number }
): ComponentPositionHotspot | null {
  return (
    hotspots.find((hotspot) =>
      pointInsideComponentBox(point, hotspot.component)
    ) ?? null
  );
}

export function ComponentPositionOverlay({
  hotspots,
  activeId,
  pinnedId,
  strokeWidth,
  cornerRadius,
  dashLength,
  dashGap,
  onFocus,
  onBlur,
  onToggle,
  onEscape
}: {
  hotspots: ComponentPositionHotspot[];
  activeId: string | null;
  pinnedId: string | null;
  strokeWidth: number;
  cornerRadius: number;
  dashLength: number;
  dashGap: number;
  onFocus: (id: string) => void;
  onBlur: () => void;
  onToggle: (id: string) => void;
  onEscape: () => void;
}) {
  return hotspots.map((hotspot) => {
    const box = hotspot.component.box;
    const active = activeId === hotspot.id;
    const handleKeyDown = (event: KeyboardEvent<SVGRectElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        event.stopPropagation();
        onToggle(hotspot.id);
      } else if (event.key === "Escape") {
        onEscape();
      }
    };

    return (
      <g
        key={hotspot.id}
        transform={`rotate(${box.rotationDeg} ${box.centerX} ${box.centerY})`}
      >
        <rect
          x={box.centerX - box.width / 2}
          y={box.centerY - box.height / 2}
          width={box.width}
          height={box.height}
          rx={cornerRadius}
          className={[
            "stroke-violet-600 transition-colors",
            active ? "fill-violet-500/20" : "fill-violet-500/5"
          ].join(" ")}
          strokeDasharray={`${dashLength} ${dashGap}`}
          strokeWidth={strokeWidth}
          pointerEvents="none"
        />
        <rect
          data-component-position-hotspot={`${hotspot.position.key}:${hotspot.component.key}`}
          role="button"
          tabIndex={0}
          aria-label={`Show component position ${hotspot.position.label}, ${hotspot.component.label}`}
          aria-pressed={pinnedId === hotspot.id}
          x={box.centerX - box.width / 2}
          y={box.centerY - box.height / 2}
          width={box.width}
          height={box.height}
          className="fill-transparent"
          pointerEvents="none"
          onFocus={() => onFocus(hotspot.id)}
          onBlur={onBlur}
          onKeyDown={handleKeyDown}
        />
      </g>
    );
  });
}

export function ComponentPositionTooltip({
  hotspot,
  style,
  alternativeNames
}: {
  hotspot: ComponentPositionHotspot;
  style: {
    left: string;
    top: string;
    transform: string;
  };
  alternativeNames: string[];
}) {
  const box = hotspot.component.box;

  return (
    <div
      data-component-position-tooltip={`${hotspot.position.key}:${hotspot.component.key}`}
      className="pointer-events-none absolute z-20 w-72 rounded-md border border-violet-200 bg-white/95 p-3 text-xs text-slate-700 shadow-lg shadow-slate-900/10"
      style={style}
      role="status"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-sm font-semibold text-slate-950">
          {hotspot.position.label}
        </div>
        <div className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
          {hotspot.position.required ? "Required" : "Optional"}
        </div>
      </div>
      <dl className="space-y-1.5">
        <div className="grid grid-cols-[84px_minmax(0,1fr)] gap-2">
          <dt className="font-semibold text-slate-500">Component</dt>
          <dd>{hotspot.component.label}</dd>
        </div>
        <div className="grid grid-cols-[84px_minmax(0,1fr)] gap-2">
          <dt className="font-semibold text-slate-500">Centre</dt>
          <dd>
            {box.centerX}, {box.centerY}
          </dd>
        </div>
        <div className="grid grid-cols-[84px_minmax(0,1fr)] gap-2">
          <dt className="font-semibold text-slate-500">Position box</dt>
          <dd>
            {box.width} × {box.height}
          </dd>
        </div>
        <div className="grid grid-cols-[84px_minmax(0,1fr)] gap-2">
          <dt className="font-semibold text-slate-500">Rotation</dt>
          <dd>{box.rotationDeg}°</dd>
        </div>
        <div className="grid grid-cols-[84px_minmax(0,1fr)] gap-2">
          <dt className="font-semibold text-slate-500">Alternatives</dt>
          <dd>{alternativeNames.join(", ") || "Not configured"}</dd>
        </div>
      </dl>
    </div>
  );
}
