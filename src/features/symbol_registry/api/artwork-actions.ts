"use server";

import { revalidatePath } from "next/cache";
import { previewSymbolArtwork, replaceSymbolArtwork } from "../data/artwork";
import type { ArtworkInput, ArtworkSaveInput, ArtworkPreview } from "../data/artwork-schema";
import type { ActionResult } from "../types";

export async function previewSymbolArtworkAction(input: ArtworkInput): Promise<ActionResult<ArtworkPreview>> {
  try { return { ok: true, data: await previewSymbolArtwork(input) }; }
  catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Artwork preview failed." }; }
}
export async function replaceSymbolArtworkAction(input: ArtworkSaveInput): Promise<ActionResult<{ versionId: string; versionNumber: number }>> {
  try {
    const data = await replaceSymbolArtwork(input);
    revalidatePath("/symbols");
    revalidatePath(`/symbols/${input.symbolId}`);
    return { ok: true, data };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Artwork could not be saved. Your file is retained." }; }
}
