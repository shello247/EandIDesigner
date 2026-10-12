import Link from "next/link";
import { ChevronLeft, ChevronRight, ScanSearch } from "lucide-react";
import type { DrawingListPage } from "@/features/drawing_canvas/api/report-contracts";

const statusLabels = {
  draft: "Draft",
  needs_review: "Needs review",
  approved: "Approved",
  archived: "Archived"
} as const;

export function panelAnalysisPageHref(page: number): string {
  return page === 1 ? "/panel-analysis" : `/panel-analysis?page=${page}`;
}

export function PanelAnalysisDrawingTable({
  result
}: {
  result: DrawingListPage;
}) {
  if (result.items.length === 0) {
    return (
      <div className="tool-panel flex min-h-[260px] items-center justify-center p-8 text-center">
        <div>
          <h2 className="text-lg font-bold">No drawings available</h2>
          <p className="mt-2 max-w-md text-sm text-slate-600">
            Create and save a drawing package before running Panel Analysis.
          </p>
        </div>
      </div>
    );
  }

  const first = (result.page - 1) * result.pageSize + 1;
  const last = first + result.items.length - 1;

  return (
    <div className="tool-panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Drawing</th>
              <th>Project</th>
              <th>Status</th>
              <th>Sheets</th>
              <th>Saved</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {result.items.map((drawing) => (
              <tr key={drawing.id} className="hover:bg-slate-50">
                <td>
                  <Link
                    href={`/panel-analysis/${drawing.id}`}
                    prefetch={false}
                    className="font-bold text-slate-950 hover:text-teal-800"
                  >
                    {drawing.title}
                  </Link>
                  {drawing.description ? (
                    <p className="mt-1 max-w-xl text-xs text-slate-500">
                      {drawing.description}
                    </p>
                  ) : null}
                </td>
                <td>
                  {drawing.project ? (
                    <span className="font-semibold text-slate-700">
                      {drawing.project.projectNumber
                        ? `${drawing.project.projectNumber} — ${drawing.project.name}`
                        : drawing.project.name}
                    </span>
                  ) : (
                    <span className="text-slate-400">Unassigned</span>
                  )}
                </td>
                <td>{statusLabels[drawing.status]}</td>
                <td>{drawing.sheetCount}</td>
                <td>{new Date(drawing.updatedAt).toLocaleString()}</td>
                <td>
                  <Link
                    href={`/panel-analysis/${drawing.id}`}
                    prefetch={false}
                    className="icon-button min-h-8 px-2 py-1 text-xs"
                  >
                    <ScanSearch aria-hidden="true" size={14} /> Analyze
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <nav
        aria-label="Panel Analysis drawing pages"
        className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-xs text-slate-600"
      >
        <span>
          {first}–{last} of {result.totalCount} drawings
        </span>
        <div className="flex items-center gap-2">
          {result.page > 1 ? (
            <Link
              href={panelAnalysisPageHref(result.page - 1)}
              className="icon-button min-h-8 px-2 py-1 text-xs"
              aria-label="Previous Panel Analysis drawings page"
            >
              <ChevronLeft aria-hidden="true" size={14} /> Previous
            </Link>
          ) : (
            <span className="icon-button min-h-8 cursor-not-allowed px-2 py-1 text-xs opacity-50">
              <ChevronLeft aria-hidden="true" size={14} /> Previous
            </span>
          )}
          <span className="min-w-20 text-center font-medium text-slate-700">
            Page {result.page} of {result.totalPages}
          </span>
          {result.page < result.totalPages ? (
            <Link
              href={panelAnalysisPageHref(result.page + 1)}
              className="icon-button min-h-8 px-2 py-1 text-xs"
              aria-label="Next Panel Analysis drawings page"
            >
              Next <ChevronRight aria-hidden="true" size={14} />
            </Link>
          ) : (
            <span className="icon-button min-h-8 cursor-not-allowed px-2 py-1 text-xs opacity-50">
              Next <ChevronRight aria-hidden="true" size={14} />
            </span>
          )}
        </div>
      </nav>
    </div>
  );
}
