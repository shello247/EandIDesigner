"use client";

import { ArrowLeftRight, Cable, X } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import {
  createWireSpecificationSnapshot,
  getDefaultWireCatalogEntry,
  type WireCatalogEntry,
  type WireSpecificationSnapshot
} from "@/features/wire_catalog/api/public";
import { WireCatalogPicker } from "@/features/wire_catalog/ui/public";
import {
  deriveInternalWireId,
  formatWireNumber,
  type PanelTerminalSideRef,
  type PanelWireAttributes
} from "../../api/public";

type DialogEndpoint = {
  ref: PanelTerminalSideRef;
  assetTag: string;
  label: string;
};

export type InternalWireDialogSubmission = {
  from: PanelTerminalSideRef;
  to: PanelTerminalSideRef;
  endpointsSwapped: boolean;
  specification: WireSpecificationSnapshot;
  attributes?: PanelWireAttributes;
};

export function InternalWireDialog({
  from: initialFrom,
  to: initialTo,
  wireNumber,
  initialDescription,
  catalogEntries,
  onManageCatalog,
  onCancel,
  onConfirm
}: {
  from: DialogEndpoint;
  to: DialogEndpoint;
  wireNumber: number;
  initialDescription: string;
  catalogEntries: WireCatalogEntry[];
  onManageCatalog: () => void;
  onCancel: () => void;
  onConfirm: (submission: InternalWireDialogSubmission) => void;
}) {
  const [swapped, setSwapped] = useState(false);
  const [catalogEntryId, setCatalogEntryId] = useState(
    getDefaultWireCatalogEntry(catalogEntries)?.id ?? ""
  );
  const [description, setDescription] = useState(initialDescription);
  const from = swapped ? initialTo : initialFrom;
  const to = swapped ? initialFrom : initialTo;
  const effectiveCatalogEntryId =
    catalogEntryId || getDefaultWireCatalogEntry(catalogEntries)?.id || "";
  const selectedEntry = catalogEntries.find(
    (entry) => entry.id === effectiveCatalogEntryId
  );
  const wireId = useMemo(
    () =>
      deriveInternalWireId({
        sourceTag: from.assetTag,
        terminalKey: from.ref.terminalKey,
        wireNumber
      }),
    [from.assetTag, from.ref.terminalKey, wireNumber]
  );
  const titleId = "internal-wire-dialog-title";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/25 p-4 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-2xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-800">
            <Cable size={18} />
          </div>
          <div className="flex-1">
            <h2 id={titleId} className="text-sm font-bold">Create internal wire</h2>
            <p className="mt-1 text-xs text-slate-500">
              Confirm electrical direction, identity, and approved wire specification.
            </p>
          </div>
          <button
            type="button"
            className="icon-button h-8 w-8 p-0"
            onClick={onCancel}
            aria-label="Close internal wire dialog"
          >
            <X size={14} />
          </button>
        </div>
        <div className="space-y-4 p-5">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-xs">
            {[from, to].map((endpoint, index) => (
              <div
                key={`${endpoint.ref.assetId}:${endpoint.ref.terminalKey}:${index}`}
                className="rounded-md border border-slate-200 bg-slate-50 p-3"
              >
                <p className="text-[10px] font-bold uppercase text-slate-500">
                  {index === 0 ? "Source" : "Destination"}
                </p>
                <p className="mt-1 font-bold">{endpoint.label}</p>
                <p className="mt-1 text-slate-500">
                  {endpoint.ref.terminalKey} / {endpoint.ref.side}
                </p>
              </div>
            )).reduce<ReactNode[]>((items, endpoint, index) => {
              items.push(endpoint);
              if (index === 0) {
                items.push(
                  <button
                    key="swap"
                    type="button"
                    className="icon-button h-9 w-9 p-0"
                    aria-label="Swap source and destination"
                    title="Swap source and destination"
                    onClick={() => setSwapped((current) => !current)}
                  >
                    <ArrowLeftRight aria-hidden="true" size={15} />
                  </button>
                );
              }
              return items;
            }, [])}
          </div>
          <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
            <label>
              <span className="field-label">Wire #</span>
              <input className="field-input font-mono" readOnly value={formatWireNumber(wireNumber)} />
            </label>
            <label>
              <span className="field-label">Wire ID</span>
              <input className="field-input font-mono" readOnly value={wireId} />
            </label>
          </div>
          <WireCatalogPicker
            entries={catalogEntries}
            value={effectiveCatalogEntryId}
            onChange={setCatalogEntryId}
            onManage={onManageCatalog}
          />
          <label className="grid gap-1">
            <span className="field-label">Description</span>
            <input
              className="field-input"
              value={description}
              maxLength={240}
              placeholder="Optional engineering description"
              onChange={(event) => setDescription(event.currentTarget.value)}
            />
          </label>
          {!catalogEntries.length ? (
            <div role="alert" className="flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <span>Set up the Wire Catalog before creating a new internal wire.</span>
              <button type="button" className="icon-button shrink-0" onClick={onManageCatalog}>
                Set up Wire Catalog
              </button>
            </div>
          ) : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button type="button" className="icon-button" onClick={onCancel}>Cancel</button>
          <button
            type="button"
            className="icon-button icon-button-primary"
            disabled={!selectedEntry}
            onClick={() => {
              if (!selectedEntry) return;
              onConfirm({
                from: from.ref,
                to: to.ref,
                endpointsSwapped: swapped,
                specification: createWireSpecificationSnapshot(selectedEntry),
                attributes: {
                  description: description.trim() || undefined
                }
              });
            }}
          >
            <Cable size={14} />
            Create wire
          </button>
        </div>
      </div>
    </div>
  );
}
