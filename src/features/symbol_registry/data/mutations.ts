import { prisma } from "@/lib/prisma";
import {
  createEngineerNoteInputSchema,
  parseMetadataJson,
  saveSymbolDraftInputSchema,
  stringifyMetadata,
  type CreateEngineerNoteInput,
  type SaveSymbolDraftInput,
  terminalMapUpdateInputSchema,
  type TerminalMapUpdateInput,
  uploadSymbolDocumentInputSchema,
  type UploadSymbolDocumentInput,
  type ValidationIssue
} from "./schema";
import { createSymbolPackage } from "../logic/use_cases/export-symbol-package";
import { validateSymbol } from "../logic/use_cases/validate-symbol";
import { getSymbolDetail, getSymbolVersionForExport } from "./queries";

function normalizeSymbolKey(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized.length > 0 ? normalized : "symbol";
}

async function replaceValidationIssues(params: {
  symbolId: string;
  versionId: string;
  issues: ValidationIssue[];
}) {
  await prisma.symbolValidationIssue.deleteMany({
    where: {
      symbolId: params.symbolId,
      versionId: params.versionId
    }
  });

  if (params.issues.length === 0) {
    return;
  }

  await prisma.symbolValidationIssue.createMany({
    data: params.issues.map((issue) => ({
      symbolId: params.symbolId,
      versionId: params.versionId,
      severity: issue.severity,
      code: issue.code,
      message: issue.message,
      path: issue.path
    }))
  });
}

async function getNextVersionNumber(symbolId: string): Promise<number> {
  const latest = await prisma.symbolVersion.findFirst({
    where: { symbolId },
    orderBy: { versionNumber: "desc" },
    select: { versionNumber: true }
  });

  return (latest?.versionNumber ?? 0) + 1;
}

export async function saveSymbolDraft(input: SaveSymbolDraftInput) {
  const parsed = saveSymbolDraftInputSchema.parse(input);
  const validation = validateSymbol(parsed.svg, parsed.metadata);
  const metadata = validation.metadata ?? parsed.metadata;
  const symbolKey = normalizeSymbolKey(metadata.symbolKey);
  const metadataJson = stringifyMetadata({ ...metadata, symbolKey });

  const symbol = await prisma.symbol.upsert({
    where: { symbolKey },
    update: {
      displayName: metadata.displayName,
      manufacturer: metadata.manufacturer,
      model: metadata.model,
      category: metadata.category,
      status: "needs_review"
    },
    create: {
      symbolKey,
      displayName: metadata.displayName,
      manufacturer: metadata.manufacturer,
      model: metadata.model,
      category: metadata.category,
      status: "needs_review"
    }
  });

  const versionNumber = await getNextVersionNumber(symbol.id);

  const version = await prisma.symbolVersion.create({
    data: {
      symbolId: symbol.id,
      versionNumber,
      status: "needs_review",
      svg: validation.sanitizedSvg,
      metadataJson,
      sourceInputSummary: parsed.sourceInputSummary,
      aiResponseId: parsed.aiResponseId
    }
  });

  if (parsed.sourceAsset) {
    await prisma.symbolSourceAsset.create({
      data: {
        symbolId: symbol.id,
        versionId: version.id,
        fileName: parsed.sourceAsset.fileName,
        mimeType: parsed.sourceAsset.mimeType,
        sizeBytes: parsed.sourceAsset.sizeBytes,
        dataUrl: parsed.sourceAsset.dataUrl
      }
    });
  }

  await replaceValidationIssues({
    symbolId: symbol.id,
    versionId: version.id,
    issues: validation.issues
  });

  return getSymbolDetail(symbol.id);
}

export async function validateSymbolVersion(versionId: string) {
  const version = await prisma.symbolVersion.findUnique({
    where: { id: versionId },
    include: { symbol: true }
  });

  if (!version) {
    throw new Error("Symbol version was not found.");
  }

  const metadata = parseMetadataJson(version.metadataJson);
  const validation = validateSymbol(version.svg, metadata);

  await prisma.symbolVersion.update({
    where: { id: version.id },
    data: {
      svg: validation.sanitizedSvg,
      metadataJson: stringifyMetadata(validation.metadata ?? metadata)
    }
  });

  await replaceValidationIssues({
    symbolId: version.symbolId,
    versionId: version.id,
    issues: validation.issues
  });

  return {
    symbolId: version.symbolId,
    blockingIssueCount: validation.blockingIssueCount,
    issues: validation.issues
  };
}

export async function updateSymbolTerminalMap(input: TerminalMapUpdateInput) {
  const parsed = terminalMapUpdateInputSchema.parse(input);
  const version = await prisma.symbolVersion.findUnique({
    where: { id: parsed.versionId },
    include: { symbol: true }
  });

  if (!version) {
    throw new Error("Symbol version was not found.");
  }

  const metadata = parseMetadataJson(version.metadataJson);
  const updatedMetadata = {
    ...metadata,
    terminals: parsed.terminals.map((terminal) => ({
      ...terminal,
      function: terminal.function?.trim() || undefined
    }))
  };
  const validation = validateSymbol(version.svg, updatedMetadata);
  const nextVersionStatus =
    version.status === "approved" ? "needs_review" : version.status;
  const nextSymbolStatus =
    version.symbol.status === "archived" ? "archived" : "needs_review";

  await prisma.$transaction([
    prisma.symbolVersion.update({
      where: { id: version.id },
      data: {
        status: nextVersionStatus,
        svg: validation.sanitizedSvg,
        metadataJson: stringifyMetadata(validation.metadata ?? updatedMetadata)
      }
    }),
    prisma.symbol.update({
      where: { id: version.symbolId },
      data: { status: nextSymbolStatus }
    })
  ]);

  await replaceValidationIssues({
    symbolId: version.symbolId,
    versionId: version.id,
    issues: validation.issues
  });

  return getSymbolDetail(version.symbolId);
}

export async function createEngineerNote(input: CreateEngineerNoteInput) {
  const parsed = createEngineerNoteInputSchema.parse(input);

  await prisma.symbolEngineerNote.create({
    data: {
      symbolId: parsed.symbolId,
      versionId: parsed.versionId,
      notes: parsed.notes,
      imageFileName: parsed.image?.fileName,
      imageMimeType: parsed.image?.mimeType,
      imageSizeBytes: parsed.image?.sizeBytes,
      imageDataUrl: parsed.image?.dataUrl
    }
  });

  return getSymbolDetail(parsed.symbolId);
}

export async function uploadSymbolDocument(input: UploadSymbolDocumentInput) {
  const parsed = uploadSymbolDocumentInputSchema.parse(input);

  const document = await prisma.symbolDocument.create({
    data: {
      symbolId: parsed.symbolId,
      versionId: parsed.versionId,
      title: parsed.title,
      fileName: parsed.fileName,
      mimeType: parsed.mimeType,
      sizeBytes: parsed.sizeBytes,
      dataUrl: parsed.dataUrl
    }
  });

  return {
    id: document.id,
    symbolId: document.symbolId
  };
}

export async function approveSymbolVersion(versionId: string) {
  const version = await prisma.symbolVersion.findUnique({
    where: { id: versionId }
  });

  if (!version) {
    throw new Error("Symbol version was not found.");
  }

  const metadata = parseMetadataJson(version.metadataJson);
  const validation = validateSymbol(version.svg, metadata);

  await replaceValidationIssues({
    symbolId: version.symbolId,
    versionId: version.id,
    issues: validation.issues
  });

  if (validation.blockingIssueCount > 0) {
    throw new Error("Blocking validation issues must be resolved before approval.");
  }

  await prisma.$transaction([
    prisma.symbolVersion.updateMany({
      where: {
        symbolId: version.symbolId,
        status: "approved"
      },
      data: { status: "needs_review" }
    }),
    prisma.symbolVersion.update({
      where: { id: version.id },
      data: {
        status: "approved",
        svg: validation.sanitizedSvg,
        metadataJson: stringifyMetadata(validation.metadata ?? metadata)
      }
    }),
    prisma.symbol.update({
      where: { id: version.symbolId },
      data: { status: "approved" }
    })
  ]);

  return getSymbolDetail(version.symbolId);
}

export async function archiveSymbol(symbolId: string) {
  await prisma.symbol.update({
    where: { id: symbolId },
    data: { status: "archived" }
  });
}

export async function exportSymbolPackage(symbolId: string) {
  const exportable = await getSymbolVersionForExport(symbolId);

  if (!exportable) {
    throw new Error("No approved symbol version is available to export.");
  }

  return createSymbolPackage(exportable);
}
