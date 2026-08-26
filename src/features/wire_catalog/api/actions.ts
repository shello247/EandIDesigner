"use server";

import { revalidatePath } from "next/cache";
import {
  createWireCatalogEntry,
  deleteWireCatalogEntry,
  setDefaultWireCatalogEntry,
  updateWireCatalogEntry
} from "../data/mutations";
import { listWireCatalogEntries } from "../data/queries";
import type {
  DeleteWireCatalogEntryInput,
  SetDefaultWireCatalogEntryInput,
  UpdateWireCatalogEntryInput,
  WireCatalogEntry,
  WireCatalogEntryInput
} from "../data/schema";
import type { WireCatalogActionResult } from "../types";

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected server error.";
}

function revalidateConsumers() {
  revalidatePath("/drawings");
}

export async function listWireCatalogEntriesAction(): Promise<
  WireCatalogActionResult<WireCatalogEntry[]>
> {
  try {
    return { ok: true, data: await listWireCatalogEntries() };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

export async function createWireCatalogEntryAction(
  input: WireCatalogEntryInput
): Promise<WireCatalogActionResult<WireCatalogEntry[]>> {
  try {
    const data = await createWireCatalogEntry(input);
    revalidateConsumers();
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

export async function updateWireCatalogEntryAction(
  input: UpdateWireCatalogEntryInput
): Promise<WireCatalogActionResult<WireCatalogEntry[]>> {
  try {
    const data = await updateWireCatalogEntry(input);
    revalidateConsumers();
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

export async function deleteWireCatalogEntryAction(
  input: DeleteWireCatalogEntryInput
): Promise<WireCatalogActionResult<WireCatalogEntry[]>> {
  try {
    const data = await deleteWireCatalogEntry(input);
    revalidateConsumers();
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

export async function setDefaultWireCatalogEntryAction(
  input: SetDefaultWireCatalogEntryInput
): Promise<WireCatalogActionResult<WireCatalogEntry[]>> {
  try {
    const data = await setDefaultWireCatalogEntry(input);
    revalidateConsumers();
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}
