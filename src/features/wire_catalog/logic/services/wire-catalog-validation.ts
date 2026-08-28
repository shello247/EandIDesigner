import type { WireCatalogEntry } from "../../data/schema";

export function getDefaultWireCatalogEntry(
  entries: readonly WireCatalogEntry[]
): WireCatalogEntry | undefined {
  return entries.find((entry) => entry.isDefault);
}

export function findWireCatalogEntry(
  entries: readonly WireCatalogEntry[],
  entryId: string
): WireCatalogEntry | undefined {
  return entries.find((entry) => entry.id === entryId);
}
