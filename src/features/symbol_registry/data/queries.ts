import { cache } from "react";
import { prisma } from "@/lib/prisma";
import {
  isNetworkSymbolCategory,
  parseMetadataJson,
  symbolCategorySchema,
  symbolStatusSchema,
  type ValidationIssue
} from "./schema";
import type {
  SymbolDetail,
  SymbolDocumentSummary,
  SymbolEngineerNoteSummary,
  SymbolListItem,
  SymbolVersionSummary
} from "../types";

function toValidationIssue(issue: {
  severity: string;
  code: string;
  message: string;
  path: string | null;
}): ValidationIssue {
  return {
    severity: issue.severity as ValidationIssue["severity"],
    code: issue.code,
    message: issue.message,
    path: issue.path ?? undefined
  };
}

function toVersionSummary(version: {
  id: string;
  versionNumber: number;
  status: string;
  svg: string;
  metadataJson: string;
  sourceInputSummary: string | null;
  aiResponseId: string | null;
  createdAt: Date;
}): SymbolVersionSummary {
  return {
    id: version.id,
    versionNumber: version.versionNumber,
    status: symbolStatusSchema.parse(version.status),
    svg: version.svg,
    metadata: parseMetadataJson(version.metadataJson),
    sourceInputSummary: version.sourceInputSummary,
    aiResponseId: version.aiResponseId,
    createdAt: version.createdAt.toISOString()
  };
}

function toEngineerNoteSummary(note: {
  id: string;
  symbolId: string;
  versionId: string | null;
  notes: string;
  imageFileName: string | null;
  imageMimeType: string | null;
  imageSizeBytes: number | null;
  imageDataUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}): SymbolEngineerNoteSummary {
  return {
    id: note.id,
    symbolId: note.symbolId,
    versionId: note.versionId,
    notes: note.notes,
    imageFileName: note.imageFileName,
    imageMimeType: note.imageMimeType,
    imageSizeBytes: note.imageSizeBytes,
    imageDataUrl: note.imageDataUrl,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString()
  };
}

function toDocumentSummary(document: {
  id: string;
  symbolId: string;
  versionId: string | null;
  title: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
  updatedAt: Date;
}): SymbolDocumentSummary {
  return {
    id: document.id,
    symbolId: document.symbolId,
    versionId: document.versionId,
    title: document.title,
    fileName: document.fileName,
    mimeType: document.mimeType,
    sizeBytes: document.sizeBytes,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString()
  };
}

export const listSymbols = cache(async (): Promise<SymbolListItem[]> => {
  const rows = await prisma.symbol.findMany({
    where: {
      NOT: {
        status: "archived"
      }
    },
    include: {
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
        select: {
          versionNumber: true
        }
      },
      validationIssues: {
        where: { severity: "blocking" },
        select: { id: true }
      }
    },
    orderBy: { updatedAt: "desc" }
  });

  return rows.map((row) => ({
    id: row.id,
    symbolKey: row.symbolKey,
    displayName: row.displayName,
    manufacturer: row.manufacturer,
    model: row.model,
    category: symbolCategorySchema.parse(row.category),
    status: symbolStatusSchema.parse(row.status),
    latestVersionNumber: row.versions[0]?.versionNumber,
    blockingIssueCount: row.validationIssues.length,
    updatedAt: row.updatedAt.toISOString()
  }));
});

export const getSymbolDetail = cache(
  async (id: string): Promise<SymbolDetail | null> => {
    const row = await prisma.symbol.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { versionNumber: "desc" }
        },
        validationIssues: {
          orderBy: [{ severity: "asc" }, { createdAt: "desc" }]
        },
        engineerNotes: {
          orderBy: { createdAt: "desc" }
        },
        documents: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            symbolId: true,
            versionId: true,
            title: true,
            fileName: true,
            mimeType: true,
            sizeBytes: true,
            createdAt: true,
            updatedAt: true
          }
        }
      }
    });

    if (!row) {
      return null;
    }

    const latestVersion = row.versions[0]
      ? toVersionSummary(row.versions[0])
      : undefined;

    return {
      id: row.id,
      symbolKey: row.symbolKey,
      displayName: row.displayName,
      manufacturer: row.manufacturer,
      model: row.model,
      category: symbolCategorySchema.parse(row.category),
      status: symbolStatusSchema.parse(row.status),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      latestVersion,
      versions: row.versions.map((version) => ({
        id: version.id,
        versionNumber: version.versionNumber,
        status: symbolStatusSchema.parse(version.status),
        createdAt: version.createdAt.toISOString()
      })),
      validationIssues: row.validationIssues.map(toValidationIssue),
      engineerNotes: row.engineerNotes.map(toEngineerNoteSummary),
      documents: row.documents.map(toDocumentSummary)
    };
  }
);

export async function getSymbolVersionForExport(symbolId: string) {
  const symbol = await prisma.symbol.findUnique({
    where: { id: symbolId },
    include: {
      versions: {
        where: { status: "approved" },
        orderBy: { versionNumber: "desc" },
        take: 1
      }
    }
  });

  if (!symbol || !symbol.versions[0]) {
    return null;
  }

  const version = symbol.versions[0];
  return {
    symbolKey: symbol.symbolKey,
    svg: version.svg,
    metadata: parseMetadataJson(version.metadataJson)
  };
}

export async function listDrawingSymbolVersions() {
  const rows = await prisma.symbol.findMany({
    where: {
      status: { not: "archived" },
      category: { not: "network_device" }
    },
    include: {
      versions: {
        where: { status: { not: "archived" } },
        orderBy: { versionNumber: "desc" },
        take: 1
      }
    },
    orderBy: [{ category: "asc" }, { displayName: "asc" }]
  });

  return rows.flatMap((symbol) => {
    const version = symbol.versions[0];

    if (!version) {
      return [];
    }

    return [
      {
        symbolId: symbol.id,
        symbolKey: symbol.symbolKey,
        displayName: symbol.displayName,
        manufacturer: symbol.manufacturer,
        model: symbol.model,
        category: symbolCategorySchema.parse(symbol.category),
        versionId: version.id,
        versionNumber: version.versionNumber,
        svg: version.svg,
        metadata: parseMetadataJson(version.metadataJson)
      }
    ];
  });
}

export async function listNetworkSymbolVersions() {
  const rows = await prisma.symbol.findMany({
    where: {
      status: "approved",
      category: "network_device"
    },
    include: {
      versions: {
        where: { status: "approved" },
        orderBy: { versionNumber: "desc" },
        take: 1
      }
    },
    orderBy: [{ displayName: "asc" }]
  });

  return rows.flatMap((symbol) => {
    const version = symbol.versions[0];

    if (!version) {
      return [];
    }

    const metadata = parseMetadataJson(version.metadataJson);

    if (!metadata.networkProfile || !isNetworkSymbolCategory(metadata.category)) {
      return [];
    }

    return [
      {
        symbolId: symbol.id,
        symbolKey: symbol.symbolKey,
        displayName: symbol.displayName,
        manufacturer: symbol.manufacturer,
        model: symbol.model,
        category: symbolCategorySchema.parse(symbol.category),
        versionId: version.id,
        versionNumber: version.versionNumber,
        svg: version.svg,
        metadata
      }
    ];
  });
}

export async function listApprovedSymbolVersions() {
  return listDrawingSymbolVersions();
}

export async function getSymbolVersionForTerminalVerification(versionId: string) {
  const version = await prisma.symbolVersion.findUnique({
    where: { id: versionId },
    include: { symbol: true }
  });

  if (!version) {
    return null;
  }

  return {
    symbolId: version.symbolId,
    symbolName: version.symbol.displayName,
    manufacturer: version.symbol.manufacturer,
    model: version.symbol.model,
    svg: version.svg,
    metadata: parseMetadataJson(version.metadataJson),
    sourceInputSummary: version.sourceInputSummary
  };
}

export async function getSymbolDocumentForDownload(documentId: string) {
  return prisma.symbolDocument.findUnique({
    where: { id: documentId },
    select: {
      fileName: true,
      mimeType: true,
      dataUrl: true
    }
  });
}
