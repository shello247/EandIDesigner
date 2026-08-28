import { cache } from "react";
import { prisma } from "@/lib/prisma";
import {
  drawingSymbolCatalogSummarySchema,
  drawingSymbolVersionIdsSchema,
  parseMetadataJson,
  symbolTechnicalKindSchema,
  symbolStatusSchema,
  type DrawingSymbolCatalogSummary,
  type ValidationIssue
} from "./schema";
import type {
  SymbolDetail,
  SymbolDocumentSummary,
  SymbolEngineerNoteSummary,
  SymbolIdentity,
  SymbolListItem,
  SymbolVersionSummary
} from "../types";
import type { SymbolCategorySummary } from "@/features/symbol_categories/api/public";

function requireManagedCategory(
  category: { id: string; name: string } | null
): SymbolCategorySummary {
  if (!category) {
    throw new Error(
      "A symbol is missing its managed category. Run the database setup before continuing."
    );
  }

  return category;
}

export const listSymbolIdentitiesByIds = cache(
  async (symbolIds: string[]): Promise<SymbolIdentity[]> => {
    const ids = [...new Set(symbolIds.filter(Boolean))];

    if (ids.length === 0) {
      return [];
    }

    const rows = await prisma.symbol.findMany({
      where: {
        id: { in: ids },
        status: { not: "archived" },
        category: { not: "network_device" }
      },
      select: {
        id: true,
        displayName: true
      }
    });

    return rows.map((row) => ({
      symbolId: row.id,
      displayName: row.displayName
    }));
  }
);

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
      },
      managedCategory: {
        select: { id: true, name: true }
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
      category: requireManagedCategory(row.managedCategory),
      technicalKind: symbolTechnicalKindSchema.parse(row.category),
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
        },
        managedCategory: {
          select: { id: true, name: true }
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
      category: requireManagedCategory(row.managedCategory),
      technicalKind: symbolTechnicalKindSchema.parse(row.category),
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

export async function listDrawingSymbolVersions(
  referencedVersionIds: readonly string[] = []
) {
  const rows = await prisma.symbol.findMany({
    where: {
      status: "approved",
      category: { not: "network_device" }
    },
    include: {
      versions: {
        where: { status: "approved" },
        orderBy: { versionNumber: "desc" },
        take: 1
      },
      managedCategory: {
        select: { id: true, name: true }
      }
    },
    orderBy: [{ managedCategory: { name: "asc" } }, { displayName: "asc" }]
  });

  const selectableVersions = rows.flatMap((symbol) => {
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
        category: symbolTechnicalKindSchema.parse(symbol.category),
        technicalKind: symbolTechnicalKindSchema.parse(symbol.category),
        managedCategory: requireManagedCategory(symbol.managedCategory),
        versionId: version.id,
        versionNumber: version.versionNumber,
        svg: version.svg,
        metadata: parseMetadataJson(version.metadataJson),
        selectable: true
      }
    ];
  });
  const selectableVersionIds = new Set(
    selectableVersions.map((version) => version.versionId)
  );
  const pinnedIds = [
    ...new Set(referencedVersionIds.filter((id) => !selectableVersionIds.has(id)))
  ];
  const pinnedVersions =
    pinnedIds.length === 0
      ? []
      : await prisma.symbolVersion.findMany({
          where: {
            id: { in: pinnedIds },
            symbol: { category: { not: "network_device" } }
          },
          include: {
            symbol: {
              include: {
                managedCategory: {
                  select: { id: true, name: true }
                }
              }
            }
          }
        });

  return [
    ...selectableVersions,
    ...pinnedVersions.map((version) => ({
      symbolId: version.symbolId,
      symbolKey: version.symbol.symbolKey,
      displayName: version.symbol.displayName,
      manufacturer: version.symbol.manufacturer,
      model: version.symbol.model,
      category: symbolTechnicalKindSchema.parse(version.symbol.category),
      technicalKind: symbolTechnicalKindSchema.parse(
        version.symbol.category
      ),
      managedCategory: requireManagedCategory(
        version.symbol.managedCategory
      ),
      versionId: version.id,
      versionNumber: version.versionNumber,
      svg: version.svg,
      metadata: parseMetadataJson(version.metadataJson),
      selectable: false
    }))
  ];
}

const DRAWING_VERSION_QUERY_CHUNK_SIZE = 400;

type DrawingSymbolVersionRow = {
  id: string;
  symbolId: string;
  versionNumber: number;
  svg: string;
  metadataJson: string;
  symbol: {
    id: string;
    symbolKey: string;
    displayName: string;
    manufacturer: string | null;
    model: string | null;
    category: string;
    managedCategory: { id: string; name: string } | null;
  };
};

function toExactDrawingSymbolVersion(version: DrawingSymbolVersionRow) {
  return {
    symbolId: version.symbolId,
    symbolKey: version.symbol.symbolKey,
    displayName: version.symbol.displayName,
    manufacturer: version.symbol.manufacturer,
    model: version.symbol.model,
    category: symbolTechnicalKindSchema.parse(version.symbol.category),
    technicalKind: symbolTechnicalKindSchema.parse(version.symbol.category),
    managedCategory: requireManagedCategory(version.symbol.managedCategory),
    versionId: version.id,
    versionNumber: version.versionNumber,
    svg: version.svg,
    metadata: parseMetadataJson(version.metadataJson),
    selectable: false
  };
}

export async function listDrawingSymbolVersionsByIds(
  versionIds: readonly string[]
) {
  const requestedVersionIds = drawingSymbolVersionIdsSchema.parse(versionIds);

  if (requestedVersionIds.length === 0) {
    return [];
  }

  const versionsById = new Map<string, DrawingSymbolVersionRow>();

  for (
    let offset = 0;
    offset < requestedVersionIds.length;
    offset += DRAWING_VERSION_QUERY_CHUNK_SIZE
  ) {
    const chunk = requestedVersionIds.slice(
      offset,
      offset + DRAWING_VERSION_QUERY_CHUNK_SIZE
    );
    const rows = await prisma.symbolVersion.findMany({
      where: {
        id: { in: chunk },
        symbol: { category: { not: "network_device" } }
      },
      select: {
        id: true,
        symbolId: true,
        versionNumber: true,
        svg: true,
        metadataJson: true,
        symbol: {
          select: {
            id: true,
            symbolKey: true,
            displayName: true,
            manufacturer: true,
            model: true,
            category: true,
            managedCategory: {
              select: { id: true, name: true }
            }
          }
        }
      }
    });

    for (const row of rows) {
      versionsById.set(row.id, row);
    }
  }

  return requestedVersionIds.flatMap((versionId) => {
    const version = versionsById.get(versionId);
    return version ? [toExactDrawingSymbolVersion(version)] : [];
  });
}

export const listDrawingSymbolCatalogSummaries = cache(
  async (): Promise<DrawingSymbolCatalogSummary[]> => {
    const rows = await prisma.symbol.findMany({
      where: {
        status: "approved",
        category: { not: "network_device" }
      },
      select: {
        id: true,
        symbolKey: true,
        displayName: true,
        manufacturer: true,
        model: true,
        category: true,
        managedCategory: {
          select: { id: true, name: true }
        },
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
      orderBy: [
        { managedCategory: { name: "asc" } },
        { displayName: "asc" },
        { id: "asc" }
      ]
    });

    return rows.flatMap((symbol) => {
      const version = symbol.versions[0];
      if (!version) return [];

      const metadata = parseMetadataJson(version.metadataJson);
      return [
        drawingSymbolCatalogSummarySchema.parse({
          symbolId: symbol.id,
          symbolKey: symbol.symbolKey,
          displayName: symbol.displayName,
          manufacturer: symbol.manufacturer,
          model: symbol.model,
          technicalKind: symbolTechnicalKindSchema.parse(symbol.category),
          managedCategory: requireManagedCategory(symbol.managedCategory),
          versionId: version.id,
          versionNumber: version.versionNumber,
          capabilities: {
            layoutUsage: metadata.layoutUsage,
            physicalWidthMm: metadata.physicalWidthMm,
            physicalHeightMm: metadata.physicalHeightMm,
            mountingType: metadata.mountingType,
            panelCategory: metadata.panelCategory,
            terminalBlockModule: metadata.terminalBlockModule,
            terminalStripCapability: metadata.terminalStripCapability
          }
        })
      ];
    });
  }
);

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
