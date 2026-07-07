import { notFound } from "next/navigation";
import { chromium } from "playwright";
import { listSymbolsForDrawing } from "@/features/symbol_registry/api/public";
import { getDrawingDetail } from "@/features/drawing_canvas/data/queries";
import { buildDrawingPdfPrintHtml } from "@/features/drawing_canvas/logic/services/drawing-pdf-export";
import { toSheetCanvasModel } from "@/features/drawing_canvas/logic/commands/drawing-sheet-commands";
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
  const firstPage = pages[0];

  if (!firstPage) {
    throw new Error("Drawing does not contain any sheets.");
  }

  const firstSheet = firstPage.sheet;
  const html = buildDrawingPdfPrintHtml({
    title: drawing.title,
    pages
  });
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    const pdf = await page.pdf({
      width: `${firstSheet.width}mm`,
      height: `${firstSheet.height}mm`,
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
