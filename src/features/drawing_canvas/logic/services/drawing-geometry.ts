import type { SymbolAnchor, SymbolMetadata } from "@/features/symbol_registry/data/schema";
import type { DrawingPlacement } from "../../data/schema";

export type WorldPoint = {
  x: number;
  y: number;
};

export function getPlacementTransform(
  placement: DrawingPlacement,
  metadata: SymbolMetadata
): string {
  return [
    `translate(${placement.x} ${placement.y})`,
    `rotate(${placement.rotation})`,
    `scale(${placement.scale})`,
    `translate(${-metadata.viewBox.x} ${-metadata.viewBox.y})`
  ].join(" ");
}

export function getAnchorWorldPoint(
  placement: DrawingPlacement,
  metadata: SymbolMetadata,
  anchor: SymbolAnchor
): WorldPoint {
  const localX = (anchor.x - metadata.viewBox.x) * placement.scale;
  const localY = (anchor.y - metadata.viewBox.y) * placement.scale;
  const radians = (placement.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  return {
    x: Number((placement.x + localX * cos - localY * sin).toFixed(2)),
    y: Number((placement.y + localX * sin + localY * cos).toFixed(2))
  };
}

export function getPlacementBounds(
  placement: DrawingPlacement,
  metadata: SymbolMetadata
) {
  return {
    x: placement.x,
    y: placement.y,
    width: metadata.viewBox.width * placement.scale,
    height: metadata.viewBox.height * placement.scale
  };
}

