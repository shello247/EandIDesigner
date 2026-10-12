import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auditClassificationInventory } from "../logic/services/classification-audit";

/** An explicit audit, never part of normal library rendering. One read transaction
 * fixes the census boundary; attachment bytes are not sent to the browser. */
export async function readClassificationAudit() {
  return prisma.$transaction(async db => {
    const symbols = await db.symbol.findMany({ orderBy: { id: "asc" }, select: {
      id: true, displayName: true, symbolKey: true, status: true, manufacturer: true,
      model: true, category: true, categoryId: true, updatedAt: true
    } });
    const versionRows = await db.symbolVersion.findMany({ orderBy: { id: "asc" }, select: {
      id: true, symbolId: true, versionNumber: true, status: true, deviceType: true,
      metadataJson: true, svg: true, createdAt: true
    } });
    const versions = versionRows.map(({ svg, ...row }) => ({ ...row,
      svgHash: createHash("sha256").update(svg).digest("hex"), hasSvg: /<svg[\s>]/i.test(svg) }));
    const items = await db.bomItem.findMany({ orderBy: { id: "asc" }, select: {
      id: true, itemKey: true, displayName: true, status: true, manufacturer: true,
      model: true, partNumber: true, productUrl: true, updatedAt: true
    } });
    const revisions = await db.bomItemEngineeringRevision.findMany({ orderBy: { id: "asc" },
      include: { notes: true, documents: true } });
    const drawings = await db.drawing.findMany({ orderBy: { id: "asc" }, select: {
      id: true, drawingKey: true, title: true, status: true, projectId: true, modelJson: true, updatedAt: true
    } });
    const configurations = await db.symbolItemConfiguration.findMany({ orderBy: { id: "asc" }, include: { options: true, parts: true } });
    const templates = await db.symbolBomTemplate.findMany({ orderBy: { id: "asc" }, include: { lines: true } });
    const attachmentRows = await db.$queryRaw<Array<{ kind: string; id: string; ownerId: string | null;
      title: string; sizeBytes: number | bigint; mimeType: string | null; contentPresent: number | bigint;
      contentHash: string | null; notes: string | null }>>(Prisma.sql`
      SELECT 'item_document' AS kind, id, itemId AS ownerId, title, sizeBytes, mimeType,
        length(dataUrl)>0 AS contentPresent, contentHash, NULL AS notes FROM BomItemDocument
      UNION ALL SELECT 'item_image', id, itemId, fileName, sizeBytes, mimeType, length(dataUrl)>0, NULL, caption FROM BomItemImage
      UNION ALL SELECT 'engineer_note', id, itemId, COALESCE(imageFileName,'Engineer Note'), COALESCE(imageSizeBytes,0), imageMimeType,
        CASE WHEN imageFileName IS NULL THEN 1 ELSE length(COALESCE(imageDataUrl,''))>0 END, contentHash, notes FROM BomItemEngineerNote
      UNION ALL SELECT 'symbol_source', id, symbolId, fileName, sizeBytes, mimeType, length(COALESCE(dataUrl,''))>0, NULL, NULL FROM SymbolSourceAsset
    `);
    // SQLite raw UNION/length expressions are returned as bigint by Prisma.
    // Preserve numeric zero (unavailable content), not the truthy string "0".
    const attachments = attachmentRows.map(row => ({ ...row,
      sizeBytes: Number(row.sizeBytes), contentPresent: Number(row.contentPresent) }));
    const foreignKeys = await db.$queryRawUnsafe<Array<{ table: string; rowid: bigint; parent: string; fkid: bigint }>>("PRAGMA foreign_key_check");
    const snapshot = { symbols, versions, items, revisions, drawings, configurations, templates, attachments };
    const serializable = JSON.parse(JSON.stringify(snapshot));
    return { capturedAt: new Date().toISOString(),
      fingerprint: createHash("sha256").update(JSON.stringify(serializable)).digest("hex"),
      ...auditClassificationInventory(serializable),
      foreignKeyIssues: foreignKeys.map(row => ({ ...row, rowid: String(row.rowid), fkid: String(row.fkid) })),
      inventory: serializable };
  }, { timeout: 60000 });
}
