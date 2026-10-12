"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { loadItemAttributeWorkspace, saveItemAttribute, removeItemAttribute, updateItemEngineeringClassification } from "../data/attributes";
import { itemEngineeringActionResult } from "../logic/services/item-engineering-action-result";
export async function loadItemAttributeWorkspaceAction(input: unknown) {
  return itemEngineeringActionResult(() => loadItemAttributeWorkspace(z.strictObject({ itemId: z.string().min(1) }).parse(input).itemId));
}
async function save<T>(input: unknown, operation: (input:unknown)=>Promise<T>) {
  return itemEngineeringActionResult(async () => {
    const result = await operation(input);
    revalidatePath("/bom/items/" + z.object({ itemId: z.string() }).parse(input).itemId);
    return result;
  });
}
export async function saveItemAttributeAction(input: unknown) { return save(input, saveItemAttribute); }
export async function removeItemAttributeAction(input: unknown) { return save(input, removeItemAttribute); }
export async function updateItemEngineeringClassificationAction(input: unknown) { return save(input, updateItemEngineeringClassification); }
