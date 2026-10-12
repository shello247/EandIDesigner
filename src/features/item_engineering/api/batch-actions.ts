"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { loadSpecificationWorkspace, previewItemAttributeBatch, saveItemAttributeBatch } from "../data/attribute-batches";
import { loadAttributeEvidence } from "../data/attribute-evidence";
import { itemEngineeringActionResult } from "../logic/services/item-engineering-action-result";
export async function loadSpecificationWorkspaceAction(input: unknown) {
  return itemEngineeringActionResult(() => loadSpecificationWorkspace(z.strictObject({ itemId: z.string().min(1) }).parse(input).itemId));
}
export async function previewItemAttributeBatchAction(input: unknown) { return itemEngineeringActionResult(() => previewItemAttributeBatch(input)); }
export async function saveItemAttributeBatchAction(input: unknown) {
  return itemEngineeringActionResult(async () => { const saved = await saveItemAttributeBatch(input);
    revalidatePath(`/bom/items/${z.object({ itemId: z.string().min(1) }).parse(input).itemId}`); return saved; });
}
export async function loadAttributeEvidenceAction(input: unknown) { return itemEngineeringActionResult(() => loadAttributeEvidence(input)); }
