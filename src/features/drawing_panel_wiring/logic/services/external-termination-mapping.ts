import type { PanelTerminalSideRef } from "../../data/schema";
import type {
  ExternalTerminationCatalogRow,
  ExternalTerminationMappingRow,
  PanelConnectivityFinding,
  PanelConnectivityGraph,
  PanelTerminalCatalog,
  PanelTerminalMappingCandidate
} from "../../types";
import { terminalSideNodeId } from "./terminal-resolution";

function sameTerminalSide(
  first: PanelTerminalSideRef | undefined,
  second: PanelTerminalSideRef | undefined
): boolean {
  return Boolean(
    first &&
      second &&
      first.assetId === second.assetId &&
      first.terminalKey === second.terminalKey &&
      first.side === second.side
  );
}

function findingMatchesTermination(
  finding: PanelConnectivityFinding,
  row: ExternalTerminationCatalogRow
): boolean {
  return (
    (finding.source?.sheetId === row.source.sheetId &&
      finding.source.connectionId === row.source.connectionId &&
      finding.source.endpointRole === row.source.endpointRole &&
      finding.source.placementId === row.source.placementId &&
      finding.source.anchorKey === row.source.anchorKey) ||
    (Boolean(row.target) &&
      finding.terminal?.assetId === row.target?.assetId &&
      finding.terminal?.terminalKey === row.target?.terminalKey &&
      finding.terminal?.side === row.target?.side)
  );
}

export function buildExternalTerminationMappingRows({
  graph,
  panelAssetId,
  terminations,
  terminalCatalog
}: {
  graph: PanelConnectivityGraph;
  panelAssetId: string;
  terminations: ExternalTerminationCatalogRow[];
  terminalCatalog: PanelTerminalCatalog;
}): ExternalTerminationMappingRow[] {
  return terminations
    .map((termination) => {
      const findings = [...graph.findings, ...terminalCatalog.findings].filter(
        (finding) => findingMatchesTermination(finding, termination)
      );
      const occupancy = termination.target
        ? terminalCatalog.occupancyBySideId.get(
            terminalSideNodeId(termination.target)
          )
        : undefined;
      const mappingConflict = findings.some(
        (finding) => finding.severity === "error"
      ) || occupancy?.status === "conflicting";

      return {
        ...termination,
        mappingMode: mappingConflict
          ? ("conflicting" as const)
          : termination.mappingMode,
        effectiveTarget: termination.target,
        mappingDisabledReason:
          termination.panelAssetId !== panelAssetId
            ? "This field termination belongs to another panel."
            : undefined,
        findings
      };
    })
    .sort((first, second) =>
      `${first.sourceSheet.number}:${first.wireId ?? ""}:${first.terminationId}`.localeCompare(
        `${second.sourceSheet.number}:${second.wireId ?? ""}:${second.terminationId}`,
        undefined,
        { numeric: true, sensitivity: "base" }
      )
    );
}

export function buildExternalTerminationMappingCandidates({
  graph,
  terminalCatalog,
  panelAssetId,
  terminationId
}: {
  graph: PanelConnectivityGraph;
  terminalCatalog: PanelTerminalCatalog;
  panelAssetId: string;
  terminationId: string;
}): PanelTerminalMappingCandidate[] {
  const termination = graph.externalTerminationsById.get(terminationId);

  if (!termination || termination.panelAssetId !== panelAssetId) {
    return [];
  }

  return [...terminalCatalog.rowsByTerminalId.values()]
    .flatMap((row) =>
      row.supportedSides.map((side): PanelTerminalMappingCandidate => {
        const ref = { ...row.terminal, side };
        const occupancy = terminalCatalog.occupancyBySideId.get(
          terminalSideNodeId(ref)
        ) ?? {
          ref,
          status: "available" as const,
          occupants: [],
          conductorStatus: "available" as const,
          conductorOccupants: [],
          structuralStatus: "available" as const,
          structuralOccupants: []
        };
        const otherOccupants = occupancy.conductorOccupants.filter(
          (occupant) => occupant.id !== terminationId
        );
        const terminalConflict = row.findings.find(
          (finding) => finding.severity === "error" || finding.code === "linked_terminal_configuration_mismatch"
        );
        const disabledReason =
          side === "internal"
            ? "Field terminations cannot use the internal side."
            : terminalConflict
              ? terminalConflict.message
              : otherOccupants.length > 0
                ? `${otherOccupants[0].label} already occupies this terminal side.`
                : undefined;

        return {
          ref,
          assetTag: row.assetTag,
          assetTitle: row.assetTitle,
          terminalLabel: row.label,
          function: row.function,
          occupancy,
          disabledReason
        };
      })
    )
    .sort(
      (first, second) =>
        first.assetTag.localeCompare(second.assetTag, undefined, {
          numeric: true,
          sensitivity: "base"
        }) ||
        first.terminalLabel.localeCompare(second.terminalLabel, undefined, {
          numeric: true,
          sensitivity: "base"
        }) ||
        first.ref.side.localeCompare(second.ref.side)
    );
}

export function isEffectiveAutomaticTarget(
  row: ExternalTerminationMappingRow,
  target: PanelTerminalSideRef
): boolean {
  return sameTerminalSide(row.inferredTarget, target);
}
