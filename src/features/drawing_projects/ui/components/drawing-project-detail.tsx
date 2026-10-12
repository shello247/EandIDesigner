import Link from "next/link";
import { FilePlus2 } from "lucide-react";
import type { DrawingClientSummary } from "@/features/drawing_clients/api/public";
import type {
  DrawingProjectDetail as DrawingProjectDetailType,
  DrawingProjectDrawingListPage
} from "../../types";
import { ProjectEditButton } from "./project-edit-button";
import { ProjectDrawingTable } from "./project-drawing-table";
import { ProjectStatusAction } from "./project-status-action";

export function DrawingProjectDetail({
  project,
  drawings,
  clients
}: {
  project: DrawingProjectDetailType;
  drawings: DrawingProjectDrawingListPage;
  clients: DrawingClientSummary[];
}) {
  return (
    <div className="space-y-5">
      <div className="flex min-w-0 flex-col gap-4">
        <div className="min-w-0 w-full">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-normal">{project.name}</h1>
            <span
              className={`rounded-full border px-2 py-0.5 text-xs font-semibold capitalize ${
                project.status === "active"
                  ? "border-teal-200 bg-teal-50 text-teal-800"
                  : "border-amber-200 bg-amber-50 text-amber-800"
              }`}
            >
              {project.status}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {project.projectNumber ?? "No project number"}
            {project.client ? ` · ${project.client}` : ""}
            {` · ${project.drawingCount} drawing${project.drawingCount === 1 ? "" : "s"}`}
          </p>
          {project.description ? <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-600">{project.description}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {project.status === "active" ? (
            <Link
              href={`/drawings/new?projectId=${encodeURIComponent(project.id)}`}
              className="icon-button icon-button-primary"
            >
              <FilePlus2 aria-hidden="true" size={16} /> New drawing for this Project
            </Link>
          ) : null}
          {project.status === "active" ? <ProjectEditButton project={project} clients={clients} /> : null}
          <ProjectStatusAction project={project} />
        </div>
      </div>
      <ProjectDrawingTable projectId={project.id} result={drawings} />
    </div>
  );
}
