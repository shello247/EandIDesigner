import {
  panelInternalWireRecordSchema,
  panelTerminalSideRefSchema,
  panelWireAttributesSchema,
  panelWireSettingsSchema,
  panelWiringSourcePackageSchema,
  type PanelInternalWireRecord,
  type PanelRecordOrigin,
  type PanelTerminalSideRef,
  type PanelWireAttributes,
  type PanelWireSettings,
  type PanelWiringSourcePackage
} from "../../data/schema";
import type {
  PanelConnectivityFinding,
  PanelConnectivityGraph,
  PanelInternalWireCatalogRow,
  PanelWireEndpointValidation,
  PanelWiringCommandResult
} from "../../types";
import { buildPackageConnectivityGraph } from "./connectivity-graph";
import {
  buildPanelTerminalCatalog,
  getTerminalSideOccupancy
} from "./panel-terminal-catalog";
import { terminalSideNodeId } from "./terminal-resolution";

function normalized(value: string): string {
  return value.trim().toUpperCase();
}

function defaultPrefix(panelTag: string): string {
  const tag = panelTag.trim().toUpperCase().replace(/[^A-Z0-9-]+/g, "");
  return `${tag || "PANEL"}-W`;
}

export function getPanelWireSettings(
  source: PanelWiringSourcePackage,
  panelAssetId: string
): PanelWireSettings {
  const panel = source.assets.find((asset) => asset.id === panelAssetId);
  const persisted = source.panelWiring?.panelSettings?.find(
    (settings) => settings.panelAssetId === panelAssetId
  );
  return panelWireSettingsSchema.parse(
    persisted ?? {
      panelAssetId,
      wireIdPolicy: {
        mode: "panel_scoped",
        prefix: defaultPrefix(panel?.tag ?? "PANEL"),
        digits: 3,
        nextNumber: 1
      }
    }
  );
}

function usedWireIds(source: PanelWiringSourcePackage): Set<string> {
  return new Set([
    ...(source.panelWiring?.internalWires ?? []).map((wire) => normalized(wire.wireId)),
    ...source.sheets.flatMap((sheet) =>
      sheet.connections.flatMap((connection) =>
        connection.wireId ? [normalized(connection.wireId)] : []
      )
    )
  ]);
}

export function allocateInternalWireId({
  source: inputSource,
  panelAssetId
}: {
  source: PanelWiringSourcePackage;
  panelAssetId: string;
}): { wireId: string; settings: PanelWireSettings } {
  const source = panelWiringSourcePackageSchema.parse(inputSource);
  const settings = getPanelWireSettings(source, panelAssetId);
  const used = usedWireIds(source);
  const prefix = settings.wireIdPolicy.prefix ?? "PANEL-W";
  let number = settings.wireIdPolicy.nextNumber;
  let wireId = "";

  do {
    wireId = `${prefix}${String(number).padStart(
      settings.wireIdPolicy.digits,
      "0"
    )}`;
    number += 1;
  } while (used.has(normalized(wireId)));

  return {
    wireId,
    settings: {
      ...settings,
      wireIdPolicy: { ...settings.wireIdPolicy, nextNumber: number }
    }
  };
}

function finding(
  code: string,
  message: string,
  panelAssetId: string,
  terminal?: PanelTerminalSideRef
): PanelConnectivityFinding {
  return {
    id: `internal_wire:${code}:${terminal ? terminalSideNodeId(terminal) : panelAssetId}`,
    severity: "error",
    code,
    message,
    panelAssetId,
    assetId: terminal?.assetId,
    terminal
  };
}

export function validateInternalWireEndpoints({
  graph,
  panelAssetId,
  from: inputFrom,
  to: inputTo,
  ignoreWireRecordId
}: {
  graph: PanelConnectivityGraph;
  panelAssetId: string;
  from: PanelTerminalSideRef;
  to: PanelTerminalSideRef;
  ignoreWireRecordId?: string;
}): PanelWireEndpointValidation {
  const from = panelTerminalSideRefSchema.parse(inputFrom);
  const to = panelTerminalSideRefSchema.parse(inputTo);
  const findings: PanelConnectivityFinding[] = [];
  const associated = graph.assetIdsByPanelAssetId.get(panelAssetId);
  const catalog = buildPanelTerminalCatalog({ graph, panelAssetId });

  for (const [role, endpoint] of [["source", from], ["destination", to]] as const) {
    if (!associated?.has(endpoint.assetId)) {
      findings.push(finding("endpoint_outside_panel", `The ${role} asset is not associated with this panel.`, panelAssetId, endpoint));
    }
    if (!graph.terminalSidesById.has(terminalSideNodeId(endpoint))) {
      findings.push(finding("missing_terminal_side", `The ${role} terminal side is unavailable.`, panelAssetId, endpoint));
    }
    if (endpoint.side === "external") {
      findings.push(finding("external_side_not_internal", "External terminal sides are reserved for field terminations.", panelAssetId, endpoint));
    }
    const occupancy = getTerminalSideOccupancy(catalog, endpoint);
    const occupants = occupancy?.conductorOccupants.filter(
      (occupant) => !ignoreWireRecordId || !occupant.id.startsWith(ignoreWireRecordId)
    );
    if (occupants && occupants.length > 0) {
      findings.push(finding("terminal_side_occupied", `${occupants[0].label} already occupies the ${role} terminal side.`, panelAssetId, endpoint));
    }
  }

  if (from.assetId === to.assetId && from.terminalKey === to.terminalKey) {
    findings.push(finding("same_logical_terminal", "An internal wire cannot connect both ends of the same logical terminal.", panelAssetId, from));
  }

  const pair = [terminalSideNodeId(from), terminalSideNodeId(to)].sort().join("::");
  const duplicate = [...graph.internalWiresById.values()].find(
    (wire) =>
      wire.id !== ignoreWireRecordId &&
      [terminalSideNodeId(wire.from), terminalSideNodeId(wire.to)]
        .sort()
        .join("::") === pair
  );
  if (duplicate) {
    findings.push(finding("duplicate_internal_wire", `${duplicate.wireId} already connects these terminal sides.`, panelAssetId));
  }

  return { valid: findings.length === 0, findings };
}

function assertUniqueWireId(
  source: PanelWiringSourcePackage,
  wireId: string,
  ignoreRecordId?: string
): void {
  const target = normalized(wireId);
  const duplicateInternal = (source.panelWiring?.internalWires ?? []).find(
    (wire) => wire.id !== ignoreRecordId && normalized(wire.wireId) === target
  );
  const duplicateField = source.sheets.some((sheet) =>
    sheet.connections.some(
      (connection) =>
        !connection.panelConnectionId &&
        connection.wireId &&
        normalized(connection.wireId) === target
    )
  );
  if (duplicateInternal || duplicateField) {
    throw new Error(`${wireId.trim()} is already used by another package wire.`);
  }
}

function nextSettingsForManualId(
  settings: PanelWireSettings,
  wireId: string
): PanelWireSettings {
  const prefix = settings.wireIdPolicy.prefix ?? "";
  if (!normalized(wireId).startsWith(normalized(prefix))) {
    return settings;
  }
  const suffix = wireId.trim().slice(prefix.length);
  const number = /^\d+$/.test(suffix) ? Number(suffix) : undefined;
  return number && number >= settings.wireIdPolicy.nextNumber
    ? {
        ...settings,
        wireIdPolicy: { ...settings.wireIdPolicy, nextNumber: number + 1 }
      }
    : settings;
}

export function createInternalPanelWire(
  inputSource: PanelWiringSourcePackage,
  input: {
    panelAssetId: string;
    from: PanelTerminalSideRef;
    to: PanelTerminalSideRef;
    wireId?: string;
    domain?: PanelInternalWireRecord["domain"];
    ownerPatternId?: string;
    attributes?: PanelWireAttributes;
    origin?: PanelRecordOrigin;
  }
): PanelWiringCommandResult & { wire?: PanelInternalWireRecord } {
  const source = panelWiringSourcePackageSchema.parse(inputSource);
  const graph = buildPackageConnectivityGraph(source);
  const validation = validateInternalWireEndpoints({ graph, ...input });
  if (!validation.valid) {
    return { mutations: [], warnings: validation.findings, affectedIds: [] };
  }
  const allocation = allocateInternalWireId({ source, panelAssetId: input.panelAssetId });
  const wireId = input.wireId?.trim() || allocation.wireId;
  assertUniqueWireId(source, wireId);
  const settings = nextSettingsForManualId(allocation.settings, wireId);
  const wire = panelInternalWireRecordSchema.parse({
    id: `internal_wire:${encodeURIComponent(input.panelAssetId)}:${encodeURIComponent(wireId)}`,
    panelAssetId: input.panelAssetId,
    wireId,
    from: input.from,
    to: input.to,
    domain: input.domain,
    ownerPatternId: input.ownerPatternId,
    attributes: input.attributes
      ? panelWireAttributesSchema.parse(input.attributes)
      : settings.defaults,
    origin: input.origin ?? "engineer"
  });
  return {
    mutations: [
      { kind: "upsert-internal-wire", wire },
      { kind: "upsert-panel-wire-settings", settings }
    ],
    warnings: [],
    affectedIds: [wire.id, wire.panelAssetId, wire.from.assetId, wire.to.assetId],
    wire
  };
}

export function updateInternalPanelWire(
  inputSource: PanelWiringSourcePackage,
  input: { id: string; wireId: string; attributes?: PanelWireAttributes }
): PanelWiringCommandResult & { wire?: PanelInternalWireRecord } {
  const source = panelWiringSourcePackageSchema.parse(inputSource);
  const current = source.panelWiring?.internalWires.find((wire) => wire.id === input.id);
  if (!current) {
    throw new Error("The internal wire no longer exists.");
  }
  assertUniqueWireId(source, input.wireId, current.id);
  const wire = panelInternalWireRecordSchema.parse({
    ...current,
    wireId: input.wireId.trim(),
    attributes: input.attributes
  });
  const settings = nextSettingsForManualId(
    getPanelWireSettings(source, current.panelAssetId),
    wire.wireId
  );
  return {
    mutations: [
      { kind: "upsert-internal-wire", wire },
      { kind: "upsert-panel-wire-settings", settings }
    ],
    warnings: [],
    affectedIds: [wire.id],
    wire
  };
}

export function deleteInternalPanelWire(
  inputSource: PanelWiringSourcePackage,
  wireRecordId: string
): PanelWiringCommandResult {
  const source = panelWiringSourcePackageSchema.parse(inputSource);
  const wire = source.panelWiring?.internalWires.find((candidate) => candidate.id === wireRecordId);
  if (wire?.ownerPatternId) {
    throw new Error("Pattern-owned wires must be deleted with their connection pattern.");
  }
  return wire
    ? {
        mutations: [{ kind: "remove-internal-wire", wireId: wireRecordId }],
        warnings: [],
        affectedIds: [wireRecordId, wire.panelAssetId]
      }
    : { mutations: [], warnings: [], affectedIds: [] };
}

export function updatePanelWireSettings(
  inputSource: PanelWiringSourcePackage,
  settings: PanelWireSettings
): PanelWiringCommandResult {
  const source = panelWiringSourcePackageSchema.parse(inputSource);
  const parsed = panelWireSettingsSchema.parse(settings);
  if (!source.assets.some((asset) => asset.id === parsed.panelAssetId)) {
    throw new Error("The panel asset no longer exists.");
  }
  return {
    mutations: [{ kind: "upsert-panel-wire-settings", settings: parsed }],
    warnings: [],
    affectedIds: [parsed.panelAssetId]
  };
}

export function getPanelWireDisplayLabel(wire: PanelInternalWireRecord): string {
  return wire.wireId;
}

export function buildPanelInternalWireCatalog({
  graph,
  panelAssetId
}: {
  graph: PanelConnectivityGraph;
  panelAssetId: string;
}): PanelInternalWireCatalogRow[] {
  const terminalLabel = (ref: PanelTerminalSideRef) => {
    const asset = graph.assetsById.get(ref.assetId);
    const terminal = graph.terminalsById.get(
      `terminal:${encodeURIComponent(ref.assetId)}:${encodeURIComponent(ref.terminalKey)}`
    );
    return `${asset?.tag ?? ref.assetId}:${terminal?.label ?? ref.terminalKey}/${ref.side}`;
  };
  return [...graph.internalWiresById.values()]
    .filter(
      (wire) => wire.panelAssetId === panelAssetId && !wire.ownerPatternId
    )
    .map((wire) => {
      const routeOccurrences = graph.source.sheets.flatMap((sheet) =>
        sheet.connections
          .filter((connection) => connection.panelConnectionId === wire.id)
          .map((connection) => ({
            sheetId: sheet.id,
            sheetNumber: sheet.sheetNumber,
            sheetName: sheet.name,
            connectionId: connection.id
          }))
      );
      const routeSheets = routeOccurrences.map((route) => ({
        id: route.sheetId,
        number: route.sheetNumber,
        name: route.sheetName
      }));
      return {
        wire,
        fromLabel: terminalLabel(wire.from),
        toLabel: terminalLabel(wire.to),
        routeSheets,
        routeOccurrences,
        represented: routeSheets.length > 0,
        findings: graph.findings.filter(
          (finding) => finding.panelAssetId === panelAssetId && finding.terminal &&
            (terminalSideNodeId(finding.terminal) === terminalSideNodeId(wire.from) ||
              terminalSideNodeId(finding.terminal) === terminalSideNodeId(wire.to))
        )
      };
    })
    .sort((first, second) => first.wire.wireId.localeCompare(second.wire.wireId, undefined, { numeric: true }));
}
