import { notFound } from "next/navigation";
import { listSymbolsForDrawing } from "@/features/symbol_registry/api/public";
import { getDrawingDetail } from "@/features/drawing_canvas/data/queries";
import { buildDrawingPdfPrintHtml } from "@/features/drawing_canvas/logic/services/drawing-pdf-export";
import { toSheetCanvasModel } from "@/features/drawing_canvas/logic/commands/drawing-sheet-commands";
import { renderDrawingToSvg } from "@/features/drawing_canvas/logic/services/drawing-svg-renderer";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const [drawing, symbols] = await Promise.all([
    getDrawingDetail(id),
    listSymbolsForDrawing()
  ]);

  if (!drawing) {
    notFound();
  }

  const sheetCount = drawing.model.sheets.length;
  const pages = drawing.model.sheets.map((sheet, index) => {
    const sheetModel = toSheetCanvasModel(drawing.model, sheet.id);
    const sectionTitle = sheet.sectionTitlePage?.title?.trim();

    return {
      sheet: sheetModel.sheet,
      svg: renderDrawingToSvg({
        model: sheetModel,
        approvedSymbols: symbols,
        showAnchors: false,
        showConnections: true,
        sheetNumber: index + 1,
        sheetCount,
        drawingTitle: drawing.title,
        sheetTitle:
          sheet.kind === "section_title" && sectionTitle
            ? sectionTitle
            : sheet.name,
        sheetKind: sheet.kind,
        sectionTitlePage: sheet.sectionTitlePage
      })
    };
  });

  return new Response(
    buildDrawingPdfPrintHtml({
      title: drawing.title,
      pages,
      drawingUrl: `/drawings/${drawing.id}`
    }),
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, max-age=0, must-revalidate"
      }
    }
  );
}
