"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Link2,
  Minus,
  PackagePlus,
  Plus,
  X
} from "lucide-react";
import type {
  ApprovedDrawingSymbol,
  DrawingModel
} from "@/features/drawing_canvas/api/template-contracts";
import { stepEngineeringTag } from "@/features/drawing_canvas/api/template-contracts";
import {
  buildTemplateImportPlan,
  type TemplateAssetResolutionChoice
} from "../../logic/use_cases/drawing-sheet-template-use-cases";
import type {
  DrawingSheetTemplateDetail,
  DrawingSheetTemplateListItem
} from "../../types";

function sheetReferenceSummary(
  asset: ReturnType<typeof buildTemplateImportPlan>["assets"][number]["compatibleAssets"][number]
): string {
  return [
    ...new Set(
      asset.placementRefs.map(
        (reference) => `Sheet ${reference.sheetNumber}: ${reference.sheetName}`
      )
    )
  ].join(", ");
}

function choiceFor(
  choices: TemplateAssetResolutionChoice[],
  templateAssetId: string
): TemplateAssetResolutionChoice | undefined {
  return choices.find((choice) => choice.templateAssetId === templateAssetId);
}

export function AddSheetTemplateDialog({
  templates,
  selectedTemplate,
  model,
  symbols,
  isPending,
  error,
  onCancel,
  onSelectTemplate,
  onBackToList,
  onImport
}: {
  templates: DrawingSheetTemplateListItem[];
  selectedTemplate: DrawingSheetTemplateDetail | null;
  model: DrawingModel;
  symbols: ApprovedDrawingSymbol[];
  isPending: boolean;
  error?: string | null;
  onCancel: () => void;
  onSelectTemplate: (templateId: string) => void;
  onBackToList: () => void;
  onImport: (
    template: DrawingSheetTemplateDetail,
    choices: TemplateAssetResolutionChoice[]
  ) => void;
}) {
  const titleId = "add-sheet-template-dialog-title";
  const plan = useMemo(
    () =>
      selectedTemplate
        ? buildTemplateImportPlan({
            model,
            template: selectedTemplate.model,
            symbols
          })
        : null,
    [model, selectedTemplate, symbols]
  );
  const initialChoices = useMemo(
    () =>
      plan?.assets.map((asset) => ({
        templateAssetId: asset.templateAsset.templateAssetId,
        mode: asset.defaultMode,
        tag: asset.suggestedTag,
        targetAssetId: asset.targetAssetId
      })) ?? [],
    [plan]
  );
  const activeChoiceKey = selectedTemplate?.id ?? "";
  const [choiceState, setChoiceState] = useState<{
    choices: TemplateAssetResolutionChoice[];
    key: string;
  }>({ choices: [], key: "" });
  const choices =
    choiceState.key === activeChoiceKey ? choiceState.choices : initialChoices;

  const updateChoice = (
    templateAssetId: string,
    updates: Partial<TemplateAssetResolutionChoice>
  ) => {
    setChoiceState({
      key: activeChoiceKey,
      choices: choices.map((choice) =>
        choice.templateAssetId === templateAssetId
          ? { ...choice, ...updates }
          : choice
      )
    });
  };
  const choicesAreComplete =
    plan?.assets.every((asset) => {
      const choice = choiceFor(choices, asset.templateAsset.templateAssetId);

      if (!choice) {
        return false;
      }

      return choice.mode === "reference"
        ? Boolean(choice.targetAssetId)
        : Boolean(choice.tag?.trim());
    }) ?? false;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/20 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onCancel();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-700">
            <BookOpen aria-hidden="true" size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-sm font-semibold text-slate-950">
              Add Sheet from Template
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              {selectedTemplate
                ? "Resolve template assets before adding the sheet."
                : "Choose a reusable drawing sheet template."}
            </p>
          </div>
          <button
            type="button"
            className="icon-button h-8 w-8 p-0"
            onClick={onCancel}
            aria-label="Close add template dialog"
          >
            <X aria-hidden="true" size={14} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
          {error ? (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {error}
            </div>
          ) : null}

          {!selectedTemplate ? (
            <div className="space-y-3">
              {templates.length === 0 ? (
                <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
                  No sheet templates have been saved yet.
                </div>
              ) : (
                templates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    className="w-full rounded-md border border-slate-200 bg-white px-4 py-3 text-left text-sm transition hover:border-sky-200 hover:bg-sky-50"
                    onClick={() => onSelectTemplate(template.id)}
                    disabled={isPending}
                    aria-label={`Use template ${template.name}`}
                  >
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-slate-950">
                        {template.name}
                      </span>
                      <span className="text-xs font-medium text-slate-500">
                        {template.assetCount} assets
                      </span>
                    </span>
                    {template.description ? (
                      <span className="mt-1 block text-xs text-slate-600">
                        {template.description}
                      </span>
                    ) : null}
                    {template.keywords.length > 0 ? (
                      <span className="mt-2 flex flex-wrap gap-1">
                        {template.keywords.map((keyword) => (
                          <span
                            key={keyword}
                            className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
                          >
                            {keyword}
                          </span>
                        ))}
                      </span>
                    ) : null}
                  </button>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <button
                type="button"
                className="icon-button"
                onClick={onBackToList}
                disabled={isPending}
              >
                <ArrowLeft aria-hidden="true" size={14} />
                Templates
              </button>

              <div>
                <h3 className="text-sm font-semibold text-slate-950">
                  {selectedTemplate.name}
                </h3>
                {selectedTemplate.description ? (
                  <p className="mt-1 text-xs text-slate-600">
                    {selectedTemplate.description}
                  </p>
                ) : null}
              </div>

              {plan?.warnings.length ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                  {plan.warnings.map((warning) => warning.message).join(" ")}
                </div>
              ) : null}

              <div className="overflow-hidden rounded-md border border-slate-200">
                <div className="grid grid-cols-[1.2fr_1fr_1.4fr] gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                  <span>Template asset</span>
                  <span>Action</span>
                  <span>Tag / reference</span>
                </div>
                <div className="divide-y divide-slate-200">
                  {plan?.assets.map((asset) => {
                    const choice = choiceFor(
                      choices,
                      asset.templateAsset.templateAssetId
                    );
                    const tag = choice?.tag ?? asset.suggestedTag;
                    const decrementedTag = stepEngineeringTag(tag, -1);
                    const incrementedTag = stepEngineeringTag(tag, 1);

                    return (
                      <div
                        key={asset.templateAsset.templateAssetId}
                        className="grid grid-cols-[1.2fr_1fr_1.4fr] gap-3 px-3 py-3 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-950">
                            {asset.templateAsset.originalTag}
                          </div>
                          <div className="mt-0.5 truncate text-slate-500">
                            {asset.templateAsset.symbolName ??
                              asset.templateAsset.symbolKey ??
                              asset.templateAsset.role}
                          </div>
                        </div>
                        <select
                          className="field-input h-9 text-xs"
                          value={choice?.mode ?? asset.defaultMode}
                          disabled={!asset.canReference || isPending}
                          onChange={(event) =>
                            updateChoice(asset.templateAsset.templateAssetId, {
                              mode: event.currentTarget
                                .value as TemplateAssetResolutionChoice["mode"],
                              targetAssetId:
                                event.currentTarget.value === "reference"
                                  ? asset.compatibleAssets[0]?.assetId
                                  : undefined
                            })
                          }
                          aria-label={`Resolution for ${asset.templateAsset.originalTag}`}
                        >
                          <option value="create">Create new asset</option>
                          <option value="reference">Reference existing asset</option>
                        </select>
                        {choice?.mode === "reference" ? (
                          <select
                            className="field-input h-9 text-xs"
                            value={choice.targetAssetId ?? ""}
                            disabled={isPending}
                            onChange={(event) =>
                              updateChoice(asset.templateAsset.templateAssetId, {
                                targetAssetId: event.currentTarget.value
                              })
                            }
                            aria-label={`Existing asset for ${asset.templateAsset.originalTag}`}
                          >
                            {asset.compatibleAssets.map((existingAsset) => (
                              <option
                                key={existingAsset.assetId}
                                value={existingAsset.assetId}
                              >
                                {existingAsset.tag} -{" "}
                                {sheetReferenceSummary(existingAsset)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="flex gap-2">
                            <input
                              className="field-input h-9 text-xs"
                              value={tag}
                              disabled={isPending}
                              onChange={(event) =>
                                updateChoice(asset.templateAsset.templateAssetId, {
                                  tag: event.currentTarget.value
                                })
                              }
                              aria-label={`New tag for ${asset.templateAsset.originalTag}`}
                            />
                            <button
                              type="button"
                              className="icon-button h-9 w-9 p-0"
                              disabled={!decrementedTag || isPending}
                              onClick={() =>
                                decrementedTag &&
                                updateChoice(asset.templateAsset.templateAssetId, {
                                  tag: decrementedTag
                                })
                              }
                              aria-label={`Decrement tag for ${asset.templateAsset.originalTag}`}
                            >
                              <Minus aria-hidden="true" size={14} />
                            </button>
                            <button
                              type="button"
                              className="icon-button h-9 w-9 p-0"
                              disabled={!incrementedTag || isPending}
                              onClick={() =>
                                incrementedTag &&
                                updateChoice(asset.templateAsset.templateAssetId, {
                                  tag: incrementedTag
                                })
                              }
                              aria-label={`Increment tag for ${asset.templateAsset.originalTag}`}
                            >
                              <Plus aria-hidden="true" size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {!plan?.canImport ? (
                <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  <AlertTriangle aria-hidden="true" size={14} />
                  This template needs symbols that are not available.
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button type="button" className="icon-button" onClick={onCancel}>
            Cancel
          </button>
          {selectedTemplate ? (
            <button
              type="button"
              className="icon-button icon-button-primary"
              disabled={isPending || !plan?.canImport || !choicesAreComplete}
              onClick={() => onImport(selectedTemplate, choices)}
            >
              {choices.some((choice) => choice.mode === "reference") ? (
                <Link2 aria-hidden="true" size={14} />
              ) : (
                <PackagePlus aria-hidden="true" size={14} />
              )}
              Import template
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
