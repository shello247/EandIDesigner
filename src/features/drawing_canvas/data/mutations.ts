import { Prisma } from "@prisma/client";
import {validateDrawingProductSelections} from "./product-selections";
import { prisma } from "@/lib/prisma";
import { resolveDrawingProjectAssignment } from "@/features/drawing_projects/api/server";
import {
  createDefaultDrawingModel,
  createDrawingInputSchema,
  saveDrawingInputSchema,
  stringifyDrawingModel,
  parseDrawingModelJson,
  type CreateDrawingInput,
  type SaveDrawingInput
} from "./schema";
import { getDrawingDetail } from "./queries";
import type { DrawingSaveAcknowledgment } from "../types";
import { generateUniqueDrawingKey } from "../logic/services/drawing-key";

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
  data: {
    title: string;
    description: string | null;
    projectId: string | null;
    status: string;
    modelJson: string;
  };
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

function isDrawingKeyCollision(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export async function createDrawing(input: CreateDrawingInput) {
  const parsed = createDrawingInputSchema.parse(input);
  const project = await resolveDrawingProjectAssignment({
    projectId: parsed.projectId
  });
  if (!project) throw new Error("Open an active project to create a drawing.");
  const model = createDefaultDrawingModel({ withTitleSheet: true });
  if (project) {
    model.titleBlock.project = project.name;
    if (project.client) model.titleBlock.client = project.client;
  }

  for (let collisionIndex = 0; collisionIndex < 1000; collisionIndex += 1) {
    try {
      const row = await prisma.drawing.create({
        data: {
          drawingKey: generateUniqueDrawingKey(parsed.title, collisionIndex),
          title: parsed.title,
          description: parsed.description || null,
          projectId: project?.id ?? null,
          status: "draft",
          modelJson: stringifyDrawingModel(model)
        },
        select: { id: true }
      });
      return getDrawingDetail(row.id);
    } catch (error) {
      if (!isDrawingKeyCollision(error)) throw error;
    }
  }

  throw new Error("A unique drawing identifier could not be generated.");
}

export async function saveDrawing(input: SaveDrawingInput) {
  const parsed = saveDrawingInputSchema.parse(input);
  if(parsed.model.version===3){const prior=await prisma.drawing.findUnique({where:{id:parsed.drawingId},select:{modelJson:true}});await validateDrawingProductSelections(parsed.model,prior?parseDrawingModelJson(prior.modelJson):null);}
  const current = parsed.projectId
    ? await prisma.drawing.findUnique({
        where: { id: parsed.drawingId },
        select: { projectId: true }
      })
    : null;
  const project = await resolveDrawingProjectAssignment({
    projectId: parsed.projectId,
    currentProjectId: current?.projectId
  });

  return updateDrawingRevision({
    drawingId: parsed.drawingId,
    expectedUpdatedAt: parsed.expectedUpdatedAt,
    data: {
      title: parsed.title,
      description: parsed.description || null,
      projectId: project?.id ?? null,
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
  if(parsed.model.version===3){const prior=await prisma.drawing.findUnique({where:{id:parsed.drawingId},select:{modelJson:true}});await validateDrawingProductSelections(parsed.model,prior?parseDrawingModelJson(prior.modelJson):null);}
  const current = parsed.projectId
    ? await prisma.drawing.findUnique({
        where: { id: parsed.drawingId },
        select: { projectId: true }
      })
    : null;
  const project = await resolveDrawingProjectAssignment({
    projectId: parsed.projectId,
    currentProjectId: current?.projectId
  });
  await updateDrawingRevision({
    drawingId: parsed.drawingId,
    expectedUpdatedAt: parsed.expectedUpdatedAt,
    data: {
      title: parsed.title,
      description: parsed.description || null,
      projectId: project?.id ?? null,
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
