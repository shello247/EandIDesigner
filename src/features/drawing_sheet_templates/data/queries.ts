import { prisma } from "@/lib/prisma";
import {
  drawingSheetTemplateStatusSchema,
  parseDrawingSheetTemplateMetadataJson,
  parseDrawingSheetTemplateModelJson
} from "./schema";
import type {
  DrawingSheetTemplateDetail,
  DrawingSheetTemplateListItem
} from "../types";
import { ensureSheetTemplateTable } from "./table";

type TemplateRow = {
  id: string;
  templateKey: string;
  name: string;
  description: string | null;
  category: string | null;
  status: string;
  modelJson?: string;
  metadataJson: string;
  sourceDrawingId: string | null;
  sourceSheetId: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toListItem(row: TemplateRow): DrawingSheetTemplateListItem {
  const metadata = parseDrawingSheetTemplateMetadataJson(row.metadataJson);

  return {
    id: row.id,
    templateKey: row.templateKey,
    name: row.name,
    description: row.description,
    category: row.category,
    status: drawingSheetTemplateStatusSchema.parse(row.status),
    assetCount: metadata.assetCount,
    requiredSymbolCount: metadata.requiredSymbols.length,
    keywords: metadata.keywords,
    updatedAt: toIsoString(row.updatedAt)
  };
}

export async function listSheetTemplates(): Promise<
  DrawingSheetTemplateListItem[]
> {
  await ensureSheetTemplateTable();

  const rows = await prisma.$queryRaw<TemplateRow[]>`
    SELECT
      "id",
      "templateKey",
      "name",
      "description",
      "category",
      "status",
      "metadataJson",
      "sourceDrawingId",
      "sourceSheetId",
      "createdAt",
      "updatedAt"
    FROM "DrawingSheetTemplate"
    WHERE "status" = 'active'
    ORDER BY "updatedAt" DESC
  `;

  return rows.map(toListItem);
}

export async function getSheetTemplate(
  templateId: string
): Promise<DrawingSheetTemplateDetail | null> {
  await ensureSheetTemplateTable();

  const rows = await prisma.$queryRaw<TemplateRow[]>`
    SELECT
      "id",
      "templateKey",
      "name",
      "description",
      "category",
      "status",
      "modelJson",
      "metadataJson",
      "sourceDrawingId",
      "sourceSheetId",
      "createdAt",
      "updatedAt"
    FROM "DrawingSheetTemplate"
    WHERE "id" = ${templateId}
    LIMIT 1
  `;
  const row = rows[0];

  if (!row?.modelJson) {
    return null;
  }

  return {
    ...toListItem(row),
    model: parseDrawingSheetTemplateModelJson(row.modelJson),
    metadata: parseDrawingSheetTemplateMetadataJson(row.metadataJson),
    sourceDrawingId: row.sourceDrawingId,
    sourceSheetId: row.sourceSheetId,
    createdAt: toIsoString(row.createdAt)
  };
}
