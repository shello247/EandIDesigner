import type { DrawingModel } from "@/features/drawing_canvas/data/schema";
import {
  panelAnalysisNavigationTargetSchema,
  type PanelAnalysisNavigationTarget
} from "../../data/schema";

export type PanelAnalysisNavigationSearchParams = Record<
  string,
  string | string[] | undefined
>;

function singleValue(
  value: string | string[] | undefined
): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function resolvePanelAnalysisNavigation({
  drawingId,
  model,
  searchParams
}: {
  drawingId: string;
  model: DrawingModel;
  searchParams: PanelAnalysisNavigationSearchParams;
}): PanelAnalysisNavigationTarget | undefined {
  const sheetId = singleValue(searchParams.sheetId);
  if (!sheetId) return undefined;

  const sheet = model.sheets.find((candidate) => candidate.id === sheetId);
  if (!sheet) return undefined;

  const sheetTarget = panelAnalysisNavigationTargetSchema.parse({
    drawingId,
    sheetId
  });
  const objectKind = singleValue(searchParams.objectKind);
  const objectId = singleValue(searchParams.objectId);
  if (!objectKind || !objectId) return sheetTarget;

  const parsed = panelAnalysisNavigationTargetSchema.safeParse({
    drawingId,
    sheetId,
    objectKind,
    objectId
  });
  if (!parsed.success) return sheetTarget;

  const objectExists =
    parsed.data.objectKind === "placement"
      ? sheet.placements.some((placement) => placement.id === objectId)
      : parsed.data.objectKind === "connection"
        ? sheet.connections.some((connection) => connection.id === objectId)
        : sheet.annotations.some((annotation) => annotation.id === objectId);

  return objectExists ? parsed.data : sheetTarget;
}
