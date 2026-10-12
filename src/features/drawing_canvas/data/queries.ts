import { cache } from "react";
import { prisma } from "@/lib/prisma";
import {
  drawingStatusSchema,
  parseDrawingModelJson
} from "./schema";
import { drawingProjectStatusSchema } from "@/features/drawing_projects/api/public";
import type {
  DrawingBomOption,
  DrawingBomSource,
  DrawingDetail,
  DrawingListPage
} from "../types";

export const DRAWING_LIST_PAGE_SIZE = 25;

const drawingListWhere = {
  NOT: { status: "archived" }
} as const;

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

export const listDrawingPage = cache(async (requestedPage: number): Promise<DrawingListPage> => {
  const totalCount = await prisma.drawing.count({ where: drawingListWhere });
  const totalPages = Math.max(1, Math.ceil(totalCount / DRAWING_LIST_PAGE_SIZE));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const rows = await prisma.drawing.findMany({
    where: drawingListWhere,
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    skip: (page - 1) * DRAWING_LIST_PAGE_SIZE,
    take: DRAWING_LIST_PAGE_SIZE,
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      modelJson: true,
      updatedAt: true,
      project: {
        select: {
          id: true,
          name: true,
          projectNumber: true,
          client: true,
          status: true
        }
      }
    }
  });

  const items = rows.map((row) => {
    const model = parseDrawingModelJson(row.modelJson);

    return {
      id: row.id,
      title: row.title,
      description: row.description ?? undefined,
      project: row.project
        ? {
            id: row.project.id,
            name: row.project.name,
            projectNumber: row.project.projectNumber ?? undefined,
            client: row.project.client ?? undefined,
            status: drawingProjectStatusSchema.parse(row.project.status)
          }
        : null,
      status: drawingStatusSchema.parse(row.status),
      sheetCount: model.sheets.length,
      updatedAt: row.updatedAt.toISOString()
    };
  });

  return {
    items,
    page,
    pageSize: DRAWING_LIST_PAGE_SIZE,
    totalCount,
    totalPages
  };
});

export const getDrawingDetail = cache(
  async (id: string): Promise<DrawingDetail | null> => {
    const row = await prisma.drawing.findUnique({
      where: { id },
      select: {
        id: true,
        drawingKey: true,
        title: true,
        description: true,
        status: true,
        modelJson: true,
        createdAt: true,
        updatedAt: true,
        project: {
          select: {
            id: true,
            name: true,
            projectNumber: true,
            client: true,
            status: true
          }
        }
      }
    });

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      drawingKey: row.drawingKey,
      title: row.title,
      description: row.description ?? undefined,
      project: row.project
        ? {
            id: row.project.id,
            name: row.project.name,
            projectNumber: row.project.projectNumber ?? undefined,
            client: row.project.client ?? undefined,
            status: drawingProjectStatusSchema.parse(row.project.status)
          }
        : null,
      status: drawingStatusSchema.parse(row.status),
      model: parseDrawingModelJson(row.modelJson),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }
);
