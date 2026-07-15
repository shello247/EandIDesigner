import { notFound } from "next/navigation";
import {
  getBomItemDetail,
  listBomItemFormOptions
} from "@/features/bom_creator/api/public";
import { BomItemDetailPanel } from "@/features/bom_creator/ui/components/bom-item-detail-panel";

export const dynamic = "force-dynamic";

export default async function BomItemDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [item, formOptions] = await Promise.all([
    getBomItemDetail(id),
    listBomItemFormOptions()
  ]);

  if (!item) {
    notFound();
  }

  return <BomItemDetailPanel formOptions={formOptions} item={item} />;
}
