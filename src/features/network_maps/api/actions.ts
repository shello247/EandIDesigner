"use server";

import { revalidatePath } from "next/cache";
import {
  approveNetworkMap,
  createNetworkMap,
  deleteNetworkMap,
  saveNetworkMap
} from "../data/mutations";
import type { SaveNetworkMapInput } from "../data/schema";
import type {
  ActionResult,
  ApprovedNetworkSymbol,
  NetworkMapDetail
} from "../types";
import { listApprovedNetworkSymbolVersionsByIds } from "@/features/symbol_registry/api/public";

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected server error.";
}

export async function createNetworkMapAction(
  formData: FormData
): Promise<ActionResult<NetworkMapDetail>> {
  try {
    const title = String(formData.get("title") ?? "").trim();
    const mapKey = String(formData.get("mapKey") ?? "").trim();
    const networkMap = await createNetworkMap({
      title,
      mapKey: mapKey || undefined
    });

    if (!networkMap) {
      return { ok: false, error: "Network map could not be created." };
    }

    revalidatePath("/networking");
    return { ok: true, data: networkMap };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

export async function saveNetworkMapAction(
  input: SaveNetworkMapInput
): Promise<ActionResult<NetworkMapDetail>> {
  try {
    const networkMap = await saveNetworkMap(input);

    if (!networkMap) {
      return { ok: false, error: "Network map could not be saved." };
    }

    revalidatePath("/networking");
    revalidatePath(`/networking/${networkMap.id}`);
    return { ok: true, data: networkMap };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

export async function approveNetworkMapAction(
  networkMapId: string
): Promise<ActionResult<NetworkMapDetail>> {
  try {
    const networkMap = await approveNetworkMap(networkMapId);

    if (!networkMap) {
      return { ok: false, error: "Network map could not be approved." };
    }

    revalidatePath("/networking");
    revalidatePath(`/networking/${networkMapId}`);
    return { ok: true, data: networkMap };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

export async function deleteNetworkMapAction(
  networkMapId: string
): Promise<ActionResult<{ id: string }>> {
  try {
    await deleteNetworkMap(networkMapId);
    revalidatePath("/networking");
    revalidatePath(`/networking/${networkMapId}`);
    return { ok: true, data: { id: networkMapId } };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

export async function loadApprovedNetworkSymbolForPlacementAction(
  versionId: string
): Promise<ActionResult<ApprovedNetworkSymbol>> {
  try {
    const [symbol] = await listApprovedNetworkSymbolVersionsByIds([versionId]);

    return symbol
      ? { ok: true, data: symbol }
      : {
          ok: false,
          error: "This approved network symbol version is no longer available."
        };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}
