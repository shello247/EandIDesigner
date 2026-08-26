"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, ChevronRight, Pencil, Plus, X } from "lucide-react";
import {
  ENGINEERING_ATTRIBUTE_DEFINITION_BY_KEY,
  formatEngineeringAttributeValue,
  listApplicableEngineeringAttributeDefinitions,
  listApplicableEngineeringAttributeDefinitionsForSubject,
  removeEngineeringAttributeValue,
  resolveEngineeringFacts,
  setEngineeringAttributeValue,
  type EngineeringAttributeCategory,
  type EngineeringAttributeContainer,
  type EngineeringAttributeSubject,
  type EngineeringAttributeValue
} from "../../api/public";
import { EngineeringAttributeField } from "./engineering-attribute-field";

const CATEGORY_LABELS: Record<EngineeringAttributeCategory, string> = {
  documentation: "Documentation",
  supply: "Electrical supply",
  load: "Load and consumption",
  protection: "Protection",
  conductor: "Conductor",
  thermal: "Thermal"
};

function unknownValueLabel(value: EngineeringAttributeValue) {
  return value.kind === "quantity"
    ? `${value.value} ${value.unit}`
    : String(value.value);
}

export type EngineeringAttributeChange = {
  definitionKey: string;
  operation: "add" | "update" | "remove";
};

type AttributeEditorState = {
  mode: "add" | "edit";
  definitionKey: string;
};

export function EngineeringAttributesCard({
  assetId,
  assetType,
  subject,
  container,
  onChange,
  sectionNumber,
  title = "Engineering Attributes",
  subtitle,
  defaultExpanded = false,
  editorDescription
}: {
  assetId: string;
  assetType?: string;
  subject?: EngineeringAttributeSubject;
  container?: EngineeringAttributeContainer;
  onChange: (
    container: EngineeringAttributeContainer | undefined,
    change: EngineeringAttributeChange
  ) => void;
  sectionNumber?: number;
  title?: string;
  subtitle?: string;
  defaultExpanded?: boolean;
  editorDescription?: string;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [editor, setEditor] = useState<AttributeEditorState | null>(null);
  const definitions = useMemo(
    () =>
      subject
        ? listApplicableEngineeringAttributeDefinitionsForSubject(subject)
        : listApplicableEngineeringAttributeDefinitions(assetType ?? "other"),
    [assetType, subject]
  );
  const assignedKeys = new Set(
    (container?.values ?? []).map((value) => value.definitionKey)
  );
  const available = definitions.filter(
    (definition) => !assignedKeys.has(definition.key)
  );
  const editorDefinition = editor?.definitionKey
    ? ENGINEERING_ATTRIBUTE_DEFINITION_BY_KEY.get(editor.definitionKey)
    : undefined;
  const editorValue =
    editor?.mode === "edit"
      ? container?.values.find(
          (value) => value.definitionKey === editor.definitionKey
        )
      : undefined;
  const projection = resolveEngineeringFacts({ container, assetType, subject });
  const dialogTitleId = `engineering-attribute-dialog-title-${assetId}`;

  useEffect(() => {
    if (!editor) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setEditor(null);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [editor]);

  const commitValue = (value: EngineeringAttributeValue) => {
    const operation = assignedKeys.has(value.definitionKey) ? "update" : "add";
    const result = setEngineeringAttributeValue({
      container,
      value,
      assetType,
      subject
    });
    if (!result.ok) return result.message;
    onChange(result.container, {
      definitionKey: value.definitionKey,
      operation
    });
    setEditor(null);
    return undefined;
  };

  const removeValue = (definitionKey: string) => {
    const result = removeEngineeringAttributeValue({
      container,
      definitionKey
    });
    if (result.ok) {
      onChange(result.container, { definitionKey, operation: "remove" });
      setEditor(null);
    }
  };

  const editorDialog = editor ? (
    <div
      data-engineering-attribute-editor="true"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/25 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setEditor(null);
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
        className="w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 id={dialogTitleId} className="text-base font-bold text-slate-950">
              {editor.mode === "add"
                ? "Add engineering attribute"
                : `Edit ${editorDefinition?.label ?? "engineering attribute"}`}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {editorDescription ??
                "Record a controlled engineering value for this physical asset."}
            </p>
          </div>
          <button
            type="button"
            className="icon-button h-9 w-9 shrink-0 justify-center p-0"
            aria-label="Close engineering attribute dialog"
            onClick={() => setEditor(null)}
          >
            <X aria-hidden="true" size={16} />
          </button>
        </header>

        <div className="p-5">
          {editor.mode === "add" ? (
            <label className="mb-4 block">
              <span className="field-label">Attribute</span>
              <select
                className="field-input text-sm"
                aria-label="Add engineering attribute"
                value={editor.definitionKey}
                onChange={(event) =>
                  setEditor({
                    mode: "add",
                    definitionKey: event.currentTarget.value
                  })
                }
              >
                <option value="">Choose an engineering attribute</option>
                {Object.entries(CATEGORY_LABELS).map(([category, label]) => {
                  const categoryDefinitions = available.filter(
                    (definition) => definition.category === category
                  );
                  return categoryDefinitions.length > 0 ? (
                    <optgroup key={category} label={label}>
                      {categoryDefinitions.map((definition) => (
                        <option key={definition.key} value={definition.key}>
                          {definition.label}
                        </option>
                      ))}
                    </optgroup>
                  ) : null;
                })}
              </select>
            </label>
          ) : null}

          {editorDefinition?.status === "active" ? (
            <EngineeringAttributeField
              key={`${editor.mode}:${editorDefinition.key}:${JSON.stringify(editorValue)}`}
              definition={editorDefinition}
              value={editorValue}
              pending={editor.mode === "add"}
              onCommit={commitValue}
              onCancel={() => setEditor(null)}
              onRemove={
                editor.mode === "edit"
                  ? () => removeValue(editorDefinition.key)
                  : undefined
              }
            />
          ) : null}
        </div>
      </section>
    </div>
  ) : null;

  return (
    <>
      <section
        className="tool-panel overflow-hidden"
        data-engineering-attributes={assetId}
      >
        <button
          type="button"
          className="group flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
        >
          <span className="min-w-0">
            <span className="flex min-w-0 items-center gap-2.5">
              {sectionNumber !== undefined ? (
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-sky-200 bg-sky-50 text-[10px] font-bold tabular-nums text-sky-700">
                  {sectionNumber}
                </span>
              ) : null}
              <span className="truncate text-sm font-bold text-slate-950">
                {title}
              </span>
            </span>
            <span
              className={`mt-1 block text-xs text-slate-500 ${
                sectionNumber !== undefined ? "pl-[30px]" : ""
              }`}
            >
              {subtitle ?? `${container?.values.length ?? 0} recorded`}
            </span>
          </span>
          <span
            aria-hidden="true"
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors ${
              expanded
                ? "border-sky-200 bg-sky-50 text-sky-700"
                : "border-slate-200 bg-white text-slate-500 group-hover:border-slate-300 group-hover:text-slate-700"
            }`}
          >
            <ChevronRight
              size={17}
              strokeWidth={2.25}
              className={`transition-transform ${expanded ? "rotate-90" : ""}`}
            />
          </span>
        </button>

        {expanded ? (
          <div className="space-y-3 border-t border-slate-200 p-4">
            {(container?.values ?? []).length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-500">
                No engineering attributes recorded.
              </div>
            ) : null}

            <div className="divide-y divide-slate-100 overflow-hidden rounded-md border border-slate-200 bg-white">
              {(container?.values ?? []).map((value) => {
                const definition = ENGINEERING_ATTRIBUTE_DEFINITION_BY_KEY.get(
                  value.definitionKey
                );
                return definition?.status === "active" ? (
                  <button
                    key={value.definitionKey}
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition hover:bg-slate-50"
                    aria-label={`Edit ${definition.label}`}
                    onClick={() =>
                      setEditor({
                        mode: "edit",
                        definitionKey: value.definitionKey
                      })
                    }
                  >
                    <span className="min-w-0">
                      <span className="block text-[11px] font-bold text-slate-700">
                        {definition.label}
                      </span>
                      <span className="mt-0.5 block break-words text-xs leading-4 text-slate-950">
                        {formatEngineeringAttributeValue(value)}
                      </span>
                    </span>
                    <Pencil
                      aria-hidden="true"
                      size={14}
                      className="shrink-0 text-slate-400"
                    />
                  </button>
                ) : (
                  <div
                    key={value.definitionKey}
                    className="px-3 py-2.5 text-xs text-amber-900"
                  >
                    <div className="flex items-center gap-2 font-bold">
                      <AlertTriangle aria-hidden="true" size={13} />
                      {definition ? "Deprecated" : "Unknown"} · {value.definitionKey}
                    </div>
                    <div className="mt-1 text-[11px] text-amber-800">
                      {unknownValueLabel(value)} · excluded from engineering facts
                    </div>
                    <button
                      type="button"
                      className="mt-1 text-[11px] font-semibold text-rose-700 underline"
                      onClick={() => removeValue(value.definitionKey)}
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
            </div>

            {projection.diagnostics
              .filter((diagnostic) => diagnostic.code === "inconsistent_values")
              .map((diagnostic) => (
                <div
                  key={`${diagnostic.definitionKey}:${diagnostic.message}`}
                  className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] leading-4 text-amber-900"
                >
                  <AlertTriangle
                    aria-hidden="true"
                    size={14}
                    className="mt-0.5 shrink-0"
                  />
                  {diagnostic.message}
                </div>
              ))}

            {available.length > 0 ? (
              <button
                type="button"
                className="icon-button w-full justify-center border-teal-200 bg-teal-50 text-teal-800"
                onClick={() => setEditor({ mode: "add", definitionKey: "" })}
              >
                <Plus aria-hidden="true" size={15} />
                Add attribute
              </button>
            ) : null}
          </div>
        ) : null}
      </section>

      {editorDialog && typeof document !== "undefined"
        ? createPortal(editorDialog, document.body)
        : null}
    </>
  );
}
