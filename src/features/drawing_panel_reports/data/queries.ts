import { listSymbolBomTemplatesForSymbols } from "@/features/bom_creator/api/public";
import { getDrawingDetailForReports } from "@/features/drawing_canvas/api/report-contracts";
import { listSymbolsForDrawing } from "@/features/symbol_registry/api/public";
import type { PanelDeliverableRequest } from "./schema";
import { buildPanelDeliverables } from "../logic/use_cases/build-panel-deliverables";

export async function buildSavedPanelDeliverables(
  drawingId: string,
  request: PanelDeliverableRequest
) {
  const drawing = await getDrawingDetailForReports(drawingId);
  if (!drawing) return null;
  const symbols = await listSymbolsForDrawing();
  const symbolIds = [...new Set([
    ...(drawing.model.assets ?? []).flatMap((asset) => asset.symbolId ? [asset.symbolId] : []),
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
