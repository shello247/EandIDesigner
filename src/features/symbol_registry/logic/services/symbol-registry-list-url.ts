export function buildSymbolRegistryListUrl({
  categoryId,
  page
}: {
  categoryId?: string;
  page: number;
}): string {
  const params = new URLSearchParams();

  if (categoryId) {
    params.set("category", categoryId);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const query = params.toString();
  return query ? `/symbols?${query}` : "/symbols";
}
