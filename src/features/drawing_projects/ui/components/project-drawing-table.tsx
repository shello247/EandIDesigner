import Link from "next/link";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { DrawingDeleteButton } from "@/features/drawing_canvas/api/public-ui";
import type { DrawingProjectDrawingListPage } from "../../types";

function pageHref(projectId: string, page: number) {
  return page === 1
    ? `/projects/${projectId}`
    : `/projects/${projectId}?drawingPage=${page}`;
}

export function ProjectDrawingTable({
  projectId,
  result
}: {
  projectId: string;
  result: DrawingProjectDrawingListPage;
}) {
  const first = (result.page - 1) * result.pageSize + 1;
  const last = first + result.items.length - 1;
  return (
    <section className="tool-panel overflow-hidden">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-bold">Linked drawings</h2>
      </div>
      {result.items.length === 0 ? (
        <div className="flex min-h-40 items-center justify-center p-6 text-center text-sm text-slate-500">
          No drawings are linked to this Project.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Drawing</th>
                <th>Status</th>
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
                  <td className="capitalize">{drawing.status.replaceAll("_", " ")}</td>
                  <td>{new Date(drawing.updatedAt).toLocaleString()}</td>
                  <td>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/drawings/${drawing.id}`}
                        className="icon-button min-h-8 px-2 py-1 text-xs"
                      >
                        <ExternalLink aria-hidden="true" size={14} /> Open
                      </Link>
                      <DrawingDeleteButton drawingId={drawing.id} title={drawing.title} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <nav
        aria-label="Linked drawing pages"
        className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-xs text-slate-600"
      >
        <span>
          {result.totalCount === 0 ? "0" : `${first}–${last}`} of {result.totalCount} drawings
        </span>
        <div className="flex items-center gap-2">
          {result.page > 1 ? (
            <Link
              href={pageHref(projectId, result.page - 1)}
              className="icon-button min-h-8 px-2 py-1 text-xs"
              aria-label="Previous linked drawings page"
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
              href={pageHref(projectId, result.page + 1)}
              className="icon-button min-h-8 px-2 py-1 text-xs"
              aria-label="Next linked drawings page"
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
    </section>
  );
}

