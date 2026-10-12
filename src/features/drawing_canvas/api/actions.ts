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
  ApprovedDrawingSymbol,
  DrawingApprovalOutcome,
  DrawingDetail,
  DrawingSaveAcknowledgment
} from "../types";
import {
  listDrawingRenderSymbols
} from "@/features/symbol_registry/api/public";
import { detailedPanelDrawingsEnabled } from "@/features/drawing_panel_wiring/api/release";
import { buildDrawingApprovalDecision } from "../logic/services/drawing-approval-quality";
import { getDrawingDetail } from "../data/queries";
import {
  containsDetailedPanelDrawings,
  hasDetailedPanelMutation
} from "../logic/services/drawing-detailed-panel-release";
import { collectDrawingSymbolVersionIds } from "../logic/services/drawing-symbol-version-references";
import { validateDrawingAssetComponentConfigurations } from "@/features/symbol_components/api/public";
import { createPanelWiringSource } from "./panel-wiring-contracts";
import {
  buildPackageConnectivityGraph,
  buildPackageTerminalOccupancyIndex,
  validateTerminalConflictDelta
} from "@/features/drawing_panel_wiring/api/public";

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
  input: SaveDrawingInput,
  current: DrawingDetail | null
): Promise<boolean> {
  if (detailedPanelDrawingsEnabled()) return false;
  return current ? hasDetailedPanelMutation(current.model, input.model) : true;
}

async function validateSavedTerminalOccupancy(
  input: SaveDrawingInput,
  current: DrawingDetail
): Promise<
  | { ok: true; symbols: ApprovedDrawingSymbol[] }
  | { ok: false; error: string }
> {
  const versionIds = new Set([
    ...collectDrawingSymbolVersionIds(current.model),
    ...collectDrawingSymbolVersionIds(input.model)
  ]);
  const symbols = await listDrawingRenderSymbols([...versionIds]);
  const baseline = buildPackageTerminalOccupancyIndex(
    buildPackageConnectivityGraph(
      createPanelWiringSource(current.model, symbols)
    )
  );
  const candidate = buildPackageTerminalOccupancyIndex(
    buildPackageConnectivityGraph(
      createPanelWiringSource(input.model, symbols)
    )
  );
  const validation = validateTerminalConflictDelta({ baseline, candidate });
  const conflict = validation.conflicts[0];
  if (conflict) {
    const baselineOccupantKeys = new Set(
      baseline.conductorOccupantsBySideId
        .get(conflict.sideId)
        ?.map((occupant) => occupant.sourceKey) ?? []
    );
    const newOccupant = conflict.occupants.find(
      (occupant) => !baselineOccupantKeys.has(occupant.sourceKey)
    ) ?? conflict.occupants.at(-1);
    const existingOccupant = conflict.occupants.find(
      (occupant) => occupant.sourceKey !== newOccupant?.sourceKey
    );
    return {
      ok: false,
      error: `${conflict.terminal.terminalKey}/${conflict.terminal.side} already has ${
        existingOccupant?.wireId ?? existingOccupant?.label ?? "a conductor"
      }${
        existingOccupant?.sheetNumber
          ? ` on Sheet ${existingOccupant.sheetNumber} — ${existingOccupant.sheetName ?? "Untitled"}`
          : ""
      }. Move ${newOccupant?.wireId ?? newOccupant?.label ?? "the new conductor"} to a free terminal end.`
    };
  }
  const unresolved = validation.unresolvedManagedEndpoints[0];
  if (unresolved) {
    return {
      ok: false,
      error: `Sheet ${unresolved.sheetNumber} — ${unresolved.sheetName}: ${unresolved.anchorKey} cannot be resolved to a managed terminal end. ${unresolved.reason}`
    };
  }
  return { ok: true, symbols };
}

export async function loadDrawingSymbolVersionAction(
  versionId: string
): Promise<ActionResult<ApprovedDrawingSymbol>> {
  try {
    const [symbol] = await listDrawingRenderSymbols([versionId]);
    return symbol
      ? { ok: true, data: { ...symbol, selectable: true } }
      : { ok: false, error: "Symbol version was not found." };
  } catch (error) {
    return toActionError(error);
  }
}

export async function createDrawingAction(
  formData: FormData
): Promise<ActionResult<DrawingDetail>> {
  try {
    const title = String(formData.get("title") ?? "").trim();
    const drawing = await createDrawing({
      title,
      description: String(formData.get("description") ?? "").trim() || undefined,
      projectId: String(formData.get("projectId") ?? "").trim() || undefined
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
): Promise<ActionResult<DrawingSaveAcknowledgment>> {
  try {
    const current = await getDrawingDetail(input.drawingId);
    if (!current) {
      return { ok: false, error: "Drawing was not found." };
    }
    if (await detailedPanelMutationBlocked(input, current)) {
      return {
        ok: false,
        code: "unavailable",
        error: "Detailed Panel Drawings are read-only in this deployment."
      };
    }
    const terminalValidation = await validateSavedTerminalOccupancy(
      input,
      current
    );
    if (!terminalValidation.ok) {
      return {
        ok: false,
        code: "validation",
        error: terminalValidation.error
      };
    }
    const symbols = terminalValidation.symbols;
    const componentIssue = validateDrawingAssetComponentConfigurations({
      model: input.model,
      symbols
    }).find((issue) => issue.severity === "blocking");

    if (componentIssue) {
      return {
        ok: false,
        code: "validation",
        error: componentIssue.message
      };
    }
    const acknowledgment = await saveDrawing({
      ...input,
      expectedUpdatedAt: input.expectedUpdatedAt ?? current.updatedAt
    });

    // The editor already owns the saved model and consumes the returned
    // updated timestamp. The drawing list is force-dynamic and is fetched
    // afresh on explicit navigation, so invalidating it here only expands and
    // prolongs this action's RSC response.
    return { ok: true, data: acknowledgment };
  } catch (error) {
    return toActionError(error);
  }
}

export async function approveDrawingAction(
  input: SaveDrawingInput
): Promise<ActionResult<DrawingApprovalOutcome>> {
  try {
    const current = await getDrawingDetail(input.drawingId);
    if (!current) {
      return { ok: false, error: "Drawing was not found." };
    }
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
    const terminalValidation = await validateSavedTerminalOccupancy(
      input,
      current
    );
    if (!terminalValidation.ok) {
      return {
        ok: false,
        code: "validation",
        error: terminalValidation.error
      };
    }
    const symbols = terminalValidation.symbols;
    const componentIssue = validateDrawingAssetComponentConfigurations({
      model: input.model,
      symbols
    }).find((issue) => issue.severity === "blocking");
    if (componentIssue) {
      return {
        ok: false,
        code: "validation",
        error: componentIssue.message
      };
    }
    const decision = buildDrawingApprovalDecision(input.model, symbols);
    const drawing = await saveDrawingReviewState(
      {
        ...input,
        expectedUpdatedAt: input.expectedUpdatedAt ?? current.updatedAt
      },
      decision.status
    );

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
    revalidatePath("/projects");
    revalidatePath("/projects/[id]", "page");
    return { ok: true, data: { id: drawingId } };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}
