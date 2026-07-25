"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Boxes, Save } from "lucide-react";
import type {
  ComponentAlternativeCandidate,
  SymbolComponentPosition
} from "../../api/public";
import { updateSymbolComponentsAction } from "../../api/actions";

function formatNumber(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(2);
}

export function SymbolComponentsPanel({
  versionId,
  positions,
  alternatives,
  readOnly
}: {
  versionId: string;
  positions: SymbolComponentPosition[];
  alternatives: ComponentAlternativeCandidate[];
  readOnly: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(positions);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (positions.length === 0) {
    return (
      <section className="tool-panel p-5">
        <div className="flex items-center gap-2">
          <Boxes aria-hidden="true" className="text-violet-700" size={17} />
          <h2 className="text-sm font-bold">Components</h2>
        </div>
        <p className="mt-3 text-sm text-slate-600">
          No component positions defined.
        </p>
      </section>
    );
  }

  const toggleAlternative = (
    positionKey: string,
    componentKey: string,
    symbolId: string
  ) => {
    setDraft((current) =>
      current.map((position) =>
        position.key !== positionKey
          ? position
          : {
              ...position,
              components: position.components.map((component) =>
                component.key !== componentKey
                  ? component
                  : {
                      ...component,
                      allowedSymbolIds: component.allowedSymbolIds.includes(
                        symbolId
                      )
                        ? component.allowedSymbolIds.filter(
                            (id) => id !== symbolId
                          )
                        : [...component.allowedSymbolIds, symbolId]
                    }
              )
            }
      )
    );
  };

  const save = () => {
    startTransition(async () => {
      setMessage(null);
      const result = await updateSymbolComponentsAction({
        versionId,
        componentPositions: draft
      });

      if (!result.ok) {
        setMessage(result.error);
        return;
      }

      setMessage("Component configuration saved.");
      router.refresh();
    });
  };

  return (
    <section className="tool-panel overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <Boxes aria-hidden="true" className="text-violet-700" size={17} />
          <div>
            <h2 className="text-sm font-bold">Components</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Figma geometry is read-only. Assign one or more approved
              alternatives to each component group.
            </p>
          </div>
        </div>
        {!readOnly ? (
          <button
            type="button"
            className="tool-button"
            disabled={isPending}
            onClick={save}
          >
            <Save aria-hidden="true" size={14} />
            {isPending ? "Saving…" : "Save"}
          </button>
        ) : null}
      </div>

      <div className="divide-y divide-slate-200">
        {draft.map((position) => (
          <div key={position.key} className="space-y-4 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-950">
                  {position.label}
                </h3>
                <p className="text-xs text-slate-500">
                  Position key: {position.key}
                </p>
              </div>
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={position.required}
                  disabled={readOnly || isPending}
                  onChange={(event) =>
                    setDraft((current) =>
                      current.map((item) =>
                        item.key === position.key
                          ? { ...item, required: event.target.checked }
                          : item
                      )
                    )
                  }
                />
                Required
              </label>
            </div>

            {position.components.map((component) => (
              <div
                key={component.key}
                className="rounded-lg border border-violet-200 bg-violet-50/40 p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-bold text-violet-950">
                      {component.label}
                    </h4>
                    <p className="mt-1 text-[11px] text-violet-800">
                      Centre {formatNumber(component.box.centerX)},{" "}
                      {formatNumber(component.box.centerY)} · Box{" "}
                      {formatNumber(component.box.width)} ×{" "}
                      {formatNumber(component.box.height)} · Rotation{" "}
                      {formatNumber(component.box.rotationDeg)}°
                    </p>
                  </div>
                  <span
                    className={[
                      "rounded-full px-2 py-1 text-[10px] font-bold",
                      component.allowedSymbolIds.length > 0
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-900"
                    ].join(" ")}
                  >
                    {component.allowedSymbolIds.length > 0
                      ? `${component.allowedSymbolIds.length} assigned`
                      : "Assignment required for approval"}
                  </span>
                </div>

                <fieldset className="mt-3" disabled={readOnly || isPending}>
                  <legend className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Approved alternatives
                  </legend>
                  {alternatives.length === 0 ? (
                    <p className="mt-2 text-xs text-slate-600">
                      No eligible panel-layout symbols are currently approved.
                    </p>
                  ) : (
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {alternatives.map((alternative) => (
                        <label
                          key={alternative.symbolId}
                          className="flex items-start gap-2 rounded-md border border-slate-200 bg-white p-2 text-xs"
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={component.allowedSymbolIds.includes(
                              alternative.symbolId
                            )}
                            onChange={() =>
                              toggleAlternative(
                                position.key,
                                component.key,
                                alternative.symbolId
                              )
                            }
                          />
                          <span>
                            <span className="block font-semibold text-slate-900">
                              {alternative.displayName}
                            </span>
                            <span className="text-slate-500">
                              V{alternative.versionNumber} ·{" "}
                              {alternative.metadata.physicalWidthMm} ×{" "}
                              {alternative.metadata.physicalHeightMm} mm
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </fieldset>
              </div>
            ))}
          </div>
        ))}
      </div>

      {message ? (
        <div className="border-t border-slate-200 px-4 py-3 text-xs text-slate-700">
          {message}
        </div>
      ) : null}
    </section>
  );
}
