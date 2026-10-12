import { cache } from "react";
import { prisma } from "@/lib/prisma";
import {
  drawingProjectIdSchema,
  drawingProjectStatusSchema,
  type DrawingProjectStatus
} from "./schema";
import type {
  DrawingProjectAssignableOption,
  DrawingProjectDetail,
  DrawingProjectDrawingListPage,
  DrawingProjectListPage
} from "../types";

export const DRAWING_PROJECT_PAGE_SIZE = 25;

function optional(value: string | null): string | undefined {
  return value || undefined;
}

export function parseDrawingProjectPage(value: unknown): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = typeof raw === "string" ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function parseDrawingProjectStatus(value: unknown): DrawingProjectStatus {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = drawingProjectStatusSchema.safeParse(raw);
  return parsed.success ? parsed.data : "active";
}

export const listDrawingProjectPage = cache(
  async ({
    requestedPage,
    status
  }: {
    requestedPage: number;
    status: DrawingProjectStatus;
  }): Promise<DrawingProjectListPage> => {
    const totalCount = await prisma.project.count({ where: { status } });
    const totalPages = Math.max(
      1,
      Math.ceil(totalCount / DRAWING_PROJECT_PAGE_SIZE)
    );
    const page = Math.min(Math.max(1, requestedPage), totalPages);
    const rows = await prisma.project.findMany({
      where: { status },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * DRAWING_PROJECT_PAGE_SIZE,
      take: DRAWING_PROJECT_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        projectNumber: true,
        clientId: true,
        client: true,
        description: true,
        status: true,
        updatedAt: true,
        _count: { select: { drawings: true } }
      }
    });
    return {
      items: rows.map((row) => ({
        id: row.id,
        name: row.name,
        projectNumber: optional(row.projectNumber),
        clientId: optional(row.clientId),
        client: optional(row.client),
        description: optional(row.description),
        status: drawingProjectStatusSchema.parse(row.status),
        drawingCount: row._count.drawings,
        updatedAt: row.updatedAt.toISOString()
      })),
      page,
      pageSize: DRAWING_PROJECT_PAGE_SIZE,
      totalCount,
      totalPages,
      status
    };
  }
);

export const getDrawingProjectDetail = cache(
  async (projectId: string): Promise<DrawingProjectDetail | null> => {
    const parsedId = drawingProjectIdSchema.parse(projectId);
    const row = await prisma.project.findUnique({
      where: { id: parsedId },
      select: {
        id: true,
        name: true,
        projectNumber: true,
        clientId: true,
        client: true,
        description: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { drawings: true } }
      }
    });
    return row
      ? {
          id: row.id,
          name: row.name,
          projectNumber: optional(row.projectNumber),
          clientId: optional(row.clientId),
          client: optional(row.client),
          description: optional(row.description),
          status: drawingProjectStatusSchema.parse(row.status),
          drawingCount: row._count.drawings,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString()
        }
      : null;
  }
);

export const listProjectDrawingPage = cache(
  async ({
    projectId,
    requestedPage
  }: {
    projectId: string;
    requestedPage: number;
  }): Promise<DrawingProjectDrawingListPage> => {
    const parsedId = drawingProjectIdSchema.parse(projectId);
    const where = { projectId: parsedId } as const;
    const totalCount = await prisma.drawing.count({ where });
    const totalPages = Math.max(
      1,
      Math.ceil(totalCount / DRAWING_PROJECT_PAGE_SIZE)
    );
    const page = Math.min(Math.max(1, requestedPage), totalPages);
    const rows = await prisma.drawing.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * DRAWING_PROJECT_PAGE_SIZE,
      take: DRAWING_PROJECT_PAGE_SIZE,
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        updatedAt: true
      }
    });
    return {
      items: rows.map((row) => ({
        id: row.id,
        title: row.title,
        description: optional(row.description),
        status: row.status,
        updatedAt: row.updatedAt.toISOString()
      })),
      page,
      pageSize: DRAWING_PROJECT_PAGE_SIZE,
      totalCount,
      totalPages
    };
  }
);

export async function listAssignableDrawingProjects(
  currentProjectId?: string
): Promise<DrawingProjectAssignableOption[]> {
  const parsedCurrent = currentProjectId
    ? drawingProjectIdSchema.parse(currentProjectId)
    : undefined;
  const rows = await prisma.project.findMany({
    where: parsedCurrent
      ? { OR: [{ status: "active" }, { id: parsedCurrent }] }
      : { status: "active" },
    orderBy: [{ projectNumber: "asc" }, { name: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      projectNumber: true,
      clientId: true,
      client: true,
      status: true
    }
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    projectNumber: optional(row.projectNumber),
    clientId: optional(row.clientId),
    client: optional(row.client),
    status: drawingProjectStatusSchema.parse(row.status)
  }));
}

export async function findDrawingProjectAssignment(projectId: string) {
  return prisma.project.findUnique({
    where: { id: drawingProjectIdSchema.parse(projectId) },
    select: {
      id: true,
      name: true,
      projectNumber: true,
      clientId: true,
      client: true,
      status: true
    }
  });
}
