import {
  panelBondRecordSchema,
  panelBridgeRecordSchema,
  panelInternalWireRecordSchema,
  panelTerminalSideRefSchema,
  panelWiringSourcePackageSchema,
  type PanelBondEndpoint,
  type PanelBondRecord,
  type PanelBridgeRecord,
  type PanelElectricalDomain,
  type PanelInternalWireRecord,
  type PanelPatternSettings,
  type PanelRecordOrigin,
  type PanelTerminalSideRef,
  type PanelWireSettings,
  type PanelWiringMutation,
  type PanelWiringSourcePackage
} from "../../data/schema";
import type {
  PanelConnectionPatternRecord,
  PanelPatternCommandResult
} from "../../types";
import { buildPackageConnectivityGraph } from "./connectivity-graph";
import { allocateInternalWireId } from "./internal-panel-wires";
import {
  allocatePanelPatternId,
  type PanelPatternIdKind
} from "./panel-pattern-id-allocation";
import { validatePanelConnectionPattern } from "./panel-pattern-validation";
import { terminalSideNodeId } from "./terminal-resolution";

type KnownElectricalDomain = Exclude<PanelElectricalDomain, "unknown">;

type PatternMetadata = {
  label?: string;
  description?: string;
  createdOnSheetId?: string;
  origin?: PanelRecordOrigin;
};

export type CreateTerminalJumperInput = PatternMetadata & {
  panelAssetId: string;
  topology: "terminal_jumper" | "bridge_bar";
  members: PanelTerminalSideRef[];
  domain: KnownElectricalDomain;
};

export type CreateDaisyChainInput = PatternMetadata & {
  panelAssetId: string;
  topology: "daisy_chain";
  members: PanelTerminalSideRef[];
  domain: KnownElectricalDomain;
};

export type CreateDistributionInput = PatternMetadata & {
  panelAssetId: string;
  topology: "distribution";
  source: PanelTerminalSideRef;
  targets: PanelTerminalSideRef[];
  domain: KnownElectricalDomain;
};

export type CreateFusedDistributionInput = PatternMetadata & {
  panelAssetId: string;
  topology: "fused_distribution";
  source: PanelTerminalSideRef;
  branches: Array<{
    protectionAssetId: string;
    protectionInput: PanelTerminalSideRef;
    protectionOutput: PanelTerminalSideRef;
    target: PanelTerminalSideRef;
  }>;
  domain: KnownElectricalDomain;
};

export type CreateDistributionGroupInput =
  | CreateDaisyChainInput
  | CreateDistributionInput
  | CreateFusedDistributionInput;

export type CreatePanelBondInput = PatternMetadata & {
  panelAssetId: string;
  source: PanelTerminalSideRef;
  target: PanelBondEndpoint;
  targetDomain: "shield" | "protective_earth" | "signal_ground";
};

function withPatternSettings(
  source: PanelWiringSourcePackage,
  settings: PanelPatternSettings
): PanelWiringSourcePackage {
  const current = source.panelWiring?.patternSettings ?? [];
  return panelWiringSourcePackageSchema.parse({
    ...source,
    panelWiring: {
      schemaVersion: 1,
      terminalMappings: source.panelWiring?.terminalMappings ?? [],
      internalWires: source.panelWiring?.internalWires ?? [],
      bridges: source.panelWiring?.bridges ?? [],
      bonds: source.panelWiring?.bonds ?? [],
      panelSettings: source.panelWiring?.panelSettings,
      patternSettings: [
        ...current.filter((candidate) => candidate.panelAssetId !== settings.panelAssetId),
        settings
      ]
    }
  });
}

function withWire(
  source: PanelWiringSourcePackage,
  wire: PanelInternalWireRecord,
  settings: PanelWireSettings
): PanelWiringSourcePackage {
  const currentSettings = source.panelWiring?.panelSettings ?? [];
  return panelWiringSourcePackageSchema.parse({
    ...source,
    panelWiring: {
      schemaVersion: 1,
      terminalMappings: source.panelWiring?.terminalMappings ?? [],
      internalWires: [...(source.panelWiring?.internalWires ?? []), wire],
      bridges: source.panelWiring?.bridges ?? [],
      bonds: source.panelWiring?.bonds ?? [],
      panelSettings: [
        ...currentSettings.filter((candidate) => candidate.panelAssetId !== settings.panelAssetId),
        settings
      ],
      patternSettings: source.panelWiring?.patternSettings
    }
  });
}

function createOwnedWire(
  source: PanelWiringSourcePackage,
  input: {
    panelAssetId: string;
    patternId: string;
    domain: KnownElectricalDomain;
    from: PanelTerminalSideRef;
    to: PanelTerminalSideRef;
  }
): {
  source: PanelWiringSourcePackage;
  wire: PanelInternalWireRecord;
  settings: PanelWireSettings;
} {
  const allocation = allocateInternalWireId({
    source,
    panelAssetId: input.panelAssetId
  });
  const wire = panelInternalWireRecordSchema.parse({
    id: `internal_wire:${encodeURIComponent(input.panelAssetId)}:${encodeURIComponent(allocation.wireId)}`,
    panelAssetId: input.panelAssetId,
    wireId: allocation.wireId,
    from: panelTerminalSideRefSchema.parse(input.from),
    to: panelTerminalSideRefSchema.parse(input.to),
    domain: input.domain,
    ownerPatternId: input.patternId,
    attributes: allocation.settings.defaults,
    origin: "engineer"
  });
  return {
    source: withWire(source, wire, allocation.settings),
    wire,
    settings: allocation.settings
  };
}

function bridgeKind(topology: CreateTerminalJumperInput["topology"] | CreateDistributionGroupInput["topology"]): PanelBridgeRecord["kind"] {
  return topology === "terminal_jumper"
    ? "jumper"
    : topology === "bridge_bar"
      ? "bridge"
      : "distribution";
}

function errorFindings(result: ReturnType<typeof validatePanelConnectionPattern>) {
  return result.filter((finding) => finding.severity === "error");
}

function patternMutations(
  record: PanelBridgeRecord | PanelBondRecord,
  recordType: "bridge" | "bond",
  wires: PanelInternalWireRecord[],
  wireSettings: PanelWireSettings | undefined,
  patternSettings: PanelPatternSettings
): PanelWiringMutation[] {
  return [
    ...wires.map((wire): PanelWiringMutation => ({ kind: "upsert-internal-wire", wire })),
    ...(wireSettings
      ? [{ kind: "upsert-panel-wire-settings", settings: wireSettings } as PanelWiringMutation]
      : []),
    recordType === "bridge"
      ? { kind: "upsert-bridge", bridge: record as PanelBridgeRecord }
      : { kind: "upsert-bond", bond: record as PanelBondRecord },
    { kind: "upsert-panel-pattern-settings", settings: patternSettings }
  ];
}

function resultForPattern({
  pattern,
  wires,
  wireSettings,
  patternSettings,
  warnings
}: {
  pattern: PanelConnectionPatternRecord;
  wires: PanelInternalWireRecord[];
  wireSettings?: PanelWireSettings;
  patternSettings: PanelPatternSettings;
  warnings: PanelPatternCommandResult["warnings"];
}): PanelPatternCommandResult {
  return {
    mutations: patternMutations(
      pattern.record,
      pattern.recordType,
      wires,
      wireSettings,
      patternSettings
    ),
    warnings,
    affectedIds: [
      pattern.record.id,
      pattern.record.panelAssetId,
      ...wires.map((wire) => wire.id),
      ...(pattern.recordType === "bridge"
        ? pattern.record.members.map((member) => member.assetId)
        : pattern.record.endpoints.flatMap((endpoint) =>
            endpoint.kind === "terminal" ? [endpoint.terminal.assetId] : []
          ))
    ],
    pattern,
    wires,
    settings: patternSettings
  };
}

export function createTerminalJumper(
  inputSource: PanelWiringSourcePackage,
  input: CreateTerminalJumperInput
): PanelPatternCommandResult {
  const source = panelWiringSourcePackageSchema.parse(inputSource);
  const allocation = allocatePanelPatternId({
    source,
    panelAssetId: input.panelAssetId,
    kind: input.topology === "terminal_jumper" ? "terminal_jumper" : "bridge_bar"
  });
  const record = panelBridgeRecordSchema.parse({
    id: allocation.id,
    patternCode: allocation.patternCode,
    panelAssetId: input.panelAssetId,
    kind: bridgeKind(input.topology),
    members: input.members,
    domain: input.domain,
    definition: { topology: input.topology, orderedMembers: input.members },
    label: input.label,
    description: input.description,
    createdOnSheetId: input.createdOnSheetId,
    origin: input.origin ?? "engineer"
  });
  const graph = buildPackageConnectivityGraph(source);
  const warnings = validatePanelConnectionPattern({
    graph,
    candidate: { recordType: "bridge", record }
  });
  if (errorFindings(warnings).length) {
    return { mutations: [], warnings, affectedIds: [] };
  }
  return resultForPattern({
    pattern: { recordType: "bridge", record },
    wires: [],
    patternSettings: allocation.settings,
    warnings
  });
}

function preparePatternSource(
  source: PanelWiringSourcePackage,
  settings: PanelPatternSettings
) {
  return withPatternSettings(source, settings);
}

export function createDistributionGroup(
  inputSource: PanelWiringSourcePackage,
  input: CreateDistributionGroupInput
): PanelPatternCommandResult {
  const source = panelWiringSourcePackageSchema.parse(inputSource);
  const allocation = allocatePanelPatternId({
    source,
    panelAssetId: input.panelAssetId,
    kind: input.topology as PanelPatternIdKind
  });
  let transient = preparePatternSource(source, allocation.settings);
  const wires: PanelInternalWireRecord[] = [];
  let lastWireSettings: PanelWireSettings | undefined;
  let record: PanelBridgeRecord;

  if (input.topology === "daisy_chain") {
    for (let index = 0; index < input.members.length - 1; index += 1) {
      const created = createOwnedWire(transient, {
        panelAssetId: input.panelAssetId,
        patternId: allocation.id,
        domain: input.domain,
        from: input.members[index],
        to: input.members[index + 1]
      });
      transient = created.source;
      wires.push(created.wire);
      lastWireSettings = created.settings;
    }
    record = panelBridgeRecordSchema.parse({
      id: allocation.id,
      patternCode: allocation.patternCode,
      panelAssetId: input.panelAssetId,
      kind: bridgeKind(input.topology),
      members: input.members,
      domain: input.domain,
      definition: {
        topology: input.topology,
        orderedMembers: input.members,
        internalWireIds: wires.map((wire) => wire.id)
      },
      label: input.label,
      description: input.description,
      createdOnSheetId: input.createdOnSheetId,
      origin: input.origin ?? "engineer"
    });
  } else if (input.topology === "distribution") {
    const branches = [];
    for (let index = 0; index < input.targets.length; index += 1) {
      const created = createOwnedWire(transient, {
        panelAssetId: input.panelAssetId,
        patternId: allocation.id,
        domain: input.domain,
        from: input.source,
        to: input.targets[index]
      });
      transient = created.source;
      wires.push(created.wire);
      lastWireSettings = created.settings;
      branches.push({
        id: `${allocation.id}:branch:${index + 1}`,
        target: input.targets[index],
        wireId: created.wire.id
      });
    }
    record = panelBridgeRecordSchema.parse({
      id: allocation.id,
      patternCode: allocation.patternCode,
      panelAssetId: input.panelAssetId,
      kind: bridgeKind(input.topology),
      members: [input.source, ...input.targets],
      domain: input.domain,
      definition: { topology: input.topology, source: input.source, branches },
      label: input.label,
      description: input.description,
      createdOnSheetId: input.createdOnSheetId,
      origin: input.origin ?? "engineer"
    });
  } else {
    const branches = [];
    for (let index = 0; index < input.branches.length; index += 1) {
      const branch = input.branches[index];
      const feed = createOwnedWire(transient, {
        panelAssetId: input.panelAssetId,
        patternId: allocation.id,
        domain: input.domain,
        from: input.source,
        to: branch.protectionInput
      });
      transient = feed.source;
      wires.push(feed.wire);
      lastWireSettings = feed.settings;
      const load = createOwnedWire(transient, {
        panelAssetId: input.panelAssetId,
        patternId: allocation.id,
        domain: input.domain,
        from: branch.protectionOutput,
        to: branch.target
      });
      transient = load.source;
      wires.push(load.wire);
      lastWireSettings = load.settings;
      branches.push({
        id: `${allocation.id}:branch:${index + 1}`,
        ...branch,
        feedWireId: feed.wire.id,
        loadWireId: load.wire.id
      });
    }
    record = panelBridgeRecordSchema.parse({
      id: allocation.id,
      patternCode: allocation.patternCode,
      panelAssetId: input.panelAssetId,
      kind: bridgeKind(input.topology),
      members: [
        input.source,
        ...input.branches.flatMap((branch) => [
          branch.protectionInput,
          branch.protectionOutput,
          branch.target
        ])
      ],
      domain: input.domain,
      definition: { topology: input.topology, source: input.source, branches },
      label: input.label,
      description: input.description,
      createdOnSheetId: input.createdOnSheetId,
      origin: input.origin ?? "engineer"
    });
  }

  const graph = buildPackageConnectivityGraph(source);
  const warnings = validatePanelConnectionPattern({
    graph,
    candidate: { recordType: "bridge", record }
  });
  if (errorFindings(warnings).length) {
    return { mutations: [], warnings, affectedIds: [] };
  }
  return resultForPattern({
    pattern: { recordType: "bridge", record },
    wires,
    wireSettings: lastWireSettings,
    patternSettings: allocation.settings,
    warnings
  });
}

export function addTerminalToDistribution(
  inputSource: PanelWiringSourcePackage,
  input: { patternId: string; target: PanelTerminalSideRef }
): PanelPatternCommandResult {
  const source = panelWiringSourcePackageSchema.parse(inputSource);
  const current = source.panelWiring?.bridges.find(
    (bridge) => bridge.id === input.patternId
  );
  if (!current?.definition || current.definition.topology !== "distribution") {
    throw new Error("Only an existing distribution pattern can accept a branch terminal.");
  }
  const created = createOwnedWire(source, {
    panelAssetId: current.panelAssetId,
    patternId: current.id,
    domain: current.domain as KnownElectricalDomain,
    from: current.definition.source,
    to: input.target
  });
  const branchIndex = current.definition.branches.length + 1;
  const record = panelBridgeRecordSchema.parse({
    ...current,
    members: [...current.members, input.target],
    definition: {
      ...current.definition,
      branches: [
        ...current.definition.branches,
        {
          id: `${current.id}:branch:${branchIndex}`,
          target: input.target,
          wireId: created.wire.id
        }
      ]
    }
  });
  const warnings = validatePanelConnectionPattern({
    graph: buildPackageConnectivityGraph(source),
    candidate: { recordType: "bridge", record }
  });
  if (errorFindings(warnings).length) {
    return { mutations: [], warnings, affectedIds: [] };
  }
  return {
    mutations: [
      { kind: "upsert-internal-wire", wire: created.wire },
      { kind: "upsert-panel-wire-settings", settings: created.settings },
      { kind: "upsert-bridge", bridge: record }
    ],
    warnings,
    affectedIds: [record.id, created.wire.id, input.target.assetId],
    pattern: { recordType: "bridge", record },
    wires: [created.wire]
  };
}

function createBond(
  inputSource: PanelWiringSourcePackage,
  input: CreatePanelBondInput,
  kind: "shield" | "protective_earth" | "signal_ground"
): PanelPatternCommandResult {
  const source = panelWiringSourcePackageSchema.parse(inputSource);
  const allocation = allocatePanelPatternId({
    source,
    panelAssetId: input.panelAssetId,
    kind: kind === "protective_earth" ? "protective_earth" : kind
  });
  const sourceEndpoint = { kind: "terminal" as const, terminal: input.source };
  const record = panelBondRecordSchema.parse({
    id: allocation.id,
    patternCode: allocation.patternCode,
    panelAssetId: input.panelAssetId,
    kind,
    endpoints: [sourceEndpoint, input.target],
    source: input.source,
    target: input.target,
    targetDomain: input.targetDomain,
    label: input.label,
    description: input.description,
    createdOnSheetId: input.createdOnSheetId,
    origin: input.origin ?? "engineer"
  });
  const warnings = validatePanelConnectionPattern({
    graph: buildPackageConnectivityGraph(source),
    candidate: { recordType: "bond", record }
  });
  if (errorFindings(warnings).length) {
    return { mutations: [], warnings, affectedIds: [] };
  }
  return resultForPattern({
    pattern: { recordType: "bond", record },
    wires: [],
    patternSettings: allocation.settings,
    warnings
  });
}

export function createShieldTermination(
  source: PanelWiringSourcePackage,
  input: CreatePanelBondInput
) {
  return createBond(source, input, "shield");
}

export function createEarthTermination(
  source: PanelWiringSourcePackage,
  input: CreatePanelBondInput & {
    kind: "protective_earth" | "signal_ground";
  }
) {
  return createBond(source, input, input.kind);
}

export function updatePanelConnectionPattern(
  inputSource: PanelWiringSourcePackage,
  pattern: PanelConnectionPatternRecord
): PanelPatternCommandResult {
  const source = panelWiringSourcePackageSchema.parse(inputSource);
  const parsed: PanelConnectionPatternRecord =
    pattern.recordType === "bridge"
      ? { recordType: "bridge", record: panelBridgeRecordSchema.parse(pattern.record) }
      : { recordType: "bond", record: panelBondRecordSchema.parse(pattern.record) };
  const current = parsed.recordType === "bridge"
    ? source.panelWiring?.bridges.find((record) => record.id === parsed.record.id)
    : source.panelWiring?.bonds.find((record) => record.id === parsed.record.id);
  if (current) {
    const immutableShape = (record: PanelBridgeRecord | PanelBondRecord) => {
      const shape = { ...record };
      delete shape.label;
      delete shape.description;
      return JSON.stringify(shape);
    };
    if (immutableShape(current) !== immutableShape(parsed.record)) {
      throw new Error(
        "Pattern topology and membership must be changed through guided pattern authoring."
      );
    }
  }
  const warnings = validatePanelConnectionPattern({
    graph: buildPackageConnectivityGraph(source),
    candidate: parsed
  });
  if (errorFindings(warnings).length) {
    return { mutations: [], warnings, affectedIds: [] };
  }
  return {
    mutations: [
      parsed.recordType === "bridge"
        ? { kind: "upsert-bridge", bridge: parsed.record }
        : { kind: "upsert-bond", bond: parsed.record }
    ],
    warnings,
    affectedIds: [parsed.record.id],
    pattern: parsed
  };
}

export function deletePanelConnectionPattern(
  inputSource: PanelWiringSourcePackage,
  patternId: string
): PanelPatternCommandResult {
  const source = panelWiringSourcePackageSchema.parse(inputSource);
  const bridge = source.panelWiring?.bridges.find((candidate) => candidate.id === patternId);
  const bond = source.panelWiring?.bonds.find((candidate) => candidate.id === patternId);
  const ownedWires = (source.panelWiring?.internalWires ?? []).filter(
    (wire) => wire.ownerPatternId === patternId
  );
  if (!bridge && !bond) {
    return { mutations: [], warnings: [], affectedIds: [] };
  }
  return {
    mutations: [
      ...ownedWires.map(
        (wire): PanelWiringMutation => ({ kind: "remove-internal-wire", wireId: wire.id })
      ),
      bridge
        ? { kind: "remove-bridge", bridgeId: patternId }
        : { kind: "remove-bond", bondId: patternId }
    ],
    warnings: [],
    affectedIds: [patternId, ...ownedWires.map((wire) => wire.id)],
    pattern: bridge
      ? { recordType: "bridge", record: bridge }
      : { recordType: "bond", record: bond! },
    wires: ownedWires
  };
}

function mappedTerminal(
  terminal: PanelTerminalSideRef,
  mappings: ReadonlyMap<string, PanelTerminalSideRef>
): PanelTerminalSideRef {
  const mapped = mappings.get(terminalSideNodeId(terminal));
  if (!mapped) {
    throw new Error(`No explicit target mapping was provided for ${terminal.terminalKey}:${terminal.side}.`);
  }
  return mapped;
}

export function duplicatePanelConnectionPattern(
  inputSource: PanelWiringSourcePackage,
  input: {
    patternId: string;
    targetPanelAssetId: string;
    terminalMappings: Array<{ from: PanelTerminalSideRef; to: PanelTerminalSideRef }>;
    createdOnSheetId?: string;
  }
): PanelPatternCommandResult {
  const source = panelWiringSourcePackageSchema.parse(inputSource);
  const mapping = new Map(
    input.terminalMappings.map((entry) => [terminalSideNodeId(entry.from), entry.to])
  );
  const bridge = source.panelWiring?.bridges.find((candidate) => candidate.id === input.patternId);
  if (bridge?.definition) {
    const metadata = {
      panelAssetId: input.targetPanelAssetId,
      domain: (bridge.domain ?? "unknown") as KnownElectricalDomain,
      label: bridge.label,
      description: bridge.description,
      createdOnSheetId: input.createdOnSheetId,
      origin: bridge.origin
    };
    if (bridge.definition.topology === "terminal_jumper" || bridge.definition.topology === "bridge_bar") {
      return createTerminalJumper(source, {
        ...metadata,
        topology: bridge.definition.topology,
        members: bridge.definition.orderedMembers.map((terminal) => mappedTerminal(terminal, mapping))
      });
    }
    if (bridge.definition.topology === "daisy_chain") {
      return createDistributionGroup(source, {
        ...metadata,
        topology: "daisy_chain",
        members: bridge.definition.orderedMembers.map((terminal) => mappedTerminal(terminal, mapping))
      });
    }
    if (bridge.definition.topology === "distribution") {
      return createDistributionGroup(source, {
        ...metadata,
        topology: "distribution",
        source: mappedTerminal(bridge.definition.source, mapping),
        targets: bridge.definition.branches.map((branch) => mappedTerminal(branch.target, mapping))
      });
    }
    return createDistributionGroup(source, {
      ...metadata,
      topology: "fused_distribution",
      source: mappedTerminal(bridge.definition.source, mapping),
      branches: bridge.definition.branches.map((branch) => ({
        protectionAssetId: mappedTerminal(branch.protectionInput, mapping).assetId,
        protectionInput: mappedTerminal(branch.protectionInput, mapping),
        protectionOutput: mappedTerminal(branch.protectionOutput, mapping),
        target: mappedTerminal(branch.target, mapping)
      }))
    });
  }
  const bond = source.panelWiring?.bonds.find((candidate) => candidate.id === input.patternId);
  if (bond?.source && bond.target) {
    const targetDomain: CreatePanelBondInput["targetDomain"] =
      bond.targetDomain === "shield" ||
      bond.targetDomain === "protective_earth" ||
      bond.targetDomain === "signal_ground"
        ? bond.targetDomain
        : bond.kind;
    const target = bond.target.kind === "terminal"
      ? { kind: "terminal" as const, terminal: mappedTerminal(bond.target.terminal, mapping) }
      : { ...bond.target, panelAssetId: input.targetPanelAssetId };
    const base = {
      panelAssetId: input.targetPanelAssetId,
      source: mappedTerminal(bond.source, mapping),
      target,
      targetDomain,
      label: bond.label,
      description: bond.description,
      createdOnSheetId: input.createdOnSheetId,
      origin: bond.origin
    };
    return bond.kind === "shield"
      ? createShieldTermination(source, base)
      : createEarthTermination(source, { ...base, kind: bond.kind });
  }
  throw new Error("Only structured connection patterns can be duplicated.");
}

export function getPanelPatternDisplayLabel(
  pattern: PanelConnectionPatternRecord
): string {
  return pattern.record.label?.trim() || pattern.record.patternCode || pattern.record.id;
}
