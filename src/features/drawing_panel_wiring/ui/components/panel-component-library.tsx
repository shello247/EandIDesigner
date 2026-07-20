"use client";

import { AlertTriangle, ChevronDown, ChevronRight, Plus } from "lucide-react";
import { useState } from "react";
import type {
  PanelComponentPaletteGroup,
  PanelComponentPaletteRow
} from "../../api/public";

const GROUP_LABELS: Record<PanelComponentPaletteGroup, string> = {
  circuit_protection: "Circuit Protection",
  relays: "Relays",
  power: "Power",
  control_io: "Control and I/O",
  isolation_conversion: "Isolation and Conversion",
  terminal_blocks: "Terminal Blocks",
  earth_ground: "Earth / Ground",
  instruments: "Instrumentation",
  other: "Other"
};

export function PanelComponentLibrary({
  rows,
  onAdd
}: {
  rows: PanelComponentPaletteRow[];
  onAdd: (row: PanelComponentPaletteRow) => void;
}) {
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set());
  const groups = rows.reduce(
    (catalog, row) => {
      (catalog[row.group] ??= []).push(row);
      return catalog;
    },
    {} as Partial<Record<PanelComponentPaletteGroup, PanelComponentPaletteRow[]>>
  );

  const toggle = (group: string) => {
    setOpenGroups((current) => {
      const next = new Set(current);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  };

  return (
    <section className="tool-panel overflow-hidden">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-bold">Panel Component Library</h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Approved schematic components for this Detailed Panel Drawing.
        </p>
      </div>
      <div className="max-h-[520px] space-y-2 overflow-auto p-4">
        {(Object.keys(groups) as PanelComponentPaletteGroup[]).map((group) => {
          const groupRows = groups[group] ?? [];
          const isOpen = openGroups.has(group);
          return (
            <div key={group}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 rounded-md px-1 py-1 text-left text-xs font-semibold text-slate-600 hover:bg-slate-50"
                aria-expanded={isOpen}
                onClick={() => toggle(group)}
              >
                <span className="inline-flex items-center gap-1.5">
                  {isOpen ? (
                    <ChevronDown aria-hidden="true" size={13} />
                  ) : (
                    <ChevronRight aria-hidden="true" size={13} />
                  )}
                  {GROUP_LABELS[group]}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-500">
                  {groupRows.length}
                </span>
              </button>
              {isOpen ? (
                <div className="mt-2 space-y-2">
                  {groupRows.map((row) => {
                    const disabled = row.status === "blocked";
                    const reason = row.blockingReasons[0];
                    return (
                      <button
                        key={row.versionId}
                        type="button"
                        className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-xs transition enabled:hover:border-teal-200 enabled:hover:bg-teal-50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                        disabled={disabled}
                        title={reason}
                        onClick={() => onAdd(row)}
                      >
                        <span className="flex items-start justify-between gap-2">
                          <span className="min-w-0">
                            <span className="block text-[12px] font-semibold leading-snug text-slate-950">
                              {row.displayName}
                            </span>
                            <span className="mt-1 block text-[10px] text-slate-500">
                              {row.terminals.length} terminal{row.terminals.length === 1 ? "" : "s"}
                              {row.warnings.length > 0 ? " / Layout dimensions missing" : ""}
                            </span>
                            {reason ? (
                              <span className="mt-1 flex items-start gap-1 text-[10px] text-amber-700">
                                <AlertTriangle aria-hidden="true" className="mt-0.5 shrink-0" size={11} />
                                {reason}
                              </span>
                            ) : null}
                          </span>
                          <Plus aria-hidden="true" className="shrink-0 text-teal-700" size={14} />
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
        {rows.length === 0 ? (
          <p className="text-xs leading-5 text-slate-500">
            No approved Detailed Panel component symbols are available. Enable
            the capability from Symbol Registry.
          </p>
        ) : null}
      </div>
    </section>
  );
}
