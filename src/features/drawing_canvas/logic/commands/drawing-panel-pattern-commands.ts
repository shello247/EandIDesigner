import {
  deletePanelConnectionPattern,
  type PanelBondEndpoint,
  type PanelConnectionPatternRecord,
  type PanelInternalWireRecord,
  type PanelPatternCommandResult,
  type PanelTerminalSideRef
} from "@/features/drawing_panel_wiring/api/public";
import {
  drawingPackageModelSchema,
  type DrawingConnection,
  type DrawingModel,
  type DrawingPlacement
} from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import {
  applyPanelWiringMutations,
  createPanelWiringSource
} from "../../api/panel-wiring-contracts";
import { toSheetCanvasModel } from "./drawing-sheet-commands";
import { resolvePanelTerminalSideOccurrence } from "./drawing-panel-wire-commands";
import { generateDefaultOrthogonalRoute } from "../services/connection-route-geometry";
import { buildRenderableDrawingSymbols } from "../services/drawing-generated-symbols";
import {
  PANEL_REFERENCE_ANCHOR_KEY,
  createPanelPatternLegendPlacement,
  createPanelReferencePlacement as buildPanelReferencePlacement,
  isGeneratedPanelPatternLegendPlacement,
  isGeneratedPanelReferencePlacement,
  type PanelReferenceKind
} from "../services/drawing-panel-reference-symbols";

type DetailedPanelSheet = DrawingModel["sheets"][number] & {
  panelDrawingContext: {
    kind: "detailed_panel_wiring";
    panelAssetId: string;
  };
};

type SegmentEndpoint =
  | { kind: "terminal"; terminal: PanelTerminalSideRef }
  | {
      kind: "panel_reference";
      panelAssetId: string;
      referenceKind: PanelReferenceKind;
      key?: string;
    };

type PatternSegment = {
  id: string;
  from: SegmentEndpoint;
  to: SegmentEndpoint;
  wireRecordId?: string;
};

function detailedSheet(model: DrawingModel, sheetId: string): DetailedPanelSheet {
  const sheet = model.sheets.find((candidate) => candidate.id === sheetId);
  if (!sheet || sheet.panelDrawingContext?.kind !== "detailed_panel_wiring") {
    throw new Error("Connection patterns can only be represented on a Detailed Panel Drawing.");
  }
  return sheet as DetailedPanelSheet;
}

function visualId(prefix: string): string {
  const suffix = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return `${prefix}_${suffix}`;
}

function updateSheet(
  model: DrawingModel,
  sheetId: string,
  updater: (sheet: DrawingModel["sheets"][number]) => DrawingModel["sheets"][number]
): DrawingModel {
  return drawingPackageModelSchema.parse({
    ...model,
    sheets: model.sheets.map((sheet) =>
      sheet.id === sheetId ? updater(sheet) : sheet
    )
  });
}

function terminalEndpoint(terminal: PanelTerminalSideRef): SegmentEndpoint {
  return { kind: "terminal", terminal };
}

function bondEndpoint(endpoint: PanelBondEndpoint): SegmentEndpoint {
  return endpoint.kind === "terminal"
    ? terminalEndpoint(endpoint.terminal)
    : endpoint;
}

function patternSegments(
  pattern: PanelConnectionPatternRecord
): PatternSegment[] {
  if (pattern.recordType === "bond") {
    if (!pattern.record.source || !pattern.record.target) {
      throw new Error("Legacy bond records require review before they can be represented.");
    }
    return [
      {
        id: `${pattern.record.id}:segment:1`,
        from: terminalEndpoint(pattern.record.source),
        to: bondEndpoint(pattern.record.target)
      }
    ];
  }
  const definition = pattern.record.definition;
  if (!definition) {
    throw new Error("Legacy bridge records require review before they can be represented.");
  }
  if (definition.topology === "terminal_jumper" || definition.topology === "daisy_chain") {
    return definition.orderedMembers.slice(0, -1).map((member, index) => ({
      id: `${pattern.record.id}:segment:${index + 1}`,
      from: terminalEndpoint(member),
      to: terminalEndpoint(definition.orderedMembers[index + 1]),
      wireRecordId:
        definition.topology === "daisy_chain"
          ? definition.internalWireIds[index]
          : undefined
    }));
  }
  if (definition.topology === "bridge_bar") {
    return definition.orderedMembers.slice(1).map((member, index) => ({
      id: `${pattern.record.id}:segment:${index + 1}`,
      from: terminalEndpoint(definition.orderedMembers[0]),
      to: terminalEndpoint(member)
    }));
  }
  if (definition.topology === "distribution") {
    return definition.branches.map((branch, index) => ({
      id: `${pattern.record.id}:segment:${index + 1}`,
      from: terminalEndpoint(definition.source),
      to: terminalEndpoint(branch.target),
      wireRecordId: branch.wireId
    }));
  }
  return definition.branches.flatMap((branch, index) => [
    {
      id: `${pattern.record.id}:segment:${index + 1}:feed`,
      from: terminalEndpoint(definition.source),
      to: terminalEndpoint(branch.protectionInput),
      wireRecordId: branch.feedWireId
    },
    {
      id: `${pattern.record.id}:segment:${index + 1}:load`,
      from: terminalEndpoint(branch.protectionOutput),
      to: terminalEndpoint(branch.target),
      wireRecordId: branch.loadWireId
    }
  ]);
}

function findPattern(
  model: DrawingModel,
  patternId: string
): PanelConnectionPatternRecord {
  const bridge = model.panelWiring?.bridges.find(
    (candidate) => candidate.id === patternId
  );
  if (bridge) return { recordType: "bridge", record: bridge };
  const bond = model.panelWiring?.bonds.find(
    (candidate) => candidate.id === patternId
  );
  if (bond) return { recordType: "bond", record: bond };
  throw new Error("The connection pattern no longer exists.");
}

function referencePlacementKey(
  placement: DrawingPlacement
): string | undefined {
  return isGeneratedPanelReferencePlacement(placement)
    ? [
        placement.panelReference.panelAssetId,
        placement.panelReference.referenceKind,
        placement.panelReference.key ?? "default"
      ].join(":")
    : undefined;
}

export function createPanelReferencePlacement({
  model,
  sheetId,
  panelAssetId,
  referenceKind,
  key
}: {
  model: DrawingModel;
  sheetId: string;
  panelAssetId: string;
  referenceKind: PanelReferenceKind;
  key?: string;
}): { model: DrawingModel; placement: DrawingPlacement; created: boolean } {
  const sheet = detailedSheet(model, sheetId);
  if (sheet.panelDrawingContext.panelAssetId !== panelAssetId) {
    throw new Error("The panel reference belongs to a different panel.");
  }
  const lookupKey = [panelAssetId, referenceKind, key ?? "default"].join(":");
  const existing = sheet.placements.find(
    (placement) => referencePlacementKey(placement) === lookupKey
  );
  if (existing) return { model, placement: existing, created: false };
  const referenceCount = sheet.placements.filter(isGeneratedPanelReferencePlacement).length;
  const placement = buildPanelReferencePlacement({
    panelAssetId,
    referenceKind,
    key,
    x: Math.max(24, sheet.page.width - 54),
    y: 72 + referenceCount * 24
  });
  return {
    model: updateSheet(model, sheetId, (candidate) => ({
      ...candidate,
      placements: [...candidate.placements, placement]
    })),
    placement,
    created: true
  };
}

export function ensurePanelPatternLegend({
  model,
  sheetId
}: {
  model: DrawingModel;
  sheetId: string;
}): { model: DrawingModel; placement: DrawingPlacement; created: boolean } {
  const sheet = detailedSheet(model, sheetId);
  const existing = sheet.placements.find(isGeneratedPanelPatternLegendPlacement);
  if (existing) {
    return { model, placement: existing, created: false };
  }
  const placement = createPanelPatternLegendPlacement(sheet.page);
  return {
    model: updateSheet(model, sheetId, (candidate) => ({
      ...candidate,
      placements: [...candidate.placements, placement]
    })),
    placement,
    created: true
  };
}

export function restorePanelPatternLegend({
  model,
  sheetId
}: {
  model: DrawingModel;
  sheetId: string;
}): DrawingModel {
  const ensured = ensurePanelPatternLegend({ model, sheetId });
  return updateSheet(ensured.model, sheetId, (sheet) => ({
    ...sheet,
    placements: sheet.placements.map((placement) =>
      placement.id === ensured.placement.id
        ? { ...placement, panelPatternLegend: { visible: true } }
        : placement
    )
  }));
}

export function setPanelPatternLegendVisibility({
  model,
  sheetId,
  visible
}: {
  model: DrawingModel;
  sheetId: string;
  visible: boolean;
}): DrawingModel {
  const ensured = ensurePanelPatternLegend({ model, sheetId });
  return updateSheet(ensured.model, sheetId, (sheet) => ({
    ...sheet,
    placements: sheet.placements.map((placement) =>
      placement.id === ensured.placement.id
        ? { ...placement, panelPatternLegend: { visible } }
        : placement
    )
  }));
}

function resolveEndpoint({
  model,
  symbols,
  sheetId,
  endpoint
}: {
  model: DrawingModel;
  symbols: ApprovedDrawingSymbol[];
  sheetId: string;
  endpoint: SegmentEndpoint;
}) {
  if (endpoint.kind === "terminal") {
    const resolved = resolvePanelTerminalSideOccurrence({
      model,
      symbols,
      sheetId,
      terminal: endpoint.terminal
    });
    return {
      model,
      endpoint: {
        placementId: resolved.placementId,
        anchorKey: resolved.anchorKey
      }
    };
  }
  const reference = createPanelReferencePlacement({
    model,
    sheetId,
    panelAssetId: endpoint.panelAssetId,
    referenceKind: endpoint.referenceKind,
    key: endpoint.key
  });
  return {
    model: reference.model,
    endpoint: {
      placementId: reference.placement.id,
      anchorKey: PANEL_REFERENCE_ANCHOR_KEY
    }
  };
}

function buildPatternConnections({
  model: inputModel,
  symbols,
  sheetId,
  pattern
}: {
  model: DrawingModel;
  symbols: ApprovedDrawingSymbol[];
  sheetId: string;
  pattern: PanelConnectionPatternRecord;
}): { model: DrawingModel; connections: DrawingConnection[] } {
  let model = inputModel;
  const connections: DrawingConnection[] = [];
  for (const segment of patternSegments(pattern)) {
    const from = resolveEndpoint({ model, symbols, sheetId, endpoint: segment.from });
    model = from.model;
    const to = resolveEndpoint({ model, symbols, sheetId, endpoint: segment.to });
    model = to.model;
    const connection: DrawingConnection = {
      id: visualId("panel_pattern_route"),
      from: from.endpoint,
      to: to.endpoint,
      panelConnectionId: segment.wireRecordId,
      panelPatternId: pattern.record.id,
      panelPatternSegmentId: segment.id
    };
    const canvasModel = toSheetCanvasModel(model, sheetId);
    const renderableSymbols = buildRenderableDrawingSymbols({
      placements: canvasModel.placements,
      approvedSymbols: symbols,
      assets: model.assets
    });
    const route = generateDefaultOrthogonalRoute({
      model: canvasModel,
      symbols: renderableSymbols,
      connection,
      mode: "auto"
    });
    connections.push(route ? { ...connection, route } : connection);
  }
  return { model, connections };
}

export function addPanelPatternRouteOccurrence({
  model,
  symbols,
  sheetId,
  patternId
}: {
  model: DrawingModel;
  symbols: ApprovedDrawingSymbol[];
  sheetId: string;
  patternId: string;
}): {
  model: DrawingModel;
  pattern: PanelConnectionPatternRecord;
  connections: DrawingConnection[];
} {
  const sheet = detailedSheet(model, sheetId);
  const pattern = findPattern(model, patternId);
  if (sheet.panelDrawingContext.panelAssetId !== pattern.record.panelAssetId) {
    throw new Error("This connection pattern belongs to a different panel.");
  }
  if (sheet.connections.some((connection) => connection.panelPatternId === patternId)) {
    throw new Error("This connection pattern is already represented on the sheet.");
  }
  const built = buildPatternConnections({ model, symbols, sheetId, pattern });
  const withConnections = updateSheet(built.model, sheetId, (candidate) => ({
    ...candidate,
    connections: [...candidate.connections, ...built.connections]
  }));
  return {
    model: restorePanelPatternLegend({ model: withConnections, sheetId }),
    pattern,
    connections: built.connections
  };
}

export function createPanelPatternWithRoutes({
  model,
  symbols,
  sheetId,
  result
}: {
  model: DrawingModel;
  symbols: ApprovedDrawingSymbol[];
  sheetId: string;
  result: PanelPatternCommandResult;
}) {
  if (!result.pattern || result.mutations.length === 0) {
    throw new Error(result.warnings[0]?.message ?? "The connection pattern is invalid.");
  }
  const withPattern = applyPanelWiringMutations(model, result.mutations);
  return addPanelPatternRouteOccurrence({
    model: withPattern,
    symbols,
    sheetId,
    patternId: result.pattern.record.id
  });
}

export function removePanelPatternRouteOccurrence({
  model,
  sheetId,
  patternId
}: {
  model: DrawingModel;
  sheetId: string;
  patternId: string;
}): DrawingModel {
  detailedSheet(model, sheetId);
  return updateSheet(model, sheetId, (sheet) => ({
    ...sheet,
    connections: sheet.connections.filter(
      (connection) => connection.panelPatternId !== patternId
    )
  }));
}

function removeUnreferencedPanelReferences(model: DrawingModel): DrawingModel {
  return drawingPackageModelSchema.parse({
    ...model,
    sheets: model.sheets.map((sheet) => {
      const referencedPlacementIds = new Set(
        sheet.connections.flatMap((connection) => [
          connection.from.placementId,
          connection.to.placementId
        ])
      );
      return {
        ...sheet,
        placements: sheet.placements.filter(
          (placement) =>
            !isGeneratedPanelReferencePlacement(placement) ||
            referencedPlacementIds.has(placement.id)
        )
      };
    })
  });
}

export function deletePanelPatternAndRoutes({
  model,
  symbols,
  patternId
}: {
  model: DrawingModel;
  symbols: ApprovedDrawingSymbol[];
  patternId: string;
}): DrawingModel {
  const result = deletePanelConnectionPattern(
    createPanelWiringSource(model, symbols),
    patternId
  );
  const ownedWireIds = new Set((result.wires ?? []).map((wire) => wire.id));
  const withoutPattern = applyPanelWiringMutations(model, result.mutations);
  const withoutRoutes = drawingPackageModelSchema.parse({
    ...withoutPattern,
    sheets: withoutPattern.sheets.map((sheet) => ({
      ...sheet,
      connections: sheet.connections.filter(
        (connection) =>
          connection.panelPatternId !== patternId &&
          (!connection.panelConnectionId ||
            !ownedWireIds.has(connection.panelConnectionId))
      )
    }))
  });
  return removeUnreferencedPanelReferences(withoutRoutes);
}

export function ownedPatternWire(
  model: DrawingModel,
  connection: DrawingConnection
): PanelInternalWireRecord | undefined {
  return connection.panelConnectionId
    ? model.panelWiring?.internalWires.find(
        (wire) =>
          wire.id === connection.panelConnectionId &&
          wire.ownerPatternId === connection.panelPatternId
      )
    : undefined;
}
