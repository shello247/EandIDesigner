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

  await prisma.drawing.update({
    where: { id: parsed.drawingId },
    data: {
      title: parsed.title,
      status: "needs_review",
      modelJson: stringifyDrawingModel(parsed.model)
    }
  });

  return getDrawingDetail(parsed.drawingId);
}

export async function approveDrawing(drawingId: string) {
  await prisma.drawing.update({
    where: { id: drawingId },
    data: { status: "approved" }
  });

  return getDrawingDetail(drawingId);
}

export async function deleteDrawing(drawingId: string) {
  await prisma.drawing.delete({
    where: { id: drawingId }
  });
}
