import { cache } from "react";
import { prisma } from "@/lib/prisma";
import {
  normalizeSymbolCategoryName,
  PROTECTED_SYMBOL_CATEGORY_NAME,
  sortSymbolCategories,
  type SymbolCategoryRecord,
  type SymbolCategorySummary
} from "./schema";

export const listSymbolCategories = cache(
  async (): Promise<SymbolCategoryRecord[]> => {
    const rows = await prisma.symbolCategory.findMany({
      include: {
        _count: {
          select: { symbols: true }
        }
      }
    });

    return sortSymbolCategories(
      rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description ?? undefined,
        isProtected: row.isProtected,
        symbolCount: row._count.symbols
      }))
    );
  }
);

export async function getSymbolCategorySummary(
  categoryId: string | null | undefined
): Promise<SymbolCategorySummary> {
  const category = categoryId
    ? await prisma.symbolCategory.findUnique({
        where: { id: categoryId },
        select: { id: true, name: true }
      })
    : null;

  if (category) {
    return category;
  }

  const fallback = await prisma.symbolCategory.findUnique({
    where: {
      normalizedName: normalizeSymbolCategoryName(
        PROTECTED_SYMBOL_CATEGORY_NAME
      )
    },
    select: { id: true, name: true }
  });

  if (!fallback) {
    throw new Error(
      "The protected Other symbol category has not been initialized."
    );
  }

  return fallback;
}

export async function findSymbolCategoryByName(
  name: string
): Promise<SymbolCategorySummary | null> {
  return prisma.symbolCategory.findUnique({
    where: { normalizedName: normalizeSymbolCategoryName(name) },
    select: { id: true, name: true }
  });
}

export async function requireSymbolCategory(
  categoryId: string
): Promise<SymbolCategorySummary> {
  const category = await prisma.symbolCategory.findUnique({
    where: { id: categoryId },
    select: { id: true, name: true }
  });

  if (!category) {
    throw new Error("The selected symbol category is unavailable.");
  }

  return category;
}
