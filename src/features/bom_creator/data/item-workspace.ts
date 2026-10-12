import { z } from "zod";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getLatestItemEngineeringRevision, updateItemEngineeringClassificationInTransaction, ItemEngineeringError } from "@/features/item_engineering/api/server";
import { itemEngineeringDeviceTypeSchema } from "@/features/item_engineering/api/public";
import { bomItemWritableFieldsSchema, bomItemInputSchema, bomItemImagesInputSchema, bomItemDetailSchema, bomItemUsageSchema } from "./schema";
import { bomItemImageMetadataSelect, bomItemDocumentMetadataSelect, toBomItemSummary, toBomItemImageMetadata, toBomItemDocumentMetadata } from "./queries";
import { reconcileBomItemImages } from "./mutations";

export const itemDetailsFieldsSchema = bomItemWritableFieldsSchema.pick({
  displayName: true, description: true, unit: true,
  manufacturer: true, partNumber: true, model: true, notes: true
}).extend({ productUrl: bomItemInputSchema.shape.productUrl }).strict();
export const itemCommercialFieldsSchema = bomItemWritableFieldsSchema.pick({
  supplierName: true, supplierContactName: true, supplierEmail: true, supplierPhone: true,
  supplierWebsite: true, supplierSku: true, unitCost: true, currency: true,
  leadTimeDays: true, minimumOrderQuantity: true, costNotes: true
}).strict();
const guardSchema = z.object({
  itemId: z.string().trim().min(1), expectedUpdatedAt: z.string().datetime(),
  expectedLatestRevisionId: z.string().min(1).nullable()
});
export const itemDetailsUpdateSchema = guardSchema.extend({ fields: itemDetailsFieldsSchema, deviceType: itemEngineeringDeviceTypeSchema }).strict();
export const itemCommercialUpdateSchema = guardSchema.omit({ expectedLatestRevisionId: true }).extend({ fields: itemCommercialFieldsSchema }).strict();
export const itemImagesUpdateSchema = guardSchema.omit({ expectedLatestRevisionId: true }).extend({ images: bomItemImagesInputSchema }).strict();
export const itemOverviewSchema = bomItemDetailSchema.omit({ documents: true, usage: true, latestEngineeringRevisionId: true }).extend({
  revisionId: z.string().nullable(), deviceType: itemEngineeringDeviceTypeSchema.nullable()
});
export type ItemOverview = z.infer<typeof itemOverviewSchema>;
export type ItemDetailsFields = z.infer<typeof itemDetailsFieldsSchema>;
export type ItemCommercialFields = z.infer<typeof itemCommercialFieldsSchema>;

export async function getItemWorkspaceOverview(itemId: string, db: Prisma.TransactionClient = prisma) {
  const id = z.string().trim().min(1).parse(itemId);
  const row = await db.bomItem.findUnique({ where: { id }, include: {
    images: { select: bomItemImageMetadataSelect, orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { id: "asc" }] }
  } });
  if (!row) return null;
  const revision = await getLatestItemEngineeringRevision(id, db);
  return itemOverviewSchema.parse({ ...toBomItemSummary(row),
    productUrl: row.productUrl ?? undefined, productUrlExtractedAt: row.productUrlExtractedAt?.toISOString(),
    images: row.images.map(toBomItemImageMetadata), revisionId: revision?.id ?? null,
    // Legacy catalogue categories are not reliable engineering classifications.
    // Reading an unclassified Item must neither infer its type nor rewrite it.
    deviceType: revision?.profile.deviceType ?? null
  });
}
export async function listItemWorkspaceDocuments(itemId: string, db: Prisma.TransactionClient = prisma) {
  const rows = await db.bomItemDocument.findMany({ where: { itemId: z.string().min(1).parse(itemId), archivedAt: null },
    select: bomItemDocumentMetadataSelect, orderBy: [{ createdAt: "desc" }, { id: "asc" }] });
  return rows.map(toBomItemDocumentMetadata);
}
export async function listItemWorkspaceUsage(itemId: string, db: Prisma.TransactionClient = prisma) {
  const rows = await db.symbolBomTemplateLine.findMany({ where: { itemId: z.string().min(1).parse(itemId) },
    select: { id: true, quantityRule: true, quantity: true,
      template: { select: { symbol: { select: { id: true, symbolKey: true, displayName: true } } } } },
    orderBy: { id: "asc" } });
  return rows.map(row => bomItemUsageSchema.parse({ ...row.template.symbol, symbolId: row.template.symbol.id,
    lineId: row.id, quantityRule: row.quantityRule, quantity: row.quantity }));
}
async function updateSection(input: unknown, section: "details" | "commercial" | "images", db: PrismaClient) {
  const parsed = section === "details" ? itemDetailsUpdateSchema.parse(input)
    : section === "commercial" ? itemCommercialUpdateSchema.parse(input) : itemImagesUpdateSchema.parse(input);
  return db.$transaction(async tx => {
    const current = await tx.bomItem.findUnique({ where: { id: parsed.itemId }, select: { status: true, updatedAt: true } });
    if (!current) throw new ItemEngineeringError("NOT_FOUND", "Item was not found.");
    if (current.status !== "active") throw new ItemEngineeringError("ARCHIVED", "Archived Items are read-only.");
    if (current.updatedAt.toISOString() !== parsed.expectedUpdatedAt) {
      throw new ItemEngineeringError("REVISION_CONFLICT", "Item details changed. Review the latest saved section before retrying; your draft is retained.");
    }
    const fields = "fields" in parsed ? parsed.fields : {};
    const data = { ...Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, value ?? null])),
      ...("deviceType" in parsed ? { category: parsed.deviceType } : {}) };
    // Compare and update in the transaction. Commercial/image writes never create electrical revisions.
    const changed = await tx.bomItem.updateMany({ where: { id: parsed.itemId, status: "active", updatedAt: current.updatedAt },
      data: { ...data, updatedAt: new Date(Math.max(Date.now(), current.updatedAt.getTime() + 1)) } });
    if (changed.count !== 1) throw new ItemEngineeringError("REVISION_CONFLICT", "Item changed. Review and retry.");
    if ("expectedLatestRevisionId" in parsed) {
      await updateItemEngineeringClassificationInTransaction({ itemId: parsed.itemId,
        expectedLatestRevisionId: parsed.expectedLatestRevisionId, deviceType: parsed.deviceType }, tx);
    }
    if ("images" in parsed) await reconcileBomItemImages(tx, parsed.itemId, parsed.images);
    return (await getItemWorkspaceOverview(parsed.itemId, tx))!;
  }, { timeout: 15000 });
}
export const updateItemWorkspaceDetails = (input: unknown, db: PrismaClient = prisma) => updateSection(input, "details", db);
export const updateItemWorkspaceCommercial = (input: unknown, db: PrismaClient = prisma) => updateSection(input, "commercial", db);
export const updateItemWorkspaceImages = (input: unknown, db: PrismaClient = prisma) => updateSection(input, "images", db);
