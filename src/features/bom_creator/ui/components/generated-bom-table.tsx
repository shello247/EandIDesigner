import Link from "next/link";
import { AlertTriangle, Boxes, ClipboardList } from "lucide-react";
import type { GeneratedBomLine } from "../../data/schema";
import {
  buildGeneratedBomViewUrl,
  type GeneratedBomViewKind,
  type GeneratedBomViewModel
} from "../../logic/services/generated-bom-view";

function formatQuantity(line: GeneratedBomLine): string {
  if (line.quantityStatus === "manual_required") {
    return "Manual";
  }

  if (line.quantityStatus === "unavailable" || line.quantity === undefined) {
    return "-";
  }

  return Number.isInteger(line.quantity)
    ? String(line.quantity)
    : line.quantity.toFixed(3).replace(/0+$/g, "").replace(/\.$/, "");
}

function label(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function viewUrl(
  bom: GeneratedBomViewModel,
  view: GeneratedBomViewKind,
  page = 1
) {
  return buildGeneratedBomViewUrl({
    drawingId: bom.drawingId,
    view,
    page,
    pageSize: view === bom.view ? bom.pageSize : undefined
  });
}

function Pagination({ bom }: { bom: GeneratedBomViewModel }) {
  if (bom.totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
      <div className="text-xs font-semibold text-slate-500">
        Page {bom.page} of {bom.totalPages}
      </div>
      <div className="flex gap-2">
        {bom.page > 1 ? (
          <Link className="icon-button" href={viewUrl(bom, bom.view, bom.page - 1)}>
            Previous
          </Link>
        ) : (
          <span className="icon-button cursor-not-allowed opacity-50">Previous</span>
        )}
        {bom.page < bom.totalPages ? (
          <Link className="icon-button" href={viewUrl(bom, bom.view, bom.page + 1)}>
            Next
          </Link>
        ) : (
          <span className="icon-button cursor-not-allowed opacity-50">Next</span>
        )}
      </div>
    </div>
  );
}

export function GeneratedBomTable({ bom }: { bom: GeneratedBomViewModel }) {
  const tabs: Array<{
    view: GeneratedBomViewKind;
    label: string;
    count: number;
  }> = [
    { view: "consolidated", label: "Consolidated", count: bom.consolidatedLineCount },
    { view: "assembly", label: "Assembly", count: bom.assemblyCount },
    { view: "review", label: "Review", count: bom.warningCount }
  ];

  return (
    <div className="space-y-5" data-testid={`generated-bom-view-${bom.view}`}>
      {bom.warningCount > 0 ? (
        <div className="tool-panel overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div className="flex items-center gap-2">
              <AlertTriangle aria-hidden="true" className="text-amber-700" size={15} />
              <h2>BOM Review</h2>
            </div>
            <Link className="text-xs font-semibold text-teal-700" href={viewUrl(bom, "review")}>
              Review details
            </Link>
          </div>
          <div className="flex flex-wrap gap-2 p-3">
            {bom.warningSummary.map((warning) => (
              <span
                key={warning.code}
                className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800"
              >
                {label(warning.code)}: {warning.count}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="tool-panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div>
            <h2>{bom.drawingTitle}</h2>
            <p className="mt-1 text-xs text-slate-500">
              {bom.assemblyCount} assemblies / {bom.consolidatedLineCount} purchasing lines
            </p>
          </div>
          <div className="flex flex-wrap gap-1" role="tablist" aria-label="BOM views">
            {tabs.map((tab) => (
              <Link
                key={tab.view}
                href={viewUrl(bom, tab.view)}
                role="tab"
                aria-selected={bom.view === tab.view}
                className={[
                  "icon-button",
                  bom.view === tab.view ? "icon-button-primary" : ""
                ].join(" ")}
              >
                {tab.view === "assembly" ? (
                  <Boxes aria-hidden="true" size={14} />
                ) : (
                  <ClipboardList aria-hidden="true" size={14} />
                )}
                {tab.label} ({tab.count})
              </Link>
            ))}
          </div>
        </div>

        {bom.view === "consolidated" ? (
          bom.consolidatedLines.length === 0 ? (
            <div className="p-6 text-sm text-slate-600">No linked BOM items were generated.</div>
          ) : (
            <div>
              <div className="border-b border-slate-200 px-4 py-3"><h2>Consolidated BOM</h2></div>
              <div className="overflow-auto">
              <table className="data-table" data-testid="consolidated-bom-table">
                <thead>
                  <tr>
                    <th>Item</th><th>Category</th><th>Qty</th><th>Unit</th>
                    <th>Manufacturer</th><th>Part</th><th>Source Assets</th>
                  </tr>
                </thead>
                <tbody>
                  {bom.consolidatedLines.map((line) => (
                    <tr key={line.id}>
                      <td><div className="font-bold text-slate-950">{line.displayName}</div><div className="mt-1 text-xs text-slate-500">{line.itemKey}</div></td>
                      <td className="capitalize">{line.category.replace(/_/g, " ")}</td>
                      <td className="font-semibold">{formatQuantity(line)}</td>
                      <td>{line.unit}</td><td>{line.manufacturer ?? "-"}</td><td>{line.partNumber ?? "-"}</td>
                      <td>
                        {line.sourceAssetPreview.join(", ")}
                        {line.sourceAssetCount > line.sourceAssetPreview.length
                          ? ` +${line.sourceAssetCount - line.sourceAssetPreview.length} more`
                          : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )
        ) : null}

        {bom.view === "assembly" ? (
          <div>
            <div className="border-b border-slate-200 px-4 py-3"><h2>Assembly View</h2></div>
            <div className="divide-y divide-slate-200">
            {bom.assemblies.map((assembly) => (
              <section key={assembly.assetId} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><h3 className="text-sm font-bold text-slate-950">{assembly.assetTag}</h3><div className="mt-1 text-xs text-slate-500">{assembly.title} / {assembly.assetType.replace(/_/g, " ")}{assembly.symbolName ? ` / ${assembly.symbolName}` : ""}</div></div>
                  <div className="text-xs font-semibold text-slate-500">{assembly.sheetRefs.length > 0 ? assembly.sheetRefs.map((ref) => `S${ref.sheetNumber} ${ref.sheetName}`).join(", ") : "Unplaced"}</div>
                </div>
                {assembly.warnings.length > 0 ? <div className="mt-3 grid gap-2">{assembly.warnings.map((warning, index) => <div key={`${warning.code}-${index}`} className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{warning.message}</div>)}</div> : null}
                {assembly.lines.length > 0 ? <div className="mt-3 overflow-auto"><table className="data-table" data-testid="assembly-bom-table"><thead><tr><th>Item</th><th>Rule</th><th>Qty</th><th>Unit</th></tr></thead><tbody>{assembly.lines.map((line) => <tr key={line.id}><td><div className="font-semibold">{line.displayName}</div><div className="mt-1 text-xs text-slate-500">{line.itemKey}</div></td><td>{label(line.quantityRule)}</td><td className="font-semibold">{formatQuantity(line)}</td><td>{line.unit}</td></tr>)}</tbody></table></div> : null}
              </section>
            ))}
            </div>
          </div>
        ) : null}

        {bom.view === "review" ? (
          bom.warnings.length === 0 ? (
            <div className="p-6 text-sm text-slate-600">No BOM warnings were generated.</div>
          ) : (
            <div>
              <div className="border-b border-slate-200 px-4 py-3"><h2>Warning Details</h2></div>
              <div className="divide-y divide-slate-200" data-testid="bom-warning-list">
              {bom.warnings.map((warning, index) => (
                <div key={`${warning.code}-${warning.assetId ?? "global"}-${index}`} className="px-4 py-3">
                  <div className="text-xs font-semibold text-amber-700">{label(warning.code)}</div>
                  <div className="mt-1 text-xs text-slate-600">{warning.message}</div>
                </div>
              ))}
              </div>
            </div>
          )
        ) : null}

        <Pagination bom={bom} />
      </div>
    </div>
  );
}
