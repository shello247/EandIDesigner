import { cache } from "react";
import { prisma } from "@/lib/prisma";
import {
  drawingStatusSchema,
  parseDrawingModelJson,
  type DrawingValidationIssue
} from "./schema";
import type { DrawingDetail, DrawingListItem } from "../types";

function toValidationIssue(issue: {
  severity: string;
  code: string;
  message: string;
  path: string | null;
}): DrawingValidationIssue {
  return {
    severity: issue.severity as DrawingValidationIssue["severity"],
    code: issue.code,
    message: issue.message,
    path: issue.path ?? undefined
  };
}

export const listDrawings = cache(async (): Promise<DrawingListItem[]> => {
  const rows = await prisma.drawing.findMany({
    where: {
      NOT: { status: "archived" }
    },
    include: {
      validationIssues: {
        where: { severity: "blocking" },
        select: { id: true }
      }
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
      blockingIssueCount: row.validationIssues.length,
      updatedAt: row.updatedAt.toISOString()
    };
  });
});

export const getDrawingDetail = cache(
  async (id: string): Promise<DrawingDetail | null> => {
    const row = await prisma.drawing.findUnique({
      where: { id },
      include: {
        validationIssues: {
          orderBy: [{ severity: "asc" }, { createdAt: "desc" }]
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
      status: drawingStatusSchema.parse(row.status),
      model: parseDrawingModelJson(row.modelJson),
      validationIssues: row.validationIssues.map(toValidationIssue),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }
);

