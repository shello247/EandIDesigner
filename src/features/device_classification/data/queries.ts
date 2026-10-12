import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { deviceTypeSchema } from "@/shared/device-classification/device-types";
import type { ClassificationLookup } from "@/shared/device-classification/classification-resolution";
import { classificationBatchInputSchema, type ClassificationBatchInput } from "./schema";
import { classificationContentToken } from "../logic/services/classification-token";

type LightRow = { id: string; recordId: string; deviceType: string | null; invalidJson?: number | bigint };
function project(ids: string[], rows: LightRow[], kind: "item_revision" | "symbol_version"): Record<string, ClassificationLookup> {
  const byId = new Map(rows.map(row => [row.id, row]));
  return Object.fromEntries([...new Set(ids)].map(id => {
    const row = byId.get(id);
    const parsed = deviceTypeSchema.nullable().safeParse(row?.deviceType);
    const lookup: ClassificationLookup = !row || !parsed.success || Boolean(row.invalidJson)
      ? { state: "unavailable", recordId: row?.recordId ?? id, revisionId: id,
        reason: !row ? "Exact source revision was not found." : "Source classification is malformed or unrecognised." }
      : { state: "available", source: { kind, recordId: row.recordId, revisionId: row.id, deviceType: parsed.data } };
    return [id, lookup];
  }));
}

/** Lean exact-revision projection; no attachment bodies, SVG or full profiles. */
export async function readClassificationBatch(input: ClassificationBatchInput) {
  const parsed = classificationBatchInputSchema.parse(input);
  const [symbols, items] = await Promise.all([
    parsed.symbolVersionIds.length ? prisma.symbolVersion.findMany({
      where: { id: { in: parsed.symbolVersionIds } }, select: { id: true, symbolId: true, deviceType: true }
    }) : [],
    parsed.itemRevisionIds.length ? prisma.$queryRaw<LightRow[]>(Prisma.sql`
      SELECT "id", "itemId" AS "recordId",
        CASE WHEN json_valid("profileJson") THEN json_extract("profileJson", '$.deviceType') ELSE NULL END AS "deviceType",
        NOT json_valid("profileJson") AS "invalidJson"
      FROM "BomItemEngineeringRevision" WHERE "id" IN (${Prisma.join(parsed.itemRevisionIds)})`) : []
  ]);
  return { symbols: project(parsed.symbolVersionIds, symbols.map(row => ({ ...row, recordId: row.symbolId })), "symbol_version"),
    items: project(parsed.itemRevisionIds, items, "item_revision") };
}

export async function getSymbolClassificationReview(versionId: string) {
  const row = await prisma.symbolVersion.findUnique({ where: { id: versionId },
    include: { symbol: { select: { displayName: true, status: true } } } });
  if (!row) throw new Error("The exact Symbol version is unavailable.");
  return { versionId: row.id, symbolId: row.symbolId, versionNumber: row.versionNumber,
    title: row.symbol.displayName, deviceType: deviceTypeSchema.nullable().parse(row.deviceType),
    token: classificationContentToken(row), archived: row.status === "archived" || row.symbol.status === "archived" };
}
