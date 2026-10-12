"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createItemEngineeringRevision, saveItemWorkspaceProfile } from "../data/mutations";
import { getLatestItemEngineeringRevision, getItemEngineeringRevision } from "../data/queries";
import { saveItemEngineerNote, archiveItemEngineerNote, listItemEngineerNotePage, getItemEngineerNote, reorderItemEngineerNote } from "../data/guidance";
import { itemEngineeringActionResult } from "../logic/services/item-engineering-action-result";
import { ItemEngineeringError } from "../logic/services/item-engineering-revision";

export async function saveItemEngineeringProfileAction(input: unknown) {
  return itemEngineeringActionResult(async () => {
    const result = await createItemEngineeringRevision(input);
    revalidatePath(`/bom/items/${result.revision.itemId}`);
    return result;
  });
}
export async function saveItemWorkspaceProfileAction(input: unknown) {
  return itemEngineeringActionResult(async () => {
    const result = await saveItemWorkspaceProfile(input);
    revalidatePath(`/bom/items/${result.revision.itemId}`);
    return result;
  });
}
export async function saveItemEngineerNoteAction(input: unknown) {
  return itemEngineeringActionResult(async () => {
    const result = await saveItemEngineerNote(input);
    revalidatePath(`/bom/items/${result.note.itemId}`);
    return result;
  });
}
export async function archiveItemEngineerNoteAction(input: unknown) {
  return itemEngineeringActionResult(async () => {
    const parsed = z.object({ itemId: z.string().trim().min(1) }).parse(input);
    const result = await archiveItemEngineerNote(input);
    revalidatePath(`/bom/items/${parsed.itemId}`);
    return result;
  });
}
export async function loadItemEngineerNotePageAction(input: unknown) {
  return itemEngineeringActionResult(() => listItemEngineerNotePage(input));
}
export async function reorderItemEngineerNoteAction(input: unknown) {
  return itemEngineeringActionResult(async () => {
    const result = await reorderItemEngineerNote(input);
    revalidatePath(`/bom/items/${result.itemId}`);
    return result;
  });
}
export async function loadItemEngineerNoteAction(input: unknown) {
  return itemEngineeringActionResult(async () => {
    const parsed = z.strictObject({ itemId: z.string().trim().min(1), noteId: z.string().trim().min(1) }).parse(input);
    const note = await getItemEngineerNote(parsed.itemId, parsed.noteId);
    if (!note) throw new ItemEngineeringError("NOT_FOUND", "Item note was not found.");
    return note;
  });
}
export async function loadItemEngineeringRevisionAction(input: unknown) {
  return itemEngineeringActionResult(async () => {
    const parsed = z.strictObject({ itemId: z.string().trim().min(1), revisionId: z.string().trim().min(1).optional() }).parse(input);
    const revision = parsed.revisionId ? await getItemEngineeringRevision(parsed.revisionId) : await getLatestItemEngineeringRevision(parsed.itemId);
    if (parsed.revisionId && !revision || revision && revision.itemId !== parsed.itemId) {
      throw new ItemEngineeringError("NOT_FOUND", "Item engineering revision was not found for this Item.");
    }
    return revision;
  });
}
