"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Copy,
  X
} from "lucide-react";
import type { DrawingModel } from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import {
  buildSheetDuplicatePlan,
  suggestDuplicateSheetName,
  suggestSheetDuplicateSourceLabel,
  suggestSheetDuplicateTargetLabel,
  type SheetDuplicateAssetAction,
  type SheetDuplicateAssetChoice,
  type SheetDuplicateAssetRow,
  type SheetDuplicatePlan
} from "../../logic/services/drawing-sheet-duplication";

type WizardStep = 0 | 1 | 2;

const STEPS = ["Sheet Details", "Asset Decisions", "Quality Review"];

function formatAssetType(type: string): string {
  return type
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function stepClass(isActive: boolean): string {
  return [
    "flex min-w-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold",
    isActive
      ? "border-sky-300 bg-sky-50 text-sky-900"
      : "border-slate-200 bg-white text-slate-500"
  ].join(" ");
}

function assetRowSummary(row: SheetDuplicateAssetRow): string {
  return `${row.sourceTag} / ${row.title}`;
}

export function DuplicateSheetWizardDialog({
  model,
  symbols,
  activeSheetId,
  onCancel,
  onDuplicateSheet
}: {
  model: DrawingModel;
  symbols: ApprovedDrawingSymbol[];
  activeSheetId: string;
  onCancel: () => void;
  onDuplicateSheet: (plan: SheetDuplicatePlan) => void;
}) {
  const activeSheet =
    model.sheets.find((sheet) => sheet.id === activeSheetId) ?? model.sheets[0];
  const activeSheetNumber =
    model.sheets.findIndex((sheet) => sheet.id === activeSheet.id) + 1;
  const isSectionTitlePage = activeSheet.kind === "section_title";
  const suggestedSourceLabel = suggestSheetDuplicateSourceLabel(activeSheet.name);
  const suggestedTargetLabel =
    suggestSheetDuplicateTargetLabel(suggestedSourceLabel);
  const [step, setStep] = useState<WizardStep>(0);
  const [sourceLabel, setSourceLabel] = useState(suggestedSourceLabel);
  const [targetLabel, setTargetLabel] = useState(suggestedTargetLabel);
  const [targetSheetName, setTargetSheetName] = useState(
    suggestDuplicateSheetName({
      sheetName: activeSheet.name,
      sourceLabel: suggestedSourceLabel,
      targetLabel: suggestedTargetLabel
    })
  );
  const [isSheetNameCustomized, setIsSheetNameCustomized] = useState(false);
  const [choices, setChoices] = useState<
    Record<string, SheetDuplicateAssetChoice>
  >({});

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onCancel]);

  const plan = useMemo(
    () =>
      buildSheetDuplicatePlan({
        model,
        symbols,
        sourceSheetId: activeSheet.id,
        sourceLabel,
        targetLabel,
        targetSheetName,
        choices: Object.values(choices)
      }),
    [activeSheet.id, choices, model, sourceLabel, symbols, targetLabel, targetSheetName]
  );
  const createAssetCount = plan.assetRows.filter(
    (row) => row.action === "create"
  ).length;
  const referenceAssetCount = plan.assetRows.length - createAssetCount;
  const canConfirm = plan.blockingErrors.length === 0;

  const updateChoice = (choice: SheetDuplicateAssetChoice) => {
    setChoices((current) => ({
      ...current,
      [choice.sourceAssetId]: choice
    }));
  };

  const updateReplacementLabels = ({
    nextSourceLabel = sourceLabel,
    nextTargetLabel = targetLabel
  }: {
    nextSourceLabel?: string;
    nextTargetLabel?: string;
  }) => {
    setSourceLabel(nextSourceLabel);
    setTargetLabel(nextTargetLabel);

    if (!isSheetNameCustomized) {
      setTargetSheetName(
        suggestDuplicateSheetName({
          sheetName: activeSheet.name,
          sourceLabel: nextSourceLabel,
          targetLabel: nextTargetLabel
        })
      );
    }
  };

  const renderSheetDetails = () => (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
        <h3 className="font-semibold text-slate-950">Source sheet</h3>
        <p className="mt-2 font-semibold text-slate-900">
          Sheet {activeSheetNumber}
        </p>
        <p className="mt-1">{activeSheet.name}</p>
        <p className="mt-3 text-slate-500">
          {isSectionTitlePage
            ? "The duplicate becomes a new empty section after this complete section block. Member sheets are not copied."
            : "The duplicate will be inserted directly after this sheet and opened for review."}
        </p>
      </div>
      <div className="space-y-3">
        <div>
          <label className="field-label" htmlFor="duplicate-target-sheet-name">
            New sheet name
          </label>
          <input
            id="duplicate-target-sheet-name"
            className="field-input"
            value={targetSheetName}
            onChange={(event) => {
              setIsSheetNameCustomized(true);
              setTargetSheetName(event.currentTarget.value);
            }}
          />
        </div>
        {!isSectionTitlePage ? <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="duplicate-source-label">
              Source text
            </label>
            <input
              id="duplicate-source-label"
              className="field-input"
              value={sourceLabel}
              placeholder="Tank 1"
              onChange={(event) =>
                updateReplacementLabels({
                  nextSourceLabel: event.currentTarget.value
                })
              }
            />
          </div>
          <div>
            <label className="field-label" htmlFor="duplicate-target-label">
              Target text
            </label>
            <input
              id="duplicate-target-label"
              className="field-input"
              value={targetLabel}
              placeholder="Tank 2"
              onChange={(event) =>
                updateReplacementLabels({
                  nextTargetLabel: event.currentTarget.value
                })
              }
            />
          </div>
        </div> : null}
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs">
          <div className="font-semibold text-slate-950">Preview</div>
          <div className="mt-1 truncate text-slate-600">{plan.targetSheetName}</div>
        </div>
        {isSheetNameCustomized ? (
          <button
            type="button"
            className="icon-button"
            onClick={() => {
              setIsSheetNameCustomized(false);
              setTargetSheetName(
                suggestDuplicateSheetName({
                  sheetName: activeSheet.name,
                  sourceLabel,
                  targetLabel
                })
              );
            }}
          >
            Reset generated name
          </button>
        ) : null}
      </div>
    </div>
  );

  const renderAssetActionControls = (row: SheetDuplicateAssetRow) => (
    <div className="grid gap-2 sm:grid-cols-[140px_1fr]">
      <select
        className="field-input h-10"
        value={row.action}
        disabled={plan.preserveAssetReferences}
        onChange={(event) => {
          const action = event.currentTarget.value as SheetDuplicateAssetAction;
          const firstReference = row.compatibleAssets[0];

          updateChoice({
            sourceAssetId: row.sourceAssetId,
            action,
            targetAssetId:
              action === "reference"
                ? row.targetAssetId ?? firstReference?.assetId
                : row.targetAssetId,
            targetTag:
              action === "create"
                ? row.targetTag
                : firstReference?.tag ?? row.targetTag
          });
        }}
        aria-label={`Asset action for ${assetRowSummary(row)}`}
      >
        <option value="create">Create new</option>
        <option value="reference">Reference existing</option>
      </select>
      {row.action === "create" ? (
        <input
          className="field-input h-10"
          value={row.targetTag ?? ""}
          placeholder="Target tag"
          onChange={(event) =>
            updateChoice({
              sourceAssetId: row.sourceAssetId,
              action: "create",
              targetTag: event.currentTarget.value
            })
          }
          aria-label={`Target tag for ${assetRowSummary(row)}`}
        />
      ) : (
        <select
          className="field-input h-10"
          value={row.targetAssetId ?? ""}
          onChange={(event) => {
            const targetAsset = row.compatibleAssets.find(
              (asset) => asset.assetId === event.currentTarget.value
            );

            updateChoice({
              sourceAssetId: row.sourceAssetId,
              action: "reference",
              targetAssetId: event.currentTarget.value,
              targetTag: targetAsset?.tag
            });
          }}
          aria-label={`Reference target for ${assetRowSummary(row)}`}
        >
          {row.compatibleAssets.map((asset) => (
            <option key={asset.assetId} value={asset.assetId}>
              {asset.tag} - {asset.title}
            </option>
          ))}
        </select>
      )}
    </div>
  );

  const renderAssetDecisions = () => (
    <div className="space-y-3">
      <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-900">
        Review every physical asset on this sheet before creating the duplicate.
        Existing compatible target assets are suggested where appropriate.
      </div>
      <div className="max-h-[500px] space-y-2 overflow-y-auto">
        {plan.assetRows.length === 0 ? (
          <div className="rounded-md border border-slate-200 px-3 py-8 text-center text-xs text-slate-500">
            This sheet does not contain placed assets.
          </div>
        ) : (
          plan.assetRows.map((row) => (
            <div
              key={row.sourceAssetId}
              className="grid gap-3 rounded-md border border-slate-200 bg-white p-3 lg:grid-cols-[1fr_380px]"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-950">
                    {row.sourceTag}
                  </span>
                  <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[11px] font-semibold uppercase text-slate-500">
                    {formatAssetType(row.type)}
                  </span>
                  {row.defaultAction === "reference" ? (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                      Suggested reference
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 truncate text-xs text-slate-600">{row.title}</p>
                {row.warnings.length > 0 ? (
                  <p className="mt-2 text-[11px] leading-4 text-amber-700">
                    {row.warnings.join(" ")}
                  </p>
                ) : null}
              </div>
              {renderAssetActionControls(row)}
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderQualityReview = () => (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-md border border-slate-200 bg-white p-3">
            <div className="text-lg font-semibold text-slate-950">1</div>
            <div className="text-slate-500">New sheet</div>
          </div>
          <div className="rounded-md border border-slate-200 bg-white p-3">
            <div className="text-lg font-semibold text-slate-950">
              {createAssetCount}
            </div>
            <div className="text-slate-500">New assets</div>
          </div>
          <div className="rounded-md border border-slate-200 bg-white p-3">
            <div className="text-lg font-semibold text-slate-950">
              {referenceAssetCount}
            </div>
            <div className="text-slate-500">References</div>
          </div>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-3 text-xs">
          <div className="font-semibold text-slate-950">New sheet name</div>
          <div className="mt-1 text-slate-600">{plan.targetSheetName}</div>
        </div>
      </div>
      <div className="space-y-3">
        {plan.blockingErrors.length > 0 ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-700">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle aria-hidden="true" size={14} />
              Resolve before duplicating
            </div>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {plan.blockingErrors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle2 aria-hidden="true" size={14} />
              Ready to duplicate
            </div>
            <p className="mt-1">
              Asset tags and references are valid for this sheet duplicate.
            </p>
          </div>
        )}
        {plan.warnings.length > 0 ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
            <div className="font-semibold">Warnings</div>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {plan.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="rounded-md border border-slate-200">
          <div className="border-b border-slate-200 px-3 py-2 text-xs font-semibold text-slate-950">
            Asset mapping
          </div>
          <div className="max-h-48 overflow-y-auto p-3 text-xs">
            {plan.assetRows.map((row) => (
              <div key={row.sourceAssetId} className="mb-2 last:mb-0">
                <span className="font-semibold text-slate-950">
                  {row.sourceTag}
                </span>{" "}
                <span className="text-slate-500">
                  {row.action === "create"
                    ? `-> ${row.targetTag}`
                    : `references ${row.targetTag}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

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
        aria-labelledby="duplicate-sheet-wizard-title"
        aria-describedby="duplicate-sheet-wizard-description"
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-700">
            <Copy aria-hidden="true" size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h2
              id="duplicate-sheet-wizard-title"
              className="text-sm font-semibold text-slate-950"
            >
              Duplicate Sheet
            </h2>
            <p
              id="duplicate-sheet-wizard-description"
              className="mt-1 text-xs leading-5 text-slate-600"
            >
              Duplicate one sheet with reviewed asset tags and references.
            </p>
          </div>
          <button
            type="button"
            className="icon-button h-8 w-8 p-0"
            onClick={onCancel}
            aria-label="Close duplicate sheet wizard"
          >
            <X aria-hidden="true" size={14} />
          </button>
        </div>

        <div className="border-b border-slate-200 px-5 py-3">
          <div className="flex flex-wrap items-center gap-2">
            {STEPS.map((label, index) => (
              <div key={label} className={stepClass(step === index)}>
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px]">
                  {index + 1}
                </span>
                {label}
              </div>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {step === 0 ? renderSheetDetails() : null}
          {step === 1 ? renderAssetDecisions() : null}
          {step === 2 ? renderQualityReview() : null}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-5 py-4">
          <button type="button" className="icon-button" onClick={onCancel}>
            Cancel
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              className="icon-button"
              disabled={step === 0}
              onClick={() =>
                setStep((current) => Math.max(0, current - 1) as WizardStep)
              }
            >
              <ArrowLeft aria-hidden="true" size={14} />
              Back
            </button>
            {step < 2 ? (
              <button
                type="button"
                className="icon-button icon-button-primary"
                onClick={() =>
                  setStep((current) => Math.min(2, current + 1) as WizardStep)
                }
              >
                Next
                <ArrowRight aria-hidden="true" size={14} />
              </button>
            ) : (
              <button
                type="button"
                className="icon-button icon-button-primary"
                disabled={!canConfirm}
                onClick={() => onDuplicateSheet(plan)}
              >
                <Copy aria-hidden="true" size={14} />
                Duplicate sheet
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
