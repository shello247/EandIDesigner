import type { SymbolAnchor, SymbolMetadata } from "@/features/symbol_registry/data/schema";
import type { DrawingPlacement } from "../../data/schema";

export type WorldPoint = {
  x: number;
  y: number;
};

export type PlacementBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type RotatedPlacementBounds = PlacementBounds & {
  right: number;
  bottom: number;
  centerX: number;
  centerY: number;
};

function round(value: number): number {
  const rounded = Number(value.toFixed(2));
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function getPlacementScaleFactors(
  placement: DrawingPlacement,
  metadata: SymbolMetadata
): { x: number; y: number } {
  const length = placement.layoutDimensions?.lengthMm;
  const width = placement.layoutDimensions?.widthMm;

  if (length && width) {
    return {
      x: length / metadata.viewBox.width,
      y: width / metadata.viewBox.height
    };
  }

  return {
    x: placement.scale,
    y: placement.scale
  };
}

export function getPlacementTransform(
  placement: DrawingPlacement,
  metadata: SymbolMetadata
): string {
  const scale = getPlacementScaleFactors(placement, metadata);
  const centerX = (metadata.viewBox.width * scale.x) / 2;
  const centerY = (metadata.viewBox.height * scale.y) / 2;

  return [
    `translate(${placement.x} ${placement.y})`,
    `translate(${centerX} ${centerY})`,
    `rotate(${placement.rotation})`,
    `translate(${-centerX} ${-centerY})`,
    `scale(${scale.x} ${scale.y})`,
    `translate(${-metadata.viewBox.x} ${-metadata.viewBox.y})`
  ].join(" ");
}

export function getAnchorWorldPoint(
  placement: DrawingPlacement,
  metadata: SymbolMetadata,
  anchor: SymbolAnchor
): WorldPoint {
  const scale = getPlacementScaleFactors(placement, metadata);
  const localX = (anchor.x - metadata.viewBox.x) * scale.x;
  const localY = (anchor.y - metadata.viewBox.y) * scale.y;
  const centerX = (metadata.viewBox.width * scale.x) / 2;
  const centerY = (metadata.viewBox.height * scale.y) / 2;
  const radians = (placement.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = localX - centerX;
  const dy = localY - centerY;

  return {
    x: Number((placement.x + centerX + dx * cos - dy * sin).toFixed(2)),
    y: Number((placement.y + centerY + dx * sin + dy * cos).toFixed(2))
  };
}

export function getPlacementBounds(
  placement: DrawingPlacement,
  metadata: SymbolMetadata
): PlacementBounds {
  return {
    x: placement.x,
    y: placement.y,
    width: metadata.viewBox.width * getPlacementScaleFactors(placement, metadata).x,
    height: metadata.viewBox.height * getPlacementScaleFactors(placement, metadata).y
  };
}

export function getRotatedPlacementBounds(
  placement: DrawingPlacement,
  metadata: SymbolMetadata
): RotatedPlacementBounds {
  const bounds = getPlacementBounds(placement, metadata);
  const radians = (placement.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  const corners = [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { x: bounds.x, y: bounds.y + bounds.height }
  ].map((corner) => {
    const dx = corner.x - centerX;
    const dy = corner.y - centerY;

    return {
      x: centerX + dx * cos - dy * sin,
      y: centerY + dx * sin + dy * cos
    };
  });
  const left = Math.min(...corners.map((corner) => corner.x));
  const top = Math.min(...corners.map((corner) => corner.y));
  const right = Math.max(...corners.map((corner) => corner.x));
  const bottom = Math.max(...corners.map((corner) => corner.y));

  return {
    x: round(left),
    y: round(top),
    width: round(right - left),
    height: round(bottom - top),
    right: round(right),
    bottom: round(bottom),
    centerX: round((left + right) / 2),
    centerY: round((top + bottom) / 2)
  };
}
