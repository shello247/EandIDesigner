import {
  createInternalPanelWire,
  deleteInternalPanelWire,
  updateInternalPanelWire,
  type PanelInternalWireRecord,
  type PanelTerminalSideRef,
  type PanelWireAttributes
} from "@/features/drawing_panel_wiring/api/public";
import {
  drawingPackageModelSchema,
  type DrawingConnection,
  type DrawingModel
} from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import {
  applyPanelWiringMutations,
  createPanelWiringSource
} from "../../api/panel-wiring-contracts";
import { toSheetCanvasModel } from "./drawing-sheet-commands";
import { generateDefaultOrthogonalRoute } from "../services/connection-route-geometry";
import { buildRenderableDrawingSymbols } from "../services/drawing-generated-symbols";
import {
  buildGuidedConnectionRoute,
  type GuidedConnectionWaypoint
} from "../services/guided-connection-routing";
import type { WireSpecificationSnapshot } from "@/features/wire_catalog/api/public";

export type PanelWireOccurrenceEndpoint = {
  terminal: PanelTerminalSideRef;
  placementId: string;
  anchorKey: string;
  assetTag: string;
  terminalLabel: string;
};

type DetailedPanelSheet = DrawingModel["sheets"][number] & {
  panelDrawingContext: {
    kind: "detailed_panel_wiring";
    panelAssetId: string;
  };
};

function detailedSheet(model: DrawingModel, sheetId: string): DetailedPanelSheet {
  const sheet = model.sheets.find((candidate) => candidate.id === sheetId);
  if (!sheet || sheet.panelDrawingContext?.kind !== "detailed_panel_wiring") {
    throw new Error("Internal wires can only be authored on a Detailed Panel Drawing.");
  }
  return sheet as DetailedPanelSheet;
}

export function resolvePanelTerminalSideOccurrence({
  model,
  symbols,
  sheetId,
  terminal
}: {
  model: DrawingModel;
  symbols: ApprovedDrawingSymbol[];
  sheetId: string;
  terminal: PanelTerminalSideRef;
}): PanelWireOccurrenceEndpoint {
  const source = createPanelWiringSource(model, symbols);
  const sheet = source.sheets.find((candidate) => candidate.id === sheetId);
  const occurrence = sheet?.occurrences.find(
    (candidate) => candidate.assetId === terminal.assetId
  );
  const definition = occurrence?.terminals.find(
    (candidate) => candidate.terminalKey === terminal.terminalKey
  );
  const anchor = definition?.anchors.find(
    (candidate) => candidate.sideHint === terminal.side
  );
  const asset = source.assets.find((candidate) => candidate.id === terminal.assetId);
  if (!occurrence || !definition || !anchor || !asset) {
    throw new Error("The terminal side is not represented by an available sheet anchor.");
  }
  return {
    terminal,
    placementId: occurrence.placementId,
    anchorKey: anchor.anchorKey,
    assetTag: asset.tag,
    terminalLabel: definition.label
  };
}

function routeId(): string {
  const suffix = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return `panel_route_${suffix}`;
}

export function buildPanelWireRoute({
  model,
  symbols,
  sheetId,
  wire,
  routeWaypoints
}: {
  model: DrawingModel;
  symbols: ApprovedDrawingSymbol[];
  sheetId: string;
  wire: PanelInternalWireRecord;
  routeWaypoints?: GuidedConnectionWaypoint[];
}): DrawingConnection {
  if (wire.ownerPatternId) {
    throw new Error("Represent this wire through its owning connection pattern.");
  }
  const sheet = detailedSheet(model, sheetId);
  if (sheet.panelDrawingContext.panelAssetId !== wire.panelAssetId) {
    throw new Error("This internal wire belongs to a different panel.");
  }
  if (sheet.connections.some((connection) => connection.panelConnectionId === wire.id)) {
    throw new Error("This internal wire is already represented on the sheet.");
  }
  const from = resolvePanelTerminalSideOccurrence({ model, symbols, sheetId, terminal: wire.from });
  const to = resolvePanelTerminalSideOccurrence({ model, symbols, sheetId, terminal: wire.to });
  const connection: DrawingConnection = {
    id: routeId(),
    from: { placementId: from.placementId, anchorKey: from.anchorKey },
    to: { placementId: to.placementId, anchorKey: to.anchorKey },
    panelConnectionId: wire.id
  };
  const canvasModel = toSheetCanvasModel(model, sheetId);
  const renderableSymbols = buildRenderableDrawingSymbols({
    placements: canvasModel.placements,
    approvedSymbols: symbols,
    assets: model.assets
  });
  const route = routeWaypoints
    ? buildGuidedConnectionRoute({
        model: canvasModel,
        symbols: renderableSymbols,
        connection,
        waypoints: routeWaypoints
      })
    : generateDefaultOrthogonalRoute({
        model: canvasModel,
        symbols: renderableSymbols,
        connection,
        mode: "auto"
      });
  if (routeWaypoints && !route) {
    throw new Error(
      "The guided route cannot be completed inside the printable sheet. Adjust a bend and try again."
    );
  }
  return route ? { ...connection, route } : connection;
}

function addRoute(model: DrawingModel, sheetId: string, connection: DrawingConnection): DrawingModel {
  return drawingPackageModelSchema.parse({
    ...model,
    sheets: model.sheets.map((sheet) =>
      sheet.id === sheetId
        ? { ...sheet, connections: [...sheet.connections, connection] }
        : sheet
    )
  });
}

export function createInternalPanelWireRoute({
  model,
  symbols,
  sheetId,
  from,
  to,
  wireId,
  specification,
  attributes,
  routeWaypoints
}: {
  model: DrawingModel;
  symbols: ApprovedDrawingSymbol[];
  sheetId: string;
  from: PanelTerminalSideRef;
  to: PanelTerminalSideRef;
  wireId?: string;
  specification?: WireSpecificationSnapshot;
  attributes?: PanelWireAttributes;
  routeWaypoints?: GuidedConnectionWaypoint[];
}): { model: DrawingModel; wire: PanelInternalWireRecord; connection: DrawingConnection } {
  const sheet = detailedSheet(model, sheetId);
  const result = createInternalPanelWire(createPanelWiringSource(model, symbols), {
    panelAssetId: sheet.panelDrawingContext.panelAssetId,
    from,
    to,
    wireId,
    specification,
    attributes
  });
  if (!result.wire || result.warnings.some((finding) => finding.severity === "error")) {
    throw new Error(result.warnings[0]?.message ?? "The internal wire is invalid.");
  }
  const withWire = applyPanelWiringMutations(model, result.mutations);
  const connection = buildPanelWireRoute({
    model: withWire,
    symbols,
    sheetId,
    wire: result.wire,
    routeWaypoints
  });
  return { model: addRoute(withWire, sheetId, connection), wire: result.wire, connection };
}

export function addInternalWireRouteOccurrence({
  model,
  symbols,
  sheetId,
  wireRecordId
}: {
  model: DrawingModel;
  symbols: ApprovedDrawingSymbol[];
  sheetId: string;
  wireRecordId: string;
}) {
  const wire = model.panelWiring?.internalWires.find((candidate) => candidate.id === wireRecordId);
  if (!wire) throw new Error("The internal wire no longer exists.");
  const connection = buildPanelWireRoute({ model, symbols, sheetId, wire });
  return { model: addRoute(model, sheetId, connection), connection, wire };
}

export function updateInternalPanelWireCommand({
  model,
  symbols,
  id,
  wireId,
  specification,
  attributes
}: {
  model: DrawingModel;
  symbols: ApprovedDrawingSymbol[];
  id: string;
  wireId?: string;
  specification?: WireSpecificationSnapshot;
  attributes?: PanelWireAttributes;
}): DrawingModel {
  const result = updateInternalPanelWire(createPanelWiringSource(model, symbols), {
    id,
    wireId,
    specification,
    attributes
  });
  return applyPanelWiringMutations(model, result.mutations);
}

export function deleteInternalWireRouteOccurrence({
  model,
  sheetId,
  connectionId
}: {
  model: DrawingModel;
  sheetId: string;
  connectionId: string;
}): DrawingModel {
  return drawingPackageModelSchema.parse({
    ...model,
    sheets: model.sheets.map((sheet) =>
      sheet.id === sheetId
        ? { ...sheet, connections: sheet.connections.filter((connection) => connection.id !== connectionId) }
        : sheet
    )
  });
}

export function deleteInternalWireAndRoutes({
  model,
  symbols,
  wireRecordId
}: {
  model: DrawingModel;
  symbols: ApprovedDrawingSymbol[];
  wireRecordId: string;
}): DrawingModel {
  const wire = model.panelWiring?.internalWires.find(
    (candidate) => candidate.id === wireRecordId
  );
  if (wire?.ownerPatternId) {
    throw new Error("Pattern-owned wires must be deleted with their connection pattern.");
  }
  const result = deleteInternalPanelWire(createPanelWiringSource(model, symbols), wireRecordId);
  const withoutRecord = applyPanelWiringMutations(model, result.mutations);
  return drawingPackageModelSchema.parse({
    ...withoutRecord,
    sheets: withoutRecord.sheets.map((sheet) => ({
      ...sheet,
      connections: sheet.connections.filter((connection) => connection.panelConnectionId !== wireRecordId)
    }))
  });
}
