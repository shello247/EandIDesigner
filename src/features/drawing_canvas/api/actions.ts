"use server";

import { revalidatePath } from "next/cache";
import {
  approveDrawing,
  createDrawing,
  createNmt81ToNrf81SampleDrawing,
  deleteDrawing,
  saveDrawing
} from "../data/mutations";
import type { SaveDrawingInput } from "../data/schema";
import type { ActionResult, DrawingDetail } from "../types";

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected server error.";
}

export async function createDrawingAction(
  formData: FormData
): Promise<ActionResult<DrawingDetail>> {
  try {
    const title = String(formData.get("title") ?? "").trim();
    const drawingKey = String(formData.get("drawingKey") ?? "").trim();
    const drawing = await createDrawing({
      title,
      drawingKey: drawingKey || undefined
    });

    if (!drawing) {
      return { ok: false, error: "Drawing could not be created." };
    }

    revalidatePath("/drawings");
    return { ok: true, data: drawing };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

export async function createSampleDrawingAction(): Promise<
  ActionResult<DrawingDetail>
> {
  try {
    const drawing = await createNmt81ToNrf81SampleDrawing();

    if (!drawing) {
      return { ok: false, error: "Sample drawing could not be created." };
    }

    revalidatePath("/drawings");
    return { ok: true, data: drawing };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

export async function saveDrawingAction(
  input: SaveDrawingInput
): Promise<ActionResult<DrawingDetail>> {
  try {
    const drawing = await saveDrawing(input);

    if (!drawing) {
      return { ok: false, error: "Drawing could not be saved." };
    }

    revalidatePath("/drawings");
    revalidatePath(`/drawings/${drawing.id}`);
    return { ok: true, data: drawing };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

export async function approveDrawingAction(
  drawingId: string
): Promise<ActionResult<DrawingDetail>> {
  try {
    const drawing = await approveDrawing(drawingId);

    if (!drawing) {
      return { ok: false, error: "Drawing could not be approved." };
    }

    revalidatePath("/drawings");
    revalidatePath(`/drawings/${drawingId}`);
    return { ok: true, data: drawing };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

export async function deleteDrawingAction(
  drawingId: string
): Promise<ActionResult<{ id: string }>> {
  try {
    await deleteDrawing(drawingId);
    revalidatePath("/drawings");
    revalidatePath(`/drawings/${drawingId}`);
    return { ok: true, data: { id: drawingId } };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}
