import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { DrawingListItem, DrawingListPage } from "../../types";
import { DrawingDeleteButton } from "./drawing-delete-button";

const statusLabels: Record<DrawingListItem["status"], string> = {
  draft: "Draft",
  needs_review: "Needs review",
  approved: "Approved",
  archived: "Archived"
};

function drawingPageHref(page: number) {
  return page === 1 ? "/drawings" : `/drawings?page=${page}`;
}

export function DrawingTable({ result }: { result: DrawingListPage }) {
  if (result.items.length === 0) {
    return (
      <div className="tool-panel flex min-h-[260px] items-center justify-center p-8 text-center">
        <div>
          <h2 className="text-lg font-bold">No drawings yet</h2>
          <p className="mt-2 max-w-md text-sm text-slate-600">
            Create a drawing, place symbols, connect anchors, and save
            a structured engineering sheet.
          </p>
        </div>
      </div>
    );
  }

  const firstItemNumber = (result.page - 1) * result.pageSize + 1;
  const lastItemNumber = firstItemNumber + result.items.length - 1;

  return (
    <div className="tool-panel overflow-hidden">
      <table className="data-table">
        <thead>
          <tr>
            <th>Drawing</th>
            <th>Project</th>
            <th>Status</th>
            <th>Sheets</th>
            <th>Updated</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {result.items.map((drawing) => (
            <tr key={drawing.id} className="hover:bg-slate-50">
              <td>
                <Link
                  href={`/drawings/${drawing.id}`}
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
                  <div>
                    <Link
                      href={`/projects/${drawing.project.id}`}
                      className="font-semibold text-slate-700 hover:text-teal-800"
                    >
                      {drawing.project.projectNumber
                        ? `${drawing.project.projectNumber} — ${drawing.project.name}`
                        : drawing.project.name}
                    </Link>
                    {drawing.project.status === "archived" ? (
                      <span className="mt-1 block text-xs font-medium text-amber-700">
                        Archived
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <span className="text-slate-400">Unassigned</span>
                )}
              </td>
              <td>{statusLabels[drawing.status]}</td>
              <td>{drawing.sheetCount}</td>
              <td>{new Date(drawing.updatedAt).toLocaleString()}</td>
              <td>
                <DrawingDeleteButton
                  drawingId={drawing.id}
                  title={drawing.title}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <nav
        aria-label="Drawing list pages"
        className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-xs text-slate-600"
      >
        <span>
          {firstItemNumber}–{lastItemNumber} of {result.totalCount} drawings
        </span>
        <div className="flex items-center gap-2">
          {result.page > 1 ? (
            <Link
              href={drawingPageHref(result.page - 1)}
              className="icon-button min-h-8 px-2 py-1 text-xs"
              aria-label="Previous drawings page"
            >
              <ChevronLeft aria-hidden="true" size={14} />
              Previous
            </Link>
          ) : (
            <span
              className="icon-button min-h-8 cursor-not-allowed px-2 py-1 text-xs opacity-50"
              aria-hidden="true"
            >
              <ChevronLeft aria-hidden="true" size={14} />
              Previous
            </span>
          )}
          <span className="min-w-20 text-center font-medium text-slate-700">
            Page {result.page} of {result.totalPages}
          </span>
          {result.page < result.totalPages ? (
            <Link
              href={drawingPageHref(result.page + 1)}
              className="icon-button min-h-8 px-2 py-1 text-xs"
              aria-label="Next drawings page"
            >
              Next
              <ChevronRight aria-hidden="true" size={14} />
            </Link>
          ) : (
            <span
              className="icon-button min-h-8 cursor-not-allowed px-2 py-1 text-xs opacity-50"
              aria-hidden="true"
            >
              Next
              <ChevronRight aria-hidden="true" size={14} />
            </span>
          )}
        </div>
      </nav>
    </div>
  );
}
