"use client";

import { useMemo } from "react";
import {
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyStart,
  AlignHorizontalSpaceBetween,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  AlignVerticalSpaceBetween,
  type LucideIcon
} from "lucide-react";
import type { DrawingSheetCanvasModel } from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import type { DrawingCanvasSelection } from "../../logic/services/drawing-selection";
import {
  resolvePlacementArrangement,
  type PlacementArrangementAction,
  type PlacementArrangementResult
} from "../../logic/services/drawing-selection-arrangement";

type ArrangementControl = {
  action: PlacementArrangementAction;
  label: string;
  Icon: LucideIcon;
};

const ALIGN_CONTROLS: ArrangementControl[] = [
  { action: "align_left", label: "Align left", Icon: AlignHorizontalJustifyStart },
  {
    action: "align_center",
    label: "Align horizontal center",
    Icon: AlignHorizontalJustifyCenter
  },
  { action: "align_right", label: "Align right", Icon: AlignHorizontalJustifyEnd },
  { action: "align_top", label: "Align top", Icon: AlignVerticalJustifyStart },
  {
    action: "align_middle",
    label: "Align vertical middle",
    Icon: AlignVerticalJustifyCenter
  },
  { action: "align_bottom", label: "Align bottom", Icon: AlignVerticalJustifyEnd }
];

const DISTRIBUTE_CONTROLS: ArrangementControl[] = [
  {
    action: "distribute_horizontal",
    label: "Distribute horizontally",
    Icon: AlignHorizontalSpaceBetween
  },
  {
    action: "distribute_vertical",
    label: "Distribute vertically",
    Icon: AlignVerticalSpaceBetween
  }
];

function ArrangementButton({
  control,
  result,
  mixedSelection,
  onArrange
}: {
  control: ArrangementControl;
  result: PlacementArrangementResult;
  mixedSelection: boolean;
  onArrange: (action: PlacementArrangementAction) => void;
}) {
  const { action, label, Icon } = control;
  const disabled = mixedSelection || !result.ok;

  return (
    <button
      type="button"
      className="flex min-h-9 min-w-9 flex-1 items-center justify-center rounded-md border border-slate-200 bg-white px-2 text-slate-700 transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-300"
      aria-label={label}
      title={label}
      disabled={disabled}
      data-testid={`arrange-${action}`}
      onClick={() => onArrange(action)}
    >
      <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
      <span className="sr-only">{label}</span>
    </button>
  );
}

function firstFailureMessage(
  controls: ArrangementControl[],
  results: Map<PlacementArrangementAction, PlacementArrangementResult>
): string | undefined {
  const failures = controls
    .map((control) => results.get(control.action))
    .filter(
      (result): result is Extract<PlacementArrangementResult, { ok: false }> =>
        Boolean(result && !result.ok)
    );

  if (failures.length !== controls.length) {
    return undefined;
  }

  return failures[0]?.message;
}

export function DrawingSelectionArrangeControls({
  model,
  symbols,
  selection,
  onArrange
}: {
  model: DrawingSheetCanvasModel;
  symbols: ApprovedDrawingSymbol[];
  selection: DrawingCanvasSelection;
  onArrange: (action: PlacementArrangementAction) => void;
}) {
  const results = useMemo(() => {
    const resolved = new Map<
      PlacementArrangementAction,
      PlacementArrangementResult
    >();

    for (const control of [...ALIGN_CONTROLS, ...DISTRIBUTE_CONTROLS]) {
      resolved.set(
        control.action,
        resolvePlacementArrangement({
          model,
          symbols,
          placementIds: selection.placementIds,
          action: control.action
        })
      );
    }

    return resolved;
  }, [model, selection.placementIds, symbols]);
  const mixedSelection = selection.annotationIds.length > 0;
  const mixedSelectionMessage = mixedSelection
    ? `Deselect ${selection.annotationIds.length} note${selection.annotationIds.length === 1 ? "" : "s"} before arranging symbols.`
    : undefined;
  const alignMessage =
    mixedSelectionMessage ?? firstFailureMessage(ALIGN_CONTROLS, results);
  const distributeMessage =
    mixedSelectionMessage ?? firstFailureMessage(DISTRIBUTE_CONTROLS, results);

  return (
    <div className="space-y-4" data-testid="drawing-selection-arrange-controls">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
          Align
        </p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {ALIGN_CONTROLS.map((control) => (
            <ArrangementButton
              key={control.action}
              control={control}
              result={results.get(control.action)!}
              mixedSelection={mixedSelection}
              onArrange={onArrange}
            />
          ))}
        </div>
        {alignMessage ? (
          <p className="mt-2 text-xs leading-5 text-slate-500">{alignMessage}</p>
        ) : null}
      </div>

      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
          Distribute
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {DISTRIBUTE_CONTROLS.map((control) => (
            <ArrangementButton
              key={control.action}
              control={control}
              result={results.get(control.action)!}
              mixedSelection={mixedSelection}
              onArrange={onArrange}
            />
          ))}
        </div>
        {distributeMessage ? (
          <p className="mt-2 text-xs leading-5 text-slate-500">
            {distributeMessage}
          </p>
        ) : null}
      </div>
    </div>
  );
}
