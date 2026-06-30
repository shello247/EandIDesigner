import type { DrawingConnection, DrawingModel } from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import {
  getConnectionWireId,
  getPlacementIdentifier,
  getReadableConnectionName
} from "./drawing-identification";

export type DrawingConnectionTransitionGroup = {
  id: string;
  title: string;
  connectionCount: number;
  fromPlacementId: string;
  toPlacementId: string;
  connections: DrawingConnection[];
};

function transitionPairKey(connection: DrawingConnection): string {
  return [connection.from.placementId, connection.to.placementId].sort().join("::");
}

export function getConnectionTransitionGroups(
  model: DrawingModel,
  symbols: ApprovedDrawingSymbol[]
): DrawingConnectionTransitionGroup[] {
  const groups = new Map<string, DrawingConnectionTransitionGroup>();

  for (const connection of model.connections) {
    const key = transitionPairKey(connection);
    const existingGroup = groups.get(key);

    if (existingGroup) {
      existingGroup.connections.push(connection);
      existingGroup.connectionCount += 1;
      continue;
    }

    const fromTag = getPlacementIdentifier(model, connection.from.placementId);
    const toTag = getPlacementIdentifier(model, connection.to.placementId);

    groups.set(key, {
      id: key,
      title: `${fromTag} ↔ ${toTag}`,
      connectionCount: 1,
      fromPlacementId: connection.from.placementId,
      toPlacementId: connection.to.placementId,
      connections: [connection]
    });
  }

  return [...groups.values()].map((group) => ({
    ...group,
    connections: [...group.connections].sort((first, second) => {
      const firstName =
        getConnectionWireId(model, symbols, first) ??
        getReadableConnectionName(model, symbols, first);
      const secondName =
        getConnectionWireId(model, symbols, second) ??
        getReadableConnectionName(model, symbols, second);

      return firstName.localeCompare(secondName, undefined, {
        numeric: true,
        sensitivity: "base"
      });
    })
  }));
}
