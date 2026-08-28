export type {
  DeleteWireCatalogEntryInput,
  SetDefaultWireCatalogEntryInput,
  UpdateWireCatalogEntryInput,
  WireCatalogEntry,
  WireCatalogEntryInput,
  WireSpecificationSnapshot
} from "../data/schema";

export type WireCatalogActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };
