"use server";

import { revalidatePath } from "next/cache";
import {
  createBomItemCategory,
  createBomItemManufacturer,
  createBomItem,
  deleteBomItem,
  saveSymbolBomTemplate,
  updateBomItem
} from "../data/mutations";
import { getBomItemDetail, listBomItems } from "../data/queries";
import type {
  BomItemDeleteResult,
  BomItemDetail,
  BomItemInput,
  BomItemOption,
  BomItemOptionInput,
  BomItemUpdateInput,
  SaveSymbolBomTemplateInput,
  SymbolBomTemplateDetail
} from "../data/schema";
import { validateSymbolBomTemplateInput } from "../logic/use_cases/symbol-bom-template-use-cases";
import type { ActionResult } from "../types";

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected server error.";
}

function revalidateBomOptionPaths() {
  revalidatePath("/bom");
  revalidatePath("/bom/items");
  revalidatePath("/symbols");
}

function revalidateBomPaths(input: { symbolId?: string; itemId?: string } = {}) {
  revalidatePath("/bom");
  revalidatePath("/bom/items");
  revalidatePath("/symbols");

  if (input.symbolId) {
    revalidatePath(`/symbols/${input.symbolId}`);
  }

  if (input.itemId) {
    revalidatePath(`/bom/items/${input.itemId}`);
  }
}

export async function createBomItemCategoryAction(
  input: BomItemOptionInput
): Promise<ActionResult<BomItemOption>> {
  try {
    const option = await createBomItemCategory(input);
    revalidateBomOptionPaths();
    return { ok: true, data: option };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

export async function createBomItemManufacturerAction(
  input: BomItemOptionInput
): Promise<ActionResult<BomItemOption>> {
  try {
    const option = await createBomItemManufacturer(input);
    revalidateBomOptionPaths();
    return { ok: true, data: option };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

export async function createBomItemAction(
  input: BomItemInput
): Promise<ActionResult<BomItemDetail>> {
  try {
    const item = await createBomItem(input);

    if (!item) {
      return { ok: false, error: "BOM item could not be created." };
    }

    revalidateBomPaths({ itemId: item.id });
    return { ok: true, data: item };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

export async function updateBomItemAction(
  input: BomItemUpdateInput
): Promise<ActionResult<BomItemDetail>> {
  try {
    const item = await updateBomItem(input);

    if (!item) {
      return { ok: false, error: "BOM item could not be updated." };
    }

    revalidateBomPaths({ itemId: item.id });
    return { ok: true, data: item };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

export async function getBomItemDetailAction(
  id: string
): Promise<ActionResult<BomItemDetail | null>> {
  try {
    const item = await getBomItemDetail(id);
    return { ok: true, data: item };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

export async function deleteBomItemAction(
  id: string
): Promise<ActionResult<BomItemDeleteResult>> {
  try {
    const result = await deleteBomItem(id);

    revalidateBomPaths({ itemId: result.id });
    return { ok: true, data: result };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

export async function saveSymbolBomTemplateAction(
  input: SaveSymbolBomTemplateInput
): Promise<ActionResult<SymbolBomTemplateDetail | null>> {
  try {
    const items = await listBomItems({ includeArchived: true });
    const parsed = validateSymbolBomTemplateInput(input, items);
    const template = await saveSymbolBomTemplate(parsed);

    revalidateBomPaths({ symbolId: parsed.symbolId });
    return { ok: true, data: template };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}
