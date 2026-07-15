import type { DrawingConnection } from "@/features/drawing_canvas/api/asset-contracts";
import type { BomQuantityRule, BomQuantityStatus } from "../../data/schema";

export type BomQuantityContext = {
  connectionCount?: number;
  assetPlacementIds?: string[];
  connections?: DrawingConnection[];
};

export type BomQuantityResult = {
  quantity?: number;
  status: BomQuantityStatus;
};

function connectionTouchesPlacement(
  connection: DrawingConnection,
  placementIds: Set<string>
): boolean {
  return (
    placementIds.has(connection.from.placementId) ||
    placementIds.has(connection.to.placementId) ||
    Boolean(connection.cablePlacementId && placementIds.has(connection.cablePlacementId))
  );
}

function countAssetConnections(context: BomQuantityContext): number {
  if (context.connectionCount !== undefined) {
    return context.connectionCount;
  }

  const placementIds = new Set(context.assetPlacementIds ?? []);

  if (placementIds.size === 0) {
    return 0;
  }

  const connectionIds = new Set<string>();

  for (const connection of context.connections ?? []) {
    if (connectionTouchesPlacement(connection, placementIds)) {
      connectionIds.add(connection.id);
    }
  }

  return connectionIds.size;
}

export function calculateBomQuantity(
  quantityRule: BomQuantityRule,
  baseQuantity: number,
  context: BomQuantityContext
): BomQuantityResult {
  if (quantityRule === "manual") {
    return { status: "manual_required" };
  }

  if (quantityRule === "fixed_per_assembly") {
    return { quantity: baseQuantity, status: "calculated" };
  }

  if (quantityRule === "per_cable_end") {
    return { quantity: baseQuantity * 2, status: "calculated" };
  }

  if (
    quantityRule === "per_conductor_termination" ||
    quantityRule === "per_connection"
  ) {
    return {
      quantity: baseQuantity * countAssetConnections(context),
      status: "calculated"
    };
  }

  return { status: "unavailable" };
}
