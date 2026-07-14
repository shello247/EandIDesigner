import type {
  PanelBondEndpoint,
  PanelBondRecord,
  PanelBridgeRecord,
  PanelElectricalDomain,
  PanelTerminalSideRef
} from "../../data/schema";
import type {
  PanelConnectivityFinding,
  PanelConnectivityGraph
} from "../../types";
import { terminalNodeId, terminalSideNodeId } from "./terminal-resolution";

export type PanelConnectionPatternCandidate =
  | { recordType: "bridge"; record: PanelBridgeRecord }
  | { recordType: "bond"; record: PanelBondRecord };

type PatternDomainAssignment = {
  recordId: string;
  domain: PanelElectricalDomain;
};

type PatternConductorAssignment = {
  recordId: string;
  label: string;
};

export type PanelPatternValidationIndex = {
  domainsByTerminalSide: ReadonlyMap<string, PatternDomainAssignment[]>;
  conductorsByTerminalSide: ReadonlyMap<string, PatternConductorAssignment[]>;
  structuralPatternsByTerminalSide: ReadonlyMap<string, string[]>;
  bondsBySourceTerminalSide: ReadonlyMap<string, string[]>;
};

function appendIndexValue<T>(map: Map<string, T[]>, key: string, value: T) {
  map.set(key, [...(map.get(key) ?? []), value]);
}

export function buildPanelPatternValidationIndex(
  graph: PanelConnectivityGraph
): PanelPatternValidationIndex {
  const domainsByTerminalSide = new Map<string, PatternDomainAssignment[]>();
  const conductorsByTerminalSide = new Map<
    string,
    PatternConductorAssignment[]
  >();
  const structuralPatternsByTerminalSide = new Map<string, string[]>();
  const bondsBySourceTerminalSide = new Map<string, string[]>();

  for (const wire of graph.internalWiresById.values()) {
    const recordId = wire.ownerPatternId ?? wire.id;
    for (const terminal of [wire.from, wire.to]) {
      const sideId = terminalSideNodeId(terminal);
      appendIndexValue(conductorsByTerminalSide, sideId, {
        recordId,
        label: wire.wireId
      });
      if (wire.domain) {
        appendIndexValue(domainsByTerminalSide, sideId, {
          recordId,
          domain: wire.domain
        });
      }
    }
  }
  for (const termination of graph.externalTerminationsById.values()) {
    if (!termination.target || termination.status !== "resolved") continue;
    appendIndexValue(
      conductorsByTerminalSide,
      terminalSideNodeId(termination.target),
      {
        recordId: termination.id,
        label: termination.wireId ?? "An existing conductor"
      }
    );
  }
  for (const bridge of graph.bridgesById.values()) {
    const structural =
      bridge.definition?.topology === "terminal_jumper" ||
      bridge.definition?.topology === "bridge_bar";
    for (const member of bridge.members) {
      const sideId = terminalSideNodeId(member);
      if (bridge.domain) {
        appendIndexValue(domainsByTerminalSide, sideId, {
          recordId: bridge.id,
          domain: bridge.domain
        });
      }
      if (structural) {
        appendIndexValue(structuralPatternsByTerminalSide, sideId, bridge.id);
      }
    }
  }
  for (const bond of graph.bondsById.values()) {
    if (bond.source) {
      appendIndexValue(
        bondsBySourceTerminalSide,
        terminalSideNodeId(bond.source),
        bond.id
      );
    }
    for (const endpoint of bond.endpoints) {
      if (endpoint.kind !== "terminal") continue;
      const sideId = terminalSideNodeId(endpoint.terminal);
      appendIndexValue(domainsByTerminalSide, sideId, {
        recordId: bond.id,
        domain: bond.kind
      });
      if (bond.targetDomain) {
        appendIndexValue(domainsByTerminalSide, sideId, {
          recordId: bond.id,
          domain: bond.targetDomain
        });
      }
    }
  }

  return {
    domainsByTerminalSide,
    conductorsByTerminalSide,
    structuralPatternsByTerminalSide,
    bondsBySourceTerminalSide
  };
}

function finding(
  recordId: string,
  panelAssetId: string,
  code: string,
  message: string,
  severity: PanelConnectivityFinding["severity"] = "error",
  terminal?: PanelTerminalSideRef
): PanelConnectivityFinding {
  return {
    id: `pattern:${recordId}:${code}:${terminal ? terminalSideNodeId(terminal) : "record"}`,
    severity,
    code,
    message,
    panelAssetId,
    assetId: terminal?.assetId,
    terminal
  };
}

function sameTerminal(first: PanelTerminalSideRef, second: PanelTerminalSideRef) {
  return terminalSideNodeId(first) === terminalSideNodeId(second);
}

function uniqueTerminals(terminals: PanelTerminalSideRef[]): boolean {
  return new Set(terminals.map(terminalSideNodeId)).size === terminals.length;
}

function assignedDomains(
  index: PanelPatternValidationIndex,
  ref: PanelTerminalSideRef,
  ignorePatternId: string
): Set<PanelElectricalDomain> {
  const sideId = terminalSideNodeId(ref);
  return new Set(
    (index.domainsByTerminalSide.get(sideId) ?? [])
      .filter((assignment) => assignment.recordId !== ignorePatternId)
      .map((assignment) => assignment.domain)
  );
}

function validateTerminal(
  graph: PanelConnectivityGraph,
  index: PanelPatternValidationIndex,
  recordId: string,
  panelAssetId: string,
  terminal: PanelTerminalSideRef,
  domain: PanelElectricalDomain | undefined,
  findings: PanelConnectivityFinding[]
) {
  if (terminal.side === "external") {
    findings.push(
      finding(recordId, panelAssetId, "external_side_not_pattern_eligible", "External terminal sides are reserved for field terminations.", "error", terminal)
    );
  }
  if (!graph.terminalSidesById.has(terminalSideNodeId(terminal))) {
    findings.push(
      finding(recordId, panelAssetId, "missing_terminal", "A selected terminal side is unavailable.", "error", terminal)
    );
    return;
  }
  if (!graph.assetIdsByPanelAssetId.get(panelAssetId)?.has(terminal.assetId)) {
    findings.push(
      finding(recordId, panelAssetId, "terminal_outside_panel", "A selected terminal belongs to another panel.", "error", terminal)
    );
  }
  const node = graph.terminalsById.get(terminalNodeId(terminal));
  if (domain && domain !== "unknown") {
    if (node?.allowedDomains?.length && !node.allowedDomains.includes(domain)) {
      findings.push(
        finding(recordId, panelAssetId, "terminal_domain_incompatible", `${node.label} does not allow the ${domain.replaceAll("_", " ")} domain.`, "error", terminal)
      );
    } else if (!node?.allowedDomains?.length) {
      findings.push(
        finding(recordId, panelAssetId, "terminal_domain_unverified", `${node?.label ?? terminal.terminalKey} has no explicit electrical-domain constraint.`, "warning", terminal)
      );
    }
    const existingDomains = assignedDomains(index, terminal, recordId);
    if (
      [...existingDomains].some(
        (existing) => existing !== "unknown" && existing !== domain
      )
    ) {
      findings.push(
        finding(recordId, panelAssetId, "terminal_domain_mixed", "This terminal already participates in an incompatible electrical domain.", "error", terminal)
      );
    }
  }
}

function validateConductorAvailability(
  index: PanelPatternValidationIndex,
  recordId: string,
  panelAssetId: string,
  terminals: PanelTerminalSideRef[],
  findings: PanelConnectivityFinding[]
) {
  for (const terminal of terminals) {
    const sideId = terminalSideNodeId(terminal);
    const existingConductor = (
      index.conductorsByTerminalSide.get(sideId) ?? []
    ).find((assignment) => assignment.recordId !== recordId);
    if (existingConductor) {
      findings.push(
        finding(
          recordId,
          panelAssetId,
          "pattern_conductor_occupied",
          `${existingConductor.label} already occupies this terminal side.`,
          "error",
          terminal
        )
      );
    }
  }
}

function bondTerminalEndpoints(endpoints: PanelBondEndpoint[]) {
  return endpoints.flatMap((endpoint) =>
    endpoint.kind === "terminal" ? [endpoint.terminal] : []
  );
}

export function validatePanelConnectionPattern({
  graph,
  candidate,
  index = buildPanelPatternValidationIndex(graph)
}: {
  graph: PanelConnectivityGraph;
  candidate: PanelConnectionPatternCandidate;
  index?: PanelPatternValidationIndex;
}): PanelConnectivityFinding[] {
  const findings: PanelConnectivityFinding[] = [];

  if (candidate.recordType === "bridge") {
    const bridge = candidate.record;
    if (!bridge.definition) {
      return [
        finding(bridge.id, bridge.panelAssetId, "legacy_pattern_definition", "This legacy pattern has no editable topology definition.", "warning")
      ];
    }
    if (!bridge.domain || bridge.domain === "unknown") {
      findings.push(
        finding(bridge.id, bridge.panelAssetId, "missing_pattern_domain", "Select an electrical domain for this pattern.")
      );
    }
    if (!uniqueTerminals(bridge.members)) {
      findings.push(
        finding(bridge.id, bridge.panelAssetId, "duplicate_pattern_member", "A terminal can appear only once in a pattern.")
      );
    }
    bridge.members.forEach((terminal) =>
      validateTerminal(
        graph,
        index,
        bridge.id,
        bridge.panelAssetId,
        terminal,
        bridge.domain,
        findings
      )
    );
    const definition = bridge.definition;
    if (definition.topology === "daisy_chain") {
      validateConductorAvailability(
        index,
        bridge.id,
        bridge.panelAssetId,
        definition.orderedMembers,
        findings
      );
      if (definition.internalWireIds.length !== definition.orderedMembers.length - 1) {
        findings.push(
          finding(bridge.id, bridge.panelAssetId, "invalid_daisy_wire_count", "A daisy chain needs one wire between each adjacent terminal.")
        );
      }
      if (definition.orderedMembers.length > 2) {
        findings.push(
          finding(bridge.id, bridge.panelAssetId, "terminal_capacity_unverified", "Intermediate daisy-chain terminals carry two pattern-owned conductors; hardware capacity is not verified.", "warning")
        );
      }
    }
    if (definition.topology === "distribution") {
      validateConductorAvailability(
        index,
        bridge.id,
        bridge.panelAssetId,
        [definition.source, ...definition.branches.map((branch) => branch.target)],
        findings
      );
      if (definition.branches.some((branch) => sameTerminal(branch.target, definition.source))) {
        findings.push(
          finding(bridge.id, bridge.panelAssetId, "distribution_source_is_branch", "A distribution source cannot also be a branch target.")
        );
      }
      if (!uniqueTerminals(definition.branches.map((branch) => branch.target))) {
        findings.push(
          finding(bridge.id, bridge.panelAssetId, "duplicate_distribution_branch", "Distribution branch terminals must be unique.")
        );
      }
      findings.push(
        finding(bridge.id, bridge.panelAssetId, "terminal_capacity_unverified", "The distribution source carries multiple pattern-owned conductors; hardware capacity is not verified.", "warning", definition.source)
      );
    }
    if (definition.topology === "fused_distribution") {
      validateConductorAvailability(
        index,
        bridge.id,
        bridge.panelAssetId,
        [
          definition.source,
          ...definition.branches.flatMap((branch) => [
            branch.protectionInput,
            branch.protectionOutput,
            branch.target
          ])
        ],
        findings
      );
      const targets = definition.branches.map((branch) => branch.target);
      if (!uniqueTerminals(targets)) {
        findings.push(
          finding(bridge.id, bridge.panelAssetId, "duplicate_fused_branch", "Fused-distribution targets must be unique.")
        );
      }
      for (const branch of definition.branches) {
        if (
          branch.protectionInput.assetId !== branch.protectionAssetId ||
          branch.protectionOutput.assetId !== branch.protectionAssetId ||
          sameTerminal(branch.protectionInput, branch.protectionOutput)
        ) {
          findings.push(
            finding(bridge.id, bridge.panelAssetId, "invalid_protection_path", "Each fused branch requires distinct input and output terminals on its explicit protection asset.")
          );
        }
      }
      findings.push(
        finding(bridge.id, bridge.panelAssetId, "terminal_capacity_unverified", "The fused-distribution source carries multiple pattern-owned conductors; hardware capacity is not verified.", "warning", definition.source)
      );
    }
    const structural = definition.topology === "terminal_jumper" || definition.topology === "bridge_bar";
    if (structural) {
      const occupiedId = bridge.members
        .flatMap(
          (member) =>
            index.structuralPatternsByTerminalSide.get(
              terminalSideNodeId(member)
            ) ?? []
        )
        .find((patternId) => patternId !== bridge.id);
      if (occupiedId) {
        const occupied = graph.bridgesById.get(occupiedId);
        findings.push(
          finding(
            bridge.id,
            bridge.panelAssetId,
            "duplicate_structural_membership",
            `${occupied?.patternCode ?? occupiedId} already uses one of these structural terminal positions.`
          )
        );
      }
    }
  } else {
    const bond = candidate.record;
    if (!bond.source || !bond.target) {
      return [
        finding(
          bond.id,
          bond.panelAssetId,
          "legacy_bond_definition",
          "This legacy bond has no editable source/target definition.",
          "warning"
        )
      ];
    }
    const terminalEndpoints = bondTerminalEndpoints(bond.endpoints);
    if (!bond.source || !bond.target || bond.endpoints.length !== 2) {
      findings.push(
        finding(bond.id, bond.panelAssetId, "invalid_bond_endpoints", "A new bond requires one terminal source and one terminal or panel-reference target.")
      );
    }
    if (bond.source) {
      validateTerminal(
        graph,
        index,
        bond.id,
        bond.panelAssetId,
        bond.source,
        bond.kind,
        findings
      );
    }
    if (bond.target?.kind === "terminal") {
      validateTerminal(
        graph,
        index,
        bond.id,
        bond.panelAssetId,
        bond.target.terminal,
        bond.targetDomain ?? bond.kind,
        findings
      );
    }
    if (!bond.source || !bond.target) {
      terminalEndpoints.forEach((terminal) =>
        validateTerminal(
          graph,
          index,
          bond.id,
          bond.panelAssetId,
          terminal,
          bond.kind,
          findings
        )
      );
    }
    const duplicateSourceId = bond.source
      ? (
          index.bondsBySourceTerminalSide.get(
            terminalSideNodeId(bond.source)
          ) ?? []
        ).find((bondId) => bondId !== bond.id)
      : undefined;
    if (duplicateSourceId) {
      const duplicateSource = graph.bondsById.get(duplicateSourceId);
      findings.push(
        finding(
          bond.id,
          bond.panelAssetId,
          "duplicate_exclusive_bond",
          `${duplicateSource?.patternCode ?? duplicateSourceId} already bonds this source terminal.`
        )
      );
    }
    if (
      bond.kind !== "shield" &&
      bond.targetDomain &&
      bond.targetDomain !== bond.kind
    ) {
      findings.push(
        finding(bond.id, bond.panelAssetId, "bond_domain_mismatch", `${bond.kind.replaceAll("_", " ")} bonds require a matching target domain.`)
      );
    }
    if (
      bond.kind === "shield" &&
      bond.targetDomain &&
      bond.targetDomain !== "shield"
    ) {
      findings.push(
        finding(bond.id, bond.panelAssetId, "cross_domain_shield_bond", `Shield termination is explicitly bonded to ${bond.targetDomain.replaceAll("_", " ")}.`, "warning")
      );
    }
  }

  return findings.sort((first, second) => first.id.localeCompare(second.id));
}
