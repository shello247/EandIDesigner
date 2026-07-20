import type {
  DrawingConnection,
  DrawingConnectionRoute,
  DrawingSheetCanvasModel as DrawingModel,
  DrawingRoutePoint
} from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import {
  expandedOrthogonalPoints,
  normalizeConnectionRoute
} from "./connection-route-geometry";

function formatNumber(value: number): string {
  return Number(value.toFixed(2)).toString();
}

function distance(
  first: { x: number; y: number },
  second: { x: number; y: number }
): number {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function pointAlong(
  from: { x: number; y: number },
  to: { x: number; y: number },
  amount: number
): { x: number; y: number } {
  const length = distance(from, to);

  if (length === 0) {
    return from;
  }

  const ratio = amount / length;

  return {
    x: from.x + (to.x - from.x) * ratio,
    y: from.y + (to.y - from.y) * ratio
  };
}

function isGenericLabel(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase();

  return !normalized || normalized === "connection";
}

export function getConnectionRouteLabel(
  connection: DrawingConnection
): string | null {
  if (!isGenericLabel(connection.label)) {
    return connection.label?.trim() ?? null;
  }

  if (connection.wireId?.trim()) {
    return connection.wireId.trim();
  }

  if (
    connection.conductorKey &&
    !/^ch\d+_/i.test(connection.conductorKey) &&
    !/^[a-z]\d+$/i.test(connection.conductorKey)
  ) {
    return connection.conductorKey.trim();
  }

  return null;
}

export function getRouteLabelPoint(route: DrawingConnectionRoute): {
  x: number;
  y: number;
  anchor: "start" | "middle";
} {
  const points = expandedOrthogonalPoints(route);
  const segments = points.slice(0, -1).map((point, index) => ({
    from: point,
    to: points[index + 1],
    length: distance(point, points[index + 1])
  }));
  const segment =
    segments
      .filter((candidate) => candidate.length >= 14)
      .sort((first, second) => second.length - first.length)[0] ?? segments[0];

  if (!segment) {
    return { x: 0, y: 0, anchor: "start" };
  }

  const midpoint = {
    x: (segment.from.x + segment.to.x) / 2,
    y: (segment.from.y + segment.to.y) / 2
  };
  const horizontal = Math.abs(segment.to.x - segment.from.x) >= Math.abs(
    segment.to.y - segment.from.y
  );

  return {
    x: Number((midpoint.x + (horizontal ? 0 : 3.5)).toFixed(2)),
    y: Number((midpoint.y + (horizontal ? -3.5 : 0)).toFixed(2)),
    anchor: horizontal ? "middle" : "start"
  };
}

export function routeLabelBox(label: string, point: { x: number; y: number }) {
  const width = Number((label.length * 1.55 + 3.6).toFixed(2));
  const height = 4.2;

  return {
    x: Number((point.x - width / 2).toFixed(2)),
    y: Number((point.y - height + 1.1).toFixed(2)),
    width,
    height
  };
}

export function routeToPathData(
  route: DrawingConnectionRoute,
  cornerRadius = 2.2
): string {
  const points = expandedOrthogonalPoints(route);

  if (points.length === 0) {
    return "";
  }

  if (points.length === 1) {
    return `M ${formatNumber(points[0].x)} ${formatNumber(points[0].y)}`;
  }

  const commands = [`M ${formatNumber(points[0].x)} ${formatNumber(points[0].y)}`];

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const next = points[index + 1];

    if (!next || cornerRadius <= 0) {
      commands.push(`L ${formatNumber(current.x)} ${formatNumber(current.y)}`);
      continue;
    }

    const incoming = distance(previous, current);
    const outgoing = distance(current, next);
    const radius = Math.min(cornerRadius, incoming / 2, outgoing / 2);

    if (radius <= 0.1) {
      commands.push(`L ${formatNumber(current.x)} ${formatNumber(current.y)}`);
      continue;
    }

    const beforeCorner = pointAlong(current, previous, radius);
    const afterCorner = pointAlong(current, next, radius);

    commands.push(
      `L ${formatNumber(beforeCorner.x)} ${formatNumber(beforeCorner.y)}`,
      `Q ${formatNumber(current.x)} ${formatNumber(current.y)} ${formatNumber(afterCorner.x)} ${formatNumber(afterCorner.y)}`
    );
  }

  return commands.join(" ");
}

export function getRenderableConnectionRoute(input: {
  model: DrawingModel;
  symbols: ApprovedDrawingSymbol[];
  connection: DrawingConnection;
}): {
  connection: DrawingConnection;
  route: DrawingConnectionRoute;
  pathData: string;
  label: string | null;
  labelPoint: { x: number; y: number; anchor: "start" | "middle" };
} | null {
  const route = normalizeConnectionRoute(input);

  if (!route) {
    return null;
  }

  return {
    connection: input.connection,
    route,
    pathData: routeToPathData(route),
    label: getConnectionRouteLabel(input.connection),
    labelPoint: route.labelPosition
      ? {
          x: route.labelPosition.x,
          y: route.labelPosition.y,
          anchor: "middle"
        }
      : getRouteLabelPoint(route)
  };
}

export function renderConnectionRouteSvg(input: {
  model: DrawingModel;
  symbols: ApprovedDrawingSymbol[];
  connection: DrawingConnection;
  stroke?: string;
  strokeWidth?: number;
  showLabel?: boolean;
  escapeXml: (value: string) => string;
}): string {
  const rendered = getRenderableConnectionRoute(input);

  if (!rendered) {
    return "";
  }

  const stroke = input.stroke ?? "#0f8f83";
  const strokeWidth = input.strokeWidth ?? 0.46;
  const label = rendered.label;
  const labelSvg =
    input.showLabel !== false && label
      ? (() => {
          const box = routeLabelBox(label, rendered.labelPoint);
          return `
            <rect x="${formatNumber(box.x)}" y="${formatNumber(box.y)}" width="${formatNumber(box.width)}" height="${formatNumber(box.height)}" rx="1.2" fill="white" opacity="0.86"/>
            <text x="${formatNumber(rendered.labelPoint.x)}" y="${formatNumber(rendered.labelPoint.y)}" font-family="Arial, Helvetica, sans-serif" font-size="2.7" font-weight="600" text-anchor="${rendered.labelPoint.anchor}" fill="#475569">${input.escapeXml(label)}</text>
          `;
        })()
      : "";

  return `
    <g data-connection-id="${input.escapeXml(input.connection.id)}"${input.connection.panelConnectionId ? ` data-panel-wire-id="${input.escapeXml(input.connection.panelConnectionId)}"` : ""} data-route-style="orthogonal">
      <path d="${rendered.pathData}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>
      ${labelSvg}
    </g>
  `;
}

export function visibleRouteControlPoints(
  route: DrawingConnectionRoute
): DrawingRoutePoint[] {
  return route.points.filter((point) => point.kind !== "endpoint");
}
