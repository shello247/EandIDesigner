import { z } from "zod";
import {
  panelTerminalMappingSchema,
  panelWiringSourcePackageSchema,
  type PanelTerminalMapping,
  type PanelWiringSourcePackage
} from "../../data/schema";
import type {
  PanelConnectivityFinding,
  PanelWiringCommandResult
} from "../../types";
import { buildPackageConnectivityGraph } from "../services/connectivity-graph";
import { buildPanelTerminalCatalog } from "../services/panel-terminal-catalog";
import {
  externalTerminationId,
  sheetConnectionKey,
  sheetPlacementKey,
  terminalSideNodeId
} from "../services/terminal-resolution";

const setContextInputSchema = z.object({
  sheetId: z.string().trim().min(1),
  panelAssetId: z.string().trim().min(1)
});

const removeMappingInputSchema = z.object({
  mappingId: z.string().trim().min(1)
});

function commandError(
  code: string,
  message: string,
  details: Partial<PanelConnectivityFinding> = {}
): PanelWiringCommandResult {
  return {
    mutations: [],
    warnings: [
      {
        id: `command:${code}`,
        severity: "error",
        code,
        message,
        ...details
      }
    ],
    affectedIds: []
  };
}

function isPanelAsset(source: PanelWiringSourcePackage, assetId: string): boolean {
  const asset = source.assets.find((candidate) => candidate.id === assetId);

  return Boolean(
    asset &&
      (["panel", "junction_box"].includes(asset.type) ||
        source.sheets.some((sheet) =>
          sheet.occurrences.some(
            (occurrence) =>
              occurrence.assetId === assetId && occurrence.role === "enclosure"
          )
        ))
  );
}

export function setPanelDrawingContext(
  inputSource: PanelWiringSourcePackage,
  input: { sheetId: string; panelAssetId: string }
): PanelWiringCommandResult {
  const source = panelWiringSourcePackageSchema.parse(inputSource);
  const parsed = setContextInputSchema.parse(input);
  const sheet = source.sheets.find((candidate) => candidate.id === parsed.sheetId);

  if (!sheet) {
    return commandError("missing_sheet", "The target sheet is not available.");
  }

  if (!isPanelAsset(source, parsed.panelAssetId)) {
    return commandError(
      "invalid_panel_asset",
      "The selected asset is not a panel or enclosure.",
      { panelAssetId: parsed.panelAssetId }
    );
  }

  return {
    mutations: [
      {
        kind: "set-panel-context",
        sheetId: parsed.sheetId,
        context: {
          kind: "detailed_panel_wiring",
          panelAssetId: parsed.panelAssetId
        }
      }
    ],
    warnings: [],
    affectedIds: [parsed.sheetId, parsed.panelAssetId]
  };
}

export function clearPanelDrawingContext(
  inputSource: PanelWiringSourcePackage,
  input: { sheetId: string }
): PanelWiringCommandResult {
  const source = panelWiringSourcePackageSchema.parse(inputSource);
  const sheetId = z.string().trim().min(1).parse(input.sheetId);
  const sheet = source.sheets.find((candidate) => candidate.id === sheetId);

  if (!sheet) {
    return commandError("missing_sheet", "The target sheet is not available.");
  }

  if (!sheet.panelDrawingContext) {
    return {
      mutations: [],
      warnings: [],
      affectedIds: []
    };
  }

  return {
    mutations: [{ kind: "clear-panel-context", sheetId }],
    warnings: [],
    affectedIds: [sheetId, sheet.panelDrawingContext.panelAssetId]
  };
}

export function upsertExternalTerminationMapping(
  inputSource: PanelWiringSourcePackage,
  input: PanelTerminalMapping
): PanelWiringCommandResult {
  const source = panelWiringSourcePackageSchema.parse(inputSource);
  const mapping = panelTerminalMappingSchema.parse(input);
  const graph = buildPackageConnectivityGraph(source);
  const connection = graph.connectionsBySheetConnection.get(
    sheetConnectionKey(mapping.source.sheetId, mapping.source.connectionId)
  );

  if (!connection) {
    return commandError(
      "missing_source_connection",
      "The source field connection is not available.",
      { panelAssetId: mapping.panelAssetId, source: mapping.source }
    );
  }

  const endpoint = connection[mapping.source.endpointRole];

  if (
    endpoint.placementId !== mapping.source.placementId ||
    endpoint.anchorKey !== mapping.source.anchorKey ||
    !graph.occurrencesBySheetPlacement.has(
      sheetPlacementKey(mapping.source.sheetId, mapping.source.placementId)
    )
  ) {
    return commandError(
      "stale_source_endpoint",
      "The source endpoint no longer matches the referenced drawing connection.",
      { panelAssetId: mapping.panelAssetId, source: mapping.source }
    );
  }

  if (!graph.terminalSidesById.has(terminalSideNodeId(mapping.target))) {
    return commandError(
      "missing_target_terminal",
      "The target terminal side is not available.",
      {
        panelAssetId: mapping.panelAssetId,
        assetId: mapping.target.assetId,
        terminal: mapping.target
      }
    );
  }

  if (mapping.target.side === "internal") {
    return commandError(
      "invalid_field_terminal_side",
      "Field terminations cannot be mapped to an internal terminal side.",
      {
        panelAssetId: mapping.panelAssetId,
        assetId: mapping.target.assetId,
        terminal: mapping.target,
        source: mapping.source
      }
    );
  }

  if (
    !graph.assetIdsByPanelAssetId
      .get(mapping.panelAssetId)
      ?.has(mapping.target.assetId)
  ) {
    return commandError(
      "target_outside_panel",
      "The target terminal asset is not associated with the selected panel.",
      {
        panelAssetId: mapping.panelAssetId,
        assetId: mapping.target.assetId,
        terminal: mapping.target
      }
    );
  }

  const terminalConflict = graph.findings.find(
    (finding) =>
      finding.assetId === mapping.target.assetId &&
      finding.code === "linked_terminal_configuration_mismatch"
  );

  if (terminalConflict) {
    return commandError(
      "conflicting_target_terminal",
      terminalConflict.message,
      {
        panelAssetId: mapping.panelAssetId,
        assetId: mapping.target.assetId,
        terminal: mapping.target,
        source: mapping.source
      }
    );
  }

  const catalog = buildPanelTerminalCatalog({
    graph,
    panelAssetId: mapping.panelAssetId
  });
  const occupancy = catalog.occupancyBySideId.get(
    terminalSideNodeId(mapping.target)
  );
  const currentTerminationId = externalTerminationId(
    mapping.panelAssetId,
    mapping.source
  );
  const otherOccupants = occupancy?.conductorOccupants.filter(
    (occupant) => occupant.id !== currentTerminationId
  );

  if (otherOccupants && otherOccupants.length > 0) {
    return commandError(
      "terminal_side_occupied",
      `${otherOccupants[0].label} already occupies this terminal side.`,
      {
        panelAssetId: mapping.panelAssetId,
        assetId: mapping.target.assetId,
        terminal: mapping.target,
        source: mapping.source
      }
    );
  }

  return {
    mutations: [
      {
        kind: "upsert-terminal-mapping",
        mapping
      }
    ],
    warnings: [],
    affectedIds: [mapping.id, mapping.panelAssetId, mapping.target.assetId]
  };
}

export function removeExternalTerminationMapping(
  inputSource: PanelWiringSourcePackage,
  input: { mappingId: string }
): PanelWiringCommandResult {
  const source = panelWiringSourcePackageSchema.parse(inputSource);
  const parsed = removeMappingInputSchema.parse(input);
  const mapping = source.panelWiring?.terminalMappings.find(
    (candidate) => candidate.id === parsed.mappingId
  );

  if (!mapping) {
    return commandError(
      "missing_terminal_mapping",
      "The terminal mapping is not available."
    );
  }

  return {
    mutations: [
      {
        kind: "remove-terminal-mapping",
        mappingId: parsed.mappingId
      }
    ],
    warnings: [],
    affectedIds: [parsed.mappingId, mapping.panelAssetId]
  };
}
