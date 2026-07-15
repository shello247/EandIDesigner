import { redirect } from "next/navigation";
import {
  buildBomItemListUrl,
  listBomItemFilterOptions,
  listBomItemRows,
  parseBomItemListSearchParams
} from "@/features/bom_creator/api/public";
import { BomItemsLibraryShell } from "@/features/bom_creator/ui/components/bom-items-library-shell";

export const dynamic = "force-dynamic";

export default async function BomItemsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const input = parseBomItemListSearchParams(await searchParams);
  const [result, filterOptions] = await Promise.all([
    listBomItemRows(input),
    listBomItemFilterOptions()
  ]);

  if (result.page !== input.page) {
    redirect(
      buildBomItemListUrl({
        filters: result.appliedFilters,
        page: result.page,
        pageSize: result.pageSize
      })
    );
  }

  return (
    <BomItemsLibraryShell filterOptions={filterOptions} result={result} />
  );
}
