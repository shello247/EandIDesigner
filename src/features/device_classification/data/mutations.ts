import { prisma } from "@/lib/prisma";
import { saveSymbolClassificationInputSchema, type SaveSymbolClassificationInput } from "./schema";
import { classificationContentToken } from "../logic/services/classification-token";

export async function saveSymbolClassification(input: SaveSymbolClassificationInput) {
  const parsed = saveSymbolClassificationInputSchema.parse(input);
  return prisma.$transaction(async tx => {
    const row = await tx.symbolVersion.findUnique({ where: { id: parsed.versionId },
      include: { symbol: { select: { status: true } } } });
    if (!row) throw new Error("The exact Symbol version is unavailable.");
    if (row.status === "archived" || row.symbol.status === "archived") throw new Error("Archived Symbol classifications require historical review; this record was not changed.");
    if (classificationContentToken(row) !== parsed.expectedToken) throw new Error("This Symbol changed. Reload its classification review before applying.");
    if (row.deviceType !== parsed.deviceType) {
      const updated = await tx.symbolVersion.updateMany({
        where: { id: row.id, deviceType: row.deviceType, svg: row.svg, metadataJson: row.metadataJson, status: row.status },
        data: { deviceType: parsed.deviceType }
      });
      if (updated.count !== 1) throw new Error("The Symbol changed during classification; no correction was applied.");
    }
    return { kind: "symbol_classification" as const, recordId: row.symbolId, revisionId: row.id,
      before: row.deviceType, after: parsed.deviceType, evidence: parsed.evidence,
      previousToken: parsed.expectedToken, token: classificationContentToken({ ...row, deviceType: parsed.deviceType }),
      changed: row.deviceType !== parsed.deviceType, recordedAt: new Date().toISOString() };
  });
}
