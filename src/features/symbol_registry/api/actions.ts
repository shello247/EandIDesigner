"use server";

import { revalidatePath } from "next/cache";
import {
  deleteSymbol,
  exportSymbolPackage,
  saveSymbolMetadataChanges,
  saveSymbolDraft
} from "../data/mutations";
import {
  getSymbolDetail,
  getSymbolVersionForTerminalVerification,
  listSymbols
} from "../data/queries";
import type {
  SaveSymbolMetadataChangesInput,
  SaveSymbolDraftInput,
} from "../data/schema";
import { verifyTerminalMapWithAi } from "../logic/services/openai-terminal-map-verifier";
import type { ActionResult, SymbolDetail, SymbolListItem } from "../types";

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected server error.";
}

export async function listSymbolsAction(): Promise<
  ActionResult<SymbolListItem[]>
> {
  try {
    return { ok: true, data: await listSymbols() };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

export async function getSymbolAction(
  id: string
): Promise<ActionResult<SymbolDetail | null>> {
  try {
    return { ok: true, data: await getSymbolDetail(id) };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

export async function saveSymbolDraftAction(
  input: SaveSymbolDraftInput
): Promise<ActionResult<SymbolDetail>> {
  try {
    const saved = await saveSymbolDraft(input);
    if (!saved) {
      return { ok: false, error: "Symbol draft could not be saved." };
    }
    revalidatePath("/symbols");
    revalidatePath(`/symbols/${saved.id}`);
    return { ok: true, data: saved };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

export async function saveSymbolMetadataChangesAction(
  input: SaveSymbolMetadataChangesInput
): Promise<ActionResult<SymbolDetail>> {
  try {
    const updated = await saveSymbolMetadataChanges(input);
    if (!updated) {
      return { ok: false, error: "Symbol metadata could not be saved." };
    }
    revalidatePath("/symbols");
    revalidatePath(`/symbols/${updated.id}`);
    return { ok: true, data: updated };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

export async function verifyTerminalMapWithAiAction(
  versionId: string
): Promise<ActionResult<Awaited<ReturnType<typeof verifyTerminalMapWithAi>>>> {
  try {
    const input = await getSymbolVersionForTerminalVerification(versionId);

    if (!input) {
      return { ok: false, error: "Symbol version was not found." };
    }

    return { ok: true, data: await verifyTerminalMapWithAi(input) };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

export async function deleteSymbolAction(
  symbolId: string
): Promise<ActionResult<{ id: string }>> {
  try {
    await deleteSymbol(symbolId);
    revalidatePath("/symbols");
    revalidatePath(`/symbols/${symbolId}`);
    return { ok: true, data: { id: symbolId } };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

export async function exportSymbolPackageAction(
  symbolId: string
): Promise<ActionResult<Awaited<ReturnType<typeof exportSymbolPackage>>>> {
  try {
    return { ok: true, data: await exportSymbolPackage(symbolId) };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}
