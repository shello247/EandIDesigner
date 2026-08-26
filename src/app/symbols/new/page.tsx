import { SvgImportStudio } from "@/features/svg_symbol_import/ui/components/svg-import-studio";
import { listSymbolCategories } from "@/features/symbol_categories/data/queries";

export default async function NewSymbolPage() {
  const categories = await listSymbolCategories();
  return <SvgImportStudio categories={categories} />;
}
