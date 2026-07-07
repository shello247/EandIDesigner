import { prisma } from "@/lib/prisma";
import { listSymbolsForDrawing } from "@/features/symbol_registry/api/public";
import {
  createSheetTemplateModel
} from "../logic/use_cases/drawing-sheet-template-use-cases";
import {
  saveSheetTemplateInputSchema,
  stringifyDrawingSheetTemplateModel,
  type SaveSheetTemplateInput
} from "./schema";
import { getSheetTemplate } from "./queries";
import { ensureSheetTemplateTable } from "./table";

function normalizeTemplateKey(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized.length > 0 ? normalized : "sheet_template";
}

function createId(prefix: string): string {
  const randomPart =
    globalThis.crypto && "randomUUID" in globalThis.crypto
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  return `${prefix}_${randomPart.replace(/[^A-Za-z0-9_]+/g, "_")}`;
}

async function nextUniqueTemplateKey(baseValue: string): Promise<string> {
  await ensureSheetTemplateTable();

  const baseKey = normalizeTemplateKey(baseValue);
  let candidate = baseKey;
  let suffix = 2;

  while (
    (
      await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "DrawingSheetTemplate"
        WHERE "templateKey" = ${candidate}
        LIMIT 1
      `
    ).length > 0
  ) {
    candidate = `${baseKey}_${suffix}`;
    suffix += 1;
  }

  return candidate;
}

export async function createSheetTemplate(input: SaveSheetTemplateInput) {
  await ensureSheetTemplateTable();

  const parsed = saveSheetTemplateInputSchema.parse(input);
  const symbols = await listSymbolsForDrawing();
  const templateModel = createSheetTemplateModel({
    model: parsed.model,
    sheetId: parsed.sheetId,
    symbols,
    summary: parsed.description || `${parsed.name} template`,
    keywords: parsed.keywords,
    sourceDrawingId: parsed.sourceDrawingId
  });
  const templateKey = await nextUniqueTemplateKey(parsed.name);
  const now = new Date().toISOString();
  const id = createId("dst");

  await prisma.$executeRaw`
    INSERT INTO "DrawingSheetTemplate" (
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
    ) VALUES (
      ${id},
      ${templateKey},
      ${parsed.name},
      ${parsed.description ?? null},
      ${parsed.category ?? null},
      'active',
      ${stringifyDrawingSheetTemplateModel(templateModel)},
      ${JSON.stringify(templateModel.metadata, null, 2)},
      ${parsed.sourceDrawingId ?? null},
      ${parsed.sourceSheetId},
      ${now},
      ${now}
    )
  `;

  return getSheetTemplate(id);
}

export async function archiveSheetTemplate(templateId: string) {
  await ensureSheetTemplateTable();

  await prisma.$executeRaw`
    UPDATE "DrawingSheetTemplate"
    SET "status" = 'archived', "updatedAt" = ${new Date().toISOString()}
    WHERE "id" = ${templateId}
  `;
}
