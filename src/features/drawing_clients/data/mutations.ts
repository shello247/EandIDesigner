import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createDrawingClientInputSchema, type CreateDrawingClientInput } from "./schema";
import { normalizeDrawingClientName } from "../logic/services/client-name";
import type { DrawingClientSummary } from "../types";

export class DrawingClientDomainError extends Error {
  constructor(
    message: string,
    readonly code: "duplicate_name"
  ) {
    super(message);
    this.name = "DrawingClientDomainError";
  }
}

export async function createDrawingClient(
  input: CreateDrawingClientInput
): Promise<DrawingClientSummary> {
  const parsed = createDrawingClientInputSchema.parse(input);
  try {
    return await prisma.client.create({
      data: {
        name: parsed.name,
        normalizedName: normalizeDrawingClientName(parsed.name)
      },
      select: { id: true, name: true }
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new DrawingClientDomainError(
        "A Client with this name already exists.",
        "duplicate_name"
      );
    }
    throw error;
  }
}
