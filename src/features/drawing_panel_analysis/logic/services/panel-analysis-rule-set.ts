import type { DrawingModel } from "@/features/drawing_canvas/data/schema";
import type { ApprovedDrawingSymbol } from "@/features/drawing_canvas/types";
import type {
  PackagePanelDrawingQualityReport,
  PanelWiringSourcePackage
} from "@/features/drawing_panel_wiring/api/contracts";
import type {
  PanelConnectivityGraph,
  PanelExternalTermination,
  TerminalSideOccupant
} from "@/features/drawing_panel_wiring/types";
import { buildPackageTerminalOccupancyIndex } from "@/features/drawing_panel_wiring/api/public";
import type {
  PanelAnalysisCategory,
  PanelAnalysisFindingDraft,
  PanelAnalysisRule
} from "../../api/public";
import {
  adaptPanelQualityFindings,
  type AdaptedPanelQualityFinding
} from "./panel-quality-finding-adapter";
import {
  comparePanelTerminalElectricalRoles,
  resolvePanelTerminalElectricalRole,
  type PanelTerminalRoleResolution
} from "./panel-analysis-signal-semantics";
import { buildIncompleteCommunicationPathEvidence } from "./panel-analysis-path-evidence";
import type {ResolvedDrawingProduct} from "@/features/drawing_canvas/api/product-server";
import type {PowerAnalysis} from "../../data/engineering-checks";
import {powerBudgetRule,focusedProductRules} from "./product-engineering-rules";

export type PanelAnalysisRuleContext = {
  model: DrawingModel;
  source: PanelWiringSourcePackage;
  graph: PanelConnectivityGraph;
  symbols: readonly ApprovedDrawingSymbol[];
  qualityReport: PackagePanelDrawingQualityReport;
  products?: readonly ResolvedDrawingProduct[];
  powerAnalysis?: PowerAnalysis;
};

const qualityCategories: PanelAnalysisCategory[] = [
  "structural_identity",
  "connectivity",
  "terminal_occupancy",
  "external_termination",
  "internal_wiring"
];

function unique(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function sourceLocation(
  termination: PanelExternalTermination
): PanelAnalysisFindingDraft["locations"] {
  return [
    {
      sheetId: termination.sourceSheet.id,
      sheetNumber: termination.sourceSheet.number,
      sheetName: termination.sourceSheet.name,
      objectKind: "connection",
      objectId: termination.source.connectionId
    }
  ];
}

function buildQualityRules(
  findings: readonly AdaptedPanelQualityFinding[]
): PanelAnalysisRule<PanelAnalysisRuleContext>[] {
  return qualityCategories.map((category) => {
    const categoryFindings = findings
      .filter((finding) => finding.category === category)
      .map(({ category: findingCategory, ...finding }) => {
        if (findingCategory !== category) {
          throw new Error("Panel quality category changed during adaptation.");
        }
        return finding;
      });

    return {
      code: `panel.quality.${category}`,
      version: "1",
      category,
      isApplicable: ({ graph }) =>
        graph.panelAssetIds.size > 0
          ? { applicable: true }
          : { applicable: false, reason: "No panel drawings were detected." },
      evaluate: () =>
        categoryFindings.length > 0
          ? { status: "finding", findings: categoryFindings }
          : { status: "passed" }
    };
  });
}

function conductorIdentityRule(): PanelAnalysisRule<PanelAnalysisRuleContext> {
  return {
    code: "connection.conductor_identity",
    version: "1",
    category: "cable_conductor",
    isApplicable: ({ graph }) =>
      graph.externalTerminationsById.size > 0
        ? { applicable: true }
        : {
            applicable: false,
            reason: "No external terminations are present in the package."
          },
    evaluate: ({ graph }) => {
      const findings = [...graph.externalTerminationsById.values()]
        .map((termination): PanelAnalysisFindingDraft | undefined => {
          const missing = [
            !termination.wireId ? "wire number" : undefined,
            !termination.cableTag ? "cable tag" : undefined,
            !termination.conductorKey ? "conductor/core" : undefined
          ].filter((value): value is string => Boolean(value));
          if (missing.length === 0) return undefined;

          const displayId =
            termination.wireId ??
            `${termination.sourceAssetTag ?? "Field connection"} on Sheet ${termination.sourceSheet.number}`;
          return {
            findingKey: termination.id,
            severity: "data_gap",
            evidenceLevel: "verified",
            title: `${displayId} has incomplete conductor identity`,
            problem: `The saved field connection is missing ${missing.join(", ")}.`,
            significance:
              "A loop drawing and wire schedule cannot identify, purchase, terminate, or test this conductor unambiguously.",
            recommendedAction:
              "Assign the canonical wire number, cable tag, and conductor/core identity to the connection.",
            rootCauseKey: `external-termination:${termination.id}`,
            panelAssetIds: [termination.panelAssetId],
            assetIds: unique([
              termination.sourceAssetId,
              termination.cableAssetId,
              termination.target?.assetId
            ]),
            affectedRecords: [
              {
                kind: "connection",
                id: termination.source.connectionId,
                assetId: termination.sourceAssetId
              },
              ...(termination.cableAssetId
                ? [
                    {
                      kind: "cable" as const,
                      id: termination.cableAssetId,
                      label: termination.cableTag
                    }
                  ]
                : [])
            ],
            evidence: [
              { label: "Missing fields", value: missing.join(", ") },
              {
                label: "Source endpoint",
                value: `${termination.source.placementId}:${termination.source.anchorKey}`
              }
            ],
            locations: sourceLocation(termination)
          };
        })
        .filter((finding): finding is PanelAnalysisFindingDraft => Boolean(finding));

      return findings.length > 0
        ? { status: "finding", findings }
        : { status: "passed" };
    }
  };
}

function externalLandingConflictRule(): PanelAnalysisRule<PanelAnalysisRuleContext> {
  return {
    code: "terminal.external_side_multiple_landings",
    version: "2",
    category: "terminal_occupancy",
    isApplicable: ({ graph }) =>
      graph.terminalSidesById.size > 0
        ? { applicable: true }
        : {
            applicable: false,
            reason: "No managed terminal ends are present."
          },
    evaluate: ({ graph }) => {
      const occupancy = buildPackageTerminalOccupancyIndex(graph);
      const findings = [...occupancy.occupancyBySideId.entries()]
        .filter(([, side]) => side.conductorStatus === "conflicting")
        .map(([targetKey, side]): PanelAnalysisFindingDraft => {
          const target = side.ref;
          const occupants = side.conductorOccupants as TerminalSideOccupant[];
          const targetAsset = graph.assetsById.get(target.assetId);
          const defaultPosition =
            target.side === "internal"
              ? "TOP"
              : target.side === "external"
                ? "BOTTOM"
                : "SINGLE";
          const anchorLabels = unique(
            occupants.map((occupant) => occupant.anchorKey)
          );
          const physicalLabel = `${anchorLabels.join(", ") || target.terminalKey} — ${target.side}/${defaultPosition}`;
          const occupantRecords: PanelAnalysisFindingDraft["affectedRecords"] =
            occupants.map((occupant) =>
              occupant.connectionId
                ? {
                    kind: "connection",
                    id: occupant.connectionId,
                    label: `${occupant.wireId ?? occupant.label}${
                      occupant.sheetNumber
                        ? ` — Sheet ${occupant.sheetNumber}`
                        : ""
                    }`
                  }
                : {
                    kind: "internal_wire",
                    id: occupant.id,
                    label: occupant.wireId ?? occupant.label
                  }
            );
          return {
            findingKey: targetKey,
            severity: "error",
            evidenceLevel: "verified",
            title: `${targetAsset?.tag ?? target.assetId}:${target.terminalKey}/${target.side} has ${occupants.length} conductors on the same terminal end`,
            problem: `${occupants.length} physical conductors occupy ${physicalLabel}.`,
            significance:
              "An undocumented multi-conductor landing can exceed terminal capacity or join circuits that were intended to remain separate.",
            recommendedAction:
              "Verify the intended terminations and move or remove the additional conductor landing so each physical terminal end has one conductor.",
            rootCauseKey: `external-landing:${targetKey}`,
            panelAssetIds: [
              ...(graph.panelAssetIdsByAssetId.get(target.assetId) ?? [])
            ].sort(),
            assetIds: [target.assetId],
            affectedRecords: [
              {
                kind: "terminal",
                id: targetKey,
                label: targetAsset?.tag,
                assetId: target.assetId,
                terminalKey: target.terminalKey,
                terminalSide: target.side
              },
              ...occupantRecords
            ],
            evidence: [
              {
                label: "Physical terminal end",
                value: physicalLabel
              },
              {
                label: "Landing count",
                value: String(occupants.length)
              },
              ...occupants.map((occupant, index) => ({
                label: `Conductor ${index + 1}`,
                value: [
                  occupant.wireId ?? occupant.label,
                  occupant.sheetNumber
                    ? `Sheet ${occupant.sheetNumber} — ${occupant.sheetName ?? "Untitled"}`
                    : undefined,
                  occupant.connectionId
                    ? `${occupant.connectionId}:${occupant.endpointRole ?? "endpoint"}`
                    : occupant.id,
                  occupant.anchorKey
                ]
                  .filter(Boolean)
                  .join(" · ")
              }))
            ],
            locations: occupants.flatMap((occupant) =>
              occupant.sheetId && occupant.sheetNumber && occupant.connectionId
                ? [
                    {
                      sheetId: occupant.sheetId,
                      sheetNumber: occupant.sheetNumber,
                      sheetName: occupant.sheetName,
                      objectKind: "connection" as const,
                      objectId: occupant.connectionId
                    }
                  ]
                : []
            )
          };
        });

      return findings.length > 0
        ? { status: "finding", findings }
        : { status: "passed" };
    }
  };
}

function tankReferences(value: string | undefined): string[] {
  if (!value) return [];
  return [
    ...value.matchAll(/\btank\s+(\d+)\b/giu)
  ].map((match) => match[1]);
}

function internalWireDescriptionRule(): PanelAnalysisRule<PanelAnalysisRuleContext> {
  return {
    code: "internal_wire.description_consistency",
    version: "1",
    category: "documentation",
    isApplicable: ({ source }) =>
      (source.panelWiring?.internalWires.length ?? 0) > 0
        ? { applicable: true }
        : { applicable: false, reason: "No internal wires are recorded." },
    evaluate: ({ source }) => {
      const assetsById = new Map(source.assets.map((asset) => [asset.id, asset]));
      const findings = (source.panelWiring?.internalWires ?? []).flatMap(
        (wire): PanelAnalysisFindingDraft[] => {
          const description = wire.attributes?.description;
          if (!description) return [];
          const endpointAssets = [
            assetsById.get(wire.from.assetId),
            assetsById.get(wire.to.assetId)
          ];
          const endpointTanks = unique(
            endpointAssets.flatMap((asset) => tankReferences(asset?.title))
          );
          const describedTanks = unique(tankReferences(description));
          const inconsistentTanks = describedTanks.filter(
            (tank) => endpointTanks.length > 0 && !endpointTanks.includes(tank)
          );
          if (inconsistentTanks.length === 0) return [];
          const route = source.sheets
            .flatMap((sheet) =>
              sheet.connections.map((connection) => ({ sheet, connection }))
            )
            .find(({ connection }) => connection.panelConnectionId === wire.id);

          return [
            {
              findingKey: wire.id,
              severity: "warning",
              evidenceLevel: "inferred",
              title: `${wire.wireId} description may reference the wrong tank`,
              problem: `The description refers to Tank ${inconsistentTanks.join(", ")}, while the endpoint records refer to Tank ${endpointTanks.join(", ")}.`,
              significance:
                "Incorrect destination wording can cause installation, testing, and maintenance work to be performed on the wrong process equipment.",
              recommendedAction:
                "Compare the description with the actual wire endpoints and correct the text if the endpoint assignment is intentional.",
              rootCauseKey: `internal-wire-description:${wire.id}`,
              panelAssetIds: [wire.panelAssetId],
              assetIds: unique([wire.from.assetId, wire.to.assetId]),
              affectedRecords: [
                { kind: "internal_wire", id: wire.id, label: wire.wireId }
              ],
              evidence: [
                { label: "Description", value: description },
                {
                  label: "Endpoint equipment",
                  value: endpointAssets
                    .map((asset) => `${asset?.tag ?? "Unknown"} — ${asset?.title ?? "Unknown"}`)
                    .join("; ")
                }
              ],
              locations: route
                ? [
                    {
                      sheetId: route.sheet.id,
                      sheetNumber: route.sheet.sheetNumber,
                      sheetName: route.sheet.name,
                      objectKind: "connection",
                      objectId: route.connection.id
                    }
                  ]
                : []
            }
          ];
        }
      );

      return findings.length > 0
        ? { status: "finding", findings }
        : { status: "passed" };
    }
  };
}

function engineeringMetadataRule(): PanelAnalysisRule<PanelAnalysisRuleContext> {
  return {
    code: "asset.instrument_engineering_metadata",
    version: "1",
    category: "engineering_metadata",
    isApplicable: ({ model }) =>
      model.assets.some((asset) => asset.type === "instrument")
        ? { applicable: true }
        : { applicable: false, reason: "No instrument assets are present." },
    evaluate: ({ model, source }) => {
      const occurrences = new Map(
        source.sheets.flatMap((sheet) =>
          sheet.occurrences.flatMap((occurrence) =>
            occurrence.assetId
              ? [
                  [
                    occurrence.assetId,
                    {
                      sheetId: sheet.id,
                      sheetNumber: sheet.sheetNumber,
                      sheetName: sheet.name,
                      placementId: occurrence.placementId
                    }
                  ] as const
                ]
              : []
          )
        )
      );
      const findings = model.assets
        .filter(
          (asset) =>
            asset.type === "instrument" &&
            (asset.engineeringAttributes?.values.length ?? 0) === 0
        )
        .map((asset): PanelAnalysisFindingDraft => {
          const occurrence = occurrences.get(asset.id);
          return {
            findingKey: asset.id,
            severity: "data_gap",
            evidenceLevel: "verified",
            title: `${asset.tag} has no structured engineering attributes`,
            problem:
              "The instrument asset has no structured engineering attribute values recorded.",
            significance:
              "Loop readiness checks cannot verify signal, supply, range, service, or installation requirements without structured evidence.",
            recommendedAction:
              "Record the applicable instrument engineering attributes, then re-run Panel Analysis.",
            rootCauseKey: `instrument-metadata:${asset.id}`,
            panelAssetIds: unique(
              [...(source.panelWiring?.internalWires ?? [])]
                .filter(
                  (wire) =>
                    wire.from.assetId === asset.id || wire.to.assetId === asset.id
                )
                .map((wire) => wire.panelAssetId)
            ),
            assetIds: [asset.id],
            affectedRecords: [
              { kind: "asset", id: asset.id, label: asset.tag }
            ],
            evidence: [
              { label: "Recorded attributes", value: "0" },
              { label: "Asset type", value: asset.type }
            ],
            locations: occurrence
              ? [
                  {
                    sheetId: occurrence.sheetId,
                    sheetNumber: occurrence.sheetNumber,
                    sheetName: occurrence.sheetName,
                    objectKind: "placement",
                    objectId: occurrence.placementId
                  }
                ]
              : []
          };
        });

      return findings.length > 0
        ? { status: "finding", findings }
        : { status: "passed" };
    }
  };
}

function shieldRepresentationRule(): PanelAnalysisRule<PanelAnalysisRuleContext> {
  return {
    code: "shield.structured_representation",
    version: "1",
    category: "shield_earth",
    isApplicable: ({ source }) => {
      const hasShieldEvidence =
        source.sheets.some((sheet) =>
          sheet.connections.some((connection) =>
            [connection.wireId, connection.label, connection.conductorKey].some(
              (value) => value && /\b(shield|drain)\b/iu.test(value)
            )
          )
        ) ||
        (source.panelWiring?.internalWires.some((wire) =>
          [
            wire.wireId,
            wire.attributes?.description,
            wire.attributes?.wireType
          ].some((value) => value && /\b(shield|drain)\b/iu.test(value))
        ) ?? false) ||
        (source.panelWiring?.bonds.some(
          (bond) =>
            bond.kind === "shield" ||
            [bond.label, bond.description].some(
              (value) => value && /\b(shield|drain)\b/iu.test(value)
            )
        ) ?? false);
      return hasShieldEvidence
        ? { applicable: true }
        : {
            applicable: false,
            reason: "No explicit shield or drain evidence is present."
          };
    },
    evaluate: ({ source }) =>
      source.panelWiring?.bonds.some((bond) => bond.kind === "shield")
        ? { status: "passed" }
        : {
            status: "not_evaluated",
            reason:
              "Shield conductors are visible, but no structured shield-bond record is available to verify their termination."
          }
  };
}

type SemanticTerminal = {
  assetId: string;
  assetTag: string;
  assetType: PanelAnalysisRuleContext["source"]["assets"][number]["type"];
  terminalKey: string;
  role: Extract<PanelTerminalRoleResolution, { status: "resolved" }>;
  locations: PanelAnalysisFindingDraft["locations"];
};

function semanticTerminalKey(assetId: string, terminalKey: string): string {
  return `${assetId}\u0000${terminalKey}`;
}

function buildSemanticTerminals(
  context: PanelAnalysisRuleContext
): Map<string, SemanticTerminal> {
  const symbolsByVersionId = new Map(
    context.symbols.map((symbol) => [symbol.versionId, symbol])
  );
  const assetsById = new Map(
    context.source.assets.map((asset) => [asset.id, asset])
  );
  const result = new Map<string, SemanticTerminal>();

  for (const terminal of context.graph.terminalsById.values()) {
    const occurrences = context.graph.occurrencesByAssetId.get(
      terminal.ref.assetId
    );
    const occurrence = occurrences?.find(
      (candidate) => candidate.occurrenceKind === "wiring"
    ) ?? occurrences?.[0];
    if (!occurrence) continue;
    const symbol = symbolsByVersionId.get(occurrence.versionId);
    if (!symbol) continue;
    const candidates = symbol.metadata.terminals.filter(
      (candidate) => candidate.key === terminal.ref.terminalKey
    );
    if (candidates.length === 0) continue;
    const explicitRoles = new Set(
      candidates.flatMap((candidate) =>
        candidate.electricalRole ? [candidate.electricalRole] : []
      )
    );
    if (explicitRoles.size > 1) continue;
    const role = resolvePanelTerminalElectricalRole({
      terminal:
        candidates.find((candidate) => candidate.electricalRole) ?? candidates[0],
      symbolDisplayName: symbol.displayName
    });
    if (role.status !== "resolved") continue;
    const asset = assetsById.get(terminal.ref.assetId);
    if (!asset) continue;
    const locations = terminal.occurrenceRefs.flatMap((reference) => {
      const sheet = context.graph.sheetsById.get(reference.sheetId);
      return sheet
        ? [
            {
              sheetId: sheet.id,
              sheetNumber: sheet.sheetNumber,
              sheetName: sheet.name,
              objectKind: "placement" as const,
              objectId: reference.placementId
            }
          ]
        : [];
    });
    result.set(semanticTerminalKey(asset.id, terminal.ref.terminalKey), {
      assetId: asset.id,
      assetTag: asset.tag,
      assetType: asset.type,
      terminalKey: terminal.ref.terminalKey,
      role,
      locations
    });
  }

  return result;
}

function terminalsForNet(
  context: PanelAnalysisRuleContext,
  semanticTerminals: ReadonlyMap<string, SemanticTerminal>,
  netId: string
): SemanticTerminal[] {
  const net = context.graph.electricalNetsById.get(netId);
  if (!net) return [];
  const result = new Map<string, SemanticTerminal>();
  for (const sideId of net.terminalSideIds) {
    const side = context.graph.terminalSidesById.get(sideId);
    if (!side) continue;
    const key = semanticTerminalKey(side.ref.assetId, side.ref.terminalKey);
    const terminal = semanticTerminals.get(key);
    if (terminal) result.set(key, terminal);
  }
  return [...result.values()];
}

function signalCompatibilityRule(): PanelAnalysisRule<PanelAnalysisRuleContext> {
  return {
    code: "signal.polarity_compatibility",
    version: "1",
    category: "signal_compatibility",
    isApplicable: (context) =>
      buildSemanticTerminals(context).size > 0
        ? { applicable: true }
        : {
            applicable: false,
            reason: "No terminal electrical roles can be resolved."
          },
    evaluate: (context) => {
      const semanticTerminals = buildSemanticTerminals(context);
      const findings: PanelAnalysisFindingDraft[] = [];

      for (const net of context.graph.electricalNetsById.values()) {
        const terminals = terminalsForNet(context, semanticTerminals, net.id);
        let mismatch:
          | {
              first: SemanticTerminal;
              second: SemanticTerminal;
              evidenceLevel: "verified" | "inferred";
              reason: string;
            }
          | undefined;

        for (let firstIndex = 0; firstIndex < terminals.length; firstIndex += 1) {
          for (
            let secondIndex = firstIndex + 1;
            secondIndex < terminals.length;
            secondIndex += 1
          ) {
            const first = terminals[firstIndex];
            const second = terminals[secondIndex];
            const isInstrumentIoPair =
              first.assetId !== second.assetId &&
              ((first.assetType === "instrument" &&
                ["controller", "io_module"].includes(second.assetType)) ||
                (second.assetType === "instrument" &&
                  ["controller", "io_module"].includes(first.assetType)));
            if (!isInstrumentIoPair) continue;
            const comparison = comparePanelTerminalElectricalRoles(
              first.role,
              second.role
            );
            if (comparison.status === "incompatible") {
              mismatch = { first, second, ...comparison };
              break;
            }
          }
          if (mismatch) break;
        }

        if (!mismatch) continue;
        const instrument =
          mismatch.first.assetType === "instrument"
            ? mismatch.first
            : mismatch.second;
        findings.push({
          findingKey: net.id,
          severity:
            mismatch.evidenceLevel === "verified" ? "error" : "warning",
          evidenceLevel: mismatch.evidenceLevel,
          title: `${mismatch.evidenceLevel === "verified" ? "Signal polarity mismatch" : "Probable signal polarity mismatch"} between ${mismatch.first.assetTag} and ${mismatch.second.assetTag}`,
          problem: mismatch.reason,
          significance:
            "Opposite analog signal polarities on one electrical path can invert or invalidate the measured current signal.",
          recommendedAction:
            "Verify the transmitter and input-channel polarity against approved device information, then correct the terminal assignments if required.",
          rootCauseKey: `signal-polarity:${instrument.assetId}`,
          panelAssetIds: unique(net.panelAssetIds),
          assetIds: unique([mismatch.first.assetId, mismatch.second.assetId]),
          affectedRecords: [mismatch.first, mismatch.second].map((terminal) => ({
            kind: "terminal" as const,
            id: semanticTerminalKey(terminal.assetId, terminal.terminalKey),
            assetId: terminal.assetId,
            terminalKey: terminal.terminalKey,
            label: terminal.assetTag
          })),
          evidence: [
            {
              label: mismatch.first.assetTag,
              value: `${mismatch.first.terminalKey}: ${mismatch.first.role.role}`
            },
            {
              label: mismatch.second.assetTag,
              value: `${mismatch.second.terminalKey}: ${mismatch.second.role.role}`
            }
          ],
          locations: [...mismatch.first.locations, ...mismatch.second.locations]
        });
      }

      return findings.length > 0
        ? { status: "finding", findings }
        : { status: "passed" };
    }
  };
}

function instrumentPathRule(): PanelAnalysisRule<PanelAnalysisRuleContext> {
  return {
    code: "instrument_loop.path_completeness",
    version: "2",
    category: "instrument_loop",
    isApplicable: (context) => {
      const communicationTerminals = [...buildSemanticTerminals(context).values()]
        .filter(
          (terminal) =>
            terminal.assetType === "instrument" &&
            ["communication_a", "communication_b"].includes(terminal.role.role)
        );
      return communicationTerminals.length > 0
        ? { applicable: true }
        : {
            applicable: false,
            reason:
              "No instrument communication terminals can be resolved from approved metadata."
          };
    },
    evaluate: (context) => {
      const semanticTerminals = buildSemanticTerminals(context);
      const communicationTerminals = [...semanticTerminals.values()].filter(
        (terminal) =>
          terminal.assetType === "instrument" &&
          ["communication_a", "communication_b"].includes(terminal.role.role)
      );
      const findings = communicationTerminals.flatMap(
        (terminal): PanelAnalysisFindingDraft[] => {
          const sideNodes = [...context.graph.terminalSidesById.values()].filter(
            (side) =>
              side.ref.assetId === terminal.assetId &&
              side.ref.terminalKey === terminal.terminalKey
          );
          const netIds = unique(
            sideNodes.map((side) =>
              context.graph.electricalNetIdByNodeId.get(side.id)
            )
          );
          const destination = netIds
            .flatMap((netId) =>
              terminalsForNet(context, semanticTerminals, netId)
            )
            .find(
              (candidate) =>
                candidate.assetId !== terminal.assetId &&
                ["controller", "io_module", "network_device"].includes(
                  candidate.assetType
                ) &&
                candidate.role.role === terminal.role.role
            );
          if (destination) return [];
          const roleLabel =
            terminal.role.role === "communication_a" ? "RS485 A" : "RS485 B";
          const pathEvidence = buildIncompleteCommunicationPathEvidence({
            graph: context.graph,
            source: {
              assetId: terminal.assetId,
              terminalKey: terminal.terminalKey,
              roleLabel
            }
          });
          const panelAssetIds = unique(
            netIds.flatMap(
              (netId) =>
                context.graph.electricalNetsById.get(netId)?.panelAssetIds ?? []
            )
          );
          return [
            {
              findingKey: `${terminal.assetId}:${terminal.terminalKey}`,
              severity: "data_gap",
              evidenceLevel: terminal.role.evidenceLevel,
              title: `${terminal.assetTag} ${roleLabel} path stops at ${pathEvidence.stoppingTerminalLabel}`,
              problem: `The ${roleLabel} path reaches ${pathEvidence.stoppingTerminalLabel} but does not continue to a matching controller, I/O, or network-device communication terminal.`,
              significance:
                "An incomplete communication path may be intentionally spare, but it is not ready for automatic loop-diagram generation without a recorded disposition.",
              recommendedAction: `Continue ${roleLabel} from ${pathEvidence.stoppingTerminalLabel} to the intended controller endpoint, or label the connected conductor as spare or reserved if that is the design intent.`,
              rootCauseKey: `communication-path:${terminal.assetId}`,
              rootCauseTitle: `${terminal.assetTag} communication paths stop before reaching a controller endpoint`,
              rootCauseSummaryItem: `${roleLabel} stops at ${pathEvidence.stoppingTerminalLabel}`,
              panelAssetIds,
              assetIds: unique([terminal.assetId, ...pathEvidence.assetIds]),
              affectedRecords: [
                {
                  kind: "terminal",
                  id: semanticTerminalKey(
                    terminal.assetId,
                    terminal.terminalKey
                  ),
                  assetId: terminal.assetId,
                  terminalKey: terminal.terminalKey,
                  label: terminal.assetTag
                },
                ...pathEvidence.affectedRecords
              ],
              evidence: [
                {
                  label: "Resolved role",
                  value: `${roleLabel} (${terminal.role.source === "explicit" ? "approved terminal role" : "inferred from approved terminal metadata"})`
                },
                ...pathEvidence.evidence
              ],
              locations:
                pathEvidence.locations.length > 0
                  ? pathEvidence.locations
                  : terminal.locations
            }
          ];
        }
      );

      return findings.length > 0
        ? { status: "finding", findings }
        : { status: "passed" };
    }
  };
}

export function createPanelAnalysisRules(
  context: PanelAnalysisRuleContext
): PanelAnalysisRule<PanelAnalysisRuleContext>[] {
  const qualityFindings = adaptPanelQualityFindings(context.qualityReport);
  return [
    ...buildQualityRules(qualityFindings),
    conductorIdentityRule(),
    externalLandingConflictRule(),
    internalWireDescriptionRule(),
    ...(context.model.version === 2 ? [engineeringMetadataRule()] : []),
    ...(context.products?.some(p=>p.selection) ? [powerBudgetRule(),...focusedProductRules(context)] : []),
    shieldRepresentationRule(),
    signalCompatibilityRule(),
    instrumentPathRule()
  ];
}
