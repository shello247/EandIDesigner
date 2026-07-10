import {
  listBomItemFormOptions,
  listBomItems
} from "@/features/bom_creator/api/public";
import { BomItemsLibraryShell } from "@/features/bom_creator/ui/components/bom-items-library-shell";

export const dynamic = "force-dynamic";

export default async function BomItemsPage() {
  const [items, formOptions] = await Promise.all([
    listBomItems(),
    listBomItemFormOptions()
  ]);

  return <BomItemsLibraryShell formOptions={formOptions} items={items} />;
}
