import { cache } from "react";
import { prisma } from "@/lib/prisma";
import {
  drawingStatusSchema,
  parseDrawingModelJson
} from "./schema";
import type {
  DrawingBomOption,
  DrawingBomSource,
  DrawingDetail,
  DrawingListItem
} from "../types";

export const listDrawingBomOptions = cache(
  async (): Promise<DrawingBomOption[]> => {
    return prisma.drawing.findMany({
      where: {
        NOT: { status: "archived" }
      },
      select: {
        id: true,
        drawingKey: true,
        title: true
      },
      orderBy: { updatedAt: "desc" }
    });
  }
);

export const getDrawingBomSource = cache(
  async (id: string): Promise<DrawingBomSource | null> => {
    const row = await prisma.drawing.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        modelJson: true
      }
    });

    return row
      ? {
          id: row.id,
          title: row.title,
          model: parseDrawingModelJson(row.modelJson)
        }
      : null;
  }
);

export const listDrawings = cache(async (): Promise<DrawingListItem[]> => {
  const rows = await prisma.drawing.findMany({
    where: {
      NOT: { status: "archived" }
    },
    orderBy: { updatedAt: "desc" }
  });

  return rows.map((row) => {
    const model = parseDrawingModelJson(row.modelJson);
    const placementCount = model.sheets.reduce(
      (total, sheet) => total + sheet.placements.length,
      0
    );
    const connectionCount = model.sheets.reduce(
      (total, sheet) => total + sheet.connections.length,
      0
    );

    return {
      id: row.id,
      drawingKey: row.drawingKey,
      title: row.title,
      status: drawingStatusSchema.parse(row.status),
      sheetCount: model.sheets.length,
      placementCount,
      connectionCount,
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
