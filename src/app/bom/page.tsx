import {
  generateDrawingBom,
  listSymbolBomTemplatesForSymbols
} from "@/features/bom_creator/api/public";
import { getDrawingDetail, listDrawings } from "@/features/drawing_canvas/data/queries";
import { listSymbolsForDrawing } from "@/features/symbol_registry/api/public";
import { BomCreatorShell } from "@/features/bom_creator/ui/components/bom-creator-shell";
import type { DrawingModel } from "@/features/drawing_canvas/data/schema";

export const dynamic = "force-dynamic";

function getDrawingSymbolIds(model: DrawingModel): string[] {
  const symbolIds = new Set<string>();

  for (const asset of model.assets ?? []) {
    if (asset.symbolId) {
      symbolIds.add(asset.symbolId);
    }
  }

  for (const sheet of model.sheets) {
    for (const placement of sheet.placements) {
      if (placement.symbolId) {
        symbolIds.add(placement.symbolId);
      }
    }
  }

  return [...symbolIds];
}

export default async function BomCreatorPage({
  searchParams
}: {
  searchParams: Promise<{ drawingId?: string }>;
}) {
  const { drawingId } = await searchParams;
  const [drawings, drawing] = await Promise.all([
    listDrawings(),
    drawingId ? getDrawingDetail(drawingId) : Promise.resolve(null)
  ]);
  let bom = undefined;

  if (drawing) {
    const symbolIds = getDrawingSymbolIds(drawing.model);
    const [symbols, templates] = await Promise.all([
      listSymbolsForDrawing(),
      listSymbolBomTemplatesForSymbols(symbolIds)
    ]);

    bom = generateDrawingBom({
      drawingId: drawing.id,
      drawingTitle: drawing.title,
      model: drawing.model,
      symbols,
      templates
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-normal">BOM Creator</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Live drawing BOMs generated from drawing assets and symbol mini BOMs.
        </p>
      </div>

      <BomCreatorShell
        drawings={drawings}
        selectedDrawingId={drawingId}
        bom={bom}
      />
    </div>
  );
}
