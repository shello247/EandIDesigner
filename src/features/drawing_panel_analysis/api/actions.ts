"use server";

import { ZodError } from "zod";
import {loadSelectedProductBom} from "@/features/bom_creator/api/product-server";
import {
  generateBomFromProjection,
  listSymbolBomTemplatesForSymbols
} from "@/features/bom_creator/api/public";
import { collectDrawingSymbolVersionIds } from "@/features/drawing_canvas/api/report-contracts";
import { listDrawingRenderSymbols } from "@/features/symbol_registry/api/public";
import {
  panelAnalysisBomRequestSchema,
  panelAnalysisBomResultSchema
} from "../data/schema";
import {
  getPanelAnalysisDrawingRevision,
  getPanelAnalysisDrawingSource
} from "../data/queries";
import { buildSavedPanelAnalysis } from "../logic/use_cases/build-panel-analysis";
import type {
  PanelAnalysisActionResult,
  PanelAnalysisBomRequest,
  PanelAnalysisBomResult
} from "../types";

export async function loadPanelAnalysisBomAction(
  input: PanelAnalysisBomRequest
): Promise<PanelAnalysisActionResult<PanelAnalysisBomResult>> {
  try {
    const request = panelAnalysisBomRequestSchema.parse(input);
    const drawing = await getPanelAnalysisDrawingSource(request.drawingId);
    if (!drawing) {
      return { ok: false, code: "not_found", error: "The drawing no longer exists." };
    }
    if (drawing.updatedAt !== request.expectedUpdatedAt) {
      return {
        ok: false,
        code: "conflict",
        error: "The saved drawing changed. Reload Panel Analysis before loading materials."
      };
    }

    const symbols = await listDrawingRenderSymbols(
      collectDrawingSymbolVersionIds(drawing.model)
    );
    const analysis = buildSavedPanelAnalysis({ drawing, symbols });
    const selectedSchedules = request.panelAssetId
      ? analysis.schedules.filter(
          (panel) => panel.panelAssetId === request.panelAssetId
        )
      : analysis.schedules;
    if (request.panelAssetId && selectedSchedules.length === 0) {
      return { ok: false, code: "validation", error: "Select a valid panel." };
    }

    const symbolIds = [...new Set(
      selectedSchedules.flatMap((panel) =>
        panel.bomProjection.assemblies.flatMap((assembly) =>
          assembly.symbolId && !assembly.symbolId.startsWith("__")
            ? [assembly.symbolId]
            : []
        )
      )
    )];
    const [templates,selectedProducts] = await Promise.all([listSymbolBomTemplatesForSymbols(symbolIds),loadSelectedProductBom(drawing.model,symbols)]);
    const finalRevision = await getPanelAnalysisDrawingRevision(request.drawingId);
    if (finalRevision !== request.expectedUpdatedAt) {
      return {
        ok: false,
        code: "conflict",
        error: "The saved drawing changed while materials were loading. Reload Panel Analysis."
      };
    }

    return {
      ok: true,
      data: panelAnalysisBomResultSchema.parse({
        savedAt: finalRevision,
        panels: selectedSchedules.map((panel) => ({
          panelAssetId: panel.panelAssetId,
          panelTag: panel.panelTag,
          information: panel.bomProjection.information,
          bom: generateBomFromProjection({
            drawingId: drawing.id,
            drawingTitle: `${drawing.title} - ${panel.panelTag}`,
            assemblies: panel.bomProjection.assemblies,
            symbols,
            templates,selectedProducts
          })
        }))
      })
    };
  } catch (error) {
    return {
      ok: false,
      code: error instanceof ZodError ? "validation" : "unavailable",
      error:
        error instanceof ZodError
          ? "The materials request is invalid."
          : error instanceof Error
            ? error.message
            : "Materials could not be loaded."
    };
  }
}
