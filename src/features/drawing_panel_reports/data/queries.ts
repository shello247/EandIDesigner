import { listSymbolBomTemplatesForSymbols } from "@/features/bom_creator/api/public";
import type { DrawingAssetRecord } from "@/features/drawing_canvas/api/asset-contracts";
import {
  collectDrawingSymbolVersionIds,
  getDrawingDetailForReports
} from "@/features/drawing_canvas/api/report-contracts";
import { listDrawingRenderSymbols } from "@/features/symbol_registry/api/public";
import type { PanelDeliverableRequest } from "./schema";
import { buildPanelDeliverables } from "../logic/use_cases/build-panel-deliverables";

function componentSymbolIds(
  selections: DrawingAssetRecord["componentSelections"]
): string[] {
  return (selections ?? []).flatMap((selection) => [
    selection.symbolId,
    ...componentSymbolIds(selection.children)
  ]);
}

export async function buildSavedPanelDeliverables(
  drawingId: string,
  request: PanelDeliverableRequest
) {
  const drawing = await getDrawingDetailForReports(drawingId);
  if (!drawing) return null;
  const symbols = await listDrawingRenderSymbols(
    collectDrawingSymbolVersionIds(drawing.model)
  );
  const symbolIds = [...new Set([
    ...(drawing.model.assets ?? []).flatMap((asset) => [
      ...(asset.symbolId ? [asset.symbolId] : []),
      ...componentSymbolIds(asset.componentSelections),
      ...(asset.terminalStrip?.members.flatMap((member) => [
        member.symbolId,
        ...componentSymbolIds(member.componentSelections)
      ]) ?? [])
    ]),
    ...drawing.model.sheets.flatMap((sheet) =>
      sheet.placements.flatMap((placement) =>
        placement.symbolId.startsWith("__") ? [] : [placement.symbolId]
      )
    )
  ])];
  const templates = await listSymbolBomTemplatesForSymbols(symbolIds);
  const bundle = buildPanelDeliverables({
    drawingId: drawing.id,
    drawingKey: drawing.drawingKey,
    drawingTitle: drawing.title,
    drawingStatus: drawing.status,
    model: drawing.model,
    symbols,
    templates,
    request,
    enforceIssuance: true
  });
  return { drawing, symbols, bundle };
}
