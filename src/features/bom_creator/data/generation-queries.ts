import { cache } from "react";
import { prisma } from "@/lib/prisma";
import {
  bomGenerationItemSchema,
  bomGenerationTemplateSchema,
  type BomGenerationTemplate
} from "./schema";

export const listBomGenerationTemplatesForSymbols = cache(
  async (symbolIds: string[]): Promise<BomGenerationTemplate[]> => {
    const ids = [...new Set(symbolIds.filter(Boolean))];

    if (ids.length === 0) {
      return [];
    }

    const [templateRows, lineRows] = await Promise.all([
      prisma.symbolBomTemplate.findMany({
        where: { symbolId: { in: ids } },
        select: {
          id: true,
          symbolId: true,
          notes: true
        }
      }),
      prisma.symbolBomTemplateLine.findMany({
        where: {
          template: { symbolId: { in: ids } }
        },
        select: {
          id: true,
          templateId: true,
          itemId: true,
          lineNumber: true,
          quantityRule: true,
          quantity: true,
          notes: true
        },
        orderBy: [{ templateId: "asc" }, { lineNumber: "asc" }]
      })
    ]);

    const itemIds = [...new Set(lineRows.map((line) => line.itemId))];
    const itemRows =
      itemIds.length === 0
        ? []
        : await prisma.bomItem.findMany({
            where: { id: { in: itemIds } },
            select: {
              id: true,
              itemKey: true,
              displayName: true,
              category: true,
              unit: true,
              manufacturer: true,
              partNumber: true,
              status: true
            }
          });
    const itemById = new Map(
      itemRows.map((item) => [
        item.id,
        bomGenerationItemSchema.parse({
          ...item,
          manufacturer: item.manufacturer ?? undefined,
          partNumber: item.partNumber ?? undefined
        })
      ])
    );
    const linesByTemplateId = new Map<
      string,
      BomGenerationTemplate["lines"]
    >();

    for (const line of lineRows) {
      const item = itemById.get(line.itemId);

      if (!item) {
        throw new Error(`BOM template line ${line.id} references a missing item.`);
      }

      const lines = linesByTemplateId.get(line.templateId) ?? [];
      lines.push({
        id: line.id,
        itemId: line.itemId,
        lineNumber: line.lineNumber,
        quantityRule: line.quantityRule as BomGenerationTemplate["lines"][number]["quantityRule"],
        quantity: line.quantity,
        notes: line.notes ?? undefined,
        item
      });
      linesByTemplateId.set(line.templateId, lines);
    }

    return templateRows.map((template) =>
      bomGenerationTemplateSchema.parse({
        id: template.id,
        symbolId: template.symbolId,
        notes: template.notes ?? undefined,
        lines: linesByTemplateId.get(template.id) ?? []
      })
    );
  }
);
