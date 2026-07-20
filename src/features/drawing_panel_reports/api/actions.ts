"use server";

import { z } from "zod";
import { listSymbolBomTemplatesForSymbols } from "@/features/bom_creator/api/public";

const symbolIdsSchema = z.array(z.string().trim().min(1)).max(500);

export async function loadPanelBomTemplatesAction(symbolIds: string[]) {
  try {
    const ids = [...new Set(symbolIdsSchema.parse(symbolIds))];
    return {
      ok: true as const,
      data: await listSymbolBomTemplatesForSymbols(ids)
    };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Unable to load BOM templates."
    };
  }
}
