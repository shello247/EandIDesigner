import { notFound } from "next/navigation";
import { listNetworkSymbolsForMapping } from "@/features/symbol_registry/api/public";
import { getNetworkMapDetail } from "@/features/network_maps/data/queries";
import { buildNetworkMapPrintHtml } from "@/features/network_maps/logic/services/network-pdf-export";
import { renderNetworkMapSheetToSvg } from "@/features/network_maps/logic/services/network-svg-renderer";

export const dynamic = "force-dynamic";

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

  return new Response(
    buildNetworkMapPrintHtml({
      title: networkMap.title,
      pages,
      networkMapUrl: `/networking/${networkMap.id}`
    }),
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, max-age=0, must-revalidate"
      }
    }
  );
}
