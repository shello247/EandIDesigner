import { cache } from "react";
import { prisma } from "@/lib/prisma";
import {
  BOM_ITEM_PICKER_PAGE_SIZE,
  bomItemPickerInputSchema,
  bomItemPickerResultSchema,
  symbolBomEditorDataSchema,
  type BomItemPickerInput,
  type BomItemPickerResult,
  type SymbolBomEditorData
} from "./schema";
import { listBomGenerationTemplatesForSymbols } from "./generation-queries";

export const getSymbolBomEditorData = cache(
  async (symbolId: string): Promise<SymbolBomEditorData> => {
    const templates = await listBomGenerationTemplatesForSymbols([symbolId]);

    return symbolBomEditorDataSchema.parse({
      template: templates[0] ?? null
    });
  }
);

export async function listBomItemPickerRows(
  input: BomItemPickerInput
): Promise<BomItemPickerResult> {
  const parsed = bomItemPickerInputSchema.parse(input);
  const search = parsed.query
    ? {
        OR: [
          { itemKey: { contains: parsed.query } },
          { displayName: { contains: parsed.query } },
          { partNumber: { contains: parsed.query } },
          { manufacturer: { contains: parsed.query } },
          { supplierName: { contains: parsed.query } }
        ]
      }
    : {};
  const where = {
    status: "active",
    ...search
  } as const;
  const skip = (parsed.page - 1) * BOM_ITEM_PICKER_PAGE_SIZE;
  const [totalItems, rows] = await Promise.all([
    prisma.bomItem.count({ where }),
    prisma.bomItem.findMany({
      where,
      select: {
        id: true,
        itemKey: true,
        displayName: true,
        category: true,
        unit: true,
        manufacturer: true,
        partNumber: true,
        status: true
      },
      orderBy: [{ displayName: "asc" }, { itemKey: "asc" }],
      skip,
      take: BOM_ITEM_PICKER_PAGE_SIZE
    })
  ]);

  return bomItemPickerResultSchema.parse({
    items: rows.map((row) => ({
      ...row,
      manufacturer: row.manufacturer ?? undefined,
      partNumber: row.partNumber ?? undefined
    })),
    query: parsed.query,
    page: parsed.page,
    totalPages: Math.max(1, Math.ceil(totalItems / BOM_ITEM_PICKER_PAGE_SIZE)),
    totalItems
  });
}

export async function listExistingBomItemIds(
  itemIds: readonly string[]
): Promise<string[]> {
  const ids = [...new Set(itemIds.filter(Boolean))];

  if (ids.length === 0) {
    return [];
  }

  const rows = await prisma.bomItem.findMany({
    where: { id: { in: ids } },
    select: { id: true }
  });

  return rows.map((row) => row.id);
}
