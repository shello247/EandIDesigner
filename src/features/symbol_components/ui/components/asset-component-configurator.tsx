"use client";

import { Boxes } from "lucide-react";
import type {
  ComponentSelectableSymbol,
  DrawingComponentSelection
} from "../../api/public";
import { resolveAutomaticComponentSelections } from "../../api/public";

function optionValue(componentKey: string, symbolId: string) {
  return `${componentKey}::${symbolId}`;
}

export function AssetComponentConfigurator({
  parent,
  symbols,
  value,
  onChange,
  depth = 0
}: {
  parent: ComponentSelectableSymbol;
  symbols: ComponentSelectableSymbol[];
  value: DrawingComponentSelection[];
  onChange: (value: DrawingComponentSelection[]) => void;
  depth?: number;
}) {
  const positions = parent.metadata.componentPositions ?? [];
  const latestById = new Map<string, ComponentSelectableSymbol>();
  for (const symbol of symbols) {
    if (!latestById.has(symbol.symbolId)) {
      latestById.set(symbol.symbolId, symbol);
    }
  }

  if (positions.length === 0) {
    return depth === 0 ? (
      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        No component positions defined.
      </div>
    ) : null;
  }

  return (
    <div
      className={[
        "space-y-3",
        depth > 0
          ? "ml-3 border-l-2 border-violet-200 pl-3"
          : "rounded-lg border border-violet-200 bg-violet-50/30 p-3"
      ].join(" ")}
    >
      {depth === 0 ? (
        <div className="flex items-center gap-2 text-xs font-bold text-violet-950">
          <Boxes aria-hidden="true" size={15} />
          Installed components
        </div>
      ) : null}

      {positions.map((position) => {
        const selected = value.find(
          (selection) => selection.positionKey === position.key
        );
        const selectedSymbol = selected
          ? symbols.find(
              (symbol) =>
                symbol.symbolId === selected.symbolId &&
                symbol.versionId === selected.versionId
            ) ?? latestById.get(selected.symbolId)
          : undefined;
        const choices = position.components.flatMap((component) =>
          component.allowedSymbolIds.flatMap((symbolId) => {
            const symbol = latestById.get(symbolId);
            return symbol ? [{ component, symbol }] : [];
          })
        );

        return (
          <div key={position.key} className="space-y-2">
            <label
              className="field-label"
              htmlFor={`component-position-${depth}-${position.key}`}
            >
              {position.label}
              {position.required ? " *" : " (optional)"}
            </label>
            <select
              id={`component-position-${depth}-${position.key}`}
              className="field-input"
              value={
                selected
                  ? optionValue(selected.componentKey, selected.symbolId)
                  : ""
              }
              onChange={(event) => {
                const nextValue = event.currentTarget.value;
                const remaining = value.filter(
                  (selection) => selection.positionKey !== position.key
                );

                if (!nextValue) {
                  onChange(remaining);
                  return;
                }

                const choice = choices.find(
                  ({ component, symbol }) =>
                    optionValue(component.key, symbol.symbolId) === nextValue
                );
                if (!choice) {
                  return;
                }

                const automatic = resolveAutomaticComponentSelections({
                  parent: choice.symbol,
                  symbols
                });
                onChange([
                  ...remaining,
                  {
                    positionKey: position.key,
                    componentKey: choice.component.key,
                    symbolId: choice.symbol.symbolId,
                    versionId: choice.symbol.versionId,
                    children: automatic.selections
                  }
                ]);
              }}
            >
              <option value="">
                {position.required ? "Select required component" : "None"}
              </option>
              {choices.map(({ component, symbol }) => (
                <option
                  key={optionValue(component.key, symbol.symbolId)}
                  value={optionValue(component.key, symbol.symbolId)}
                >
                  {component.label}: {symbol.displayName}
                </option>
              ))}
            </select>

            {selected && selectedSymbol ? (
              <AssetComponentConfigurator
                parent={selectedSymbol}
                symbols={symbols}
                value={selected.children ?? []}
                depth={depth + 1}
                onChange={(children) =>
                  onChange(
                    value.map((selection) =>
                      selection.positionKey === position.key
                        ? { ...selection, children }
                        : selection
                    )
                  )
                }
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
