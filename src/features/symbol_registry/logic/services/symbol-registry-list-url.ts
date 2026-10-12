export function buildSymbolRegistryListUrl({
  categoryId,
  deviceType,
  page
}: {
  categoryId?: string;
  deviceType?: string;
  page: number;
}): string {
  const params = new URLSearchParams();

  if (categoryId) {
    params.set("category", categoryId);
  }
  if (deviceType) params.set("deviceType", deviceType);

  if (page > 1) {
    params.set("page", String(page));
  }

  const query = params.toString();
  return query ? `/symbols?${query}` : "/symbols";
}
