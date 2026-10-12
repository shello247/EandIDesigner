import { prisma } from "@/lib/prisma";
import { parseDrawingModelJson } from "@/features/drawing_canvas/data/schema";
import { mergeImportedComponentConfiguration } from "@/features/symbol_components/api/public";
import { validateRegisteredSymbolComponents } from "@/features/symbol_components/api/server";
import {
  parseMetadataJson,
  saveSymbolMetadataChangesInputSchema,
  saveSymbolDraftInputSchema,
  stringifyMetadata,
  type SaveSymbolMetadataChangesInput,
  type SaveSymbolDraftInput
} from "./schema";
import { createSymbolPackage } from "../logic/use_cases/export-symbol-package";
import { mergeEditableSymbolMetadata } from "../logic/services/editable-symbol-metadata";
import { validateSymbol } from "../logic/use_cases/validate-symbol";
import { getSymbolDetail, getSymbolVersionForExport } from "./queries";
import {
  findSymbolCategoryByName,
  requireSymbolCategory
} from "@/features/symbol_categories/data/queries";
import { resolveLegacySymbolCategoryName } from "@/features/symbol_categories/api/public";

function normalizeSymbolKey(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized.length > 0 ? normalized : "symbol";
}

async function getNextVersionNumber(symbolId: string): Promise<number> {
  const latest = await prisma.symbolVersion.findFirst({
    where: { symbolId },
    orderBy: { versionNumber: "desc" },
    select: { versionNumber: true }
  });

  return (latest?.versionNumber ?? 0) + 1;
}

function validationErrorMessage(validation: ReturnType<typeof validateSymbol>) {
  const blockingIssue = validation.issues.find(
    (issue) => issue.severity === "blocking"
  );

  return blockingIssue?.message ?? "Symbol metadata is invalid.";
}

async function validateSymbolWithRegisteredComponents(
  symbolId: string,
  svg: string,
  metadataInput: unknown
) {
  const validation = validateSymbol(svg, metadataInput);

  if (!validation.metadata) {
    return validation;
  }

  const componentIssues = await validateRegisteredSymbolComponents(
    symbolId,
    validation.metadata
  );
  const issues = [
    ...validation.issues.filter(
      (issue) => !issue.code.startsWith("COMPONENT_")
    ),
    ...componentIssues
  ];

  return {
    ...validation,
    issues,
    blockingIssueCount: issues.filter(
      (issue) => issue.severity === "blocking"
    ).length
  };
}

export async function saveSymbolDraft(input: SaveSymbolDraftInput) {
  const parsed = saveSymbolDraftInputSchema.parse(input);
  const normalizedInputSymbolKey = normalizeSymbolKey(parsed.metadata.symbolKey);
  const previousSymbol = await prisma.symbol.findUnique({
    where: { symbolKey: normalizedInputSymbolKey },
    select: {
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
        select: { metadataJson: true }
      }
    }
  });
  const previousMetadata = previousSymbol?.versions[0]
    ? parseMetadataJson(previousSymbol.versions[0].metadataJson)
    : undefined;
  const metadataWithPreservedComponents = {
    ...parsed.metadata,
    componentPositions: mergeImportedComponentConfiguration(
      parsed.metadata.componentPositions,
      previousMetadata?.componentPositions
    )
  };
  const validation = validateSymbol(parsed.svg, metadataWithPreservedComponents);
  const metadata = validation.metadata ?? metadataWithPreservedComponents;
  const symbolKey = normalizeSymbolKey(metadata.symbolKey);
  const metadataJson = stringifyMetadata({ ...metadata, symbolKey });
  const requestedCategory = parsed.categoryId
    ? await requireSymbolCategory(parsed.categoryId)
    : await findSymbolCategoryByName(
        resolveLegacySymbolCategoryName({
          panelCategory: metadata.panelCategory,
          technicalKind: metadata.category
        })
      );

  if (!requestedCategory) {
    throw new Error("A managed symbol category must be selected.");
  }

  const symbol = await prisma.symbol.upsert({
    where: { symbolKey },
    update: {
      displayName: metadata.displayName,
      manufacturer: metadata.manufacturer,
      model: metadata.model,
      category: metadata.category,
      categoryId: requestedCategory.id,
      status: "draft"
    },
    create: {
      symbolKey,
      displayName: metadata.displayName,
      manufacturer: metadata.manufacturer,
      model: metadata.model,
      category: metadata.category,
      categoryId: requestedCategory.id,
      status: "draft"
    }
  });

  const versionNumber = await getNextVersionNumber(symbol.id);

  const version = await prisma.symbolVersion.create({
    data: {
      symbolId: symbol.id,
      versionNumber,
      status: "draft",
      svg: validation.sanitizedSvg,
      deviceType: parsed.deviceType ?? null,
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

  const completeValidation = await validateSymbolWithRegisteredComponents(
    symbol.id,
    validation.sanitizedSvg,
    metadata
  );
  // Legacy storage token "approved" means available to existing drawing consumers;
  // there is no approval command or decision in the manual-authoring workflow.
  if (completeValidation.blockingIssueCount === 0) {
    await assertTerminalStripDefaultUnique({ symbolId: symbol.id, metadata });
    await prisma.$transaction([
      prisma.symbolVersion.update({
        where: { id: version.id }, data: { status: "approved" }
      }),
      prisma.symbol.update({ where: { id: symbol.id }, data: { status: "approved" } })
    ]);
  }

  return getSymbolDetail(symbol.id);
}

async function assertTerminalStripDefaultUnique(params: {
  symbolId: string;
  metadata: import("./schema").SymbolMetadata;
}) {
  const capability = params.metadata.terminalStripCapability;
  if (!capability?.defaultForNewStrips || capability.role === "accessory") {
    return;
  }

  const symbols = await prisma.symbol.findMany({
    where: {
      id: { not: params.symbolId },
      status: "approved"
    },
    select: {
      displayName: true,
      versions: {
        where: { status: "approved" },
        orderBy: { versionNumber: "desc" },
        take: 1,
        select: { metadataJson: true }
      }
    }
  });

  for (const symbol of symbols) {
    const version = symbol.versions[0];
    if (!version) {
      continue;
    }
    try {
      const other = parseMetadataJson(version.metadataJson)
        .terminalStripCapability;
      if (other?.defaultForNewStrips && other.role === capability.role) {
        throw new Error(
          `${symbol.displayName} is already the default ${
            capability.role === "end_bracket" ? "end bracket" : "electrical member"
          } for new terminal strips.`
        );
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("already the default")) {
        throw error;
      }
    }
  }
}

export async function saveSymbolMetadataChanges(
  input: SaveSymbolMetadataChangesInput
) {
  const parsed = saveSymbolMetadataChangesInputSchema.parse(input);
  const version = await prisma.symbolVersion.findUnique({
    where: { id: parsed.versionId },
    include: { symbol: true }
  });

  if (
    !version ||
    version.symbolId !== parsed.symbolId ||
    version.symbol.id !== parsed.symbolId
  ) {
    throw new Error("Symbol version was not found.");
  }

  if (
    version.symbol.status === "archived" ||
    version.status === "archived"
  ) {
    throw new Error("Archived symbols are immutable.");
  }

  const latestVersion = await prisma.symbolVersion.findFirst({
    where: { symbolId: parsed.symbolId },
    orderBy: { versionNumber: "desc" },
    select: { id: true }
  });

  if (!latestVersion || latestVersion.id !== version.id) {
    throw new Error("Historical symbol versions cannot be edited.");
  }

  const storedMetadata = parseMetadataJson(version.metadataJson);
  const categoryId = parsed.categoryId ?? version.symbol.categoryId;
  if (!categoryId) {
    throw new Error("A managed symbol category must be selected.");
  }
  await requireSymbolCategory(categoryId);
  const mergedMetadata = mergeEditableSymbolMetadata(storedMetadata, parsed);
  const validation = await validateSymbolWithRegisteredComponents(
    version.symbolId,
    version.svg,
    mergedMetadata
  );

  if (!validation.metadata) {
    throw new Error(validationErrorMessage(validation));
  }
  const validatedMetadata = validation.metadata;

  await assertTerminalStripDefaultUnique({
    symbolId: version.symbolId,
    metadata: validatedMetadata
  });

  if (validation.blockingIssueCount > 0) {
    throw new Error(
      validation.issues.find((issue) => issue.severity === "blocking")
        ?.message ??
        "Symbol data contains invalid SVG or terminal references."
    );
  }

  const nextStatus = "approved"; // Existing storage compatibility; saving makes the symbol available.
  const isNetworkSymbol = validatedMetadata.category === "network_device";

  await prisma.$transaction(async (transaction) => {
    await transaction.symbolVersion.update({
      where: { id: version.id },
      data: {
        status: nextStatus,
        metadataJson: stringifyMetadata(validatedMetadata)
      }
    });
    await transaction.symbol.update({
      where: { id: version.symbolId },
      data: {
        status: nextStatus,
        displayName: validatedMetadata.displayName,
        categoryId,
        ...(isNetworkSymbol
          ? {
              manufacturer: validatedMetadata.manufacturer ?? null,
              model: validatedMetadata.model ?? null
            }
          : {})
      }
    });
  });

  return getSymbolDetail(version.symbolId);
}

function formatDrawingReferences(titles: string[]): string {
  const visibleTitles = titles.slice(0, 4).join(", ");
  const remainingCount = titles.length - 4;

  return remainingCount > 0
    ? `${visibleTitles}, and ${remainingCount} more`
    : visibleTitles;
}

function selectionReferencesSymbol(
  selections: ReturnType<typeof parseDrawingModelJson>["assets"][number]["componentSelections"],
  symbolId: string
): boolean {
  return (selections ?? []).some(
    (selection) =>
      selection.symbolId === symbolId ||
      selectionReferencesSymbol(selection.children, symbolId)
  );
}

export async function deleteSymbol(symbolId: string) {
  const symbol = await prisma.symbol.findUnique({
    where: { id: symbolId },
    select: { displayName: true }
  });

  if (!symbol) {
    throw new Error("Symbol was not found.");
  }

  const drawings = await prisma.drawing.findMany({
    where: {
      NOT: { status: "archived" }
    },
    select: {
      title: true,
      modelJson: true
    }
  });
  const referencedBy = drawings.flatMap((drawing) => {
    const model = parseDrawingModelJson(drawing.modelJson);
    const isReferenced =
      model.sheets.some((sheet) =>
        sheet.placements.some((placement) => placement.symbolId === symbolId)
      ) ||
      model.assets.some((asset) =>
        selectionReferencesSymbol(asset.componentSelections, symbolId) ||
        (asset.terminalStrip?.members ?? []).some(
          (member) =>
            member.symbolId === symbolId ||
            selectionReferencesSymbol(member.componentSelections, symbolId)
        )
      );

    return isReferenced ? [drawing.title] : [];
  });

  if (referencedBy.length > 0) {
    throw new Error(
      `Cannot delete "${symbol.displayName}" because it is used in ${referencedBy.length} drawing${referencedBy.length === 1 ? "" : "s"}: ${formatDrawingReferences(referencedBy)}. Remove those placements first.`
    );
  }

  const parentVersions = await prisma.symbolVersion.findMany({
    where: {
      symbolId: { not: symbolId }
    },
    select: {
      metadataJson: true,
      symbol: {
        select: { displayName: true }
      }
    }
  });
  const referencedByParents = [
    ...new Set(
      parentVersions.flatMap((version) => {
        const metadata = parseMetadataJson(version.metadataJson);
        const isReferenced = (metadata.componentPositions ?? []).some(
          (position) =>
            position.components.some((component) =>
              component.allowedSymbolIds.includes(symbolId)
            )
        );
        return isReferenced ? [version.symbol.displayName] : [];
      })
    )
  ];

  if (referencedByParents.length > 0) {
    throw new Error(
      `Cannot delete "${symbol.displayName}" because it is a component alternative for ${referencedByParents.length} parent symbol${referencedByParents.length === 1 ? "" : "s"}: ${formatDrawingReferences(referencedByParents)}. Remove those component assignments first.`
    );
  }

  await prisma.symbol.delete({
    where: { id: symbolId }
  });
}

export async function exportSymbolPackage(symbolId: string) {
  const exportable = await getSymbolVersionForExport(symbolId);

  if (!exportable) {
    throw new Error("No saved symbol version is available to export.");
  }

  return createSymbolPackage(exportable);
}
