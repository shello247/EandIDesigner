"use server";

import { revalidatePath } from "next/cache";
import {
  createDrawing,
  deleteDrawing,
  DrawingRevisionConflictError,
  saveDrawing,
  saveDrawingReviewState
} from "../data/mutations";
import type { SaveDrawingInput } from "../data/schema";
import type {
  ActionResult,
  DrawingApprovalOutcome,
  DrawingDetail
} from "../types";
import { listSymbolsForDrawing } from "@/features/symbol_registry/api/public";
import { detailedPanelDrawingsEnabled } from "@/features/drawing_panel_wiring/api/release";
import { buildDrawingApprovalDecision } from "../logic/services/drawing-approval-quality";
import { getDrawingDetail } from "../data/queries";
import {
  containsDetailedPanelDrawings,
  hasDetailedPanelMutation
} from "../logic/services/drawing-detailed-panel-release";

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected server error.";
}

function toActionError(error: unknown): ActionResult<never> {
  if (error instanceof DrawingRevisionConflictError) {
    return {
      ok: false,
      error: error.message,
      code: "conflict",
      latestUpdatedAt: error.latestUpdatedAt
    };
  }
  return { ok: false, error: toErrorMessage(error) };
}

async function detailedPanelMutationBlocked(
  input: SaveDrawingInput
): Promise<boolean> {
  if (detailedPanelDrawingsEnabled()) return false;
  const current = await getDrawingDetail(input.drawingId);
  return current ? hasDetailedPanelMutation(current.model, input.model) : true;
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
    return toActionError(error);
  }
}

export async function saveDrawingAction(
  input: SaveDrawingInput
): Promise<ActionResult<DrawingDetail>> {
  try {
    if (await detailedPanelMutationBlocked(input)) {
      return {
        ok: false,
        code: "unavailable",
        error: "Detailed Panel Drawings are read-only in this deployment."
      };
    }
    const drawing = await saveDrawing(input);

    if (!drawing) {
      return { ok: false, error: "Drawing could not be saved." };
    }

    revalidatePath("/drawings");
    revalidatePath(`/drawings/${drawing.id}`);
    return { ok: true, data: drawing };
  } catch (error) {
    return toActionError(error);
  }
}

export async function approveDrawingAction(
  input: SaveDrawingInput
): Promise<ActionResult<DrawingApprovalOutcome>> {
  try {
    if (
      !detailedPanelDrawingsEnabled() &&
      containsDetailedPanelDrawings(input.model)
    ) {
      return {
        ok: false,
        code: "unavailable",
        error: "Detailed Panel packages cannot be approved while the feature is read-only."
      };
    }
    const symbols = await listSymbolsForDrawing();
    const decision = buildDrawingApprovalDecision(input.model, symbols);
    const drawing = await saveDrawingReviewState(input, decision.status);

    if (!drawing) {
      return { ok: false, error: "Drawing could not be approved." };
    }

    revalidatePath("/drawings");
    revalidatePath(`/drawings/${input.drawingId}`);
    return {
      ok: true,
      data: {
        drawing,
        quality: decision.quality,
        approved: decision.quality.canApprove
      }
    };
  } catch (error) {
    return toActionError(error);
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
