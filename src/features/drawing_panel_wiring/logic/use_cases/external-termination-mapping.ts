import { z } from "zod";
import {
  panelTerminalSideRefSchema,
  panelWiringSourcePackageSchema,
  type PanelRecordOrigin,
  type PanelTerminalSideRef,
  type PanelWiringSourcePackage
} from "../../data/schema";
import type {
  PanelConnectivityFinding,
  PanelWiringCommandResult
} from "../../types";
import { buildPackageConnectivityGraph } from "../services/connectivity-graph";
import { buildExternalTerminationMappingCandidates } from "../services/external-termination-mapping";
import { buildPanelTerminalCatalog } from "../services/panel-terminal-catalog";
import { sourceEndpointKey } from "../services/terminal-resolution";
import {
  removeExternalTerminationMapping,
  upsertExternalTerminationMapping
} from "./update-panel-wiring-context";

const mappingInputSchema = z.object({
  panelAssetId: z.string().trim().min(1),
  terminationId: z.string().trim().min(1),
  target: panelTerminalSideRefSchema,
  origin: z.enum(["engineer", "agent", "imported"]).default("engineer")
});

const resetInputSchema = z.object({
  panelAssetId: z.string().trim().min(1),
  terminationId: z.string().trim().min(1)
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

function deterministicMappingId(
  panelAssetId: string,
  sourceKey: string
): string {
  return `terminal-mapping:${encodeURIComponent(panelAssetId)}:${sourceKey}`;
}

function currentMappingId(
  source: PanelWiringSourcePackage,
  panelAssetId: string,
  terminationSourceKey: string,
  preferredId?: string
): string | undefined {
  if (preferredId) {
    return preferredId;
  }

  return source.panelWiring?.terminalMappings.find(
    (mapping) =>
      mapping.panelAssetId === panelAssetId &&
      sourceEndpointKey(mapping.source) === terminationSourceKey
  )?.id;
}

export function mapExternalTerminationToTerminal(
  inputSource: PanelWiringSourcePackage,
  input: {
    panelAssetId: string;
    terminationId: string;
    target: PanelTerminalSideRef;
    origin?: PanelRecordOrigin;
  }
): PanelWiringCommandResult {
  const source = panelWiringSourcePackageSchema.parse(inputSource);
  const parsed = mappingInputSchema.parse(input);
  const graph = buildPackageConnectivityGraph(source);
  const termination = graph.externalTerminationsById.get(parsed.terminationId);

  if (!termination || termination.panelAssetId !== parsed.panelAssetId) {
    return commandError(
      "missing_external_termination",
      "The external field termination is not available for this panel.",
      { panelAssetId: parsed.panelAssetId }
    );
  }

  if (parsed.target.side === "internal") {
    return commandError(
      "invalid_field_terminal_side",
      "Field terminations cannot be mapped to an internal terminal side.",
      {
        panelAssetId: parsed.panelAssetId,
        assetId: parsed.target.assetId,
        terminal: parsed.target,
        source: termination.source
      }
    );
  }

  const terminalCatalog = buildPanelTerminalCatalog({
    graph,
    panelAssetId: parsed.panelAssetId
  });
  const candidate = buildExternalTerminationMappingCandidates({
    graph,
    terminalCatalog,
    panelAssetId: parsed.panelAssetId,
    terminationId: termination.id
  }).find((item) => sameTerminalSide(item.ref, parsed.target));

  if (!candidate) {
    return commandError(
      graph.assetIdsByPanelAssetId
        .get(parsed.panelAssetId)
        ?.has(parsed.target.assetId)
        ? "missing_target_terminal"
        : "target_outside_panel",
      graph.assetIdsByPanelAssetId
        .get(parsed.panelAssetId)
        ?.has(parsed.target.assetId)
        ? "The target terminal side is not available."
        : "The target terminal asset is not associated with this panel.",
      {
        panelAssetId: parsed.panelAssetId,
        assetId: parsed.target.assetId,
        terminal: parsed.target,
        source: termination.source
      }
    );
  }

  if (candidate.disabledReason) {
    return commandError(
      candidate.occupancy.conductorStatus === "available"
        ? "invalid_target_terminal"
        : "terminal_side_occupied",
      candidate.disabledReason,
      {
        panelAssetId: parsed.panelAssetId,
        assetId: parsed.target.assetId,
        terminal: parsed.target,
        source: termination.source
      }
    );
  }

  const terminationSourceKey = sourceEndpointKey(termination.source);
  const mappingId = currentMappingId(
    source,
    parsed.panelAssetId,
    terminationSourceKey,
    termination.mappingId
  );

  if (sameTerminalSide(termination.inferredTarget, parsed.target)) {
    return mappingId
      ? removeExternalTerminationMapping(source, { mappingId })
      : { mutations: [], warnings: [], affectedIds: [] };
  }

  return upsertExternalTerminationMapping(source, {
    id:
      mappingId ??
      deterministicMappingId(parsed.panelAssetId, terminationSourceKey),
    panelAssetId: parsed.panelAssetId,
    source: termination.source,
    target: parsed.target,
    origin: parsed.origin
  });
}

export const updateExternalTerminationMapping =
  mapExternalTerminationToTerminal;

export function resetExternalTerminationMapping(
  inputSource: PanelWiringSourcePackage,
  input: { panelAssetId: string; terminationId: string }
): PanelWiringCommandResult {
  const source = panelWiringSourcePackageSchema.parse(inputSource);
  const parsed = resetInputSchema.parse(input);
  const graph = buildPackageConnectivityGraph(source);
  const termination = graph.externalTerminationsById.get(parsed.terminationId);

  if (!termination || termination.panelAssetId !== parsed.panelAssetId) {
    return commandError(
      "missing_external_termination",
      "The external field termination is not available for this panel.",
      { panelAssetId: parsed.panelAssetId }
    );
  }

  const mappingId = currentMappingId(
    source,
    parsed.panelAssetId,
    sourceEndpointKey(termination.source),
    termination.mappingId
  );

  return mappingId
    ? removeExternalTerminationMapping(source, { mappingId })
    : { mutations: [], warnings: [], affectedIds: [] };
}
