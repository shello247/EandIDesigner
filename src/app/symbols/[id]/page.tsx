import { notFound } from "next/navigation";
import { getSymbolDetail } from "@/features/symbol_registry/data/queries";
import { SymbolDetailPanel } from "@/features/symbol_registry/ui/components/symbol-detail-panel";
import { listComponentAlternativeCandidates } from "@/features/symbol_components/api/server";
import { listSymbolCategories } from "@/features/symbol_categories/data/queries";

export const dynamic = "force-dynamic";

export default async function SymbolDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [symbol, componentAlternatives, categories] = await Promise.all([
    getSymbolDetail(id),
    listComponentAlternativeCandidates(),
    listSymbolCategories()
  ]);

  if (!symbol) {
    notFound();
  }

  return (
    <SymbolDetailPanel
      symbol={symbol}
      componentAlternatives={componentAlternatives}
      categories={categories}
    />
  );
}
