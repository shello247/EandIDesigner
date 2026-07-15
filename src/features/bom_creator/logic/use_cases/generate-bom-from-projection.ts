import type { ApprovedDrawingSymbol } from "@/features/drawing_canvas/api/asset-contracts";
import {
  type BomAssemblyProjection,
  type ConsolidatedBomLine,
  type GeneratedBomAssembly,
  type GeneratedBomLine,
  type GeneratedBomWarning,
  type GeneratedDrawingBom,
  type SymbolBomTemplateDetail
} from "../../data/schema";
import { calculateProjectedBomQuantity } from "../services/bom-quantity-rules";

export type GenerateBomFromProjectionInput = {
  drawingId: string;
  drawingTitle: string;
  assemblies: BomAssemblyProjection[];
  symbols: ApprovedDrawingSymbol[];
  templates: SymbolBomTemplateDetail[];
};

function uniqueWarnings(warnings: GeneratedBomWarning[]): GeneratedBomWarning[] {
  const unique = new Map<string, GeneratedBomWarning>();
  for (const warning of warnings) {
    const key = [warning.code, warning.assetId ?? "", warning.itemId ?? "", warning.message].join("|");
    unique.set(key, warning);
  }
  return [...unique.values()];
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
          quantity: line.quantityStatus === "calculated" ? line.quantity ?? 0 : undefined,
          sourceAssetTags: [assembly.assetTag]
        });
        continue;
      }
      if (!current.sourceAssetTags.includes(assembly.assetTag)) {
        current.sourceAssetTags.push(assembly.assetTag);
      }
      if (current.quantityStatus === "calculated" && line.quantityStatus === "calculated") {
        current.quantity = (current.quantity ?? 0) + (line.quantity ?? 0);
      } else {
        current.quantity = undefined;
        current.quantityStatus = line.quantityStatus === "manual_required"
          ? "manual_required"
          : "unavailable";
      }
    }
  }
  return [...groups.values()].sort((first, second) =>
    first.displayName.localeCompare(second.displayName, undefined, { numeric: true })
  );
}

export function generateBomFromProjection({
  drawingId,
  drawingTitle,
  assemblies: projections,
  symbols,
  templates
}: GenerateBomFromProjectionInput): GeneratedDrawingBom {
  const templateBySymbolId = new Map(templates.map((template) => [template.symbolId, template]));
  const symbolById = new Map(symbols.map((symbol) => [symbol.symbolId, symbol]));
  const warnings: GeneratedBomWarning[] = [];
  const assemblies = projections.map((projection): GeneratedBomAssembly => {
    const symbolId = projection.symbolId?.trim() || undefined;
    const symbol = symbolId ? symbolById.get(symbolId) : undefined;
    const template = symbolId ? templateBySymbolId.get(symbolId) : undefined;
    const assemblyWarnings: GeneratedBomWarning[] = [];
    const lines: GeneratedBomLine[] = [];

    if (!symbolId || symbolId.startsWith("__")) {
      assemblyWarnings.push({
        code: "generated_symbol",
        assetId: projection.assetId,
        message: `${projection.assetTag} uses a generated or missing symbol and cannot be expanded.`
      });
    } else {
      if (!symbol) {
        assemblyWarnings.push({
          code: "missing_symbol",
          assetId: projection.assetId,
          message: `${projection.assetTag} references a symbol that is not available in the drawing symbol list.`
        });
      }
      if (!template) {
        assemblyWarnings.push({
          code: "missing_template",
          assetId: projection.assetId,
          message: `${projection.assetTag} does not have a linked symbol BOM template.`
        });
      } else {
        for (const templateLine of template.lines) {
          const quantity = calculateProjectedBomQuantity(
            templateLine.quantityRule,
            templateLine.quantity,
            projection.quantityFacts
          );
          if (templateLine.quantityRule === "manual") {
            assemblyWarnings.push({
              code: "manual_quantity_required",
              assetId: projection.assetId,
              itemId: templateLine.itemId,
              message: `${projection.assetTag} requires a manual quantity for ${templateLine.item.displayName}.`
            });
          }
          if (templateLine.item.status === "archived") {
            assemblyWarnings.push({
              code: "archived_item",
              assetId: projection.assetId,
              itemId: templateLine.itemId,
              message: `${templateLine.item.displayName} is archived but still linked to ${projection.assetTag}.`
            });
          }
          lines.push({
            id: `${projection.assetId}-${templateLine.id}`,
            itemId: templateLine.itemId,
            itemKey: templateLine.item.itemKey,
            displayName: templateLine.item.displayName,
            category: templateLine.item.category,
            unit: templateLine.item.unit,
            manufacturer: templateLine.item.manufacturer,
            partNumber: templateLine.item.partNumber,
            quantity: quantity.quantity,
            quantityRule: templateLine.quantityRule,
            quantityStatus: quantity.status,
            sourceLineId: templateLine.id,
            sourceAssetId: projection.assetId,
            notes: templateLine.notes
          });
        }
      }
    }

    const uniqueAssemblyWarnings = uniqueWarnings(assemblyWarnings);
    warnings.push(...uniqueAssemblyWarnings);
    return {
      assetId: projection.assetId,
      assetTag: projection.assetTag,
      assetType: projection.assetType,
      title: projection.title,
      symbolId,
      symbolName: symbol?.displayName,
      sheetRefs: projection.sheetRefs,
      lines,
      warnings: uniqueAssemblyWarnings
    };
  });

  return {
    drawingId,
    drawingTitle,
    assemblies,
    consolidatedLines: aggregateLines(assemblies),
    warnings: uniqueWarnings(warnings)
  };
}
