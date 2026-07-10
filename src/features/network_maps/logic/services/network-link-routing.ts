import type { NetworkMapLink, NetworkMapRoutePoint } from "../../data/schema";
import type { ApprovedNetworkSymbol } from "../../types";
import type { NetworkMapNode, NetworkMapSheet } from "../../data/schema";

type Point = { x: number; y: number };

function roundPoint(point: Point): Point {
  return {
    x: Number(point.x.toFixed(2)),
    y: Number(point.y.toFixed(2))
  };
}

function nodeCenter(node: NetworkMapNode, symbol: ApprovedNetworkSymbol): Point {
  return {
    x: node.x + (symbol.metadata.viewBox.width * node.scale) / 2,
    y: node.y + (symbol.metadata.viewBox.height * node.scale) / 2
  };
}

export function getNetworkPortWorldPoint(input: {
  sheet: NetworkMapSheet;
  symbols: ApprovedNetworkSymbol[];
  nodeId: string;
  portKey: string;
}): Point | null {
  const node = input.sheet.nodes.find((candidate) => candidate.id === input.nodeId);
  const symbol = node
    ? input.symbols.find(
        (candidate) =>
          candidate.symbolId === node.symbolId &&
          candidate.versionId === node.versionId
      )
    : undefined;

  if (!node || !symbol) {
    return null;
  }

  const port = symbol.metadata.networkProfile.ports.find(
    (candidate) => candidate.key === input.portKey
  );
  const anchor = symbol.metadata.anchors.find(
    (candidate) => candidate.key === (port?.anchorKey ?? input.portKey)
  );

  if (!anchor) {
    return nodeCenter(node, symbol);
  }

  return roundPoint({
    x: node.x + anchor.x * node.scale,
    y: node.y + anchor.y * node.scale
  });
}

export function buildDefaultNetworkLinkRoute(input: {
  sheet: NetworkMapSheet;
  symbols: ApprovedNetworkSymbol[];
  link: NetworkMapLink;
}): NetworkMapRoutePoint[] | null {
  const from = getNetworkPortWorldPoint({
    sheet: input.sheet,
    symbols: input.symbols,
    nodeId: input.link.from.nodeId,
    portKey: input.link.from.portKey
  });
  const to = getNetworkPortWorldPoint({
    sheet: input.sheet,
    symbols: input.symbols,
    nodeId: input.link.to.nodeId,
    portKey: input.link.to.portKey
  });

  if (!from || !to) {
    return null;
  }

  const midpointX = Number(((from.x + to.x) / 2).toFixed(2));

  return [
    { id: `${input.link.id}_from`, kind: "endpoint", ...from },
    {
      id: `${input.link.id}_control_1`,
      kind: "control",
      x: midpointX,
      y: from.y
    },
    {
      id: `${input.link.id}_control_2`,
      kind: "control",
      x: midpointX,
      y: to.y
    },
    { id: `${input.link.id}_to`, kind: "endpoint", ...to }
  ];
}

export function expandedNetworkRoutePoints(
  points: NetworkMapRoutePoint[]
): NetworkMapRoutePoint[] {
  const output: NetworkMapRoutePoint[] = [];

  for (const point of points) {
    const previous = output.at(-1);

    if (!previous) {
      output.push(point);
      continue;
    }

    if (previous.x !== point.x && previous.y !== point.y) {
      output.push({
        id: `${previous.id}_${point.id}_elbow`,
        kind: "elbow",
        x: point.x,
        y: previous.y
      });
    }

    const latest = output.at(-1);

    if (!latest || latest.x !== point.x || latest.y !== point.y) {
      output.push(point);
    }
  }

  return output;
}

export function networkRoutePathData(points: NetworkMapRoutePoint[]): string {
  const expanded = expandedNetworkRoutePoints(points);

  if (expanded.length === 0) {
    return "";
  }

  return expanded
    .map((point, index) => {
      const command = index === 0 ? "M" : "L";

      return `${command} ${Number(point.x.toFixed(2))} ${Number(point.y.toFixed(2))}`;
    })
    .join(" ");
}
