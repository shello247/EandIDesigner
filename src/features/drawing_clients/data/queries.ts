import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { drawingClientIdSchema } from "./schema";
import type { DrawingClientSummary } from "../types";

export const listDrawingClients = cache(
  async (): Promise<DrawingClientSummary[]> =>
    prisma.client.findMany({
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: { id: true, name: true }
    })
);

export async function findDrawingClientById(
  clientId: string
): Promise<DrawingClientSummary | null> {
  return prisma.client.findUnique({
    where: { id: drawingClientIdSchema.parse(clientId) },
    select: { id: true, name: true }
  });
}
