import type { SymbolMetadata, ValidationIssue } from "@/features/symbol_registry/api/public";
import { SYMBOL_COMPONENT_MAX_DEPTH } from "../../data/schema";

export type ComponentAlternativeCandidate = {
  symbolId: string;
  displayName: string;
  versionId: string;
  versionNumber: number;
  metadata: SymbolMetadata;
};

function referencedSymbolIds(metadata: SymbolMetadata): string[] {
  return [
    ...new Set(
      (metadata.componentPositions ?? []).flatMap((position) =>
        position.components.flatMap((component) => component.allowedSymbolIds)
      )
    )
  ];
}

export function validateComponentDefinitionsBasic(
  metadata: SymbolMetadata
): ValidationIssue[] {
  return (metadata.componentPositions ?? []).flatMap((position, positionIndex) =>
    position.components.flatMap((component, componentIndex) =>
      component.allowedSymbolIds.length > 0
        ? []
        : [
            {
              severity: "blocking" as const,
              code: "COMPONENT_ALTERNATIVE_REQUIRED",
              message: `Component "${component.label}" in "${position.label}" requires at least one approved alternative.`,
              path: `metadata.componentPositions.${positionIndex}.components.${componentIndex}.allowedSymbolIds`
            }
          ]
    )
  );
}

export function validateSymbolComponentDefinitions(params: {
  parentSymbolId: string;
  metadata: SymbolMetadata;
  candidates: ComponentAlternativeCandidate[];
}): ValidationIssue[] {
  const issues = validateComponentDefinitionsBasic(params.metadata);
  const candidateById = new Map(
    params.candidates.map((candidate) => [candidate.symbolId, candidate])
  );
  const reportedUnavailable = new Set<string>();
  const reportedCycles = new Set<string>();
  let depthReported = false;

  for (const [positionIndex, position] of (
    params.metadata.componentPositions ?? []
  ).entries()) {
    for (const [componentIndex, component] of position.components.entries()) {
      for (const symbolId of component.allowedSymbolIds) {
        if (candidateById.has(symbolId)) {
          continue;
        }

        if (!reportedUnavailable.has(symbolId)) {
          reportedUnavailable.add(symbolId);
          issues.push({
            severity: "blocking",
            code: "COMPONENT_ALTERNATIVE_UNAVAILABLE",
            message: `Component alternative "${symbolId}" is unavailable. Alternatives require a current approved panel-layout version with positive physical dimensions.`,
            path: `metadata.componentPositions.${positionIndex}.components.${componentIndex}.allowedSymbolIds`
          });
        }
      }
    }
  }

  const childrenFor = (symbolId: string): string[] => {
    if (symbolId === params.parentSymbolId) {
      return referencedSymbolIds(params.metadata);
    }

    const candidate = candidateById.get(symbolId);
    return candidate ? referencedSymbolIds(candidate.metadata) : [];
  };

  const visit = (symbolId: string, path: string[], depth: number) => {
    if (depth > SYMBOL_COMPONENT_MAX_DEPTH) {
      if (!depthReported) {
        depthReported = true;
        issues.push({
          severity: "blocking",
          code: "COMPONENT_DEPTH_EXCEEDED",
          message: `Component nesting exceeds the defensive maximum depth of ${SYMBOL_COMPONENT_MAX_DEPTH}.`,
          path: "metadata.componentPositions"
        });
      }
      return;
    }

    for (const childId of childrenFor(symbolId)) {
      const cycleIndex = path.indexOf(childId);
      if (cycleIndex >= 0) {
        const cycle = [...path.slice(cycleIndex), childId].join(" → ");
        if (!reportedCycles.has(cycle)) {
          reportedCycles.add(cycle);
          issues.push({
            severity: "blocking",
            code: "COMPONENT_CYCLE",
            message: `Component alternatives create a cycle: ${cycle}.`,
            path: "metadata.componentPositions"
          });
        }
        continue;
      }

      if (candidateById.has(childId)) {
        visit(childId, [...path, childId], depth + 1);
      }
    }
  };

  visit(params.parentSymbolId, [params.parentSymbolId], 0);
  return issues;
}
