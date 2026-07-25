import type {
  SymbolMetadata,
  ValidationIssue
} from "@/features/symbol_registry/api/public";
import {
  SYMBOL_COMPONENT_MAX_DEPTH,
  type DrawingComponentSelection,
  type SymbolComponentDefinition
} from "../../data/schema";

export type ComponentSelectableSymbol = {
  symbolId: string;
  versionId: string;
  displayName: string;
  svg: string;
  metadata: SymbolMetadata;
  selectable?: boolean;
};

export type ComponentSelectionResolution = {
  selections: DrawingComponentSelection[];
  issues: ValidationIssue[];
};

function latestSymbolsById(symbols: ComponentSelectableSymbol[]) {
  const map = new Map<string, ComponentSelectableSymbol>();
  for (const symbol of symbols) {
    if (symbol.selectable !== false && !map.has(symbol.symbolId)) {
      map.set(symbol.symbolId, symbol);
    }
  }
  return map;
}

function availableChoices(
  components: SymbolComponentDefinition[],
  latestById: Map<string, ComponentSelectableSymbol>
) {
  return components.flatMap((component) =>
    component.allowedSymbolIds.flatMap((symbolId) => {
      const symbol = latestById.get(symbolId);
      return symbol ? [{ component, symbol }] : [];
    })
  );
}

export function resolveAutomaticComponentSelections(params: {
  parent: ComponentSelectableSymbol;
  symbols: ComponentSelectableSymbol[];
}): ComponentSelectionResolution {
  const latestById = latestSymbolsById(params.symbols);
  const issues: ValidationIssue[] = [];

  const resolve = (
    parent: ComponentSelectableSymbol,
    path: string[],
    depth: number
  ): DrawingComponentSelection[] => {
    if (depth > SYMBOL_COMPONENT_MAX_DEPTH) {
      issues.push({
        severity: "blocking",
        code: "COMPONENT_SELECTION_DEPTH_EXCEEDED",
        message: `Component selection nesting exceeds ${SYMBOL_COMPONENT_MAX_DEPTH} levels.`,
        path: "componentSelections"
      });
      return [];
    }

    return (parent.metadata.componentPositions ?? []).flatMap((position) => {
      if (!position.required) {
        return [];
      }

      const choices = availableChoices(position.components, latestById);
      if (choices.length !== 1) {
        issues.push({
          severity: "blocking",
          code: "COMPONENT_SELECTION_REQUIRED",
          message:
            choices.length === 0
              ? `Required component position "${position.label}" has no available alternative.`
              : `Required component position "${position.label}" needs an explicit selection.`,
          path: `componentSelections.${position.key}`
        });
        return [];
      }

      const { component, symbol } = choices[0];
      if (path.includes(symbol.symbolId)) {
        issues.push({
          severity: "blocking",
          code: "COMPONENT_SELECTION_CYCLE",
          message: `Component selection creates a cycle through "${symbol.displayName}".`,
          path: `componentSelections.${position.key}`
        });
        return [];
      }

      return [
        {
          positionKey: position.key,
          componentKey: component.key,
          symbolId: symbol.symbolId,
          versionId: symbol.versionId,
          children: resolve(
            symbol,
            [...path, symbol.symbolId],
            depth + 1
          )
        }
      ];
    });
  };

  return {
    selections: resolve(params.parent, [params.parent.symbolId], 0),
    issues
  };
}

export function validateDrawingComponentSelections(params: {
  parent: ComponentSelectableSymbol;
  selections: DrawingComponentSelection[];
  symbols: ComponentSelectableSymbol[];
}): ValidationIssue[] {
  const exactVersions = new Map(
    params.symbols.map((symbol) => [
      `${symbol.symbolId}:${symbol.versionId}`,
      symbol
    ])
  );
  const issues: ValidationIssue[] = [];

  const validate = (
    parent: ComponentSelectableSymbol,
    selections: DrawingComponentSelection[],
    ancestry: string[],
    depth: number,
    path: string
  ) => {
    if (depth > SYMBOL_COMPONENT_MAX_DEPTH) {
      issues.push({
        severity: "blocking",
        code: "COMPONENT_SELECTION_DEPTH_EXCEEDED",
        message: `Component selection nesting exceeds ${SYMBOL_COMPONENT_MAX_DEPTH} levels.`,
        path
      });
      return;
    }

    const positions = parent.metadata.componentPositions ?? [];
    const positionByKey = new Map(
      positions.map((position) => [position.key, position])
    );
    const seenPositions = new Set<string>();

    for (const [index, selection] of selections.entries()) {
      const selectionPath = `${path}.${index}`;
      const position = positionByKey.get(selection.positionKey);

      if (!position) {
        issues.push({
          severity: "blocking",
          code: "COMPONENT_SELECTION_POSITION_UNKNOWN",
          message: `Component position "${selection.positionKey}" is not defined by "${parent.displayName}".`,
          path: selectionPath
        });
        continue;
      }

      if (seenPositions.has(selection.positionKey)) {
        issues.push({
          severity: "blocking",
          code: "COMPONENT_SELECTION_DUPLICATE",
          message: `Component position "${position.label}" has more than one selection.`,
          path: selectionPath
        });
        continue;
      }
      seenPositions.add(selection.positionKey);

      const component = position.components.find(
        (candidate) => candidate.key === selection.componentKey
      );
      if (!component || !component.allowedSymbolIds.includes(selection.symbolId)) {
        issues.push({
          severity: "blocking",
          code: "COMPONENT_SELECTION_NOT_ALLOWED",
          message: `Selected component is not allowed in "${position.label}".`,
          path: selectionPath
        });
        continue;
      }

      const child = exactVersions.get(
        `${selection.symbolId}:${selection.versionId}`
      );
      if (!child) {
        issues.push({
          severity: "blocking",
          code: "COMPONENT_SELECTION_VERSION_MISSING",
          message: `Pinned component version "${selection.versionId}" is unavailable.`,
          path: selectionPath
        });
        continue;
      }

      if (ancestry.includes(child.symbolId)) {
        issues.push({
          severity: "blocking",
          code: "COMPONENT_SELECTION_CYCLE",
          message: `Component selection creates a cycle through "${child.displayName}".`,
          path: selectionPath
        });
        continue;
      }

      validate(
        child,
        selection.children ?? [],
        [...ancestry, child.symbolId],
        depth + 1,
        `${selectionPath}.children`
      );
    }

    for (const position of positions) {
      if (position.required && !seenPositions.has(position.key)) {
        issues.push({
          severity: "blocking",
          code: "COMPONENT_SELECTION_REQUIRED",
          message: `Required component position "${position.label}" must be populated.`,
          path
        });
      }
    }
  };

  validate(
    params.parent,
    params.selections,
    [params.parent.symbolId],
    0,
    "componentSelections"
  );
  return issues;
}

export function collectComponentSelectionVersionIds(
  selections: DrawingComponentSelection[] | undefined
): string[] {
  const ids = new Set<string>();

  const visit = (items: DrawingComponentSelection[] | undefined) => {
    for (const selection of items ?? []) {
      ids.add(selection.versionId);
      visit(selection.children);
    }
  };

  visit(selections);
  return [...ids];
}
