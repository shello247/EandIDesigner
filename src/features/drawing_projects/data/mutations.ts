import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { findDrawingClientById } from "@/features/drawing_clients/api/server";
import {
  createDrawingProjectInputSchema,
  setDrawingProjectStatusInputSchema,
  updateDrawingProjectInputSchema,
  type CreateDrawingProjectInput,
  type SetDrawingProjectStatusInput,
  type UpdateDrawingProjectInput
} from "./schema";
import {
  DRAWING_PROJECT_NUMBER_SCOPE,
  formatDrawingProjectNumber,
  normalizeDrawingProjectNumber
} from "../logic/services/project-number";
import { getDrawingProjectDetail } from "./queries";

export class DrawingProjectDomainError extends Error {
  constructor(
    message: string,
    readonly code:
      | "duplicate_number"
      | "not_found"
      | "archived"
      | "client_not_found"
  ) {
    super(message);
    this.name = "DrawingProjectDomainError";
  }
}

function nullable(value: string | undefined): string | null {
  return value || null;
}

function duplicateProjectNumberError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

async function resolveSelectedClient(clientId?: string) {
  if (!clientId) return null;
  const client = await findDrawingClientById(clientId);
  if (!client) {
    throw new DrawingProjectDomainError(
      "The selected Client is unavailable.",
      "client_not_found"
    );
  }
  return client;
}

export async function allocateProjectNumber(): Promise<string> {
  const sequence = await prisma.projectNumberSequence.upsert({
    where: { scope: DRAWING_PROJECT_NUMBER_SCOPE },
    create: { scope: DRAWING_PROJECT_NUMBER_SCOPE, lastValue: 1 },
    update: { lastValue: { increment: 1 } },
    select: { lastValue: true }
  });
  return formatDrawingProjectNumber(sequence.lastValue);
}

export async function createDrawingProject(input: CreateDrawingProjectInput) {
  const parsed = createDrawingProjectInputSchema.parse(input);
  const client = await resolveSelectedClient(parsed.clientId);
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const projectNumber = await allocateProjectNumber();
    try {
      const row = await prisma.project.create({
        data: {
          name: parsed.name,
          projectNumber,
          normalizedProjectNumber:
            normalizeDrawingProjectNumber(projectNumber) ?? null,
          clientId: client?.id ?? null,
          client: client?.name ?? null,
          description: nullable(parsed.description),
          status: "active"
        },
        select: { id: true }
      });
      return getDrawingProjectDetail(row.id);
    } catch (error) {
      if (!duplicateProjectNumberError(error)) throw error;
    }
  }
  throw new DrawingProjectDomainError(
    "A unique Project number could not be generated.",
    "duplicate_number"
  );
}

export async function updateDrawingProject(input: UpdateDrawingProjectInput) {
  const parsed = updateDrawingProjectInputSchema.parse(input);
  const existing = await prisma.project.findUnique({
    where: { id: parsed.projectId },
    select: { id: true, status: true }
  });
  if (!existing) {
    throw new DrawingProjectDomainError("Project was not found.", "not_found");
  }
  if (existing.status === "archived") {
    throw new DrawingProjectDomainError(
      "Restore this Project before editing its identity.",
      "archived"
    );
  }
  const client = await resolveSelectedClient(parsed.clientId);
  try {
    await prisma.project.update({
      where: { id: parsed.projectId },
      data: {
        name: parsed.name,
        clientId: client?.id ?? null,
        client: client?.name ?? null,
        description: nullable(parsed.description)
      }
    });
    return getDrawingProjectDetail(parsed.projectId);
  } catch (error) {
    throw error;
  }
}

export async function setDrawingProjectStatus(
  input: SetDrawingProjectStatusInput
) {
  const parsed = setDrawingProjectStatusInputSchema.parse(input);
  const result = await prisma.project.updateMany({
    where: { id: parsed.projectId },
    data: { status: parsed.status }
  });
  if (result.count !== 1) {
    throw new DrawingProjectDomainError("Project was not found.", "not_found");
  }
  return getDrawingProjectDetail(parsed.projectId);
}
