import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { wireCatalogEntrySchema, type WireCatalogEntry } from "./schema";

function toEntry(row: {
  id: string;
  name: string;
  wireType: string;
  size: string;
  color: string;
  notes: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}): WireCatalogEntry {
  return wireCatalogEntrySchema.parse({
    ...row,
    notes: row.notes ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  });
}

export const listWireCatalogEntries = cache(async (): Promise<WireCatalogEntry[]> => {
  const rows = await prisma.wireCatalogEntry.findMany({
    orderBy: [{ isDefault: "desc" }, { name: "asc" }]
  });
  return rows.map(toEntry);
});
