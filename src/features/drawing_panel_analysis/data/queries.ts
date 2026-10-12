import {
  getDrawingDetailForReports,
  listDrawingPageForReports
} from "@/features/drawing_canvas/api/report-contracts";
import { prisma } from "@/lib/prisma";

export async function listPanelAnalysisDrawingPage(page: number) {
  return listDrawingPageForReports(page);
}

export async function getPanelAnalysisDrawingSource(drawingId: string) {
  return getDrawingDetailForReports(drawingId);
}

export async function getPanelAnalysisDrawingRevision(drawingId: string) {
  const drawing = await prisma.drawing.findUnique({
    where: { id: drawingId },
    select: { updatedAt: true }
  });
  return drawing?.updatedAt.toISOString() ?? null;
}
