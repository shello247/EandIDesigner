import type {
  PanelTerminalMapping,
  PanelTerminalSideRef,
  PanelWiringSourceOccurrence,
  PanelWiringSourcePackage
} from "../../data/schema";
import type {
  PanelConnectivityFinding,
  PanelExternalTermination,
  PanelTerminalNode
} from "../../types";
import {
  externalTerminationId,
  resolveOccurrenceTerminalByAnchor,
  sheetPlacementKey,
  sourceEndpointKey,
  terminalNodeId,
  terminalSideNodeId
} from "./terminal-resolution";

export type ExternalTerminationDiscoveryInput = {
  source: PanelWiringSourcePackage;
  occurrencesBySheetPlacement: ReadonlyMap<
    string,
    PanelWiringSourceOccurrence
  >;
  panelAssetIdsByAssetId: ReadonlyMap<string, ReadonlySet<string>>;
  terminalsById: ReadonlyMap<string, PanelTerminalNode>;
  terminalSideIds: ReadonlySet<string>;
};

export type ExternalTerminationDiscoveryResult = {
  terminations: PanelExternalTermination[];
  findings: PanelConnectivityFinding[];
};

function mappingKey(mapping: PanelTerminalMapping): string {
  return `${mapping.panelAssetId}:${sourceEndpointKey(mapping.source)}`;
}

function panelsForOccurrence(
  occurrence: PanelWiringSourceOccurrence | undefined,
  panelAssetIdsByAssetId: ReadonlyMap<string, ReadonlySet<string>>
): ReadonlySet<string> {
  return occurrence?.assetId
    ? panelAssetIdsByAssetId.get(occurrence.assetId) ?? new Set<string>()
    : new Set<string>();
}

function defaultTerminalTarget(
  occurrence: PanelWiringSourceOccurrence,
  anchorKey: string,
  terminalsById: ReadonlyMap<string, PanelTerminalNode>
): PanelTerminalSideRef | undefined {
  if (!occurrence.assetId) {
    return undefined;
  }

  const terminal = resolveOccurrenceTerminalByAnchor(occurrence, anchorKey);

  if (!terminal) {
    return undefined;
  }

  const node = terminalsById.get(
    terminalNodeId({
      assetId: occurrence.assetId,
      terminalKey: terminal.terminalKey
    })
  );

  if (!node) {
    return undefined;
  }

  const side = node.supportedSides.includes("external")
    ? "external"
    : node.supportedSides.includes("single")
      ? "single"
      : undefined;

  return side
    ? {
        assetId: occurrence.assetId,
        terminalKey: terminal.terminalKey,
        side
      }
    : undefined;
}

export function discoverExternalTerminations({
  source,
  occurrencesBySheetPlacement,
  panelAssetIdsByAssetId,
  terminalsById,
  terminalSideIds
}: ExternalTerminationDiscoveryInput): ExternalTerminationDiscoveryResult {
  const findings: PanelConnectivityFinding[] = [];
  const terminations: PanelExternalTermination[] = [];
  const mappings = new Map(
    (source.panelWiring?.terminalMappings ?? []).map((mapping) => [
      mappingKey(mapping),
      mapping
    ])
  );
  const legacyInternalFindingIds = new Set<string>();

  for (const sheet of source.sheets) {
    for (const connection of sheet.connections) {
      if (connection.panelConnectionId) {
        continue;
      }

      const endpointPairs = [
        {
          endpointRole: "from" as const,
          endpoint: connection.from,
          opposite: connection.to
        },
        {
          endpointRole: "to" as const,
          endpoint: connection.to,
          opposite: connection.from
        }
      ];

      for (const pair of endpointPairs) {
        const occurrence = occurrencesBySheetPlacement.get(
          sheetPlacementKey(sheet.id, pair.endpoint.placementId)
        );
        const oppositeOccurrence = occurrencesBySheetPlacement.get(
          sheetPlacementKey(sheet.id, pair.opposite.placementId)
        );
        const endpointPanels = panelsForOccurrence(
          occurrence,
          panelAssetIdsByAssetId
        );
        const oppositePanels = panelsForOccurrence(
          oppositeOccurrence,
          panelAssetIdsByAssetId
        );

        if (!occurrence?.assetId || endpointPanels.size === 0) {
          continue;
        }

        for (const panelAssetId of endpointPanels) {
          if (oppositePanels.has(panelAssetId)) {
            const findingId = `legacy_internal:${panelAssetId}:${sheet.id}:${connection.id}`;

            if (!legacyInternalFindingIds.has(findingId)) {
              legacyInternalFindingIds.add(findingId);
              findings.push({
                id: findingId,
                severity: "warning",
                code: "legacy_internal_connection",
                message:
                  "An existing drawing connection joins two assets in the same panel and was not converted to a canonical internal wire.",
                panelAssetId
              });
            }
            continue;
          }

          const sourceRef = {
            sheetId: sheet.id,
            connectionId: connection.id,
            endpointRole: pair.endpointRole,
            placementId: pair.endpoint.placementId,
            anchorKey: pair.endpoint.anchorKey
          };
          const override = mappings.get(
            `${panelAssetId}:${sourceEndpointKey(sourceRef)}`
          );
          const target =
            override?.target ??
            defaultTerminalTarget(
              occurrence,
              pair.endpoint.anchorKey,
              terminalsById
            );
          const targetIsValid = target
            ? terminalSideIds.has(terminalSideNodeId(target))
            : false;
          const id = externalTerminationId(panelAssetId, sourceRef);
          const unresolvedReason = !target
            ? `Anchor ${pair.endpoint.anchorKey} could not be resolved to a logical terminal side.`
            : !targetIsValid
              ? "The mapped terminal side is not available in the package connectivity graph."
              : undefined;
          const unresolvedCode = !target
            ? ("unresolved_anchor" as const)
            : !targetIsValid
              ? ("missing_terminal_side" as const)
              : undefined;

          terminations.push({
            id,
            panelAssetId,
            status: targetIsValid ? "resolved" : "unresolved",
            target: targetIsValid ? target : undefined,
            source: sourceRef,
            sourceSheet: {
              id: sheet.id,
              number: sheet.sheetNumber,
              name: sheet.name
            },
            wireId: connection.wireId,
            cableAssetId: connection.cableAssetId,
            cablePlacementId: connection.cablePlacementId,
            cableTag: connection.cableTag,
            conductorKey: connection.conductorKey,
            unresolvedCode,
            unresolvedReason
          });

          if (unresolvedReason) {
            findings.push({
              id: `finding:${id}`,
              severity: "warning",
              code: "unresolved_external_termination",
              message: unresolvedReason,
              panelAssetId,
              assetId: occurrence.assetId,
              source: sourceRef
            });
          }
        }
      }
    }
  }

  return {
    terminations: terminations.sort((first, second) =>
      first.id.localeCompare(second.id)
    ),
    findings: findings.sort((first, second) => first.id.localeCompare(second.id))
  };
}
