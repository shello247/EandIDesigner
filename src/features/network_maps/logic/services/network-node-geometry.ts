import type { ApprovedNetworkSymbol } from "../../types";
import type {
  NetworkMapNode,
  NetworkMapSheetPage
} from "../../data/schema";

export type NetworkPoint = { x: number; y: number };
export type NetworkNodeSize = { width: number; height: number };

export const MISSING_NETWORK_NODE_VIEW_BOX = {
  x: 0,
  y: 0,
  width: 140,
  height: 82
} as const;

function round(value: number, precision = 2): number {
  return Number(value.toFixed(precision));
}

export function normalizeNetworkNodeRotation(rotation: number): number {
  const normalized = rotation % 360;

  return round(normalized < 0 ? normalized + 360 : normalized);
}

export function rotateNetworkPoint(
  point: NetworkPoint,
  center: NetworkPoint,
  rotation: number
): NetworkPoint {
  const radians = (normalizeNetworkNodeRotation(rotation) * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const deltaX = point.x - center.x;
  const deltaY = point.y - center.y;

  return {
    x: round(center.x + deltaX * cosine - deltaY * sine),
    y: round(center.y + deltaX * sine + deltaY * cosine)
  };
}

export function networkNodeViewBox(symbol?: ApprovedNetworkSymbol) {
  return symbol?.metadata.viewBox ?? MISSING_NETWORK_NODE_VIEW_BOX;
}

export function getNetworkNodeSize(
  node: Pick<NetworkMapNode, "scale">,
  symbol?: ApprovedNetworkSymbol
): NetworkNodeSize {
  const viewBox = networkNodeViewBox(symbol);

  return {
    width: round(viewBox.width * node.scale),
    height: round(viewBox.height * node.scale)
  };
}

export function getNetworkNodeBounds(
  node: Pick<NetworkMapNode, "x" | "y" | "scale">,
  symbol?: ApprovedNetworkSymbol
) {
  const size = getNetworkNodeSize(node, symbol);

  return { x: node.x, y: node.y, ...size };
}

export function getNetworkNodeCenter(
  node: Pick<NetworkMapNode, "x" | "y" | "scale">,
  symbol?: ApprovedNetworkSymbol
): NetworkPoint {
  const size = getNetworkNodeSize(node, symbol);

  return {
    x: round(node.x + size.width / 2),
    y: round(node.y + size.height / 2)
  };
}

export function snapNetworkCoordinate(value: number, gridSize: number): number {
  return round(Math.round(value / gridSize) * gridSize);
}

export function constrainNetworkNodeOrigin(input: {
  point: NetworkPoint;
  size: NetworkNodeSize;
  page: NetworkMapSheetPage;
}): NetworkPoint {
  const maxX = Math.max(0, input.page.width - input.size.width);
  const maxY = Math.max(0, input.page.height - input.size.height);
  const snappedX = snapNetworkCoordinate(input.point.x, input.page.gridSize);
  const snappedY = snapNetworkCoordinate(input.point.y, input.page.gridSize);

  return {
    x: round(Math.max(0, Math.min(maxX, snappedX))),
    y: round(Math.max(0, Math.min(maxY, snappedY)))
  };
}

export function networkNodeOriginFromCenter(input: {
  center: NetworkPoint;
  size: NetworkNodeSize;
  page: NetworkMapSheetPage;
}): NetworkPoint {
  return constrainNetworkNodeOrigin({
    point: {
      x: input.center.x - input.size.width / 2,
      y: input.center.y - input.size.height / 2
    },
    size: input.size,
    page: input.page
  });
}

export function clientPointToNetworkSheetPoint(input: {
  clientX: number;
  clientY: number;
  bounds: { left: number; top: number; width: number; height: number };
  page: Pick<NetworkMapSheetPage, "width" | "height">;
}): NetworkPoint {
  return {
    x: round(
      ((input.clientX - input.bounds.left) / input.bounds.width) *
        input.page.width
    ),
    y: round(
      ((input.clientY - input.bounds.top) / input.bounds.height) *
        input.page.height
    )
  };
}
