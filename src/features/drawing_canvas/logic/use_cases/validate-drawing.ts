import type { ApprovedDrawingSymbol } from "../../types";
import {
  drawingModelSchema,
  type DrawingModel,
  type DrawingValidationIssue
} from "../../data/schema";
import {
  areSameEndpoint,
  connectionPairKey,
  endpointKey,
  getUnconnectedRequiredTerminals
} from "../services/drawing-connections";
import { validateConnectionRoutes } from "../services/connection-route-validator";
import {
  getConnectionCableId,
  isRecommendedCableId,
  isRecommendedDeviceTag,
  isRecommendedTerminalBlockId
} from "../services/drawing-identification";

function packageKey(symbolId: string, versionId: string): string {
  return `${symbolId}:${versionId}`;
}

export function validateDrawing(
  modelInput: unknown,
  approvedSymbols: ApprovedDrawingSymbol[]
): {
  model?: DrawingModel;
  issues: DrawingValidationIssue[];
  blockingIssueCount: number;
} {
  const issues: DrawingValidationIssue[] = [];
  const parseResult = drawingModelSchema.safeParse(modelInput);

  if (!parseResult.success) {
    for (const issue of parseResult.error.issues) {
      issues.push({
        severity: "blocking",
        code: "DRAWING_MODEL_INVALID",
        message: issue.message,
        path: issue.path.length > 0 ? `model.${issue.path.join(".")}` : "model"
      });
    }

    return {
      issues,
      blockingIssueCount: issues.length
    };
  }

  const model = parseResult.data;
  const symbolByPlacementKey = new Map(
    approvedSymbols.map((symbol) => [
      packageKey(symbol.symbolId, symbol.versionId),
      symbol
    ])
  );
  const placementsById = new Map(
    model.placements.map((placement) => [placement.id, placement])
  );
  const symbolsByPlacementId = new Map<string, ApprovedDrawingSymbol>();
  const tagCounts = new Map<string, number>();
  const connectionPairCounts = new Map<string, number>();
  const wireIdCableIds = new Map<string, Set<string>>();

  for (const [index, placement] of model.placements.entries()) {
    const tagKey = placement.tag.trim().toLowerCase();
    tagCounts.set(tagKey, (tagCounts.get(tagKey) ?? 0) + 1);

    if (placement.role === "device" && !isRecommendedDeviceTag(placement.tag)) {
      issues.push({
        severity: "warning",
        code: "PLACEMENT_DEVICE_TAG_FORMAT",
        message: `Device tag "${placement.tag}" should use an ISA-style plant tag such as LIT-101 or TT-101.`,
        path: `placements.${index}.tag`
      });
    }

    if (
      placement.role === "cable_assembly" &&
      !isRecommendedCableId(placement.tag)
    ) {
      issues.push({
        severity: "warning",
        code: "PLACEMENT_CABLE_ID_FORMAT",
        message: `Cable ID "${placement.tag}" should use the project cable ID format such as C-101.`,
        path: `placements.${index}.tag`
      });
    }

    if (
      placement.role === "terminal_block" &&
      !isRecommendedTerminalBlockId(placement.tag)
    ) {
      issues.push({
        severity: "warning",
        code: "PLACEMENT_TERMINAL_BLOCK_ID_FORMAT",
        message: `Terminal block ID "${placement.tag}" should use a format such as TB-101.`,
        path: `placements.${index}.tag`
      });
    }

    const symbol = symbolByPlacementKey.get(
      packageKey(placement.symbolId, placement.versionId)
    );

    if (!symbol) {
      issues.push({
        severity: "blocking",
        code: "PLACEMENT_SYMBOL_NOT_APPROVED",
        message: `Placement "${placement.tag}" references a missing or unapproved symbol version.`,
        path: `placements.${index}`
      });
      continue;
    }

    symbolsByPlacementId.set(placement.id, symbol);
  }

  for (const [tag, count] of tagCounts.entries()) {
    if (count > 1) {
      issues.push({
        severity: "blocking",
        code: "PLACEMENT_TAG_DUPLICATE",
        message: `Placement tag "${tag}" is duplicated.`,
        path: "placements"
      });
    }
  }

  for (const [index, connection] of model.connections.entries()) {
    if (areSameEndpoint(connection.from, connection.to)) {
      issues.push({
        severity: "blocking",
        code: "CONNECTION_ENDPOINT_SAME",
        message: `Connection "${connection.id}" uses the same source and destination anchor.`,
        path: `connections.${index}`
      });
    }

    const pairKey = connectionPairKey(connection);
    connectionPairCounts.set(pairKey, (connectionPairCounts.get(pairKey) ?? 0) + 1);

    for (const endpointName of ["from", "to"] as const) {
      const endpoint = connection[endpointName];
      const placement = placementsById.get(endpoint.placementId);

      if (!placement) {
        issues.push({
          severity: "blocking",
          code: "CONNECTION_PLACEMENT_MISSING",
          message: `Connection "${connection.id}" references missing placement "${endpoint.placementId}".`,
          path: `connections.${index}.${endpointName}.placementId`
        });
        continue;
      }

      const symbol = symbolsByPlacementId.get(endpoint.placementId);
      const anchor = symbol?.metadata.anchors.find(
        (candidate) => candidate.key === endpoint.anchorKey
      );

      if (!anchor) {
        issues.push({
          severity: "blocking",
          code: "CONNECTION_ANCHOR_MISSING",
          message: `Connection "${connection.id}" references missing anchor "${endpoint.anchorKey}".`,
          path: `connections.${index}.${endpointName}.anchorKey`
        });
      }
    }

    if (connection.cablePlacementId) {
      const cablePlacement = placementsById.get(connection.cablePlacementId);
      if (!cablePlacement) {
        issues.push({
          severity: "blocking",
          code: "CONNECTION_CABLE_PLACEMENT_MISSING",
          message: `Connection "${connection.id}" references missing cable placement "${connection.cablePlacementId}".`,
          path: `connections.${index}.cablePlacementId`
        });
      } else if (cablePlacement.role !== "cable_assembly") {
        issues.push({
          severity: "warning",
          code: "CONNECTION_CABLE_PLACEMENT_ROLE",
          message: `Connection "${connection.id}" references a placement that is not marked as a cable assembly.`,
          path: `connections.${index}.cablePlacementId`
        });
      } else if (!connection.conductorKey) {
        issues.push({
          severity: "warning",
          code: "CONNECTION_CONDUCTOR_KEY_UNSET",
          message: `Connection "${connection.id}" does not identify a cable conductor.`,
          path: `connections.${index}.conductorKey`
        });
      }
    } else {
      issues.push({
        severity: "warning",
        code: "CONNECTION_CABLE_PLACEMENT_UNSET",
        message: `Connection "${connection.id}" is not associated with a cable assembly placement.`,
        path: `connections.${index}.cablePlacementId`
      });
    }

    if (!connection.wireId?.trim()) {
      issues.push({
        severity: "warning",
        code: "CONNECTION_WIRE_ID_UNSET",
        message: `Connection "${connection.id}" does not identify a wire ID.`,
        path: `connections.${index}.wireId`
      });
    } else {
      const cableId = getConnectionCableId(model, connection);

      if (cableId) {
        const normalizedWireId = connection.wireId.trim().toUpperCase();
        const currentCableIds = wireIdCableIds.get(normalizedWireId) ?? new Set();
        currentCableIds.add(cableId.trim().toUpperCase());
        wireIdCableIds.set(normalizedWireId, currentCableIds);
      }
    }
  }

  for (const [pairKey, count] of connectionPairCounts.entries()) {
    if (count <= 1) {
      continue;
    }

    issues.push({
      severity: "warning",
      code: "CONNECTION_DUPLICATE_PAIR",
      message: `Connection pair "${pairKey}" is duplicated.`,
      path: "connections"
    });
  }

  for (const [wireId, cableIds] of wireIdCableIds.entries()) {
    if (cableIds.size <= 1) {
      continue;
    }

    issues.push({
      severity: "warning",
      code: "CONNECTION_WIRE_ID_CABLE_CONFLICT",
      message: `Wire ID "${wireId}" is used across multiple cable IDs: ${[
        ...cableIds
      ].join(", ")}.`,
      path: "connections"
    });
  }

  const connectedEndpointKeys = new Set(
    model.connections.flatMap((connection) => [
      endpointKey(connection.from),
      endpointKey(connection.to)
    ])
  );
  const blockedRequiredTerminals = getUnconnectedRequiredTerminals(
    model,
    approvedSymbols
  ).filter(
    ({ placement, terminal }) =>
      !connectedEndpointKeys.has(
        endpointKey({
          placementId: placement.id,
          anchorKey: terminal.anchorKey
        })
      )
  );

  for (const item of blockedRequiredTerminals) {
    issues.push({
      severity: "blocking",
      code: "REQUIRED_TERMINAL_UNCONNECTED",
      message: `Required terminal "${item.terminal.key}" on "${item.placement.tag}" is not connected.`,
      path: `placements.${item.placement.id}.terminals.${item.terminal.key}`
    });
  }

  issues.push(...validateConnectionRoutes(model, approvedSymbols));

  return {
    model,
    issues,
    blockingIssueCount: issues.filter((issue) => issue.severity === "blocking")
      .length
  };
}
