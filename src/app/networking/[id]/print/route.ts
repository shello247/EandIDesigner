import { notFound } from "next/navigation";
import { listApprovedNetworkSymbolVersionsByIds } from "@/features/symbol_registry/api/public";
import { getNetworkMapDetail } from "@/features/network_maps/data/queries";
import { buildNetworkMapPrintHtml } from "@/features/network_maps/logic/services/network-pdf-export";
import { renderNetworkMapSheetToSvg } from "@/features/network_maps/logic/services/network-svg-renderer";
import { collectReferencedNetworkSymbolVersionIds } from "@/features/network_maps/logic/services/network-library-catalog";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const networkMap = await getNetworkMapDetail(id);

  if (!networkMap) {
    notFound();
  }

  const symbols = await listApprovedNetworkSymbolVersionsByIds(
    collectReferencedNetworkSymbolVersionIds(networkMap.model)
  );

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
