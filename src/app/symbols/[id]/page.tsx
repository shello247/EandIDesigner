import { notFound } from "next/navigation";
import {
  getSymbolBomTemplate,
  listBomItems
} from "@/features/bom_creator/api/public";
import { SymbolBomEditor } from "@/features/bom_creator/ui/components/symbol-bom-editor";
import { getSymbolDetail } from "@/features/symbol_registry/data/queries";
import { SymbolDetailPanel } from "@/features/symbol_registry/ui/components/symbol-detail-panel";

export const dynamic = "force-dynamic";

export default async function SymbolDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [symbol, bomItems, bomTemplate] = await Promise.all([
    getSymbolDetail(id),
    listBomItems({ includeArchived: true }),
    getSymbolBomTemplate(id)
  ]);

  if (!symbol) {
    notFound();
  }

  return (
    <SymbolDetailPanel
      symbol={symbol}
      bomPanel={
        <SymbolBomEditor
          symbolId={symbol.id}
          items={bomItems}
          template={bomTemplate}
        />
      }
    />
  );
}
