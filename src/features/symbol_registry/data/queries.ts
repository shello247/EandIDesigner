import { Prisma } from "@prisma/client";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { deviceTypeSchema } from "@/shared/device-classification/device-types";
import {
  drawingSymbolCatalogSummarySchema,
  drawingSymbolVersionIdsSchema,
  parseMetadataJson,
  SYMBOL_REGISTRY_PAGE_SIZE,
  symbolRegistryListInputSchema,
  symbolTechnicalKindSchema,
  symbolStatusSchema,
  type SymbolRegistryListInput,
  type DrawingSymbolCatalogSummary
} from "./schema";
import type {
  SymbolDetail,
  SymbolIdentity,
  SymbolListItem,
  SymbolListPage,
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

const symbolListSelect = Prisma.validator<Prisma.SymbolSelect>()({
  id: true,
  symbolKey: true,
  displayName: true,
  manufacturer: true,
  model: true,
  category: true,
  status: true,
  updatedAt: true,
  versions: {
    orderBy: { versionNumber: "desc" },
    take: 1,
    select: {
      id: true,
      deviceType: true,
      versionNumber: true
    }
  },
  managedCategory: {
    select: { id: true, name: true }
  },
  bomTemplate: {
    select: {
      _count: { select: { lines: true } }
    }
  }
});

type SymbolListDatabaseRow = Prisma.SymbolGetPayload<{
  select: typeof symbolListSelect;
}>;

const symbolListWhere = (categoryId?: string): Prisma.SymbolWhereInput => ({
  NOT: { status: "archived" },
  categoryId
});

function toSymbolListItem(row: SymbolListDatabaseRow): SymbolListItem {
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
    deviceType: deviceTypeSchema.nullable().parse(latestVersion?.deviceType ?? null),
    linkedItemCount: row.bomTemplate?._count.lines ?? 0,
    updatedAt: row.updatedAt.toISOString()
  };
}

async function findSymbolListRows(
  where: Prisma.SymbolWhereInput,
  page?: number
): Promise<SymbolListDatabaseRow[]> {
  return prisma.symbol.findMany({
    where,
    select: symbolListSelect,
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    skip: page === undefined ? undefined : (page - 1) * SYMBOL_REGISTRY_PAGE_SIZE,
    take: page === undefined ? undefined : SYMBOL_REGISTRY_PAGE_SIZE
  });
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

function toVersionSummary(version: {
  deviceType?: string | null;
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
    deviceType: deviceTypeSchema.nullable().parse(version.deviceType ?? null),
    versionNumber: version.versionNumber,
    status: symbolStatusSchema.parse(version.status),
    svg: version.svg,
    metadata: parseMetadataJson(version.metadataJson),
    sourceInputSummary: version.sourceInputSummary,
    aiResponseId: version.aiResponseId,
    createdAt: version.createdAt.toISOString()
  };
}

export const listSymbols = cache(async (): Promise<SymbolListItem[]> => {
  const rows = await findSymbolListRows(symbolListWhere());
  return rows.map(toSymbolListItem);
});

export const listSymbolRegistryPage = cache(
  async (input: SymbolRegistryListInput): Promise<SymbolListPage> => {
    const parsed = symbolRegistryListInputSchema.parse(input);
    const where = symbolListWhere(parsed.categoryId);
    if (parsed.deviceType) {
      // Filter the exact current version, not any matching historical version.
      const ids = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT s."id" FROM "Symbol" s LEFT JOIN "SymbolVersion" v ON v."symbolId" = s."id"
          AND v."versionNumber" = (SELECT MAX(h."versionNumber") FROM "SymbolVersion" h WHERE h."symbolId" = s."id")
        WHERE ${parsed.deviceType === "needs_classification" ? Prisma.sql`v."deviceType" IS NULL` : Prisma.sql`v."deviceType" = ${parsed.deviceType}`}`);
      where.id = { in: ids.map(row => row.id) };
    }
    const [totalCount, requestedRows] = await Promise.all([
      prisma.symbol.count({ where }),
      findSymbolListRows(where, parsed.page)
    ]);
    const totalPages = Math.max(
      1,
      Math.ceil(totalCount / SYMBOL_REGISTRY_PAGE_SIZE)
    );
    const page = Math.min(parsed.page, totalPages);
    const rows =
      page === parsed.page || totalCount === 0
        ? requestedRows
        : await findSymbolListRows(where, page);

    return {
      items: rows.map(toSymbolListItem),
      page,
      pageSize: SYMBOL_REGISTRY_PAGE_SIZE,
      totalCount,
      totalPages,
      categoryId: parsed.categoryId
      , deviceType: parsed.deviceType
    };
  }
);

export const getSymbolDetail = cache(
  async (id: string): Promise<SymbolDetail | null> => {
    const row = await prisma.symbol.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { versionNumber: "desc" }
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
      }))
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
    deviceType: deviceTypeSchema.nullable().parse(version.deviceType ?? null),
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
        deviceType: deviceTypeSchema.nullable().parse(version.deviceType ?? null),
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
      deviceType: deviceTypeSchema.nullable().parse(version.deviceType ?? null),
      versionNumber: version.versionNumber,
      svg: version.svg,
      metadata: parseMetadataJson(version.metadataJson),
      selectable: false
    }))
  ];
}

const DRAWING_VERSION_QUERY_CHUNK_SIZE = 400;

type DrawingSymbolVersionRow = {
  deviceType?: string | null;
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
    deviceType: deviceTypeSchema.nullable().parse(version.deviceType ?? null),
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
        deviceType: true,
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
            deviceType: true,
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
          deviceType: deviceTypeSchema.nullable().parse(version.deviceType ?? null),
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
