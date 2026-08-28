import { prisma } from "@/lib/prisma";
import {
  createSymbolCategoryInputSchema,
  deleteSymbolCategoryInputSchema,
  normalizeSymbolCategoryName,
  updateSymbolCategoryInputSchema,
  type CreateSymbolCategoryInput,
  type DeleteSymbolCategoryInput,
  type UpdateSymbolCategoryInput
} from "./schema";
import { listSymbolCategories } from "./queries";

function normalizedDescription(value: string | undefined): string | null {
  return value?.trim() || null;
}

export async function createSymbolCategory(
  input: CreateSymbolCategoryInput
) {
  const parsed = createSymbolCategoryInputSchema.parse(input);
  const normalizedName = normalizeSymbolCategoryName(parsed.name);
  const existing = await prisma.symbolCategory.findUnique({
    where: { normalizedName },
    select: { id: true }
  });

  if (existing) {
    throw new Error("A symbol category with this name already exists.");
  }

  await prisma.symbolCategory.create({
    data: {
      name: parsed.name,
      normalizedName,
      description: normalizedDescription(parsed.description)
    }
  });

  return listSymbolCategories();
}

export async function updateSymbolCategory(
  input: UpdateSymbolCategoryInput
) {
  const parsed = updateSymbolCategoryInputSchema.parse(input);
  const category = await prisma.symbolCategory.findUnique({
    where: { id: parsed.categoryId }
  });

  if (!category) {
    throw new Error("Symbol category was not found.");
  }

  const normalizedName = normalizeSymbolCategoryName(parsed.name);
  if (category.isProtected && normalizedName !== category.normalizedName) {
    throw new Error("The protected Other category cannot be renamed.");
  }

  const duplicate = await prisma.symbolCategory.findFirst({
    where: {
      normalizedName,
      id: { not: category.id }
    },
    select: { id: true }
  });

  if (duplicate) {
    throw new Error("A symbol category with this name already exists.");
  }

  await prisma.symbolCategory.update({
    where: { id: category.id },
    data: {
      name: parsed.name,
      normalizedName,
      description: normalizedDescription(parsed.description)
    }
  });

  return listSymbolCategories();
}

export async function deleteSymbolCategory(
  input: DeleteSymbolCategoryInput
) {
  const parsed = deleteSymbolCategoryInputSchema.parse(input);
  const category = await prisma.symbolCategory.findUnique({
    where: { id: parsed.categoryId },
    include: {
      _count: {
        select: { symbols: true }
      }
    }
  });

  if (!category) {
    throw new Error("Symbol category was not found.");
  }

  if (category.isProtected) {
    throw new Error("The protected Other category cannot be deleted.");
  }

  if (category._count.symbols > 0 && !parsed.replacementCategoryId) {
    throw new Error(
      `Choose a replacement category for ${category._count.symbols} assigned symbol${category._count.symbols === 1 ? "" : "s"}.`
    );
  }

  if (parsed.replacementCategoryId === category.id) {
    throw new Error("Choose a different replacement category.");
  }

  if (parsed.replacementCategoryId) {
    const replacement = await prisma.symbolCategory.findUnique({
      where: { id: parsed.replacementCategoryId },
      select: { id: true }
    });

    if (!replacement) {
      throw new Error("The replacement symbol category is unavailable.");
    }
  }

  await prisma.$transaction(async (transaction) => {
    if (category._count.symbols > 0 && parsed.replacementCategoryId) {
      await transaction.symbol.updateMany({
        where: { categoryId: category.id },
        data: { categoryId: parsed.replacementCategoryId }
      });
    }

    await transaction.symbolCategory.delete({
      where: { id: category.id }
    });
  });

  return listSymbolCategories();
}
