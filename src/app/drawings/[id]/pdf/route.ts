import { notFound } from "next/navigation";
import { chromium } from "playwright";
import { listApprovedSymbolsForDrawing } from "@/features/symbol_registry/api/public";
import { getDrawingDetail } from "@/features/drawing_canvas/data/queries";
import { buildDrawingPdfPrintHtml } from "@/features/drawing_canvas/logic/services/drawing-pdf-export";
import { renderDrawingToSvg } from "@/features/drawing_canvas/logic/services/drawing-svg-renderer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function safePdfFileName(value: string): string {
  const fileName = value
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return `${fileName || "drawing"}.pdf`;
}

function contentDisposition(fileName: string): string {
  const fallback = fileName.replace(/["\\\r\n]/g, "_");

  return `inline; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

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
  const html = buildDrawingPdfPrintHtml({
    title: drawing.title,
    sheet: drawing.model.sheet,
    svg
  });
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    const pdf = await page.pdf({
      width: `${drawing.model.sheet.width}mm`,
      height: `${drawing.model.sheet.height}mm`,
      margin: {
        top: "0mm",
        right: "0mm",
        bottom: "0mm",
        left: "0mm"
      },
      printBackground: true,
      preferCSSPageSize: true
    });
    const fileName = safePdfFileName(drawing.drawingKey || drawing.title);
    const body = pdf.buffer.slice(
      pdf.byteOffset,
      pdf.byteOffset + pdf.byteLength
    ) as ArrayBuffer;

    return new Response(body, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": contentDisposition(fileName),
        "Cache-Control": "private, max-age=0, must-revalidate"
      }
    });
  } finally {
    await browser.close();
  }
}
