import { notFound } from "next/navigation";
import { SymbolBomPanelLoader } from "@/features/bom_creator/ui/components/symbol-bom-panel-loader";
import { getSymbolDetail } from "@/features/symbol_registry/data/queries";
import { SymbolDetailPanel } from "@/features/symbol_registry/ui/components/symbol-detail-panel";
import { listComponentAlternativeCandidates } from "@/features/symbol_components/api/server";

export const dynamic = "force-dynamic";

export default async function SymbolDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [symbol, componentAlternatives] = await Promise.all([
    getSymbolDetail(id),
    listComponentAlternativeCandidates()
  ]);

  if (!symbol) {
    notFound();
  }

  return (
    <SymbolDetailPanel
      symbol={symbol}
      componentAlternatives={componentAlternatives}
      bomPanel={
        <SymbolBomPanelLoader symbolId={symbol.id} />
      }
    />
  );
}
