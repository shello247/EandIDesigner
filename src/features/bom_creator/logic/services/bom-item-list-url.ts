import {
  BOM_ITEM_LIST_DEFAULT_PAGE_SIZE,
  bomItemListInputSchema,
  type BomItemAppliedFilters,
  type BomItemListInput
} from "../../data/schema";

export type BomItemListSearchParams = Record<
  string,
  string | string[] | undefined
>;

export function parseBomItemListSearchParams(
  searchParams: BomItemListSearchParams
): BomItemListInput {
  return bomItemListInputSchema.parse({
    query: searchParams.q,
    category: searchParams.category,
    manufacturer: searchParams.manufacturer,
    page: searchParams.page,
    pageSize: searchParams.pageSize
  });
}

export function hasBomItemFilters(filters: BomItemAppliedFilters): boolean {
  return Boolean(filters.query || filters.category || filters.manufacturer);
}

export function buildBomItemListUrl(input: {
  filters: BomItemAppliedFilters;
  page: number;
  pageSize: number;
}): string {
  const params = new URLSearchParams();

  if (input.filters.query) {
    params.set("q", input.filters.query);
  }

  if (input.filters.category) {
    params.set("category", input.filters.category);
  }

  if (input.filters.manufacturer) {
    params.set("manufacturer", input.filters.manufacturer);
  }

  if (input.page > 1) {
    params.set("page", String(input.page));
  }

  if (input.pageSize !== BOM_ITEM_LIST_DEFAULT_PAGE_SIZE) {
    params.set("pageSize", String(input.pageSize));
  }

  const query = params.toString();
  return query ? `/bom/items?${query}` : "/bom/items";
}
