import { notFound } from "next/navigation";
import { chromium } from "playwright";
import { listNetworkSymbolsForMapping } from "@/features/symbol_registry/api/public";
import { getNetworkMapDetail } from "@/features/network_maps/data/queries";
import { buildNetworkMapPrintHtml } from "@/features/network_maps/logic/services/network-pdf-export";
import { renderNetworkMapSheetToSvg } from "@/features/network_maps/logic/services/network-svg-renderer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function safePdfFileName(value: string): string {
  const fileName = value
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return `${fileName || "network_map"}.pdf`;
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
  const [networkMap, symbols] = await Promise.all([
    getNetworkMapDetail(id),
    listNetworkSymbolsForMapping()
  ]);

  if (!networkMap) {
    notFound();
  }

  const sheetCount = networkMap.model.sheets.length;
  const pages = networkMap.model.sheets.map((sheet, index) => ({
    page: sheet.page,
    svg: renderNetworkMapSheetToSvg({
      model: networkMap.model,
      sheet,
      approvedSymbols: symbols,
      mapTitle: networkMap.title,
      sheetNumber: index + 1,
      sheetCount
    })
  }));
  const firstPage = pages[0];

  if (!firstPage) {
    throw new Error("Network map does not contain any sheets.");
  }

  const html = buildNetworkMapPrintHtml({
    title: networkMap.title,
    pages
  });
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    const pdf = await page.pdf({
      width: `${firstPage.page.width}mm`,
      height: `${firstPage.page.height}mm`,
      margin: {
        top: "0mm",
        right: "0mm",
        bottom: "0mm",
        left: "0mm"
      },
      printBackground: true,
      preferCSSPageSize: true
    });
    const fileName = safePdfFileName(networkMap.mapKey || networkMap.title);
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
