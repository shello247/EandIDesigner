import { cache } from "react";
import { prisma } from "@/lib/prisma";
import {
  drawingStatusSchema,
  parseDrawingModelJson
} from "./schema";
import type { DrawingDetail, DrawingListItem } from "../types";

export const listDrawings = cache(async (): Promise<DrawingListItem[]> => {
  const rows = await prisma.drawing.findMany({
    where: {
      NOT: { status: "archived" }
    },
    orderBy: { updatedAt: "desc" }
  });

  return rows.map((row) => {
    const model = parseDrawingModelJson(row.modelJson);

    return {
      id: row.id,
      drawingKey: row.drawingKey,
      title: row.title,
      status: drawingStatusSchema.parse(row.status),
      placementCount: model.placements.length,
      connectionCount: model.connections.length,
      updatedAt: row.updatedAt.toISOString()
    };
  });
});

export const getDrawingDetail = cache(
  async (id: string): Promise<DrawingDetail | null> => {
    const row = await prisma.drawing.findUnique({
      where: { id }
    });

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      drawingKey: row.drawingKey,
      title: row.title,
      status: drawingStatusSchema.parse(row.status),
      model: parseDrawingModelJson(row.modelJson),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }
);
