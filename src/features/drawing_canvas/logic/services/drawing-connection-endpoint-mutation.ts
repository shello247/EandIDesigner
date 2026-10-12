import type { DrawingConnection, DrawingEndpoint } from "../../data/schema";
import {
  connectionEndpointSourceKey,
  type ConnectionEndpointAvailability,
  type PackageTerminalOccupancyIndex
} from "@/features/drawing_panel_wiring/api/public";
import { resolveConnectionEndpointAvailability } from "@/features/drawing_panel_wiring/api/public";

export type ConnectionEndpointMutationResult =
  | {
      ok: true;
      availability: ConnectionEndpointAvailability;
    }
  | {
      ok: false;
      error: string;
      availability: ConnectionEndpointAvailability;
    };

export function validateConnectionEndpointMutation(input: {
  index: PackageTerminalOccupancyIndex;
  sheetId: string;
  connection: DrawingConnection;
  endpointRole: "from" | "to";
  candidate: DrawingEndpoint;
}): ConnectionEndpointMutationResult {
  const current = input.connection[input.endpointRole];
  if (
    current.placementId === input.candidate.placementId &&
    current.anchorKey === input.candidate.anchorKey
  ) {
    return {
      ok: true,
      availability: {
        status: "available",
        enabled: true,
        occupants: []
      }
    };
  }

  const availability = resolveConnectionEndpointAvailability({
    index: input.index,
    sheetId: input.sheetId,
    placementId: input.candidate.placementId,
    anchorKey: input.candidate.anchorKey,
    excludeSourceKey: connectionEndpointSourceKey({
      sheetId: input.sheetId,
      connectionId: input.connection.id,
      endpointRole: input.endpointRole,
      placementId: current.placementId,
      anchorKey: current.anchorKey
    })
  });
  return availability.enabled
    ? { ok: true, availability }
    : {
        ok: false,
        error:
          availability.reason ??
          "This terminal end is not available for another conductor.",
        availability
      };
}
