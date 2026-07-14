"use client";

import { useMemo, useState } from "react";
import {
  AlignCenter,
  ArrowLeft,
  ArrowRight,
  Cable,
  Check,
  ClipboardCheck,
  FileSpreadsheet,
  PackagePlus,
  ShieldCheck,
  TriangleAlert
} from "lucide-react";
import type {
  PanelConnectionPatternCatalogRow,
  PanelDiscoveryIndex,
  PanelGuidedWorkflowSnapshot,
  PanelGuidedWorkflowStepId,
  PanelInternalWireCatalogRow,
  PanelInternalWireEndpointCatalog,
  PanelInternalWireEndpointPairState,
  PanelTerminalSideRef,
  PanelWireAttributes
} from "../../api/public";
import {
  filterPanelWorkflowRecordsByAsset,
  getNextPanelWorkflowAction
} from "../../api/public";
import type { PanelDiscoveryTab } from "./panel-discovery-dialog";
import { PanelDiscoveryStatusBadge } from "./panel-discovery-status";
import { PanelWorkflowEquipmentList } from "./panel-workflow-equipment-list";
import {
  PanelInternalWireForm,
  type PanelInternalWireFormResult,
  type PanelInternalWireFormSubmission
} from "./panel-internal-wire-form";

const STEP_STATUS_STYLE = {
  complete: "border-emerald-200 bg-emerald-50 text-emerald-800",
  ready: "border-sky-200 bg-sky-50 text-sky-800",
  needs_action: "border-amber-200 bg-amber-50 text-amber-900",
  blocked: "border-slate-200 bg-slate-100 text-slate-400",
  optional: "border-violet-200 bg-violet-50 text-violet-800"
} as const;

function nextStepId(snapshot: PanelGuidedWorkflowSnapshot): PanelGuidedWorkflowStepId {
  return snapshot.nextAction.kind === "open_step"
    ? snapshot.nextAction.stepId
    : "place-representation";
}

function nextStepForAsset(
  snapshot: PanelGuidedWorkflowSnapshot,
  assetId: string
): PanelGuidedWorkflowStepId {
  const action = getNextPanelWorkflowAction(snapshot.assets, assetId);
  return action.kind === "open_step" ? action.stepId : "place-representation";
}

function sourceSheetSummary(
  sourceSheets: Array<{ sheetNumber: number; sheetName: string }>
): string {
  return sourceSheets
    .map((sheet) => `Sheet ${sheet.sheetNumber} - ${sheet.sheetName}`)
    .join("; ");
}

export function PanelGuidedWorkflow({
  snapshot,
  index,
  internalWires,
  connectionPatterns,
  endpointCatalog,
  proposedWireId,
  wireDefaults,
  activeSheetId,
  readOnly,
  onFocusAsset,
  onPlaceAsset,
  onSelectPlacement,
  onRemovePlacement,
  onRequestMapping,
  onResetTerminationMapping,
  onSelectInternalWireRoute,
  onAddInternalWireRoute,
  onDeleteInternalWire,
  onCreateInternalWire,
  onGetInternalWirePairState,
  onPickInternalWire,
  onCenterEquipment,
  onOpenReview,
  onOpenDeliverables,
  onOpenAdvanced
}: {
  snapshot: PanelGuidedWorkflowSnapshot;
  index: PanelDiscoveryIndex;
  internalWires: PanelInternalWireCatalogRow[];
  connectionPatterns: PanelConnectionPatternCatalogRow[];
  endpointCatalog: PanelInternalWireEndpointCatalog;
  proposedWireId: string;
  wireDefaults?: PanelWireAttributes;
  activeSheetId: string;
  readOnly: boolean;
  onFocusAsset: (assetId: string) => void;
  onPlaceAsset: (assetId: string) => void;
  onSelectPlacement: (placementId: string) => void;
  onRemovePlacement: (placementId: string) => void;
  onRequestMapping: (terminationId: string) => void;
  onResetTerminationMapping: (terminationId: string) => void;
  onSelectInternalWireRoute: (connectionId: string) => void;
  onAddInternalWireRoute: (wireRecordId: string) => void;
  onDeleteInternalWire: (wireRecordId: string, connectionId?: string) => void;
  onCreateInternalWire: (
    submission: PanelInternalWireFormSubmission
  ) => PanelInternalWireFormResult;
  onGetInternalWirePairState: (
    from: PanelTerminalSideRef,
    to: PanelTerminalSideRef
  ) => PanelInternalWireEndpointPairState;
  onPickInternalWire: () => void;
  onCenterEquipment: () => void;
  onOpenReview: () => void;
  onOpenDeliverables: () => void;
  onOpenAdvanced: (tab: PanelDiscoveryTab, focusId?: string) => void;
}) {
  const [activeStepId, setActiveStepId] = useState<PanelGuidedWorkflowStepId>(() =>
    nextStepId(snapshot)
  );
  const focused = snapshot.assets.find(
    (asset) => asset.assetId === snapshot.focusAssetId
  );
  const records = useMemo(
    () =>
      snapshot.focusAssetId
        ? filterPanelWorkflowRecordsByAsset({
            index,
            internalWires,
            connectionPatterns,
            assetId: snapshot.focusAssetId
          })
        : undefined,
    [connectionPatterns, index, internalWires, snapshot.focusAssetId]
  );

  const handleContinue = () => {
    if (
      snapshot.nextAction.kind === "select_asset" ||
      snapshot.nextAction.kind === "next_asset"
    ) {
      if (!readOnly) {
        setActiveStepId(
          nextStepForAsset(snapshot, snapshot.nextAction.assetId)
        );
        onFocusAsset(snapshot.nextAction.assetId);
      }
      return;
    }
    if (snapshot.nextAction.kind === "open_step") {
      setActiveStepId(snapshot.nextAction.stepId);
    }
  };
  const continueLabel =
    snapshot.nextAction.kind === "next_asset"
      ? "Next equipment"
      : snapshot.nextAction.kind === "select_asset"
        ? "Start walkthrough"
        : snapshot.nextAction.kind === "none"
          ? "No pending work"
          : "Continue";
  const activeStepIndex = snapshot.steps.findIndex(
    (step) => step.id === activeStepId
  );
  const canGoBack = activeStepIndex > 0;
  const representedEquipmentCount = snapshot.assets.filter(
    (asset) => asset.representedPlacementId
  ).length;
  const endpointCatalogRevision = useMemo(
    () =>
      endpointCatalog.equipment
        .flatMap((equipment) =>
          equipment.endpoints.map(
            (endpoint) => `${endpoint.id}:${endpoint.disabledReason ?? "available"}`
          )
        )
        .join("|"),
    [endpointCatalog]
  );

  const handleBack = () => {
    if (!canGoBack) {
      return;
    }

    setActiveStepId(snapshot.steps[activeStepIndex - 1].id);
  };

  const renderStepContent = () => {
    if (!focused || !records) {
      return (
        <div className="flex min-h-80 flex-col items-center justify-center px-8 text-center">
          <ClipboardCheck aria-hidden="true" size={28} className="text-slate-400" />
          <h3 className="mt-3 text-sm font-bold text-slate-950">Choose equipment</h3>
          <p className="mt-1 max-w-md text-xs leading-5 text-slate-500">
            Select an associated asset from the queue to begin its Detailed Panel workflow.
          </p>
        </div>
      );
    }

    if (activeStepId === "place-representation") {
      const asset = records.asset!;
      return (
        <div className="space-y-4 p-5">
          <div>
            <h3 className="text-sm font-bold text-slate-950">Add {asset.tag} to drawing</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              This adds the existing physical asset to this sheet. It does not create another asset or tag.
            </p>
          </div>
          <dl className="grid gap-3 rounded-md border border-slate-200 p-4 text-xs sm:grid-cols-2">
            <div><dt className="font-bold text-slate-500">Title</dt><dd className="mt-1 text-slate-900">{asset.title}</dd></div>
            <div><dt className="font-bold text-slate-500">Terminals</dt><dd className="mt-1 text-slate-900">{asset.terminalCount}</dd></div>
            <div className="sm:col-span-2"><dt className="font-bold text-slate-500">Source sheets</dt><dd className="mt-1 leading-5 text-slate-700">{sourceSheetSummary(asset.sourceOccurrences) || "No source occurrence"}</dd></div>
          </dl>
          <div className="flex flex-wrap gap-2">
            {asset.representedPlacementId ? (
              <>
                <button type="button" className="icon-button icon-button-primary" onClick={() => onSelectPlacement(asset.representedPlacementId!)}>Select on sheet</button>
                <button type="button" className="icon-button border-rose-200 text-rose-700" disabled={readOnly} onClick={() => onRemovePlacement(asset.representedPlacementId!)}>Remove from drawing</button>
              </>
            ) : (
              <button type="button" className="icon-button icon-button-primary" disabled={readOnly || asset.status !== "available"} onClick={() => onPlaceAsset(asset.assetId)}>
                <PackagePlus aria-hidden="true" size={14} /> Add to drawing
              </button>
            )}
            {representedEquipmentCount > 0 ? (
              <button
                type="button"
                className="icon-button"
                disabled={readOnly}
                onClick={onCenterEquipment}
              >
                <AlignCenter aria-hidden="true" size={14} />
                Center equipment
              </button>
            ) : null}
          </div>
          {asset.disabledReason ? <p className="text-xs text-red-700">{asset.disabledReason}</p> : null}
        </div>
      );
    }

    if (activeStepId === "review-terminations") {
      return (
        <div className="space-y-3 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-950">
                Review and map field terminations for {focused.tag}
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Confirm each field wire and source sheet, then map it to the correct terminal side.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="icon-button"
                onClick={() => onOpenAdvanced("terminations", focused.tag)}
              >
                All terminations
              </button>
              <button
                type="button"
                className="icon-button"
                onClick={() => onOpenAdvanced("terminal-map", focused.tag)}
              >
                Full terminal map
              </button>
            </div>
          </div>
          {records.terminations.length > 0 ? (
            <div className="overflow-x-auto rounded-md border border-slate-200">
              <table className="w-full min-w-[1060px] text-left text-xs">
                <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Wire</th>
                    <th className="px-3 py-2">Cable / conductor</th>
                    <th className="px-3 py-2">Terminal</th>
                    <th className="px-3 py-2">Source</th>
                    <th className="px-3 py-2">Mapping</th>
                    <th className="px-3 py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {records.terminations.map((row) => (
                    <tr key={row.terminationId} className="border-t border-slate-100">
                      <td className="px-3 py-2.5">
                        <PanelDiscoveryStatusBadge status={row.status} />
                      </td>
                      <td className="px-3 py-2.5 font-mono font-semibold">
                        {row.wireId || "-"}
                      </td>
                      <td className="px-3 py-2.5">
                        {row.cableTag || "-"} / {row.conductorKey || "-"}
                      </td>
                      <td className="px-3 py-2.5">
                        {row.effectiveTarget
                          ? `${focused.tag}:${row.effectiveTarget.terminalKey} / ${row.effectiveTarget.side}`
                          : "Unresolved"}
                      </td>
                      <td className="px-3 py-2.5">
                        Sheet {row.sourceSheet.number} - {row.sourceSheet.name}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold capitalize text-slate-700">
                          {row.mappingMode}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <button
                            type="button"
                            className="icon-button icon-button-primary"
                            disabled={readOnly || Boolean(row.mappingDisabledReason)}
                            title={row.mappingDisabledReason}
                            onClick={() => onRequestMapping(row.terminationId)}
                          >
                            {row.mappingMode === "unmapped" ? "Map" : "Change"}
                          </button>
                          {row.mappingMode === "manual" ? (
                            <button
                              type="button"
                              className="icon-button"
                              disabled={readOnly}
                              onClick={() => onResetTerminationMapping(row.terminationId)}
                            >
                              Reset
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
              No external field terminations are associated with this asset. No terminal mapping is required.
            </div>
          )}
        </div>
      );
    }

    if (activeStepId === "create-internal-wiring") {
      return (
        <div className="space-y-3 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-sm font-bold text-slate-950">Internal wiring for {focused.tag}</h3><p className="mt-1 text-xs text-slate-500">Connect free internal or single-sided terminals using canonical package wire records.</p></div><div className="flex gap-2"><button type="button" className="icon-button" onClick={() => onOpenAdvanced("internal-wires", focused.tag)}>Advanced wires</button><button type="button" className="icon-button" disabled={readOnly} onClick={onPickInternalWire}><Cable aria-hidden="true" size={14} /> Pick on drawing</button></div></div>
          {focused.missingRequiredConnectionCount > 0 ? <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">{focused.missingRequiredConnectionCount} required terminal connection{focused.missingRequiredConnectionCount === 1 ? " remains" : "s remain"}.</div> : <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">All required terminal sides for this asset are connected.</div>}
          <PanelInternalWireForm
            key={`${focused.assetId}:${proposedWireId}:${endpointCatalogRevision}`}
            catalog={endpointCatalog}
            focusedAssetId={focused.assetId}
            proposedWireId={proposedWireId}
            defaults={wireDefaults}
            readOnly={readOnly}
            getPairState={onGetInternalWirePairState}
            onSubmit={onCreateInternalWire}
          />
          {records.internalWires.length > 0 ? <div className="space-y-2">{records.internalWires.map((row) => { const activeRoute = row.routeOccurrences.find((route) => route.sheetId === activeSheetId); return <div key={row.wire.id} className="flex flex-wrap items-center gap-3 border-b border-slate-100 py-2.5 text-xs"><span className="font-mono font-bold text-blue-900">{row.wire.wireId}</span><span className="min-w-0 flex-1 text-slate-600">{row.fromLabel} → {row.toLabel}</span>{activeRoute ? <button type="button" className="icon-button" onClick={() => onSelectInternalWireRoute(activeRoute.connectionId)}>Select route</button> : <button type="button" className="icon-button" disabled={readOnly} onClick={() => onAddInternalWireRoute(row.wire.id)}>Add representation</button>}<button type="button" className="icon-button border-rose-200 text-rose-700" disabled={readOnly} onClick={() => onDeleteInternalWire(row.wire.id, activeRoute?.connectionId)}>Delete</button></div>; })}</div> : <p className="rounded-md border border-slate-200 bg-slate-50 px-4 py-5 text-center text-xs text-slate-500">No standalone internal wires currently terminate on {focused.tag}.</p>}
        </div>
      );
    }

    if (activeStepId === "engineering-review") {
      return <div className="flex min-h-80 flex-col items-center justify-center px-8 text-center"><ShieldCheck aria-hidden="true" size={30} className="text-teal-700" /><h3 className="mt-3 text-sm font-bold text-slate-950">Run Panel Review</h3><p className="mt-1 max-w-lg text-xs leading-5 text-slate-500">Validate asset identity, terminal occupancy, mappings, internal wires, patterns, and route integrity for the complete panel.</p><button type="button" className="icon-button icon-button-primary mt-4" onClick={onOpenReview}><ShieldCheck aria-hidden="true" size={14} /> Open Panel Review</button></div>;
    }

    return <div className="flex min-h-80 flex-col items-center justify-center px-8 text-center"><FileSpreadsheet aria-hidden="true" size={30} className="text-teal-700" /><h3 className="mt-3 text-sm font-bold text-slate-950">Generate deliverables</h3><p className="mt-1 max-w-lg text-xs leading-5 text-slate-500">Create terminal schedules, internal wire schedules, panel asset reports, BOM projections, and deliberate PDF output.</p><button type="button" className="icon-button icon-button-primary mt-4" onClick={onOpenDeliverables}><FileSpreadsheet aria-hidden="true" size={14} /> Open Deliverables</button></div>;
  };

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[260px_minmax(0,1fr)]">
      <PanelWorkflowEquipmentList
        snapshot={snapshot}
        onSelectAsset={(assetId) => {
          if (!readOnly) {
            setActiveStepId(nextStepForAsset(snapshot, assetId));
            onFocusAsset(assetId);
          }
        }}
      />
      <div className="flex min-h-0 min-w-0 flex-col">
        {snapshot.staleFocusAssetId ? (
          <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
            <TriangleAlert aria-hidden="true" size={14} className="mt-0.5 shrink-0" />
            The saved equipment focus is no longer associated with this panel. The first incomplete asset is shown without rewriting the drawing.
          </div>
        ) : null}
        <div className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2" aria-label="Detailed Panel workflow steps">
          {snapshot.steps.map((step, index) => (
            <button key={step.id} type="button" className={["flex min-w-28 items-center gap-2 rounded-md border px-2.5 py-2 text-left text-[9px] font-extrabold", activeStepId === step.id ? "border-teal-300 bg-teal-50 text-teal-900" : STEP_STATUS_STYLE[step.status]].join(" ")} disabled={step.status === "blocked" && step.id !== "place-representation"} onClick={() => setActiveStepId(step.id)}>
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current/30 bg-white/70">{step.status === "complete" ? <Check aria-hidden="true" size={11} /> : <span>{index + 1}</span>}</span>
              <span className="leading-3">{step.label}</span>
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-auto">{renderStepContent()}</div>
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3">
          <p className="min-w-0 truncate text-xs text-slate-600">
            {focused ? `${focused.tag} / ${focused.title}` : "Choose equipment to begin."}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              className="icon-button"
              disabled={!canGoBack}
              onClick={handleBack}
            >
              <ArrowLeft aria-hidden="true" size={14} />
              Back
            </button>
            <button type="button" className="icon-button icon-button-primary" disabled={snapshot.nextAction.kind === "none" || (readOnly && ["select_asset", "next_asset"].includes(snapshot.nextAction.kind))} onClick={handleContinue}>
              {continueLabel}<ArrowRight aria-hidden="true" size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
