import {
  wireSpecificationSnapshotSchema,
  type WireCatalogEntry,
  type WireSpecificationSnapshot
} from "../../data/schema";

export function createWireSpecificationSnapshot(
  entry: WireCatalogEntry
): WireSpecificationSnapshot {
  return wireSpecificationSnapshotSchema.parse({
    catalogEntryId: entry.id,
    catalogEntryName: entry.name,
    wireType: entry.wireType,
    size: entry.size,
    color: entry.color
  });
}
