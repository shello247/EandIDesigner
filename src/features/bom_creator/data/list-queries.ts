import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { itemDeviceTypeRevisionSelect, listItemDeviceTypeOptions, listItemDeviceTypePage, projectItemDeviceTypes } from "./item-device-types";
import {
  bomItemFilterOptionsSchema,
  bomItemImageMetadataSchema,
  bomItemListInputSchema,
  bomItemListResultSchema,
  bomItemListRowSchema,
  type BomItemFilterOptions,
  type BomItemImageMetadata,
  type BomItemListInput,
  type BomItemListResult,
  type BomItemListRow
} from "./schema";

const imageMetadataSelect = {
  id: true,
  fileName: true,
  mimeType: true,
  sizeBytes: true,
  caption: true,
  isPrimary: true,
  sortOrder: true
} as const;

const listRowSelect = Prisma.validator<Prisma.BomItemSelect>()({
  id: true,
  itemKey: true,
  displayName: true,
  category: true,
  engineeringRevisions: itemDeviceTypeRevisionSelect,
  unit: true,
  manufacturer: true,
  partNumber: true,
  supplierName: true,
  supplierSku: true,
  unitCost: true,
  currency: true,
  images: {
    select: imageMetadataSelect,
    orderBy: [
      { isPrimary: "desc" },
      { sortOrder: "asc" },
      { createdAt: "asc" }
    ],
    take: 1
  },
  _count: { select: { templateLines: true } }
});

type BomItemListDatabaseRow = Prisma.BomItemGetPayload<{
  select: typeof listRowSelect;
}>;

function imageUrl(imageId: string): string {
  return `/api/bom/items/images/${encodeURIComponent(imageId)}`;
}

function toImageMetadata(
  image: BomItemListDatabaseRow["images"][number]
): BomItemImageMetadata {
  return bomItemImageMetadataSchema.parse({
    id: image.id,
    imageUrl: imageUrl(image.id),
    fileName: image.fileName,
    mimeType: image.mimeType,
    sizeBytes: image.sizeBytes,
    caption: image.caption ?? undefined,
    isPrimary: image.isPrimary,
    sortOrder: image.sortOrder
  });
}

function toListRow(row: Omit<BomItemListDatabaseRow, "engineeringRevisions">): BomItemListRow {
  return bomItemListRowSchema.parse({
    id: row.id,
    itemKey: row.itemKey,
    displayName: row.displayName,
    category: row.category,
    unit: row.unit,
    manufacturer: row.manufacturer ?? undefined,
    partNumber: row.partNumber ?? undefined,
    supplierName: row.supplierName ?? undefined,
    supplierSku: row.supplierSku ?? undefined,
    unitCost: row.unitCost ?? undefined,
    currency: row.currency ?? undefined,
    primaryImage: row.images[0] ? toImageMetadata(row.images[0]) : undefined,
    templateLineCount: row._count.templateLines
  });
}

function itemWhere(input: BomItemListInput): Prisma.BomItemWhereInput {
  const searchFields: Prisma.BomItemWhereInput[] = input.query
    ? [
        { itemKey: { contains: input.query } },
        { displayName: { contains: input.query } },
        { partNumber: { contains: input.query } },
        { manufacturer: { contains: input.query } },
        { supplierName: { contains: input.query } }
      ]
    : [];

  return {
    status: "active",
    manufacturer: input.manufacturer,
    OR: searchFields.length > 0 ? searchFields : undefined
  };
}

async function findRows(
  where: Prisma.BomItemWhereInput,
  page: number,
  pageSize: number,
  db: Prisma.TransactionClient
): Promise<BomItemListDatabaseRow[]> {
  return db.bomItem.findMany({
    where,
    select: listRowSelect,
    orderBy: [{ displayName: "asc" }, { itemKey: "asc" }],
    skip: (page - 1) * pageSize,
    take: pageSize
  });
}

export async function listBomItemRows(
  input: BomItemListInput,
  db: PrismaClient | Prisma.TransactionClient = prisma
): Promise<BomItemListResult> {
  // Count, filter IDs, Item rows and exact revision verification must share one
  // read snapshot; reclassification elsewhere cannot change a row mid-projection.
  if ("$transaction" in db) {
    return db.$transaction(tx => listBomItemRows(input, tx));
  }
  const parsed = bomItemListInputSchema.parse(input);
  const where = itemWhere(parsed);
  if (parsed.category) {
    const filtered = await listItemDeviceTypePage(parsed, db);
    const rows = filtered.ids.length ? await findRows({ ...where, id: { in: filtered.ids } }, 1, parsed.pageSize, db) : [];
    return bomItemListResultSchema.parse({
      items: (await projectItemDeviceTypes(rows, db)).map(toListRow),
      totalItems: filtered.totalItems, totalPages: Math.max(1, Math.ceil(filtered.totalItems / parsed.pageSize)),
      page: filtered.page, pageSize: parsed.pageSize,
      appliedFilters: { query: parsed.query, category: parsed.category, manufacturer: parsed.manufacturer }
    });
  }
  const [totalItems, requestedRows] = await Promise.all([
    db.bomItem.count({ where }),
    findRows(where, parsed.page, parsed.pageSize, db)
  ]);
  const totalPages = Math.max(1, Math.ceil(totalItems / parsed.pageSize));
  const page = Math.min(parsed.page, totalPages);
  const rows =
    page === parsed.page || totalItems === 0
      ? requestedRows
      : await findRows(where, page, parsed.pageSize, db);

  return bomItemListResultSchema.parse({
    items: (await projectItemDeviceTypes(rows, db)).map(toListRow),
    totalItems,
    totalPages,
    page,
    pageSize: parsed.pageSize,
    appliedFilters: {
      query: parsed.query,
      category: parsed.category,
      manufacturer: parsed.manufacturer
    }
  });
}

export async function listBomItemFilterOptions(db: Prisma.TransactionClient = prisma): Promise<BomItemFilterOptions> {
  const [categories, manufacturerRows] = await Promise.all([
    listItemDeviceTypeOptions(db),
    db.bomItem.findMany({
      where: { status: "active", manufacturer: { not: null } },
      select: { manufacturer: true },
      distinct: ["manufacturer"],
      orderBy: { manufacturer: "asc" }
    })
  ]);

  return bomItemFilterOptionsSchema.parse({
    categories,
    manufacturers: manufacturerRows.flatMap((row) =>
      row.manufacturer
        ? [{ value: row.manufacturer, label: row.manufacturer }]
        : []
    )
  });
}
