"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/features/symbol_registry/types";
import {
  createSymbolCategory,
  deleteSymbolCategory,
  updateSymbolCategory
} from "../data/mutations";
import type {
  CreateSymbolCategoryInput,
  DeleteSymbolCategoryInput,
  SymbolCategoryRecord,
  UpdateSymbolCategoryInput
} from "../data/schema";

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected server error.";
}

function revalidateCategoryConsumers() {
  revalidatePath("/symbols");
  revalidatePath("/symbols/new");
  revalidatePath("/drawings");
}

export async function createSymbolCategoryAction(
  input: CreateSymbolCategoryInput
): Promise<ActionResult<SymbolCategoryRecord[]>> {
  try {
    const categories = await createSymbolCategory(input);
    revalidateCategoryConsumers();
    return { ok: true, data: categories };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

export async function updateSymbolCategoryAction(
  input: UpdateSymbolCategoryInput
): Promise<ActionResult<SymbolCategoryRecord[]>> {
  try {
    const categories = await updateSymbolCategory(input);
    revalidateCategoryConsumers();
    return { ok: true, data: categories };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

export async function deleteSymbolCategoryAction(
  input: DeleteSymbolCategoryInput
): Promise<ActionResult<SymbolCategoryRecord[]>> {
  try {
    const categories = await deleteSymbolCategory(input);
    revalidateCategoryConsumers();
    return { ok: true, data: categories };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}
