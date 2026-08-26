"use client";

import { AlertTriangle, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { useState } from "react";
import type {
  SymbolMetadata,
  SymbolPermanentContinuityGroup
} from "../../data/schema";
import { validateSymbolElectricalTopology } from "../../logic/services/symbol-electrical-topology";

function cloneGroups(metadata: SymbolMetadata): SymbolPermanentContinuityGroup[] {
  return (metadata.electricalTopology?.permanentContinuityGroups ?? []).map(
    (group) => ({ ...group, terminalKeys: [...group.terminalKeys] })
  );
}

function nextGroupKey(groups: SymbolPermanentContinuityGroup[]): string {
  const keys = new Set(groups.map((group) => group.key));
  for (let index = 1; index <= groups.length + 20; index += 1) {
    const candidate = `continuity_${index}`;
    if (!keys.has(candidate)) return candidate;
  }
  return `continuity_${groups.length + 1}`;
}

export function SymbolElectricalTopologyPanel({
  metadata,
  readOnly,
  onChange
}: {
  metadata: SymbolMetadata;
  readOnly: boolean;
  onChange: (updater: (current: SymbolMetadata) => SymbolMetadata) => void;
}) {
  const groups = metadata.electricalTopology?.permanentContinuityGroups ?? [];
  const logicalTerminalKeys = [
    ...new Set(metadata.terminals.map((terminal) => terminal.key))
  ].sort((first, second) =>
    first.localeCompare(second, undefined, { numeric: true })
  );
  const [isOpen, setIsOpen] = useState(false);
  const [draftGroups, setDraftGroups] = useState<
    SymbolPermanentContinuityGroup[]
  >([]);
  const [issues, setIssues] = useState<string[]>([]);

  const openEditor = () => {
    setDraftGroups(cloneGroups(metadata));
    setIssues([]);
    setIsOpen(true);
  };

  const applyDraft = () => {
    const nextMetadata: SymbolMetadata = {
      ...metadata,
      electricalTopology:
        draftGroups.length > 0
          ? {
              version: 1,
              permanentContinuityGroups: draftGroups.map((group) => ({
                key: group.key.trim(),
                label: group.label?.trim() || undefined,
                terminalKeys: [...group.terminalKeys]
              }))
            }
          : undefined
    };
    const validation = validateSymbolElectricalTopology(nextMetadata);
    if (!validation.valid) {
      setIssues(validation.issues);
      return;
    }
    onChange((current) => ({
      ...current,
      electricalTopology: nextMetadata.electricalTopology
    }));
    setIsOpen(false);
  };

  return (
    <section className="tool-panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <h2 className="text-sm font-bold">Internal Electrical Topology</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Permanent factory conductors only. Do not group fuse, breaker, relay,
            or switched contact terminals.
          </p>
        </div>
        {!readOnly ? (
          <button type="button" className="icon-button" onClick={openEditor}>
            <Pencil aria-hidden="true" size={14} />
            Edit topology
          </button>
        ) : null}
      </div>
      {groups.length > 0 ? (
        <table className="data-table">
          <thead>
            <tr>
              <th>Group</th>
              <th>Label</th>
              <th>Terminals</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <tr key={group.key}>
                <td className="font-bold">{group.key}</td>
                <td>{group.label ?? "Permanent continuity"}</td>
                <td>{group.terminalKeys.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="px-4 py-3 text-xs text-slate-500">
          No permanent internal continuity declared.
        </div>
      )}

      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="electrical-topology-editor-title"
        >
          <div className="max-h-[88vh] w-full max-w-4xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div>
                <h2 id="electrical-topology-editor-title" className="text-[15px] font-semibold">
                  Edit permanent continuity
                </h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Select logical terminal keys that are joined by permanent
                  factory-installed copper.
                </p>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="Close electrical topology editor"
                onClick={() => setIsOpen(false)}
              >
                <X aria-hidden="true" size={14} />
              </button>
            </div>
            <div className="max-h-[60vh] space-y-3 overflow-auto p-5">
              {draftGroups.map((group, groupIndex) => (
                <div key={`${group.key}-${groupIndex}`} className="rounded-md border border-slate-200 p-4">
                  <div className="grid gap-3 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_auto]">
                    <div>
                      <label className="field-label" htmlFor={`topology-key-${groupIndex}`}>Group key</label>
                      <input
                        id={`topology-key-${groupIndex}`}
                        className="field-input"
                        value={group.key}
                        onChange={(event) => {
                          const nextKey = event.currentTarget.value;
                          setDraftGroups((current) =>
                            current.map((candidate, index) =>
                              index === groupIndex
                                ? { ...candidate, key: nextKey }
                                : candidate
                            )
                          );
                        }}
                      />
                    </div>
                    <div>
                      <label className="field-label" htmlFor={`topology-label-${groupIndex}`}>Label</label>
                      <input
                        id={`topology-label-${groupIndex}`}
                        className="field-input"
                        placeholder="Permanent continuity"
                        value={group.label ?? ""}
                        onChange={(event) => {
                          const nextLabel = event.currentTarget.value;
                          setDraftGroups((current) =>
                            current.map((candidate, index) =>
                              index === groupIndex
                                ? { ...candidate, label: nextLabel }
                                : candidate
                            )
                          );
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      className="icon-button icon-button-danger self-end"
                      aria-label={`Remove continuity group ${group.key}`}
                      onClick={() =>
                        setDraftGroups((current) =>
                          current.filter((_candidate, index) => index !== groupIndex)
                        )
                      }
                    >
                      <Trash2 aria-hidden="true" size={15} />
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                    {logicalTerminalKeys.map((terminalKey) => (
                      <label key={terminalKey} className="flex items-center gap-2 rounded border border-slate-200 px-2.5 py-2 text-xs font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={group.terminalKeys.includes(terminalKey)}
                          onChange={(event) => {
                            const isChecked = event.currentTarget.checked;
                            setDraftGroups((current) =>
                              current.map((candidate, index) =>
                                index === groupIndex
                                  ? {
                                      ...candidate,
                                      terminalKeys: isChecked
                                        ? [...candidate.terminalKeys, terminalKey]
                                        : candidate.terminalKeys.filter((key) => key !== terminalKey)
                                    }
                                  : candidate
                              )
                            );
                          }}
                        />
                        {terminalKey}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              {draftGroups.length === 0 ? (
                <div className="rounded-md border border-dashed border-slate-300 px-4 py-6 text-center text-xs text-slate-500">
                  Add a group when two or more terminals are permanently common.
                </div>
              ) : null}
              {issues.length > 0 ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  <div className="flex items-center gap-2 font-semibold">
                    <AlertTriangle aria-hidden="true" size={14} />
                    Topology needs attention
                  </div>
                  <ul className="mt-2 space-y-1">
                    {issues.map((issue) => <li key={issue}>{issue}</li>)}
                  </ul>
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
              <button
                type="button"
                className="icon-button"
                onClick={() =>
                  setDraftGroups((current) => [
                    ...current,
                    { key: nextGroupKey(current), terminalKeys: [] }
                  ])
                }
              >
                <Plus aria-hidden="true" size={14} />
                Add continuity group
              </button>
              <div className="flex gap-2">
                <button type="button" className="icon-button" onClick={() => setIsOpen(false)}>Cancel</button>
                <button type="button" className="icon-button icon-button-primary" onClick={applyDraft}>
                  <Save aria-hidden="true" size={14} />
                  Apply to draft
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
