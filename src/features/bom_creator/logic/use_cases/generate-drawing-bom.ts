import type {
  ApprovedDrawingSymbol,
  DrawingAssetRecord,
  DrawingConnection,
  DrawingModel,
  DrawingPlacement
} from "@/features/drawing_canvas/api/asset-contracts";
import { placementAssetId } from "@/features/drawing_canvas/api/asset-contracts";
import {
  type ConsolidatedBomLine,
  type GeneratedBomAssembly,
  type GeneratedBomLine,
  type GeneratedBomWarning,
  type GeneratedDrawingBom,
  type SymbolBomTemplateDetail
} from "../../data/schema";
import { calculateBomQuantity } from "../services/bom-quantity-rules";

export type GenerateDrawingBomInput = {
  drawingId: string;
  drawingTitle: string;
  model: DrawingModel;
  symbols: ApprovedDrawingSymbol[];
  templates: SymbolBomTemplateDetail[];
};

type SheetRef = {
  sheetId: string;
  sheetName: string;
  sheetNumber: number;
};

type AssetContext = {
  asset: DrawingAssetRecord;
  placements: DrawingPlacement[];
  rawPlacementCount: number;
  sheetRefs: SheetRef[];
};

function fallbackAssetType(placement: DrawingPlacement): DrawingAssetRecord["type"] {
  if (placement.role === "cable_assembly") {
    return "cable";
  }

  if (placement.role === "terminal_block") {
    return "terminal_block";
  }

  if (placement.role === "enclosure") {
    return placement.enclosure?.kind === "junction_box" ? "junction_box" : "panel";
  }

  return "other";
}

function fallbackAssetFromPlacement(
  placement: DrawingPlacement
): DrawingAssetRecord {
  return {
    id: placementAssetId(placement),
    tag: placement.tag,
    type: fallbackAssetType(placement),
    title:
      placement.title?.trim() ||
      placement.enclosure?.title?.trim() ||
      placement.terminalBlock?.kind?.replace(/_/g, " ") ||
      placement.tag,
    symbolId: placement.symbolId,
    versionId: placement.versionId
  };
}

function warning(input: GeneratedBomWarning): GeneratedBomWarning {
  return input;
}

function warningKey(item: GeneratedBomWarning): string {
  return [item.code, item.assetId ?? "", item.itemId ?? "", item.message].join("|");
}

function uniqueWarnings(warnings: GeneratedBomWarning[]): GeneratedBomWarning[] {
  const seen = new Set<string>();
  const result: GeneratedBomWarning[] = [];

  for (const item of warnings) {
    const key = warningKey(item);

    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }

  return result;
}

function buildAssetContexts(model: DrawingModel): AssetContext[] {
  const assets = new Map<string, DrawingAssetRecord>();
  const placements = new Map<string, DrawingPlacement[]>();
  const rawPlacementCounts = new Map<string, number>();
  const sheetRefs = new Map<string, Map<string, SheetRef>>();

  for (const asset of model.assets ?? []) {
    assets.set(asset.id, asset);
  }

  model.sheets.forEach((sheet, sheetIndex) => {
    for (const placement of sheet.placements) {
      const assetId = placementAssetId(placement);
      rawPlacementCounts.set(assetId, (rawPlacementCounts.get(assetId) ?? 0) + 1);

      if (placement.layoutKind) {
        continue;
      }

      if (!assets.has(assetId)) {
        assets.set(assetId, fallbackAssetFromPlacement(placement));
      }

      placements.set(assetId, [...(placements.get(assetId) ?? []), placement]);

      const refs = sheetRefs.get(assetId) ?? new Map<string, SheetRef>();
      refs.set(sheet.id, {
        sheetId: sheet.id,
        sheetName: sheet.name,
        sheetNumber: sheetIndex + 1
      });
      sheetRefs.set(assetId, refs);
    }
  });

  return [...assets.values()]
    .map((asset) => ({
      asset,
      placements: placements.get(asset.id) ?? [],
      rawPlacementCount: rawPlacementCounts.get(asset.id) ?? 0,
      sheetRefs: [...(sheetRefs.get(asset.id)?.values() ?? [])]
    }))
    .filter(
      (context) =>
        context.placements.length > 0 ||
        context.rawPlacementCount === 0
    )
    .sort((first, second) =>
      first.asset.tag.localeCompare(second.asset.tag, undefined, {
        numeric: true
      })
    );
}

function allDrawingConnections(model: DrawingModel): DrawingConnection[] {
  return model.sheets.flatMap((sheet) => sheet.connections);
}

function isGeneratedSymbol(symbolId: string): boolean {
  return symbolId.startsWith("__");
}

function buildAssemblyLines({
  context,
  template,
  connections
}: {
  context: AssetContext;
  template: SymbolBomTemplateDetail;
  connections: DrawingConnection[];
}): {
  lines: GeneratedBomLine[];
  warnings: GeneratedBomWarning[];
} {
  const warnings: GeneratedBomWarning[] = [];
  const placementIds = context.placements.map((placement) => placement.id);
  const lines = template.lines.map((line) => {
    const quantityResult = calculateBomQuantity(line.quantityRule, line.quantity, {
      assetPlacementIds: placementIds,
      connections
    });

    if (line.quantityRule === "manual") {
      warnings.push(
        warning({
          code: "manual_quantity_required",
          assetId: context.asset.id,
          itemId: line.itemId,
          message: `${context.asset.tag} requires a manual quantity for ${line.item.displayName}.`
        })
      );
    }

    if (line.item.status === "archived") {
      warnings.push(
        warning({
          code: "archived_item",
          assetId: context.asset.id,
          itemId: line.itemId,
          message: `${line.item.displayName} is archived but still linked to ${context.asset.tag}.`
        })
      );
    }

    return {
      id: `${context.asset.id}-${line.id}`,
      itemId: line.itemId,
      itemKey: line.item.itemKey,
      displayName: line.item.displayName,
      category: line.item.category,
      unit: line.item.unit,
      manufacturer: line.item.manufacturer,
      partNumber: line.item.partNumber,
      quantity: quantityResult.quantity,
      quantityRule: line.quantityRule,
      quantityStatus: quantityResult.status,
      sourceLineId: line.id,
      sourceAssetId: context.asset.id,
      notes: line.notes
    } satisfies GeneratedBomLine;
  });

  return { lines, warnings };
}

function aggregateLines(assemblies: GeneratedBomAssembly[]): ConsolidatedBomLine[] {
  const groups = new Map<string, ConsolidatedBomLine>();

  for (const assembly of assemblies) {
    for (const line of assembly.lines) {
      const current = groups.get(line.itemId);

      if (!current) {
        groups.set(line.itemId, {
          ...line,
          id: `consolidated-${line.itemId}`,
          sourceAssetId: undefined,
          quantity:
            line.quantityStatus === "calculated" ? line.quantity ?? 0 : undefined,
          quantityStatus: line.quantityStatus,
          sourceAssetTags: [assembly.assetTag]
        });
        continue;
      }

      if (!current.sourceAssetTags.includes(assembly.assetTag)) {
        current.sourceAssetTags.push(assembly.assetTag);
      }

      if (
        current.quantityStatus === "calculated" &&
        line.quantityStatus === "calculated"
      ) {
        current.quantity = (current.quantity ?? 0) + (line.quantity ?? 0);
      } else {
        current.quantity = undefined;
        current.quantityStatus =
          line.quantityStatus === "manual_required"
            ? "manual_required"
            : "unavailable";
      }
    }
  }

  return [...groups.values()].sort((first, second) =>
    first.displayName.localeCompare(second.displayName, undefined, {
      numeric: true
    })
  );
}

export function generateDrawingBom({
  drawingId,
  drawingTitle,
  model,
  symbols,
  templates
}: GenerateDrawingBomInput): GeneratedDrawingBom {
  const templateBySymbolId = new Map(
    templates.map((template) => [template.symbolId, template])
  );
  const symbolById = new Map(symbols.map((symbol) => [symbol.symbolId, symbol]));
  const connections = allDrawingConnections(model);
  const warnings: GeneratedBomWarning[] = [];
  const assemblies: GeneratedBomAssembly[] = [];

  for (const context of buildAssetContexts(model)) {
    const symbolId = context.asset.symbolId?.trim() || undefined;
    const symbol = symbolId ? symbolById.get(symbolId) : undefined;
    const assemblyWarnings: GeneratedBomWarning[] = [];
    let lines: GeneratedBomLine[] = [];

    if (!symbolId) {
      assemblyWarnings.push(
        warning({
          code: "generated_symbol",
          assetId: context.asset.id,
          message: `${context.asset.tag} uses a generated or missing symbol and cannot be expanded.`
        })
      );
    } else if (isGeneratedSymbol(symbolId)) {
      assemblyWarnings.push(
        warning({
          code: "generated_symbol",
          assetId: context.asset.id,
          message: `${context.asset.tag} uses a generated or missing symbol and cannot be expanded.`
        })
      );
    } else {
      const template = templateBySymbolId.get(symbolId);

      if (!symbol) {
        assemblyWarnings.push(
          warning({
            code: "missing_symbol",
            assetId: context.asset.id,
            message: `${context.asset.tag} references a symbol that is not available in the drawing symbol list.`
          })
        );
      }

      if (!template) {
        assemblyWarnings.push(
          warning({
            code: "missing_template",
            assetId: context.asset.id,
            message: `${context.asset.tag} does not have a linked symbol BOM template.`
          })
        );
      } else {
        const built = buildAssemblyLines({
          context,
          template,
          connections
        });
        lines = built.lines;
        assemblyWarnings.push(...built.warnings);
      }
    }

    const assembly = {
      assetId: context.asset.id,
      assetTag: context.asset.tag,
      assetType: context.asset.type,
      title: context.asset.title,
      symbolId,
      symbolName: symbol?.displayName,
      sheetRefs: context.sheetRefs,
      lines,
      warnings: uniqueWarnings(assemblyWarnings)
    } satisfies GeneratedBomAssembly;

    assemblies.push(assembly);
    warnings.push(...assembly.warnings);
  }

  return {
    drawingId,
    drawingTitle,
    assemblies,
    consolidatedLines: aggregateLines(assemblies),
    warnings: uniqueWarnings(warnings)
  };
}
