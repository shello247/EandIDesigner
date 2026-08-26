"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import type {
  EngineeringAttributeDefinition,
  EngineeringAttributeValue
} from "../../data/schema";

function initialScalar(value: EngineeringAttributeValue | undefined) {
  return value?.value === undefined ? "" : String(value.value);
}

export function EngineeringAttributeField({
  definition,
  value,
  pending = false,
  onCommit,
  onCancel,
  onRemove
}: {
  definition: EngineeringAttributeDefinition;
  value?: EngineeringAttributeValue;
  pending?: boolean;
  onCommit: (value: EngineeringAttributeValue) => string | undefined;
  onCancel: () => void;
  onRemove?: () => void;
}) {
  const [scalar, setScalar] = useState(initialScalar(value));
  const [unit, setUnit] = useState(
    value?.kind === "quantity"
      ? value.unit
      : definition.canonicalUnit ?? definition.allowedUnits?.[0] ?? ""
  );
  const [error, setError] = useState<string>();

  const buildValue = (): EngineeringAttributeValue | undefined => {
    const base = {
      definitionKey: definition.key,
      definitionVersion: 1 as const,
      source: value?.source ?? { kind: "engineer_entered" as const }
    };
    if (definition.valueKind === "text") {
      return { ...base, kind: "text", value: scalar };
    }
    if (definition.valueKind === "choice") {
      return { ...base, kind: "choice", value: scalar };
    }
    const numericValue = Number(scalar);
    if (!scalar.trim() || !Number.isFinite(numericValue)) return undefined;
    return definition.valueKind === "quantity"
      ? { ...base, kind: "quantity", value: numericValue, unit }
      : { ...base, kind: "number", value: numericValue };
  };

  const commit = () => {
    const next = buildValue();
    if (!next) {
      setError("Enter a valid value.");
      return;
    }
    setError(onCommit(next));
  };

  return (
    <div>
      <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
        <div className="text-sm font-bold text-slate-950">{definition.label}</div>
        <div className="mt-1 text-xs leading-5 text-slate-600">
          {definition.description}
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        {definition.valueKind === "text" ? (
          <textarea
            className="field-input min-h-24 flex-1 resize-y text-sm"
            aria-label={definition.label}
            autoFocus
            value={scalar}
            maxLength={definition.maximumTextLength ?? 400}
            onChange={(event) => setScalar(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") onCancel();
              if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                commit();
              }
            }}
          />
        ) : definition.valueKind === "choice" ? (
          <select
            className="field-input flex-1 text-sm"
            aria-label={definition.label}
            autoFocus
            value={scalar}
            onChange={(event) => setScalar(event.currentTarget.value)}
          >
            <option value="">Choose a value</option>
            {definition.choices?.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="number"
            inputMode="decimal"
            className="field-input min-w-0 flex-1 text-sm"
            aria-label={definition.label}
            autoFocus
            value={scalar}
            onChange={(event) => setScalar(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") commit();
              if (event.key === "Escape") onCancel();
            }}
          />
        )}
        {definition.valueKind === "quantity" ? (
          <select
            className="field-input w-28 shrink-0 text-sm"
            value={unit}
            aria-label={`${definition.label} unit`}
            onChange={(event) => setUnit(event.currentTarget.value)}
          >
            {definition.allowedUnits?.map((candidate) => (
              <option key={candidate} value={candidate}>
                {candidate}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {error ? (
        <div className="mt-2 text-xs font-medium text-rose-700" role="alert">
          {error}
        </div>
      ) : null}

      <div className="mt-5 flex items-center justify-between gap-3">
        <div>
          {onRemove ? (
            <button
              type="button"
              className="icon-button border-rose-200 text-rose-700"
              onClick={onRemove}
            >
              <Trash2 aria-hidden="true" size={15} />
              Remove
            </button>
          ) : null}
        </div>
        <div className="flex gap-2">
          <button type="button" className="icon-button" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="icon-button border-teal-200 bg-teal-50 text-teal-800"
            onClick={commit}
          >
            {pending ? "Add attribute" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
