"use client";

import { Eye, Plus, Trash2, Unlink } from "lucide-react";
import type { PanelConnectionPatternCatalogRow } from "../../api/public";

export function PanelPatternWorkQueue({
  rows,
  activeSheetId,
  onSelectRoute,
  onAddRepresentation,
  onRemoveRepresentation,
  onDeletePattern
}: {
  rows: PanelConnectionPatternCatalogRow[];
  activeSheetId: string;
  onSelectRoute: (connectionId: string) => void;
  onAddRepresentation: (patternId: string) => void;
  onRemoveRepresentation: (patternId: string) => void;
  onDeletePattern: (patternId: string) => void;
}) {
  return (
    <div className="overflow-auto">
      <table className="w-full min-w-[980px] border-collapse text-left text-xs">
        <thead className="sticky top-0 bg-slate-50 text-slate-500">
          <tr>
            <th className="px-3 py-2 font-semibold">Pattern</th>
            <th className="px-3 py-2 font-semibold">Type / domain</th>
            <th className="px-3 py-2 font-semibold">Members</th>
            <th className="px-3 py-2 font-semibold">Owned wires</th>
            <th className="px-3 py-2 font-semibold">Sheets</th>
            <th className="px-3 py-2 font-semibold">Findings</th>
            <th className="px-3 py-2 text-right font-semibold">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {rows.map((row) => {
            const activeRoute = row.routeOccurrences.find(
              (route) => route.sheetId === activeSheetId
            );
            return (
              <tr key={row.patternId} className="align-top">
                <td className="px-3 py-3"><strong className="text-slate-900">{row.patternCode}</strong><div className="mt-1 text-slate-500">{row.displayLabel}</div></td>
                <td className="px-3 py-3 capitalize">{row.topology.replaceAll("_", " ")}<div className="mt-1 text-slate-500">{row.domain.replaceAll("_", " ")}</div></td>
                <td className="max-w-[280px] px-3 py-3">{row.memberLabels.join("; ") || "Panel reference"}</td>
                <td className="px-3 py-3 font-mono">{row.ownedWireIds.join(", ") || "-"}</td>
                <td className="px-3 py-3">{row.routeOccurrences.map((route) => `Sheet ${route.sheetNumber}`).join(", ") || "Unrepresented"}</td>
                <td className="max-w-[240px] px-3 py-3">{row.findings.length > 0 ? row.findings[0].message : "Ready"}</td>
                <td className="px-3 py-3">
                  <div className="flex justify-end gap-1">
                    {activeRoute ? (
                      <>
                        <button type="button" className="icon-button" title="Select route" onClick={() => onSelectRoute(activeRoute.connectionId)}><Eye aria-hidden="true" size={13} /></button>
                        <button type="button" className="icon-button" title="Remove this sheet representation" onClick={() => onRemoveRepresentation(row.patternId)}><Unlink aria-hidden="true" size={13} /></button>
                      </>
                    ) : (
                      <button type="button" className="icon-button" title="Add representation" onClick={() => onAddRepresentation(row.patternId)}><Plus aria-hidden="true" size={13} /> Add</button>
                    )}
                    <button type="button" className="icon-button text-rose-700" title="Delete physical pattern" onClick={() => onDeletePattern(row.patternId)}><Trash2 aria-hidden="true" size={13} /></button>
                  </div>
                </td>
              </tr>
            );
          })}
          {rows.length === 0 ? <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">No structured connection patterns yet.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}
