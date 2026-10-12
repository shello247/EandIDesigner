import {
  collectDrawingSymbolVersionIds
} from "@/features/drawing_canvas/api/report-contracts";
import { listDrawingRenderSymbols } from "@/features/symbol_registry/api/public";
import { loadDrawingProducts } from "@/features/drawing_canvas/api/product-server";
import {
  getPanelAnalysisDrawingSource,
  listPanelAnalysisDrawingPage
} from "../data/queries";
import { buildSavedPanelAnalysis } from "../logic/use_cases/build-panel-analysis";

export { listPanelAnalysisDrawingPage };
export { getPanelAnalysisDrawingSource };

export async function getSavedPanelAnalysis(drawingId: string) {
  const drawing = await getPanelAnalysisDrawingSource(drawingId);
  if (!drawing) return null;
  const [symbols, products] = await Promise.all([
    listDrawingRenderSymbols(collectDrawingSymbolVersionIds(drawing.model)),
    loadDrawingProducts(drawing.model)
  ]);
  return buildSavedPanelAnalysis({ drawing, symbols, products });
}
