import { cache } from "react";
import { prisma } from "@/lib/prisma";
import {
  approvedNetworkVersionIdsSchema,
  parseMetadataJson,
  symbolCategorySchema,
  symbolStatusSchema,
  type ValidationIssue
} from "./schema";
import {
  buildApprovedNetworkSymbol,
  buildApprovedNetworkSymbolCatalogItem,
  type ApprovedNetworkSymbol,
  type ApprovedNetworkSymbolCatalogItem
} from "../logic/services/network-symbol-catalog";
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
          id: true,
          versionNumber: true
        }
      },
      validationIssues: {
        where: { severity: "blocking" },
        select: { id: true, versionId: true }
      }
    },
    orderBy: { updatedAt: "desc" }
  });

  return rows.map((row) => {
    const latestVersion = row.versions[0];

    return {
      id: row.id,
      symbolKey: row.symbolKey,
      displayName: row.displayName,
      manufacturer: row.manufacturer,
      model: row.model,
      category: symbolCategorySchema.parse(row.category),
      status: symbolStatusSchema.parse(row.status),
      latestVersionNumber: latestVersion?.versionNumber,
      blockingIssueCount: latestVersion
        ? row.validationIssues.filter(
            (issue) => issue.versionId === latestVersion.id
          ).length
        : 0,
      updatedAt: row.updatedAt.toISOString()
    };
  });
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
      validationIssues: row.validationIssues
        .filter((issue) => issue.versionId === latestVersion?.id)
        .map(toValidationIssue),
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

export const listNetworkSymbolCatalog = cache(
  async (): Promise<ApprovedNetworkSymbolCatalogItem[]> => {
    const rows = await prisma.symbol.findMany({
      where: {
        status: "approved",
        category: "network_device"
      },
      select: {
        id: true,
        symbolKey: true,
        displayName: true,
        manufacturer: true,
        model: true,
        versions: {
          where: { status: "approved" },
          orderBy: { versionNumber: "desc" },
          take: 1,
          select: {
            id: true,
            versionNumber: true,
            metadataJson: true
          }
        }
      },
      orderBy: [{ displayName: "asc" }, { symbolKey: "asc" }]
    });

    return rows
      .flatMap((symbol) => {
        const version = symbol.versions[0];

        if (!version) {
          return [];
        }

        const item = buildApprovedNetworkSymbolCatalogItem({
          symbolId: symbol.id,
          symbolKey: symbol.symbolKey,
          displayName: symbol.displayName,
          manufacturer: symbol.manufacturer,
          model: symbol.model,
          versionId: version.id,
          versionNumber: version.versionNumber,
          metadataJson: version.metadataJson
        });

        return item ? [item] : [];
      })
      .sort(
        (first, second) =>
          first.displayName.localeCompare(second.displayName) ||
          first.symbolKey.localeCompare(second.symbolKey) ||
          first.versionId.localeCompare(second.versionId)
      );
  }
);

function toApprovedNetworkSymbol(version: {
  id: string;
  versionNumber: number;
  svg: string;
  metadataJson: string;
  symbol: {
    id: string;
    symbolKey: string;
    displayName: string;
    manufacturer: string | null;
    model: string | null;
  };
}): ApprovedNetworkSymbol | null {
  return buildApprovedNetworkSymbol({
    symbolId: version.symbol.id,
    symbolKey: version.symbol.symbolKey,
    displayName: version.symbol.displayName,
    manufacturer: version.symbol.manufacturer,
    model: version.symbol.model,
    versionId: version.id,
    versionNumber: version.versionNumber,
    svg: version.svg,
    metadataJson: version.metadataJson
  });
}

const NETWORK_VERSION_QUERY_CHUNK_SIZE = 400;

export async function listApprovedNetworkSymbolVersionsByIds(
  versionIds: readonly string[]
): Promise<ApprovedNetworkSymbol[]> {
  const uniqueVersionIds = approvedNetworkVersionIdsSchema.parse(versionIds);

  if (uniqueVersionIds.length === 0) {
    return [];
  }

  const results: ApprovedNetworkSymbol[] = [];

  for (
    let offset = 0;
    offset < uniqueVersionIds.length;
    offset += NETWORK_VERSION_QUERY_CHUNK_SIZE
  ) {
    const chunk = uniqueVersionIds.slice(
      offset,
      offset + NETWORK_VERSION_QUERY_CHUNK_SIZE
    );
    const rows = await prisma.symbolVersion.findMany({
      where: {
        id: { in: chunk },
        status: "approved",
        symbol: {
          status: "approved",
          category: "network_device"
        }
      },
      select: {
        id: true,
        versionNumber: true,
        svg: true,
        metadataJson: true,
        symbol: {
          select: {
            id: true,
            symbolKey: true,
            displayName: true,
            manufacturer: true,
            model: true
          }
        }
      }
    });

    for (const row of rows) {
      const symbol = toApprovedNetworkSymbol(row);
      if (symbol) {
        results.push(symbol);
      }
    }
  }

  return results.sort(
    (first, second) =>
      first.displayName.localeCompare(second.displayName) ||
      first.symbolKey.localeCompare(second.symbolKey) ||
      first.versionId.localeCompare(second.versionId)
  );
}

export async function getApprovedNetworkSymbolSvgAsset(versionId: string) {
  const parsedVersionIds = approvedNetworkVersionIdsSchema.safeParse([versionId]);

  if (!parsedVersionIds.success) {
    return null;
  }

  const parsedVersionId = parsedVersionIds.data[0];

  if (!parsedVersionId) {
    return null;
  }
  const version = await prisma.symbolVersion.findFirst({
    where: {
      id: parsedVersionId,
      status: "approved",
      symbol: {
        status: "approved",
        category: "network_device"
      }
    },
    select: {
      id: true,
      versionNumber: true,
      svg: true,
      metadataJson: true,
      symbol: {
        select: {
          id: true,
          symbolKey: true,
          displayName: true,
          manufacturer: true,
          model: true
        }
      }
    }
  });

  if (!version || !toApprovedNetworkSymbol(version)) {
    return null;
  }

  return { versionId: version.id, svg: version.svg };
}

export async function listNetworkSymbolVersions(): Promise<
  ApprovedNetworkSymbol[]
> {
  const rows = await prisma.symbol.findMany({
    where: {
      status: "approved",
      category: "network_device"
    },
    select: {
      id: true,
      symbolKey: true,
      displayName: true,
      manufacturer: true,
      model: true,
      versions: {
        where: { status: "approved" },
        orderBy: { versionNumber: "desc" },
        take: 1,
        select: {
          id: true,
          versionNumber: true,
          svg: true,
          metadataJson: true
        }
      }
    },
    orderBy: [{ displayName: "asc" }]
  });

  return rows.flatMap((symbol) => {
    const version = symbol.versions[0];

    if (!version) {
      return [];
    }

    const item = buildApprovedNetworkSymbol({
      symbolId: symbol.id,
      symbolKey: symbol.symbolKey,
      displayName: symbol.displayName,
      manufacturer: symbol.manufacturer,
      model: symbol.model,
      versionId: version.id,
      versionNumber: version.versionNumber,
      svg: version.svg,
      metadataJson: version.metadataJson
    });

    return item ? [item] : [];
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
