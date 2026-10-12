import { ChevronLeft, ChevronRight } from "lucide-react";
import type { FilteredPanelAnalysisFindingGroup } from "../../logic/services/panel-analysis-filtering";
import type { PanelAnalysisCoverage } from "../../types";
import { PanelAnalysisFindingCard } from "./panel-analysis-finding-card";

export const PANEL_ANALYSIS_FINDING_PAGE_SIZE = 20;

export function PanelAnalysisFindingList({
  drawingId,
  items,
  coverage,
  hasFilters,
  page,
  onPageChange
}: {
  drawingId: string;
  items: readonly FilteredPanelAnalysisFindingGroup[];
  coverage: PanelAnalysisCoverage;
  hasFilters: boolean;
  page: number;
  onPageChange: (page: number) => void;
}) {
  if (items.length === 0) {
    const state = hasFilters
      ? { title: "No findings match these filters", message: "Clear or change the filters to review the remaining analysis findings." }
      : coverage.status === "not_evaluated" || coverage.unavailableRules > 0
        ? { title: "Checks could not run", message: "The package does not contain enough verified engineering evidence to complete the applicable checks." }
        : coverage.applicableRules === 0
          ? { title: "No applicable checks", message: "None of the current Panel Analysis rules apply to this drawing package." }
          : { title: "No findings detected", message: "All applicable evaluated checks passed for this saved revision." };
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
        <h3 className="text-sm font-bold">{state.title}</h3>
        <p className="mt-2 text-xs text-slate-600">{state.message}</p>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(items.length / PANEL_ANALYSIS_FINDING_PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const firstIndex = (safePage - 1) * PANEL_ANALYSIS_FINDING_PAGE_SIZE;
  const pageItems = items.slice(firstIndex, firstIndex + PANEL_ANALYSIS_FINDING_PAGE_SIZE);
  const findingCount = items.reduce((total, item) => total + item.findings.length, 0);

  return (
    <section aria-label="Panel Analysis findings">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>{items.length} root causes · {findingCount} matching findings</span>
        <span>Page {safePage} of {totalPages}</span>
      </div>
      <div className="space-y-3">
        {pageItems.map((item) => (
          <PanelAnalysisFindingCard key={item.group.id} drawingId={drawingId} item={item} />
        ))}
      </div>
      {totalPages > 1 ? (
        <nav aria-label="Finding pages" className="mt-4 flex items-center justify-end gap-2">
          <button type="button" className="icon-button" disabled={safePage === 1} onClick={() => onPageChange(safePage - 1)}>
            <ChevronLeft aria-hidden="true" size={14} /> Previous
          </button>
          <span className="min-w-24 text-center text-xs font-semibold text-slate-600">Page {safePage} of {totalPages}</span>
          <button type="button" className="icon-button" disabled={safePage === totalPages} onClick={() => onPageChange(safePage + 1)}>
            Next <ChevronRight aria-hidden="true" size={14} />
          </button>
        </nav>
      ) : null}
    </section>
  );
}
