"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { readClassificationBatch, getSymbolClassificationReview } from "../data/queries";
import { saveSymbolClassification } from "../data/mutations";
import type { ClassificationBatchInput, SaveSymbolClassificationInput } from "./contracts";

const errorMessage = (error: unknown) => error instanceof Error ? error.message : "Classification is unavailable. Try again.";
export async function readClassificationBatchAction(input: ClassificationBatchInput) {
  try { return { ok: true as const, data: await readClassificationBatch(input) }; }
  catch (error) { return { ok: false as const, error: errorMessage(error) }; }
}
export async function getSymbolClassificationReviewAction(versionId: string) {
  try { return { ok: true as const, data: await getSymbolClassificationReview(z.string().trim().min(1).max(160).parse(versionId)) }; }
  catch (error) { return { ok: false as const, error: errorMessage(error) }; }
}
export async function saveSymbolClassificationAction(input: SaveSymbolClassificationInput) {
  try {
    const data = await saveSymbolClassification(input);
    revalidatePath("/symbols");
    revalidatePath(`/symbols/${data.recordId}`);
    return { ok: true as const, data };
  } catch (error) { return { ok: false as const, error: errorMessage(error) }; }
}
