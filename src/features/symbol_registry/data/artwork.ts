import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseMetadataJson } from "./schema";
import { artworkInputSchema, artworkSaveSchema, type ArtworkInput, type ArtworkSaveInput } from "./artwork-schema";
import { artworkToken, prepareArtworkReplacement } from "../logic/services/artwork-replacement";

async function loadCurrent(client: Prisma.TransactionClient, symbolId: string, versionId: string) {
  const symbol = await client.symbol.findUnique({ where: { id: symbolId }, include: {
    versions: { orderBy: { versionNumber: "desc" }, take: 1, include: { _count: { select: { itemConfigurations: true } } } }
  } });
  const version = symbol?.versions[0];
  if (!symbol || !version || version.id !== versionId) throw new Error("The symbol version changed. Reload the page and review the artwork again.");
  if (symbol.status === "archived" || version.status === "archived") throw new Error("Archived symbols are read-only.");
  if (version._count.itemConfigurations) throw new Error("This version has Item configurations. Artwork replacement is not yet supported for configured versions; nothing was changed.");
  return { symbol, version };
}

function preview(current: Awaited<ReturnType<typeof loadCurrent>>, input: ArtworkInput) {
  const metadata = parseMetadataJson(current.version.metadataJson);
  const svg = prepareArtworkReplacement(current.version.svg, input.svg, metadata);
  return { svg, token: artworkToken(current, svg, input.fileName), versionNumber: current.version.versionNumber,
    terminalCount: metadata.terminals.length };
}

export async function previewSymbolArtwork(input: ArtworkInput) {
  const parsed = artworkInputSchema.parse(input);
  return preview(await loadCurrent(prisma, parsed.symbolId, parsed.versionId), parsed);
}

export async function replaceSymbolArtwork(input: ArtworkSaveInput) {
  const parsed = artworkSaveSchema.parse(input);
  return prisma.$transaction(async transaction => {
    const current = await loadCurrent(transaction, parsed.symbolId, parsed.versionId);
    const checked = preview(current, parsed);
    if (checked.token !== parsed.token) throw new Error("The symbol changed after preview. Reload and review again; nothing was replaced.");
    // CAS obtains the write lock and checks symbol state before appending. SQLite
    // rejects concurrent stale snapshots; the transaction rolls back on any error.
    const locked = await transaction.symbol.updateMany({ where: { id: current.symbol.id,
      updatedAt: current.symbol.updatedAt, status: current.symbol.status }, data: { updatedAt: new Date() } });
    if (locked.count !== 1) throw new Error("The symbol changed. Reload and review again.");
    const version = await transaction.symbolVersion.create({ data: {
      symbolId: current.symbol.id, versionNumber: current.version.versionNumber + 1,
      status: current.version.status, svg: checked.svg,
      // Preserve raw JSON, including unknown/legacy fields, rather than reserializing.
      metadataJson: current.version.metadataJson,
      deviceType: current.version.deviceType,
      sourceInputSummary: `Artwork-only replacement of version ${current.version.versionNumber}: ${parsed.fileName}. Geometry and metadata preserved. Prior version retained.`
    } });
    await transaction.symbolSourceAsset.create({ data: {
      symbolId: current.symbol.id, versionId: version.id, fileName: parsed.fileName,
      mimeType: "image/svg+xml", sizeBytes: Buffer.byteLength(parsed.svg, "utf8"),
      dataUrl: `data:image/svg+xml;base64,${Buffer.from(parsed.svg, "utf8").toString("base64")}`
    } });
    return { versionId: version.id, versionNumber: version.versionNumber };
  });
}
