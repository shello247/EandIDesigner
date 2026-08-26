import type {
  PanelConnectionPatternRecord,
  PanelInternalWireRecord
} from "@/features/drawing_panel_wiring/api/public";
import type {
  DrawingConnection,
  DrawingPlacement,
  DrawingSheetCanvasModel
} from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import { expandedOrthogonalPoints } from "./connection-route-geometry";
import { getRenderableConnectionRoute } from "./connection-route-renderer";

export type PanelPatternVisualStyle = {
  stroke: string;
  strokeWidth: number;
  dashArray?: string;
  lineCap: "round" | "square";
  marker: "endpoint_bars" | "nodes" | "chain" | "shield" | "pe" | "signal_ground";
};

function format(value: number): string {
  return Number(value.toFixed(2)).toString();
}

export function getPanelConnectionPatternStyle(
  pattern: PanelConnectionPatternRecord
): PanelPatternVisualStyle {
  if (pattern.recordType === "bond") {
    if (pattern.record.kind === "shield") {
      return {
        stroke: "#475569",
        strokeWidth: 0.58,
        dashArray: "3 1.6",
        lineCap: "round",
        marker: "shield"
      };
    }
    if (pattern.record.kind === "protective_earth") {
      return {
        stroke: "#166534",
        strokeWidth: 0.66,
        lineCap: "round",
        marker: "pe"
      };
    }
    return {
      stroke: "#475569",
      strokeWidth: 0.58,
      dashArray: "4 1.2 .8 1.2",
      lineCap: "round",
      marker: "signal_ground"
    };
  }
  const topology = pattern.record.definition?.topology;
  if (topology === "terminal_jumper") {
    return {
      stroke: "#172554",
      strokeWidth: 0.9,
      lineCap: "square",
      marker: "endpoint_bars"
    };
  }
  if (topology === "bridge_bar") {
    return {
      stroke: "#1e293b",
      strokeWidth: 0.78,
      lineCap: "square",
      marker: "nodes"
    };
  }
  if (topology === "daisy_chain") {
    return {
      stroke: "#1f4e79",
      strokeWidth: 0.56,
      lineCap: "round",
      marker: "chain"
    };
  }
  return {
    stroke: "#334155",
    strokeWidth: topology === "fused_distribution" ? 0.68 : 0.64,
    lineCap: "round",
    marker: "nodes"
  };
}

export function getPanelPatternRouteLabel({
  pattern,
  wire
}: {
  pattern: PanelConnectionPatternRecord;
  wire?: Pick<PanelInternalWireRecord, "id" | "wireId" | "wireNumber">;
}): string {
  return (
    wire?.wireId ??
    pattern.record.label?.trim() ??
    pattern.record.patternCode ??
    "Pattern"
  );
}

function endpointBars(points: Array<{ x: number; y: number }>, stroke: string) {
  if (points.length < 2) return "";
  const endBar = (point: { x: number; y: number }, neighbor: { x: number; y: number }) => {
    const horizontal = Math.abs(point.x - neighbor.x) >= Math.abs(point.y - neighbor.y);
    return horizontal
      ? `<path d="M ${format(point.x)} ${format(point.y - 1.7)} L ${format(point.x)} ${format(point.y + 1.7)}" stroke="${stroke}" stroke-width="0.78"/>`
      : `<path d="M ${format(point.x - 1.7)} ${format(point.y)} L ${format(point.x + 1.7)} ${format(point.y)}" stroke="${stroke}" stroke-width="0.78"/>`;
  };
  return `${endBar(points[0], points[1])}${endBar(points.at(-1)!, points.at(-2)!)}`;
}

function markerSvg(
  marker: PanelPatternVisualStyle["marker"],
  points: Array<{ x: number; y: number }>,
  stroke: string
) {
  if (points.length === 0) return "";
  const start = points[0];
  const middle = points[Math.floor(points.length / 2)];
  if (marker === "endpoint_bars") return endpointBars(points, stroke);
  if (marker === "nodes") {
    return `<circle cx="${format(start.x)}" cy="${format(start.y)}" r="1.1" fill="white" stroke="${stroke}" stroke-width="0.55"/>`;
  }
  if (marker === "chain") {
    return `<circle cx="${format(middle.x)}" cy="${format(middle.y)}" r="1.05" fill="white" stroke="${stroke}" stroke-width="0.5"/>`;
  }
  const text = marker === "shield" ? "SH" : marker === "pe" ? "PE" : "SG";
  return `<g transform="translate(${format(middle.x)} ${format(middle.y)})"><rect x="-2.6" y="-2.1" width="5.2" height="3.4" rx=".5" fill="white" stroke="${stroke}" stroke-width=".35"/><text x="0" y=".25" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="1.8" font-weight="700" fill="${stroke}">${text}</text></g>`;
}

export function renderPanelConnectionPatternSvg({
  model,
  symbols,
  connection,
  pattern,
  wire,
  escapeXml
}: {
  model: DrawingSheetCanvasModel;
  symbols: ApprovedDrawingSymbol[];
  connection: DrawingConnection;
  pattern: PanelConnectionPatternRecord;
  wire?: Pick<PanelInternalWireRecord, "id" | "wireId" | "wireNumber">;
  escapeXml: (value: string) => string;
}): string {
  const label = getPanelPatternRouteLabel({ pattern, wire });
  const rendered = getRenderableConnectionRoute({
    model,
    symbols,
    connection: { ...connection, wireId: label }
  });
  if (!rendered) return "";
  const style = getPanelConnectionPatternStyle(pattern);
  const points = expandedOrthogonalPoints(rendered.route);
  return `
    <g data-connection-id="${escapeXml(connection.id)}" data-panel-pattern-id="${escapeXml(pattern.record.id)}" data-panel-pattern-segment-id="${escapeXml(connection.panelPatternSegmentId ?? "")}"${wire ? ` data-panel-wire-id="${escapeXml(wire.id)}"` : ""} data-route-style="panel-pattern">
      <path d="${rendered.pathData}" fill="none" stroke="${style.stroke}" stroke-width="${style.strokeWidth}"${style.dashArray ? ` stroke-dasharray="${style.dashArray}"` : ""} stroke-linecap="${style.lineCap}" stroke-linejoin="round"/>
      ${markerSvg(style.marker, points, style.stroke)}
      <text data-connection-label="${escapeXml(connection.id)}" x="${format(rendered.labelPoint.x)}" y="${format(rendered.labelPoint.y)}" font-family="Inter, Arial, sans-serif" font-size="2.45" font-weight="600" text-anchor="${rendered.labelPoint.anchor}" fill="#334155">${escapeXml(label)}</text>
    </g>
  `;
}

function legendEntry(pattern: PanelConnectionPatternRecord) {
  const style = getPanelConnectionPatternStyle(pattern);
  const topology = pattern.recordType === "bond"
    ? pattern.record.kind
    : pattern.record.definition?.topology ?? "legacy";
  const labels: Record<string, string> = {
    terminal_jumper: "Terminal jumper",
    bridge_bar: "Bridge bar",
    daisy_chain: "Daisy chain",
    distribution: "Distribution",
    fused_distribution: "Fused distribution",
    shield: "Shield bond",
    protective_earth: "Protective earth",
    signal_ground: "Signal ground",
    legacy: "Legacy pattern"
  };
  return { key: topology, label: labels[topology], style };
}

export function renderPanelPatternLegendSvg({
  placement,
  patterns,
  escapeXml
}: {
  placement: DrawingPlacement;
  patterns: PanelConnectionPatternRecord[];
  escapeXml: (value: string) => string;
}): string {
  if (placement.panelPatternLegend?.visible === false) return "";
  const entries = new Map(
    patterns.map((pattern) => {
      const entry = legendEntry(pattern);
      return [entry.key, entry] as const;
    })
  );
  const rows = [...entries.values()];
  if (rows.length === 0) return "";
  const width = 70;
  const height = 10 + rows.length * 6;
  const body = rows
    .map((entry, index) => {
      const y = 10 + index * 6;
      return `<path d="M 5 ${y} L 22 ${y}" stroke="${entry.style.stroke}" stroke-width="${entry.style.strokeWidth}"${entry.style.dashArray ? ` stroke-dasharray="${entry.style.dashArray}"` : ""}/><text x="26" y="${y + 1}" font-family="Inter, Arial, sans-serif" font-size="2.5" fill="#334155">${escapeXml(entry.label)}</text>`;
    })
    .join("");
  return `<g data-panel-pattern-legend="true" data-placement-id="${escapeXml(placement.id)}" transform="translate(${format(placement.x)} ${format(placement.y)})"><rect x="0" y="0" width="${width}" height="${height}" fill="white" stroke="#64748b" stroke-width=".4"/><text x="4" y="5.5" font-family="Inter, Arial, sans-serif" font-size="2.7" font-weight="700" fill="#1e293b">CONNECTION LEGEND</text>${body}</g>`;
}
