"use client";

import { Cable } from "lucide-react";
import { useState } from "react";
import type {
  PanelInternalWireEndpointCatalog,
  PanelInternalWireEndpointOption,
  PanelInternalWireEndpointPairState,
  PanelTerminalSideRef,
  PanelWireAttributes
} from "../../api/public";

export type PanelInternalWireFormSubmission = {
  from: PanelTerminalSideRef;
  to: PanelTerminalSideRef;
  wireId: string;
  attributes?: PanelWireAttributes;
};

export type PanelInternalWireFormResult =
  | { ok: true }
  | { ok: false; error: string };

function sideLabel(option: PanelInternalWireEndpointOption): string {
  const side = option.terminal.side.charAt(0).toUpperCase() + option.terminal.side.slice(1);
  return option.physicalPosition ? `${side} (${option.physicalPosition})` : side;
}

function terminalLabel(option: PanelInternalWireEndpointOption): string {
  const label = /^terminal\b/i.test(option.terminalLabel)
    ? option.terminalLabel
    : `Terminal ${option.terminalLabel}`;
  return `${label} - ${sideLabel(option)}`;
}

export function PanelInternalWireForm({
  catalog,
  focusedAssetId,
  proposedWireId,
  defaults,
  readOnly,
  getPairState,
  onSubmit
}: {
  catalog: PanelInternalWireEndpointCatalog;
  focusedAssetId?: string;
  proposedWireId: string;
  defaults?: PanelWireAttributes;
  readOnly: boolean;
  getPairState: (
    from: PanelTerminalSideRef,
    to: PanelTerminalSideRef
  ) => PanelInternalWireEndpointPairState;
  onSubmit: (submission: PanelInternalWireFormSubmission) => PanelInternalWireFormResult;
}) {
  const firstEnabledEquipment = catalog.equipment.find((equipment) => !equipment.disabledReason);
  const focusedEquipment = catalog.equipment.find(
    (equipment) => equipment.assetId === focusedAssetId && !equipment.disabledReason
  );
  const [fromAssetId, setFromAssetId] = useState(
    focusedEquipment?.assetId ?? firstEnabledEquipment?.assetId ?? ""
  );
  const [fromEndpointId, setFromEndpointId] = useState("");
  const [toAssetId, setToAssetId] = useState("");
  const [toEndpointId, setToEndpointId] = useState("");
  const [wireId, setWireId] = useState(proposedWireId);
  const [color, setColor] = useState(defaults?.color ?? "");
  const [size, setSize] = useState(defaults?.size ?? "");
  const [wireType, setWireType] = useState(defaults?.wireType ?? "");
  const [description, setDescription] = useState(defaults?.description ?? "");
  const [error, setError] = useState<string | null>(null);

  const fromEquipment = catalog.equipment.find(
    (equipment) => equipment.assetId === fromAssetId
  );
  const fromEndpoint = fromEquipment?.endpoints.find(
    (endpoint) => endpoint.id === fromEndpointId
  );
  const destinationEquipment = catalog.equipment.find(
    (equipment) => equipment.assetId === toAssetId
  );
  const destinationOptions =
    destinationEquipment?.endpoints.map((endpoint) => {
      const pairState = fromEndpoint
        ? getPairState(fromEndpoint.terminal, endpoint.terminal)
        : {
            enabled: !endpoint.disabledReason,
            disabledReason: endpoint.disabledReason
          };
      return {
        endpoint,
        disabledReason: endpoint.disabledReason ?? pairState.disabledReason
      };
    }) ?? [];
  const toEndpoint = destinationOptions.find(
    (option) => option.endpoint.id === toEndpointId
  );
  const enabledEndpointCount = catalog.equipment.reduce(
    (count, equipment) =>
      count + equipment.endpoints.filter((endpoint) => !endpoint.disabledReason).length,
    0
  );
  const canSubmit =
    !readOnly &&
    Boolean(fromEndpoint) &&
    Boolean(toEndpoint && !toEndpoint.disabledReason) &&
    Boolean(wireId.trim());

  if (enabledEndpointCount < 2) {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-5 text-center text-xs text-slate-600">
        Add equipment with at least two free internal or single-sided terminal endpoints before creating a wire.
      </div>
    );
  }

  return (
    <form
      className="space-y-4 rounded-md border border-slate-200 bg-white p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!canSubmit || !fromEndpoint || !toEndpoint) return;
        const result = onSubmit({
          from: fromEndpoint.terminal,
          to: toEndpoint.endpoint.terminal,
          wireId: wireId.trim(),
          attributes: {
            color: color.trim() || undefined,
            size: size.trim() || undefined,
            wireType: wireType.trim() || undefined,
            description: description.trim() || undefined
          }
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setError(null);
        setFromEndpointId("");
        setToAssetId("");
        setToEndpointId("");
      }}
    >
      <div>
        <h4 className="text-xs font-bold text-slate-950">Add internal wire</h4>
        <p className="mt-1 text-xs text-slate-500">
          Select canonical terminal endpoints. A routed line will be added to this drawing automatically.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <fieldset className="space-y-3" disabled={readOnly}>
          <legend className="text-[10px] font-bold uppercase text-slate-500">From</legend>
          <div>
            <label className="field-label" htmlFor="panel-wire-from-equipment">From equipment</label>
            <select
              id="panel-wire-from-equipment"
              className="field-input"
              value={fromAssetId}
              onChange={(event) => {
                setFromAssetId(event.currentTarget.value);
                setFromEndpointId("");
                setToEndpointId("");
                setError(null);
              }}
            >
              <option value="">Select equipment</option>
              {catalog.equipment.map((equipment) => (
                <option
                  key={equipment.assetId}
                  value={equipment.assetId}
                  disabled={Boolean(equipment.disabledReason)}
                >
                  {equipment.tag} - {equipment.title}
                  {equipment.disabledReason ? ` - ${equipment.disabledReason}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="panel-wire-from-terminal">From terminal</label>
            <select
              id="panel-wire-from-terminal"
              className="field-input"
              value={fromEndpointId}
              disabled={readOnly || !fromEquipment}
              onChange={(event) => {
                setFromEndpointId(event.currentTarget.value);
                setToEndpointId("");
                setError(null);
              }}
            >
              <option value="">Select terminal</option>
              {fromEquipment?.endpoints.map((endpoint) => (
                <option
                  key={endpoint.id}
                  value={endpoint.id}
                  disabled={Boolean(endpoint.disabledReason)}
                >
                  {terminalLabel(endpoint)}
                  {endpoint.disabledReason ? ` - ${endpoint.disabledReason}` : ""}
                </option>
              ))}
            </select>
          </div>
        </fieldset>

        <fieldset className="space-y-3" disabled={readOnly}>
          <legend className="text-[10px] font-bold uppercase text-slate-500">To</legend>
          <div>
            <label className="field-label" htmlFor="panel-wire-to-equipment">To equipment</label>
            <select
              id="panel-wire-to-equipment"
              className="field-input"
              value={toAssetId}
              onChange={(event) => {
                setToAssetId(event.currentTarget.value);
                setToEndpointId("");
                setError(null);
              }}
            >
              <option value="">Select equipment</option>
              {catalog.equipment.map((equipment) => {
                const hasValidDestination = equipment.endpoints.some((endpoint) => {
                  if (endpoint.disabledReason) return false;
                  return fromEndpoint
                    ? getPairState(fromEndpoint.terminal, endpoint.terminal).enabled
                    : true;
                });
                return (
                  <option
                    key={equipment.assetId}
                    value={equipment.assetId}
                    disabled={!hasValidDestination}
                  >
                    {equipment.tag} - {equipment.title}
                    {!hasValidDestination ? " - No valid destination terminals" : ""}
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="panel-wire-to-terminal">To terminal</label>
            <select
              id="panel-wire-to-terminal"
              className="field-input"
              value={toEndpointId}
              disabled={readOnly || !destinationEquipment || !fromEndpoint}
              onChange={(event) => {
                setToEndpointId(event.currentTarget.value);
                setError(null);
              }}
            >
              <option value="">
                {destinationEquipment && !fromEndpoint
                  ? "Select source terminal first"
                  : "Select terminal"}
              </option>
              {destinationOptions.map(({ endpoint, disabledReason }) => (
                <option
                  key={endpoint.id}
                  value={endpoint.id}
                  disabled={Boolean(disabledReason)}
                >
                  {terminalLabel(endpoint)}
                  {disabledReason ? ` - ${disabledReason}` : ""}
                </option>
              ))}
            </select>
          </div>
        </fieldset>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="field-label" htmlFor="panel-wire-id">Wire ID</label>
          <input id="panel-wire-id" className="field-input" value={wireId} disabled={readOnly} onChange={(event) => setWireId(event.currentTarget.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="panel-wire-color">Color</label>
          <input id="panel-wire-color" className="field-input" value={color} disabled={readOnly} onChange={(event) => setColor(event.currentTarget.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="panel-wire-size">Size</label>
          <input id="panel-wire-size" className="field-input" value={size} disabled={readOnly} onChange={(event) => setSize(event.currentTarget.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="panel-wire-type">Wire type</label>
          <input id="panel-wire-type" className="field-input" value={wireType} disabled={readOnly} onChange={(event) => setWireType(event.currentTarget.value)} />
        </div>
      </div>

      <div>
        <label className="field-label" htmlFor="panel-wire-description">Description</label>
        <input id="panel-wire-description" className="field-input" value={description} disabled={readOnly} onChange={(event) => setDescription(event.currentTarget.value)} />
      </div>

      {error ? <p role="alert" className="text-xs font-semibold text-red-700">{error}</p> : null}

      <div className="flex justify-end">
        <button type="submit" className="icon-button icon-button-primary" disabled={!canSubmit}>
          <Cable aria-hidden="true" size={14} />
          Create wire
        </button>
      </div>
    </form>
  );
}
