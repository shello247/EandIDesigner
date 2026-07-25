import type {
  DrawingModel
} from "@/features/drawing_canvas/api/asset-contracts";
import {
  type BomGenerationTemplate,
  type ConsolidatedBomLine,
  type GeneratedBomAssembly,
  type GeneratedBomLine,
  type GeneratedBomWarning,
  type GeneratedDrawingBom
} from "../../data/schema";
import {
  buildBomGenerationContexts,
  type BomGenerationAssetContext
} from "../services/bom-generation-context";
import { calculateBomQuantity } from "../services/bom-quantity-rules";
import {
  SYMBOL_COMPONENT_MAX_DEPTH,
  type DrawingComponentSelection
} from "@/features/symbol_components/api/public";

export type BomGenerationSymbol = {
  symbolId: string;
  displayName: string;
  versionId?: string;
};

export type GenerateDrawingBomInput = {
  drawingId: string;
  drawingTitle: string;
  model: DrawingModel;
  symbols: BomGenerationSymbol[];
  templates: BomGenerationTemplate[];
};

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

function isGeneratedSymbol(symbolId: string): boolean {
  return symbolId.startsWith("__");
}

function buildAssemblyLines({
  context,
  template,
  componentPath
}: {
  context: BomGenerationAssetContext;
  template: BomGenerationTemplate;
  componentPath?: string[];
}): {
  lines: GeneratedBomLine[];
  warnings: GeneratedBomWarning[];
} {
  const warnings: GeneratedBomWarning[] = [];
  const lines = template.lines.map((line) => {
    const quantityResult = calculateBomQuantity(line.quantityRule, line.quantity, {
      connectionCount: context.connectionCount
    });

    if (line.quantityRule === "manual") {
      warnings.push(
        warning({
          code: "manual_quantity_required",
          assetId: context.asset.id,
          itemId: line.itemId,
          componentPath,
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
          componentPath,
          message: `${line.item.displayName} is archived but still linked to ${context.asset.tag}.`
        })
      );
    }

    return {
      id: `${context.asset.id}-${componentPath?.join("-") ?? "parent"}-${line.id}`,
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
      componentPath,
      notes: line.notes
    } satisfies GeneratedBomLine;
  });

  return { lines, warnings };
}

function aggregateLines(assemblies: GeneratedBomAssembly[]): ConsolidatedBomLine[] {
  const groups = new Map<string, ConsolidatedBomLine>();
  const sourceTagsByItemId = new Map<string, Set<string>>();

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
        sourceTagsByItemId.set(line.itemId, new Set([assembly.assetTag]));
        continue;
      }

      const sourceTags = sourceTagsByItemId.get(line.itemId)!;

      if (!sourceTags.has(assembly.assetTag)) {
        sourceTags.add(assembly.assetTag);
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
  const symbolVersionKeys = new Set(
    symbols.flatMap((symbol) =>
      symbol.versionId ? [`${symbol.symbolId}:${symbol.versionId}`] : []
    )
  );
  const versionAware = symbols.some((symbol) => Boolean(symbol.versionId));
  const warnings: GeneratedBomWarning[] = [];
  const assemblies: GeneratedBomAssembly[] = [];

  for (const context of buildBomGenerationContexts(model)) {
    const symbolId = context.asset.symbolId?.trim() || undefined;
    const symbol = symbolId ? symbolById.get(symbolId) : undefined;
    const assemblyWarnings: GeneratedBomWarning[] = [];
    let lines: GeneratedBomLine[] = [];

    const expandComponents = (
      selections: DrawingComponentSelection[] | undefined,
      path: string[],
      ancestry: string[],
      depth: number
    ) => {
      if (depth > SYMBOL_COMPONENT_MAX_DEPTH) {
        assemblyWarnings.push(
          warning({
            code: "component_depth",
            assetId: context.asset.id,
            componentPath: path,
            message: `${context.asset.tag} component expansion exceeds ${SYMBOL_COMPONENT_MAX_DEPTH} levels at ${path.join(" / ")}.`
          })
        );
        return;
      }

      for (const selection of selections ?? []) {
        const childPath = [
          ...path,
          selection.positionKey,
          selection.componentKey
        ];
        if (ancestry.includes(selection.symbolId)) {
          assemblyWarnings.push(
            warning({
              code: "component_cycle",
              assetId: context.asset.id,
              componentPath: childPath,
              message: `${context.asset.tag} component cycle was stopped at ${childPath.join(" / ")}.`
            })
          );
          continue;
        }

        const childSymbol = symbolById.get(selection.symbolId);
        const childTemplate = templateBySymbolId.get(selection.symbolId);
        if (
          versionAware &&
          !symbolVersionKeys.has(
            `${selection.symbolId}:${selection.versionId}`
          )
        ) {
          assemblyWarnings.push(
            warning({
              code: "missing_component_version",
              assetId: context.asset.id,
              componentPath: childPath,
              message: `${context.asset.tag} references missing pinned component version ${selection.versionId} at ${childPath.join(" / ")}.`
            })
          );
        }
        if (!childSymbol) {
          assemblyWarnings.push(
            warning({
              code: "missing_symbol",
              assetId: context.asset.id,
              componentPath: childPath,
              message: `${context.asset.tag} component symbol is unavailable at ${childPath.join(" / ")}.`
            })
          );
        }
        if (!childTemplate) {
          assemblyWarnings.push(
            warning({
              code: "missing_template",
              assetId: context.asset.id,
              componentPath: childPath,
              message: `${context.asset.tag} component does not have a linked BOM template at ${childPath.join(" / ")}.`
            })
          );
        } else {
          const built = buildAssemblyLines({
            context,
            template: childTemplate,
            componentPath: childPath
          });
          lines.push(...built.lines);
          assemblyWarnings.push(...built.warnings);
        }

        expandComponents(
          selection.children,
          childPath,
          [...ancestry, selection.symbolId],
          depth + 1
        );
      }
    };

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
          template
        });
        lines = built.lines;
        assemblyWarnings.push(...built.warnings);
      }
    }
    expandComponents(
      context.asset.componentSelections,
      [],
      symbolId ? [symbolId] : [],
      1
    );

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
