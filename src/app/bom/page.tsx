import { redirect } from "next/navigation";
import {
  buildGeneratedBomViewUrl,
  generateDrawingBom,
  listBomGenerationTemplatesForSymbols,
  parseGeneratedBomViewSearchParams,
  selectGeneratedBomView
} from "@/features/bom_creator/api/public";
import { BomCreatorShell } from "@/features/bom_creator/ui/components/bom-creator-shell";
import { GeneratedBomTable } from "@/features/bom_creator/ui/components/generated-bom-table";
import {
  getDrawingBomSource,
  listDrawingBomOptions
} from "@/features/drawing_canvas/api/public";
import type { DrawingModel } from "@/features/drawing_canvas/api/asset-contracts";
import { listSymbolIdentitiesByIds } from "@/features/symbol_registry/api/public";

export const dynamic = "force-dynamic";

function getDrawingSymbolIds(model: DrawingModel): string[] {
  const symbolIds = new Set<string>();

  for (const asset of model.assets ?? []) {
    if (asset.symbolId) symbolIds.add(asset.symbolId);
  }

  for (const sheet of model.sheets) {
    for (const placement of sheet.placements) {
      if (placement.symbolId) symbolIds.add(placement.symbolId);
    }
  }

  return [...symbolIds];
}

export default async function BomCreatorPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const drawingId = Array.isArray(params.drawingId)
    ? params.drawingId[0]
    : params.drawingId;
  const [drawings, drawing] = await Promise.all([
    listDrawingBomOptions(),
    drawingId ? getDrawingBomSource(drawingId) : Promise.resolve(null)
  ]);
  let viewModel;

  if (drawing) {
    const symbolIds = getDrawingSymbolIds(drawing.model);
    const [symbols, templates] = await Promise.all([
      listSymbolIdentitiesByIds(symbolIds),
      listBomGenerationTemplatesForSymbols(symbolIds)
    ]);
    const bom = generateDrawingBom({
      drawingId: drawing.id,
      drawingTitle: drawing.title,
      model: drawing.model,
      symbols,
      templates
    });
    const viewInput = parseGeneratedBomViewSearchParams(params);
    viewModel = selectGeneratedBomView(bom, viewInput);

    if (viewModel.page !== viewInput.page) {
      redirect(
        buildGeneratedBomViewUrl({
          drawingId: drawing.id,
          view: viewModel.view,
          page: viewModel.page,
          pageSize: viewModel.pageSize
        })
      );
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-normal">BOM Creator</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Live drawing BOMs generated from drawing assets and symbol mini BOMs.
        </p>
      </div>
      <BomCreatorShell drawings={drawings} selectedDrawingId={drawingId} />
      {viewModel ? (
        <GeneratedBomTable bom={viewModel} />
      ) : (
        <div className="tool-panel flex min-h-[260px] items-center justify-center p-8 text-center">
          <div><h2 className="text-lg font-bold">No drawing selected</h2><p className="mt-2 max-w-md text-sm text-slate-600">Select a drawing package to generate its live BOM.</p></div>
        </div>
      )}
    </div>
  );
}
