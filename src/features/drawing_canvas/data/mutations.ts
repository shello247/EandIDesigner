import { prisma } from "@/lib/prisma";
import {
  createDefaultDrawingModel,
  createDrawingInputSchema,
  saveDrawingInputSchema,
  stringifyDrawingModel,
  type CreateDrawingInput,
  type SaveDrawingInput
} from "./schema";
import { getDrawingDetail } from "./queries";
import type { DrawingSaveAcknowledgment } from "../types";

export class DrawingRevisionConflictError extends Error {
  readonly latestUpdatedAt?: string;

  constructor(latestUpdatedAt?: string) {
    super("This drawing changed after it was opened. Reload the latest revision before saving.");
    this.name = "DrawingRevisionConflictError";
    this.latestUpdatedAt = latestUpdatedAt;
  }
}

async function updateDrawingRevision({
  drawingId,
  expectedUpdatedAt,
  data
}: {
  drawingId: string;
  expectedUpdatedAt?: string;
  data: { title: string; status: string; modelJson: string };
}): Promise<DrawingSaveAcknowledgment> {
  if (!expectedUpdatedAt) {
    const row = await prisma.drawing.update({
      where: { id: drawingId },
      data,
      select: { id: true, updatedAt: true }
    });
    return { id: row.id, updatedAt: row.updatedAt.toISOString() };
  }

  const [row] = await prisma.drawing.updateManyAndReturn({
    where: {
      id: drawingId,
      updatedAt: new Date(expectedUpdatedAt)
    },
    data,
    limit: 1,
    select: { id: true, updatedAt: true }
  });

  if (!row) {
    const latest = await prisma.drawing.findUnique({
      where: { id: drawingId },
      select: { updatedAt: true }
    });
    throw new DrawingRevisionConflictError(latest?.updatedAt.toISOString());
  }

  return { id: row.id, updatedAt: row.updatedAt.toISOString() };
}

function normalizeDrawingKey(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized.length > 0 ? normalized : "drawing";
}

async function nextUniqueDrawingKey(baseValue: string): Promise<string> {
  const baseKey = normalizeDrawingKey(baseValue);
  let candidate = baseKey;
  let suffix = 2;

  while (
    await prisma.drawing.findUnique({
      where: { drawingKey: candidate },
      select: { id: true }
    })
  ) {
    candidate = `${baseKey}_${suffix}`;
    suffix += 1;
  }

  return candidate;
}

export async function createDrawing(input: CreateDrawingInput) {
  const parsed = createDrawingInputSchema.parse(input);
  const drawingKey = await nextUniqueDrawingKey(
    parsed.drawingKey ?? parsed.title
  );
  const model = createDefaultDrawingModel();

  const row = await prisma.drawing.create({
    data: {
      drawingKey,
      title: parsed.title,
      status: "draft",
      modelJson: stringifyDrawingModel(model)
    }
  });

  return getDrawingDetail(row.id);
}

export async function saveDrawing(input: SaveDrawingInput) {
  const parsed = saveDrawingInputSchema.parse(input);

  return updateDrawingRevision({
    drawingId: parsed.drawingId,
    expectedUpdatedAt: parsed.expectedUpdatedAt,
    data: {
      title: parsed.title,
      status: "needs_review",
      modelJson: stringifyDrawingModel(parsed.model)
    }
  });
}

export async function saveDrawingReviewState(
  input: SaveDrawingInput,
  status: "needs_review" | "approved"
) {
  const parsed = saveDrawingInputSchema.parse(input);
  await updateDrawingRevision({
    drawingId: parsed.drawingId,
    expectedUpdatedAt: parsed.expectedUpdatedAt,
    data: {
      title: parsed.title,
      status,
      modelJson: stringifyDrawingModel(parsed.model)
    }
  });

  return getDrawingDetail(parsed.drawingId);
}

export async function deleteDrawing(drawingId: string) {
  await prisma.drawing.delete({
    where: { id: drawingId }
  });
}
