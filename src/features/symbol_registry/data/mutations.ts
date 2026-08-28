import { prisma } from "@/lib/prisma";
import { parseDrawingModelJson } from "@/features/drawing_canvas/data/schema";
import { mergeImportedComponentConfiguration } from "@/features/symbol_components/api/public";
import { validateRegisteredSymbolComponents } from "@/features/symbol_components/api/server";
import {
  createEngineerNoteInputSchema,
  parseMetadataJson,
  saveSymbolMetadataChangesInputSchema,
  saveSymbolDraftInputSchema,
  symbolStatusSchema,
  stringifyMetadata,
  type CreateEngineerNoteInput,
  type SaveSymbolMetadataChangesInput,
  type SaveSymbolDraftInput,
  uploadSymbolDocumentInputSchema,
  type UploadSymbolDocumentInput,
  type ValidationIssue
} from "./schema";
import { createSymbolPackage } from "../logic/use_cases/export-symbol-package";
import {
  assertSymbolVersionEditable,
  isSymbolVersionEditable
} from "../logic/services/symbol-version-lifecycle";
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

function assertStoredVersionEditable(version: {
  status: string;
  symbol: { status: string };
}) {
  if (version.symbol.status === "archived") {
    throw new Error("Archived symbols are immutable.");
  }

  assertSymbolVersionEditable(symbolStatusSchema.parse(version.status));
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
      status: "needs_review"
    },
    create: {
      symbolKey,
      displayName: metadata.displayName,
      manufacturer: metadata.manufacturer,
      model: metadata.model,
      category: metadata.category,
      categoryId: requestedCategory.id,
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

  const completeValidation = await validateSymbolWithRegisteredComponents(
    symbol.id,
    validation.sanitizedSvg,
    metadata
  );
  await replaceValidationIssues({
    symbolId: symbol.id,
    versionId: version.id,
    issues: completeValidation.issues
  });

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

export async function validateSymbolVersion(versionId: string) {
  const version = await prisma.symbolVersion.findUnique({
    where: { id: versionId },
    include: { symbol: true }
  });

  if (!version) {
    throw new Error("Symbol version was not found.");
  }

  const metadataInput: unknown = JSON.parse(version.metadataJson);
  const validation = await validateSymbolWithRegisteredComponents(
    version.symbolId,
    version.svg,
    metadataInput
  );

  if (
    isSymbolVersionEditable(symbolStatusSchema.parse(version.status)) &&
    validation.metadata
  ) {
    await prisma.symbolVersion.update({
      where: { id: version.id },
      data: {
        svg: validation.sanitizedSvg,
        metadataJson: stringifyMetadata(validation.metadata)
      }
    });
  }

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

  if (version.status === "approved" && version.symbol.status === "approved") {
    await assertTerminalStripDefaultUnique({
      symbolId: version.symbolId,
      metadata: validatedMetadata
    });
  }

  if (version.status === "approved" && validation.blockingIssueCount > 0) {
    throw new Error(
      validation.issues.find((issue) => issue.severity === "blocking")
        ?.message ??
        "Approved symbol metadata cannot be saved with blocking validation issues."
    );
  }

  const nextStatus =
    version.status === "approved" && version.symbol.status === "approved"
      ? "approved"
      : "needs_review";
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
    await transaction.symbolValidationIssue.deleteMany({
      where: {
        symbolId: version.symbolId,
        versionId: version.id
      }
    });
    if (validation.issues.length > 0) {
      await transaction.symbolValidationIssue.createMany({
        data: validation.issues.map((issue) => ({
          symbolId: version.symbolId,
          versionId: version.id,
          severity: issue.severity,
          code: issue.code,
          message: issue.message,
          path: issue.path
        }))
      });
    }
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
    where: { id: versionId },
    include: { symbol: true }
  });

  if (!version) {
    throw new Error("Symbol version was not found.");
  }

  assertStoredVersionEditable(version);

  const metadataInput: unknown = JSON.parse(version.metadataJson);
  const validation = await validateSymbolWithRegisteredComponents(
    version.symbolId,
    version.svg,
    metadataInput
  );

  await replaceValidationIssues({
    symbolId: version.symbolId,
    versionId: version.id,
    issues: validation.issues
  });

  if (validation.blockingIssueCount > 0 || !validation.metadata) {
    throw new Error("Blocking validation issues must be resolved before approval.");
  }

  await assertTerminalStripDefaultUnique({
    symbolId: version.symbolId,
    metadata: validation.metadata
  });

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
        metadataJson: stringifyMetadata(validation.metadata)
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
      `Cannot delete "${symbol.displayName}" because it is an approved component alternative for ${referencedByParents.length} parent symbol${referencedByParents.length === 1 ? "" : "s"}: ${formatDrawingReferences(referencedByParents)}. Remove those component assignments first or archive this symbol instead.`
    );
  }

  await prisma.symbol.delete({
    where: { id: symbolId }
  });
}

export async function exportSymbolPackage(symbolId: string) {
  const exportable = await getSymbolVersionForExport(symbolId);

  if (!exportable) {
    throw new Error("No approved symbol version is available to export.");
  }

  return createSymbolPackage(exportable);
}
