import {
  symbolComponentPositionsSchema,
  type SymbolComponentPosition
} from "../../data/schema";

export function mergeImportedComponentConfiguration(
  imported: SymbolComponentPosition[] | undefined,
  previous: SymbolComponentPosition[] | undefined
): SymbolComponentPosition[] | undefined {
  if (!imported || imported.length === 0) {
    return undefined;
  }

  const previousPositions = new Map(
    (previous ?? []).map((position) => [position.key, position])
  );
  const merged = imported.map((position) => {
    const previousPosition = previousPositions.get(position.key);
    const previousComponents = new Map(
      (previousPosition?.components ?? []).map((component) => [
        component.key,
        component
      ])
    );

    return {
      ...position,
      required: previousPosition?.required ?? false,
      components: position.components.map((component) => ({
        ...component,
        allowedSymbolIds:
          previousComponents.get(component.key)?.allowedSymbolIds ?? []
      }))
    };
  });

  return symbolComponentPositionsSchema.parse(merged);
}
