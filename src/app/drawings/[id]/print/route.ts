import { notFound } from "next/navigation";
import { listApprovedSymbolsForDrawing } from "@/features/symbol_registry/api/public";
import { getDrawingDetail } from "@/features/drawing_canvas/data/queries";
import { buildDrawingPdfPrintHtml } from "@/features/drawing_canvas/logic/services/drawing-pdf-export";
import { renderDrawingToSvg } from "@/features/drawing_canvas/logic/services/drawing-svg-renderer";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const [drawing, symbols] = await Promise.all([
    getDrawingDetail(id),
    listApprovedSymbolsForDrawing()
  ]);

  if (!drawing) {
    notFound();
  }

  const svg = renderDrawingToSvg({
    model: drawing.model,
    approvedSymbols: symbols,
    showAnchors: false,
    showConnections: true
  });

  return new Response(
    buildDrawingPdfPrintHtml({
      title: drawing.title,
      sheet: drawing.model.sheet,
      svg,
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
