import { notFound } from "next/navigation";
import {
  listDrawingRenderSymbols,
  listDrawingSymbolCatalogSummaries
} from "@/features/symbol_registry/api/public";
import { getDrawingDetail } from "@/features/drawing_canvas/data/queries";
import { DrawingCanvasShell } from "@/features/drawing_canvas/ui/components/drawing-canvas-shell";
import { detailedPanelDrawingsEnabled } from "@/features/drawing_panel_wiring/api/release";
import { collectDrawingSymbolVersionIds } from "@/features/drawing_canvas/logic/services/drawing-symbol-version-references";
import { listWireCatalogEntries } from "@/features/wire_catalog/api/public";

export const dynamic = "force-dynamic";

export default async function DrawingDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const drawing = await getDrawingDetail(id);

  if (!drawing) {
    notFound();
  }
  const [symbols, symbolCatalogSummaries, wireCatalogEntries] = await Promise.all([
    listDrawingRenderSymbols(collectDrawingSymbolVersionIds(drawing.model)),
    listDrawingSymbolCatalogSummaries(),
    listWireCatalogEntries()
  ]);

  return (
    <DrawingCanvasShell
      drawing={drawing}
      symbols={symbols}
      symbolCatalogSummaries={symbolCatalogSummaries}
      wireCatalogEntries={wireCatalogEntries}
      detailedPanelDrawingsEnabled={detailedPanelDrawingsEnabled()}
    />
  );
}
