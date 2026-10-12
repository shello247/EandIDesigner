"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { itemEngineeringActionResult, ItemEngineeringError } from "@/features/item_engineering/api/server";
import { getItemWorkspaceOverview, listItemWorkspaceDocuments, listItemWorkspaceUsage,
  updateItemWorkspaceDetails, updateItemWorkspaceCommercial, updateItemWorkspaceImages } from "../data/item-workspace";

export async function loadItemWorkspaceOverviewAction(itemId: string) {
  return itemEngineeringActionResult(async () => {
    const item = await getItemWorkspaceOverview(itemId);
    if (!item) throw new ItemEngineeringError("NOT_FOUND", "Item was not found.");
    return item;
  });
}
export async function loadItemWorkspaceDocumentsAction(itemId: string) {
  return itemEngineeringActionResult(() => listItemWorkspaceDocuments(z.string().min(1).parse(itemId)));
}
export async function loadItemWorkspaceUsageAction(itemId: string) {
  return itemEngineeringActionResult(() => listItemWorkspaceUsage(z.string().min(1).parse(itemId)));
}
export async function saveItemDetailsAction(input: unknown) {
  return itemEngineeringActionResult(async () => {
    const item = await updateItemWorkspaceDetails(input);
    revalidatePath(`/bom/items/${item.id}`);
    return item;
  });
}
export async function saveItemCommercialAction(input: unknown) {
  return itemEngineeringActionResult(async () => {
    const item = await updateItemWorkspaceCommercial(input);
    revalidatePath(`/bom/items/${item.id}`);
    return item;
  });
}
export async function saveItemImagesAction(input: unknown) {
  return itemEngineeringActionResult(async () => {
    const item = await updateItemWorkspaceImages(input);
    revalidatePath(`/bom/items/${item.id}`);
    return item;
  });
}
