import type { DrawingModel } from "../../data/schema";

function sameValue(first: unknown, second: unknown): boolean {
  return JSON.stringify(first) === JSON.stringify(second);
}

function detailedPanelSheets(model: DrawingModel) {
  return new Map(
    model.sheets
      .filter((sheet) => sheet.panelDrawingContext)
      .map((sheet) => [sheet.id, sheet] as const)
  );
}

function protectedAssetIds(model: DrawingModel): Set<string> {
  const ids = new Set<string>();
  for (const sheet of model.sheets) {
    if (!sheet.panelDrawingContext) continue;
    ids.add(sheet.panelDrawingContext.panelAssetId);
    for (const placement of sheet.placements) {
      if (placement.assetId) ids.add(placement.assetId);
      if (placement.containerAssetId) ids.add(placement.containerAssetId);
      if (placement.panelReference) ids.add(placement.panelReference.panelAssetId);
    }
  }
  for (const mapping of model.panelWiring?.terminalMappings ?? []) {
    ids.add(mapping.panelAssetId);
    ids.add(mapping.target.assetId);
  }
  for (const wire of model.panelWiring?.internalWires ?? []) {
    ids.add(wire.panelAssetId);
    ids.add(wire.from.assetId);
    ids.add(wire.to.assetId);
  }
  for (const bridge of model.panelWiring?.bridges ?? []) {
    ids.add(bridge.panelAssetId);
    bridge.members.forEach((member) => ids.add(member.assetId));
  }
  for (const bond of model.panelWiring?.bonds ?? []) {
    ids.add(bond.panelAssetId);
    bond.endpoints.forEach((endpoint) => {
      if (endpoint.kind === "terminal") ids.add(endpoint.terminal.assetId);
      else ids.add(endpoint.panelAssetId);
    });
  }
  return ids;
}

export function containsDetailedPanelDrawings(model: DrawingModel): boolean {
  return model.sheets.some((sheet) => Boolean(sheet.panelDrawingContext));
}

export function hasDetailedPanelMutation(
  previous: DrawingModel,
  next: DrawingModel
): boolean {
  if (!sameValue(previous.panelWiring, next.panelWiring)) return true;

  const previousSheets = detailedPanelSheets(previous);
  const nextSheets = detailedPanelSheets(next);
  const sheetIds = new Set([...previousSheets.keys(), ...nextSheets.keys()]);
  for (const sheetId of sheetIds) {
    if (!sameValue(previousSheets.get(sheetId), nextSheets.get(sheetId))) {
      return true;
    }
  }

  const assetIds = new Set([
    ...protectedAssetIds(previous),
    ...protectedAssetIds(next)
  ]);
  const previousAssets = new Map(
    (previous.assets ?? []).map((asset) => [asset.id, asset])
  );
  const nextAssets = new Map((next.assets ?? []).map((asset) => [asset.id, asset]));
  for (const assetId of assetIds) {
    if (!sameValue(previousAssets.get(assetId), nextAssets.get(assetId))) {
      return true;
    }
  }
  return false;
}
