import { Prisma, type PrismaClient } from "@prisma/client";
import { synchronizeItemEngineeringIdentity, synchronizeItemGuidance, hashItemDocumentContent, getLatestItemEngineeringRevision, updateItemEngineeringClassificationInTransaction, ItemEngineeringError } from "@/features/item_engineering/api/server";
import { prisma } from "@/lib/prisma";
import {
  bomItemInputSchema,
  bomItemDocumentDeleteInputSchema,
  bomItemDocumentUploadInputSchema,
  bomItemOptionInputSchema,
  bomItemUpdateInputSchema,
  type BomItemOption,
  type BomItemDocumentDeleteInput,
  type BomItemDocumentUploadInput,
  type BomItemImageWriteInput,
  saveSymbolBomTemplateInputSchema,
  type BomItemInput,
  type BomItemOptionInput,
  type BomItemUpdateInput,
  type SaveSymbolBomTemplateInput
} from "./schema";
import {
  getBomItemDetail,
  getBomItemDocumentMetadata,
  getSymbolBomTemplate
} from "./queries";
import {
  BOM_ITEM_KEY_SCOPE,
  formatBomItemKey
} from "../logic/services/bom-item-key";
import { validateBomItemImageBudget } from "../logic/services/bom-item-image-budget";
import { validateBomItemDocumentBudget } from "../logic/services/bom-item-document-limits";
import { buildBomItemDocumentPayload } from "../logic/services/bom-item-document-payload";

const MAX_CREATE_ATTEMPTS = 3;

function normalizeCategoryValue(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || "other";
}

function categoryLabel(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function nullable(value: string | undefined): string | null {
  return value?.trim() || null;
}

function nullableNumber(value: number | undefined): number | null {
  return value === undefined ? null : value;
}

function orderedImages(
  images: readonly BomItemImageWriteInput[]
): BomItemImageWriteInput[] {
  const hasPrimary = images.some((image) => image.isPrimary);

  return images.map((image, index) => ({
    ...image,
    isPrimary: hasPrimary ? image.isPrimary : index === 0,
    sortOrder: index
  }));
}

export async function reconcileBomItemImages(
  tx: Prisma.TransactionClient,
  itemId: string,
  images: readonly BomItemImageWriteInput[]
) {
  const currentImages = await tx.bomItemImage.findMany({
    where: { itemId },
    select: {
      id: true,
      sizeBytes: true,
      caption: true,
      isPrimary: true,
      sortOrder: true
    }
  });
  const nextImages = orderedImages(images);
  const currentById = new Map(
    currentImages.map((image) => [image.id, image])
  );
  const existingIds = new Set<string>();

  for (const image of nextImages) {
    if (image.kind !== "existing") {
      continue;
    }

    if (existingIds.has(image.id)) {
      throw new Error(`BOM item image ${image.id} is referenced more than once.`);
    }

    if (!currentById.has(image.id)) {
      throw new Error(
        `BOM item image ${image.id} does not belong to item ${itemId}.`
      );
    }

    existingIds.add(image.id);
  }

  const budget = validateBomItemImageBudget(
    nextImages.map((image) =>
      image.kind === "new"
        ? { sizeBytes: image.sizeBytes, dataUrl: image.dataUrl }
        : { sizeBytes: currentById.get(image.id)!.sizeBytes }
    )
  );

  if (!budget.ok) {
    throw new Error(
      budget.violations[0]?.message ?? "BOM item images are invalid."
    );
  }

  const removedIds = currentImages
    .filter((image) => !existingIds.has(image.id))
    .map((image) => image.id);

  if (removedIds.length > 0) {
    await tx.bomItemImage.deleteMany({
      where: {
        itemId,
        id: { in: removedIds }
      }
    });
  }

  for (const image of nextImages) {
    if (image.kind !== "existing") {
      continue;
    }

    const current = currentById.get(image.id)!;
    const caption = nullable(image.caption);

    if (
      current.caption === caption &&
      current.isPrimary === image.isPrimary &&
      current.sortOrder === image.sortOrder
    ) {
      continue;
    }

    await tx.bomItemImage.update({
      where: { id: image.id },
      data: {
        caption,
        isPrimary: image.isPrimary,
        sortOrder: image.sortOrder
      }
    });
  }

  const newImages = nextImages.filter(
    (image): image is Extract<BomItemImageWriteInput, { kind: "new" }> =>
      image.kind === "new"
  );

  if (newImages.length === 0) {
    return;
  }

  await tx.bomItemImage.createMany({
    data: newImages.map((image) => ({
      itemId,
      fileName: image.fileName,
      mimeType: image.mimeType,
      sizeBytes: image.sizeBytes,
      dataUrl: image.dataUrl,
      caption: nullable(image.caption),
      isPrimary: image.isPrimary,
      sortOrder: image.sortOrder
    }))
  });
}

function bomItemData(parsed: BomItemInput) {
  return {
    displayName: parsed.displayName,
    description: nullable(parsed.description),
    category: parsed.deviceType ?? parsed.category,
    unit: parsed.unit,
    manufacturer: nullable(parsed.manufacturer),
    partNumber: nullable(parsed.partNumber),
    model: nullable(parsed.model),
    notes: nullable(parsed.notes),
    supplierName: nullable(parsed.supplierName),
    supplierContactName: nullable(parsed.supplierContactName),
    supplierEmail: nullable(parsed.supplierEmail),
    supplierPhone: nullable(parsed.supplierPhone),
    supplierWebsite: nullable(parsed.supplierWebsite),
    supplierSku: nullable(parsed.supplierSku),
    unitCost: nullableNumber(parsed.unitCost),
    currency: nullable(parsed.currency),
    leadTimeDays: parsed.leadTimeDays ?? null,
    minimumOrderQuantity: nullableNumber(parsed.minimumOrderQuantity),
    costNotes: nullable(parsed.costNotes),
    productUrl: nullable(parsed.productUrl),
    productUrlExtractedAt: parsed.productUrlExtractedAt
      ? new Date(parsed.productUrlExtractedAt)
      : null
  };
}

export async function allocateNextBomItemKey(
  tx: Prisma.TransactionClient
): Promise<string> {
  try {
    const sequence = await tx.bomItemKeySequence.update({
      where: { scope: BOM_ITEM_KEY_SCOPE },
      data: { lastValue: { increment: 1 } },
      select: { lastValue: true }
    });

    return formatBomItemKey(sequence.lastValue);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw new Error(
        "BOM item key sequence is not initialized. Run npm run db:setup."
      );
    }

    throw error;
  }
}

export async function createBomItem(input: BomItemInput) {
  const parsed = bomItemInputSchema.parse(input);

  for (let attempt = 0; attempt < MAX_CREATE_ATTEMPTS; attempt += 1) {
    try {
      const itemId = await prisma.$transaction(async (tx) => {
        const row = await tx.bomItem.create({
          data: {
            ...bomItemData(parsed),
            itemKey: await allocateNextBomItemKey(tx),
            status: "active"
          },
          select: { id: true }
        });

        await reconcileBomItemImages(tx, row.id, parsed.images);
        if (parsed.deviceType) {
          await updateItemEngineeringClassificationInTransaction({ itemId: row.id, expectedLatestRevisionId: null, deviceType: parsed.deviceType }, tx);
        }

        return row.id;
      });

      return getBomItemDetail(itemId);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034" &&
        attempt < MAX_CREATE_ATTEMPTS - 1
      ) {
        continue;
      }

      throw error;
    }
  }

  throw new Error("BOM item could not be created after concurrent updates.");
}

export async function updateBomItem(input: BomItemUpdateInput) {
  const parsed = bomItemUpdateInputSchema.parse(input);
  const data: Record<string, unknown> = {};

  if (parsed.displayName !== undefined) {
    data.displayName = parsed.displayName;
  }

  if (parsed.description !== undefined || "description" in input) {
    data.description = nullable(parsed.description);
  }

  if (parsed.category !== undefined) {
    data.category = parsed.category;
  }

  if (parsed.unit !== undefined) {
    data.unit = parsed.unit;
  }

  if (parsed.manufacturer !== undefined || "manufacturer" in input) {
    data.manufacturer = nullable(parsed.manufacturer);
  }

  if (parsed.partNumber !== undefined || "partNumber" in input) {
    data.partNumber = nullable(parsed.partNumber);
  }

  if (parsed.model !== undefined || "model" in input) {
    data.model = nullable(parsed.model);
  }

  if (parsed.notes !== undefined || "notes" in input) {
    data.notes = nullable(parsed.notes);
  }

  if (parsed.supplierName !== undefined || "supplierName" in input) {
    data.supplierName = nullable(parsed.supplierName);
  }

  if (parsed.supplierContactName !== undefined || "supplierContactName" in input) {
    data.supplierContactName = nullable(parsed.supplierContactName);
  }

  if (parsed.supplierEmail !== undefined || "supplierEmail" in input) {
    data.supplierEmail = nullable(parsed.supplierEmail);
  }

  if (parsed.supplierPhone !== undefined || "supplierPhone" in input) {
    data.supplierPhone = nullable(parsed.supplierPhone);
  }

  if (parsed.supplierWebsite !== undefined || "supplierWebsite" in input) {
    data.supplierWebsite = nullable(parsed.supplierWebsite);
  }

  if (parsed.supplierSku !== undefined || "supplierSku" in input) {
    data.supplierSku = nullable(parsed.supplierSku);
  }

  if (parsed.unitCost !== undefined || "unitCost" in input) {
    data.unitCost = nullableNumber(parsed.unitCost);
  }

  if (parsed.currency !== undefined || "currency" in input) {
    data.currency = nullable(parsed.currency);
  }

  if (parsed.leadTimeDays !== undefined || "leadTimeDays" in input) {
    data.leadTimeDays = parsed.leadTimeDays ?? null;
  }

  if (
    parsed.minimumOrderQuantity !== undefined ||
    "minimumOrderQuantity" in input
  ) {
    data.minimumOrderQuantity = nullableNumber(parsed.minimumOrderQuantity);
  }

  if (parsed.costNotes !== undefined || "costNotes" in input) {
    data.costNotes = nullable(parsed.costNotes);
  }

  if (parsed.productUrl !== undefined || "productUrl" in input) {
    data.productUrl = nullable(parsed.productUrl);
  }

  if (
    parsed.productUrlExtractedAt !== undefined ||
    "productUrlExtractedAt" in input
  ) {
    data.productUrlExtractedAt = parsed.productUrlExtractedAt
      ? new Date(parsed.productUrlExtractedAt)
      : null;
  }

  if (parsed.status !== undefined) {
    data.status = parsed.status;
  }

  await prisma.$transaction(async (tx) => {
    const current = await tx.bomItem.findUnique({ where: { id: parsed.id }, select: { status: true, category: true } });
    if (!current) throw new ItemEngineeringError("NOT_FOUND", "Item was not found.");
    if (current.status !== "active") throw new ItemEngineeringError("ARCHIVED", "Archived Items are read-only.");
    if (parsed.category !== undefined) {
      const latest = await getLatestItemEngineeringRevision(parsed.id, tx);
      if (latest && parsed.category !== latest.profile.deviceType) {
        throw new ItemEngineeringError("VALIDATION", "Change Device Type in Item Overview → Edit details. Catalogue grouping cannot be changed independently.");
      }
      if (!latest) {
        if (parsed.category !== current.category && parsed.category !== "unclassified") {
          throw new ItemEngineeringError("VALIDATION", "Choose Device Type in Item Overview → Edit details before changing catalogue grouping.");
        }
        // Older full-form consumers may echo the unclassified read projection.
        // Never replace the original legacy value without an explicit selection.
        delete data.category;
      }
    }
    await tx.bomItem.update({
      where: { id: parsed.id },
      data
    });

    if (["displayName", "manufacturer", "model", "partNumber"].some(key => key in data)) {
      await synchronizeItemEngineeringIdentity(parsed.id, parsed.expectedEngineeringRevisionId, tx);
    }

    if ("images" in input) {
      await reconcileBomItemImages(tx, parsed.id, parsed.images ?? []);
    }
  });

  return getBomItemDetail(parsed.id);
}

export async function deleteBomItem(id: string, db: PrismaClient = prisma) {
  return db.$transaction(async (tx) => {
    const templateLineCount = await tx.symbolBomTemplateLine.count({
      where: { itemId: id }
    });

    const revisionCount = await tx.bomItemEngineeringRevision.count({ where: { itemId: id } });
    const noteCount = await tx.bomItemEngineerNote.count({ where: { itemId: id } });
    if (templateLineCount > 0 || revisionCount > 0 || noteCount > 0) {
      const row = await tx.bomItem.update({
        where: { id },
        data: { status: "archived" },
        select: { id: true }
      });

      return { id: row.id, mode: "archived" as const };
    }

    const row = await tx.bomItem.delete({
      where: { id },
      select: { id: true }
    });

    return { id: row.id, mode: "deleted" as const };
  });
}

export async function uploadBomItemDocument(
  input: BomItemDocumentUploadInput,
  db: PrismaClient = prisma
) {
  const parsed = bomItemDocumentUploadInputSchema.parse(input);

  buildBomItemDocumentPayload({
    id: "pending-upload",
    fileName: parsed.fileName,
    mimeType: parsed.mimeType,
    sizeBytes: parsed.sizeBytes,
    dataUrl: parsed.dataUrl
  });

  const saved = await db.$transaction(async (tx) => {
    const item = await tx.bomItem.findUnique({
      where: { id: parsed.itemId },
      select: { id: true, status: true }
    });

    if (!item) {
      throw new Error("BOM item was not found.");
    }
    if (item.status !== "active") throw new Error("Restore the Item before changing its documents.");

    const existing = await tx.bomItemDocument.findMany({
      where: { itemId: parsed.itemId, archivedAt: null },
      select: { sizeBytes: true }
    });
    const budget = validateBomItemDocumentBudget([
      ...existing,
      { sizeBytes: parsed.sizeBytes }
    ]);

    if (!budget.ok) {
      throw new Error(
        budget.violations[0]?.message ?? "BOM item documents are invalid."
      );
    }

    const row = await tx.bomItemDocument.create({
      data: {
        itemId: parsed.itemId,
        title: parsed.title,
        fileName: parsed.fileName,
        mimeType: parsed.mimeType,
        sizeBytes: parsed.sizeBytes,
        dataUrl: parsed.dataUrl,
        contentHash: hashItemDocumentContent(parsed)
      },
      select: { id: true }
    });

    const revision = await synchronizeItemGuidance({ itemId: parsed.itemId,
      expectedLatestRevisionId: parsed.expectedEngineeringRevisionId, addDocumentId: row.id }, tx);
    return { id: row.id, revisionId: revision?.id ?? null };
  });

  const metadata = await getBomItemDocumentMetadata(saved.id, db);
  return metadata ? { ...metadata, revisionId: saved.revisionId } : null;
}

export async function deleteBomItemDocument(
  input: BomItemDocumentDeleteInput,
  db: PrismaClient = prisma
) {
  const parsed = bomItemDocumentDeleteInputSchema.parse(input);

  return db.$transaction(async (tx) => {
    const item = await tx.bomItem.findUnique({ where: { id: parsed.itemId }, select: { status: true } });
    if (!item || item.status !== "active") throw new Error("Restore the Item before changing its documents.");
    const document = await tx.bomItemDocument.findFirst({
      where: {
        id: parsed.documentId,
        itemId: parsed.itemId
      },
      select: { id: true, itemId: true }
    });

    if (!document) {
      throw new Error("BOM item document was not found for this item.");
    }

    const revision = await synchronizeItemGuidance({ itemId: parsed.itemId,
      expectedLatestRevisionId: parsed.expectedEngineeringRevisionId, removeDocumentId: document.id }, tx);
    const referenced = await tx.bomItemRevisionDocument.count({ where: { documentId: document.id } });
    if (referenced) {
      await tx.bomItemDocument.update({ where: { id: document.id }, data: { archivedAt: new Date() } });
      return { ...document, revisionId: revision?.id ?? null, mode: "archived" as const };
    }
    await tx.bomItemDocument.delete({ where: { id: document.id } });
    return { ...document, revisionId: revision?.id ?? null, mode: "deleted" as const };
  });
}

export async function createBomItemCategory(
  input: BomItemOptionInput
): Promise<BomItemOption> {
  const parsed = bomItemOptionInputSchema.parse(input);
  const name = normalizeCategoryValue(parsed.name);
  const row = await prisma.bomItemCategory.upsert({
    where: { name },
    update: {},
    create: { name },
    select: { name: true }
  });

  return {
    value: row.name,
    label: categoryLabel(row.name)
  };
}

export async function createBomItemManufacturer(
  input: BomItemOptionInput
): Promise<BomItemOption> {
  const parsed = bomItemOptionInputSchema.parse(input);
  const name = parsed.name.trim();
  const row = await prisma.bomItemManufacturer.upsert({
    where: { name },
    update: {},
    create: { name },
    select: { name: true }
  });

  return {
    value: row.name,
    label: row.name
  };
}

export async function saveSymbolBomTemplate(input: SaveSymbolBomTemplateInput) {
  const parsed = saveSymbolBomTemplateInputSchema.parse(input);

  await prisma.$transaction(async (tx) => {
    const template = await tx.symbolBomTemplate.upsert({
      where: { symbolId: parsed.symbolId },
      update: { notes: nullable(parsed.notes) },
      create: {
        symbolId: parsed.symbolId,
        notes: nullable(parsed.notes)
      }
    });

    await tx.symbolBomTemplateLine.deleteMany({
      where: { templateId: template.id }
    });

    if (parsed.lines.length > 0) {
      await tx.symbolBomTemplateLine.createMany({
        data: parsed.lines.map((line, index) => ({
          templateId: template.id,
          itemId: line.itemId,
          lineNumber: index + 1,
          quantityRule: line.quantityRule,
          quantity: line.quantity,
          notes: nullable(line.notes)
        }))
      });
    }
  });

  return getSymbolBomTemplate(parsed.symbolId);
}
