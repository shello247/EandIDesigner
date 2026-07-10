import { cache } from "react";
import { prisma } from "@/lib/prisma";
import {
  bomItemDetailSchema,
  bomItemFormOptionsSchema,
  bomItemImageSummarySchema,
  bomItemSummarySchema,
  symbolBomTemplateDetailSchema,
  type BomItemDetail,
  type BomItemFormOptions,
  type BomItemImageSummary,
  type BomItemStatus,
  type BomItemSummary,
  type SymbolBomTemplateDetail
} from "./schema";

const defaultBomCategoryOptions = [
  "cable",
  "cable_gland",
  "sealant",
  "wire_end",
  "label",
  "terminal",
  "breaker",
  "panel",
  "accessory",
  "other"
];

type BomItemRow = {
  id: string;
  itemKey: string;
  displayName: string;
  description: string | null;
  category: string;
  unit: string;
  manufacturer: string | null;
  partNumber: string | null;
  model: string | null;
  notes: string | null;
  supplierName: string | null;
  supplierContactName: string | null;
  supplierEmail: string | null;
  supplierPhone: string | null;
  supplierWebsite: string | null;
  supplierSku: string | null;
  unitCost: number | null;
  currency: string | null;
  leadTimeDays: number | null;
  minimumOrderQuantity: number | null;
  costNotes: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

type BomItemImageRow = {
  id: string;
  itemId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
  caption: string | null;
  isPrimary: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

type BomItemListRow = BomItemRow & {
  images?: BomItemImageRow[];
  _count?: {
    templateLines: number;
  };
};

type SymbolBomTemplateRow = {
  id: string;
  symbolId: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  lines: Array<{
    id: string;
    itemId: string;
    lineNumber: number;
    quantityRule: string;
    quantity: number;
    notes: string | null;
    item: BomItemRow;
  }>;
};

function categoryLabel(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function uniqueOptions(
  values: string[],
  labelForValue: (value: string) => string,
  defaults: string[] = []
) {
  const seen = new Set<string>();
  const options = [];

  for (const value of values) {
    const normalizedValue = value.trim();
    const key = normalizedValue.toLowerCase();

    if (normalizedValue.length === 0 || seen.has(key)) {
      continue;
    }

    seen.add(key);
    options.push({
      value: normalizedValue,
      label: labelForValue(normalizedValue)
    });
  }

  return options.sort((first, second) => {
    const firstDefaultIndex = defaults.indexOf(first.value);
    const secondDefaultIndex = defaults.indexOf(second.value);

    if (firstDefaultIndex !== -1 || secondDefaultIndex !== -1) {
      if (firstDefaultIndex === -1) {
        return 1;
      }

      if (secondDefaultIndex === -1) {
        return -1;
      }

      return firstDefaultIndex - secondDefaultIndex;
    }

    return first.label.localeCompare(second.label, undefined, {
      numeric: true
    });
  });
}

function toBomItemImageSummary(row: BomItemImageRow): BomItemImageSummary {
  return bomItemImageSummarySchema.parse({
    id: row.id,
    fileName: row.fileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    dataUrl: row.dataUrl,
    caption: row.caption ?? undefined,
    isPrimary: row.isPrimary,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  });
}

function toBomItemSummary(row: BomItemListRow): BomItemSummary {
  return bomItemSummarySchema.parse({
    id: row.id,
    itemKey: row.itemKey,
    displayName: row.displayName,
    description: row.description ?? undefined,
    category: row.category,
    unit: row.unit,
    manufacturer: row.manufacturer ?? undefined,
    partNumber: row.partNumber ?? undefined,
    model: row.model ?? undefined,
    notes: row.notes ?? undefined,
    supplierName: row.supplierName ?? undefined,
    supplierContactName: row.supplierContactName ?? undefined,
    supplierEmail: row.supplierEmail ?? undefined,
    supplierPhone: row.supplierPhone ?? undefined,
    supplierWebsite: row.supplierWebsite ?? undefined,
    supplierSku: row.supplierSku ?? undefined,
    unitCost: row.unitCost ?? undefined,
    currency: row.currency ?? undefined,
    leadTimeDays: row.leadTimeDays ?? undefined,
    minimumOrderQuantity: row.minimumOrderQuantity ?? undefined,
    costNotes: row.costNotes ?? undefined,
    status: row.status as BomItemStatus,
    primaryImage: row.images?.[0]
      ? toBomItemImageSummary(row.images[0])
      : undefined,
    templateLineCount: row._count?.templateLines ?? 0,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  });
}

function toSymbolBomTemplateDetail(
  row: SymbolBomTemplateRow
): SymbolBomTemplateDetail {
  return symbolBomTemplateDetailSchema.parse({
    id: row.id,
    symbolId: row.symbolId,
    notes: row.notes ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lines: row.lines
      .slice()
      .sort((first, second) => first.lineNumber - second.lineNumber)
      .map((line) => ({
        id: line.id,
        itemId: line.itemId,
        lineNumber: line.lineNumber,
        quantityRule: line.quantityRule,
        quantity: line.quantity,
        notes: line.notes ?? undefined,
        item: toBomItemSummary(line.item)
      }))
  });
}

export const listBomItems = cache(
  async ({
    includeArchived = false
  }: {
    includeArchived?: boolean;
  } = {}): Promise<BomItemSummary[]> => {
    const rows = await prisma.bomItem.findMany({
      where: includeArchived ? undefined : { status: "active" },
      include: {
        images: {
          orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
          take: 1
        },
        _count: {
          select: { templateLines: true }
        }
      },
      orderBy: [{ category: "asc" }, { displayName: "asc" }, { itemKey: "asc" }]
    });

    return rows.map(toBomItemSummary);
  }
);

export const getBomItemDetail = cache(
  async (id: string): Promise<BomItemDetail | null> => {
    const row = await prisma.bomItem.findUnique({
      where: { id },
      include: {
        images: {
          orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }]
        },
        templateLines: {
          orderBy: { lineNumber: "asc" },
          include: {
            template: {
              include: {
                symbol: true
              }
            }
          }
        },
        _count: {
          select: { templateLines: true }
        }
      }
    });

    if (!row) {
      return null;
    }

    const summary = toBomItemSummary(row);

    return bomItemDetailSchema.parse({
      ...summary,
      images: row.images.map(toBomItemImageSummary),
      usage: row.templateLines
        .map((line) => ({
          symbolId: line.template.symbol.id,
          symbolKey: line.template.symbol.symbolKey,
          displayName: line.template.symbol.displayName,
          lineId: line.id,
          quantityRule: line.quantityRule,
          quantity: line.quantity
        }))
        .sort((first, second) =>
          first.displayName.localeCompare(second.displayName, undefined, {
            numeric: true
          })
        )
    });
  }
);

export const listBomItemFormOptions = cache(
  async (): Promise<BomItemFormOptions> => {
    const [
      categoryRows,
      manufacturerRows,
      itemCategoryRows,
      itemManufacturerRows
    ] = await Promise.all([
      prisma.bomItemCategory.findMany({
        select: { name: true },
        orderBy: { name: "asc" }
      }),
      prisma.bomItemManufacturer.findMany({
        select: { name: true },
        orderBy: { name: "asc" }
      }),
      prisma.bomItem.findMany({
        select: { category: true },
        distinct: ["category"]
      }),
      prisma.bomItem.findMany({
        where: { manufacturer: { not: null } },
        select: { manufacturer: true },
        distinct: ["manufacturer"]
      })
    ]);

    return bomItemFormOptionsSchema.parse({
      categories: uniqueOptions(
        [
          ...defaultBomCategoryOptions,
          ...categoryRows.map((row) => row.name),
          ...itemCategoryRows.map((row) => row.category)
        ],
        categoryLabel,
        defaultBomCategoryOptions
      ),
      manufacturers: uniqueOptions(
        [
          ...manufacturerRows.map((row) => row.name),
          ...itemManufacturerRows.flatMap((row) =>
            row.manufacturer ? [row.manufacturer] : []
          )
        ],
        (value) => value
      )
    });
  }
);

export const getSymbolBomTemplate = cache(
  async (symbolId: string): Promise<SymbolBomTemplateDetail | null> => {
    const row = await prisma.symbolBomTemplate.findUnique({
      where: { symbolId },
      include: {
        lines: {
          orderBy: { lineNumber: "asc" },
          include: { item: true }
        }
      }
    });

    return row ? toSymbolBomTemplateDetail(row) : null;
  }
);

export const listSymbolBomTemplatesForSymbols = cache(
  async (symbolIds: string[]): Promise<SymbolBomTemplateDetail[]> => {
    const uniqueSymbolIds = [...new Set(symbolIds.filter(Boolean))];

    if (uniqueSymbolIds.length === 0) {
      return [];
    }

    const rows = await prisma.symbolBomTemplate.findMany({
      where: {
        symbolId: { in: uniqueSymbolIds }
      },
      include: {
        lines: {
          orderBy: { lineNumber: "asc" },
          include: { item: true }
        }
      }
    });

    return rows.map(toSymbolBomTemplateDetail);
  }
);
