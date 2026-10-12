import Link from "next/link";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import type {
  DrawingProjectListPage
} from "../../types";
import type { DrawingProjectStatus } from "../../data/schema";

function pageHref(status: DrawingProjectStatus, page: number) {
  const params = new URLSearchParams();
  if (status === "archived") params.set("status", status);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/projects?${query}` : "/projects";
}

export function DrawingProjectTable({
  result
}: {
  result: DrawingProjectListPage;
}) {
  const first = (result.page - 1) * result.pageSize + 1;
  const last = first + result.items.length - 1;

  return (
    <section className="tool-panel overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <h2 className="text-sm font-bold">Project register</h2>
          <p className="mt-1 text-xs text-slate-500">
            Organize drawing packages without changing their printed title blocks.
          </p>
        </div>
        <div className="flex rounded-md border border-slate-200 bg-slate-50 p-1 text-xs font-semibold">
          {(["active", "archived"] as const).map((status) => (
            <Link
              key={status}
              href={pageHref(status, 1)}
              className={`rounded px-3 py-1.5 capitalize ${
                result.status === status
                  ? "bg-white text-teal-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {status}
            </Link>
          ))}
        </div>
      </div>

      {result.items.length === 0 ? (
        <div className="flex min-h-56 items-center justify-center p-8 text-center">
          <div>
            <h3 className="font-bold text-slate-900">
              No {result.status} Projects
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              {result.status === "active"
                ? "Create a Project or continue creating unassigned drawings."
                : "Archived Projects will remain available here with their drawing links."}
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Client</th>
                <th>Drawings</th>
                <th>Status</th>
                <th>Updated</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((project) => (
                <tr key={project.id} className="hover:bg-slate-50">
                  <td>
                    <Link
                      href={`/projects/${project.id}`}
                      className="font-bold text-slate-950 hover:text-teal-800"
                    >
                      {project.projectNumber ? `${project.projectNumber} — ` : ""}
                      {project.name}
                    </Link>
                    {project.description ? (
                      <p className="mt-1 max-w-xl text-xs text-slate-500">
                        {project.description}
                      </p>
                    ) : null}
                  </td>
                  <td>{project.client ?? "—"}</td>
                  <td>{project.drawingCount}</td>
                  <td className="capitalize">{project.status}</td>
                  <td>{new Date(project.updatedAt).toLocaleString()}</td>
                  <td>
                    <Link
                      href={`/projects/${project.id}`}
                      className="icon-button min-h-8 px-2 py-1 text-xs"
                    >
                      <ExternalLink aria-hidden="true" size={14} />
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <nav
        aria-label="Project register pages"
        className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-xs text-slate-600"
      >
        <span>
          {result.totalCount === 0 ? "0" : `${first}–${last}`} of {result.totalCount} Projects
        </span>
        <div className="flex items-center gap-2">
          {result.page > 1 ? (
            <Link
              href={pageHref(result.status, result.page - 1)}
              className="icon-button min-h-8 px-2 py-1 text-xs"
              aria-label="Previous Projects page"
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
              href={pageHref(result.status, result.page + 1)}
              className="icon-button min-h-8 px-2 py-1 text-xs"
              aria-label="Next Projects page"
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
