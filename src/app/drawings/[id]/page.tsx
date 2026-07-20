import { notFound } from "next/navigation";
import { listSymbolsForDrawing } from "@/features/symbol_registry/api/public";
import { getDrawingDetail } from "@/features/drawing_canvas/data/queries";
import { DrawingCanvasShell } from "@/features/drawing_canvas/ui/components/drawing-canvas-shell";
import { detailedPanelDrawingsEnabled } from "@/features/drawing_panel_wiring/api/release";

export const dynamic = "force-dynamic";

export default async function DrawingDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [drawing, symbols] = await Promise.all([
    getDrawingDetail(id),
    listSymbolsForDrawing()
  ]);

  if (!drawing) {
    notFound();
  }

  return (
    <DrawingCanvasShell
      drawing={drawing}
      symbols={symbols}
      detailedPanelDrawingsEnabled={detailedPanelDrawingsEnabled()}
    />
  );
}
