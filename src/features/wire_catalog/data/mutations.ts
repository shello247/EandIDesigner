import { prisma } from "@/lib/prisma";
import {
  deleteWireCatalogEntryInputSchema,
  normalizeWireCatalogName,
  setDefaultWireCatalogEntryInputSchema,
  updateWireCatalogEntryInputSchema,
  wireCatalogEntryInputSchema,
  type DeleteWireCatalogEntryInput,
  type SetDefaultWireCatalogEntryInput,
  type UpdateWireCatalogEntryInput,
  type WireCatalogEntryInput
} from "./schema";
import { listWireCatalogEntries } from "./queries";

function normalizedNotes(value: string | undefined): string | null {
  return value?.trim() || null;
}

async function assertUniqueName(normalizedName: string, ignoreId?: string) {
  const duplicate = await prisma.wireCatalogEntry.findFirst({
    where: {
      normalizedName,
      ...(ignoreId ? { id: { not: ignoreId } } : {})
    },
    select: { id: true }
  });
  if (duplicate) {
    throw new Error("A wire catalog entry with this name already exists.");
  }
}

export async function createWireCatalogEntry(input: WireCatalogEntryInput) {
  const parsed = wireCatalogEntryInputSchema.parse(input);
  const normalizedName = normalizeWireCatalogName(parsed.name);
  await assertUniqueName(normalizedName);

  await prisma.$transaction(async (transaction) => {
    const count = await transaction.wireCatalogEntry.count();
    const makeDefault = count === 0 || parsed.makeDefault === true;
    if (makeDefault) {
      await transaction.wireCatalogEntry.updateMany({
        data: { isDefault: false }
      });
    }
    await transaction.wireCatalogEntry.create({
      data: {
        name: parsed.name,
        normalizedName,
        wireType: parsed.wireType,
        size: parsed.size,
        color: parsed.color,
        notes: normalizedNotes(parsed.notes),
        isDefault: makeDefault
      }
    });
  });
  return listWireCatalogEntries();
}

export async function updateWireCatalogEntry(
  input: UpdateWireCatalogEntryInput
) {
  const parsed = updateWireCatalogEntryInputSchema.parse(input);
  const current = await prisma.wireCatalogEntry.findUnique({
    where: { id: parsed.entryId }
  });
  if (!current) throw new Error("Wire catalog entry was not found.");
  const normalizedName = normalizeWireCatalogName(parsed.name);
  await assertUniqueName(normalizedName, current.id);

  await prisma.$transaction(async (transaction) => {
    if (parsed.makeDefault) {
      await transaction.wireCatalogEntry.updateMany({
        data: { isDefault: false }
      });
    }
    await transaction.wireCatalogEntry.update({
      where: { id: current.id },
      data: {
        name: parsed.name,
        normalizedName,
        wireType: parsed.wireType,
        size: parsed.size,
        color: parsed.color,
        notes: normalizedNotes(parsed.notes),
        isDefault: parsed.makeDefault ? true : current.isDefault
      }
    });
  });
  return listWireCatalogEntries();
}

export async function setDefaultWireCatalogEntry(
  input: SetDefaultWireCatalogEntryInput
) {
  const parsed = setDefaultWireCatalogEntryInputSchema.parse(input);
  const entry = await prisma.wireCatalogEntry.findUnique({
    where: { id: parsed.entryId },
    select: { id: true }
  });
  if (!entry) throw new Error("Wire catalog entry was not found.");
  await prisma.$transaction([
    prisma.wireCatalogEntry.updateMany({ data: { isDefault: false } }),
    prisma.wireCatalogEntry.update({
      where: { id: entry.id },
      data: { isDefault: true }
    })
  ]);
  return listWireCatalogEntries();
}

export async function deleteWireCatalogEntry(
  input: DeleteWireCatalogEntryInput
) {
  const parsed = deleteWireCatalogEntryInputSchema.parse(input);
  const entry = await prisma.wireCatalogEntry.findUnique({
    where: { id: parsed.entryId }
  });
  if (!entry) throw new Error("Wire catalog entry was not found.");
  const count = await prisma.wireCatalogEntry.count();

  if (entry.isDefault && count > 1 && !parsed.replacementDefaultId) {
    throw new Error("Choose a replacement default before deleting this entry.");
  }
  if (parsed.replacementDefaultId === entry.id) {
    throw new Error("Choose a different replacement default.");
  }

  await prisma.$transaction(async (transaction) => {
    if (entry.isDefault && parsed.replacementDefaultId) {
      const replacement = await transaction.wireCatalogEntry.findUnique({
        where: { id: parsed.replacementDefaultId },
        select: { id: true }
      });
      if (!replacement) {
        throw new Error("The replacement wire catalog entry is unavailable.");
      }
      await transaction.wireCatalogEntry.updateMany({
        data: { isDefault: false }
      });
      await transaction.wireCatalogEntry.update({
        where: { id: replacement.id },
        data: { isDefault: true }
      });
    }
    await transaction.wireCatalogEntry.delete({ where: { id: entry.id } });
  });
  return listWireCatalogEntries();
}
