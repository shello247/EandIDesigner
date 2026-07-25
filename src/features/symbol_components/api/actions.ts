"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/features/symbol_registry/types";
import type { UpdateSymbolComponentsInput } from "../data/schema";
import { updateSymbolComponents } from "../data/mutations";

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected server error.";
}

export async function updateSymbolComponentsAction(
  input: UpdateSymbolComponentsInput
): Promise<ActionResult<{ symbolId: string }>> {
  try {
    const result = await updateSymbolComponents(input);
    revalidatePath("/symbols");
    revalidatePath(`/symbols/${result.symbolId}`);
    return { ok: true, data: result };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}
