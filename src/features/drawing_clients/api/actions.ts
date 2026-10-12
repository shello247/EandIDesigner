"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createDrawingClientInputSchema } from "../data/schema";
import { DrawingClientDomainError } from "../data/mutations";
import { createDrawingClient } from "./server";
import type {
  DrawingClientActionResult,
  DrawingClientSummary
} from "../types";

export async function createDrawingClientAction(
  formData: FormData
): Promise<DrawingClientActionResult<DrawingClientSummary>> {
  try {
    const client = await createDrawingClient(
      createDrawingClientInputSchema.parse({
        name: String(formData.get("name") ?? "")
      })
    );
    revalidatePath("/projects/new");
    revalidatePath("/projects");
    return { ok: true, data: client };
  } catch (error) {
    if (error instanceof DrawingClientDomainError) {
      return {
        ok: false,
        error: error.message,
        code: "validation",
        fieldErrors: { name: error.message }
      };
    }
    if (error instanceof z.ZodError) {
      const message = error.issues[0]?.message ?? "Enter a valid Client name.";
      return {
        ok: false,
        error: message,
        code: "validation",
        fieldErrors: { name: message }
      };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unexpected server error."
    };
  }
}
