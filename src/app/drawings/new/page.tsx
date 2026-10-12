import { NewDrawingPanel } from "@/features/drawing_canvas/ui/components/new-drawing-panel";
import { redirect } from "next/navigation";
import { listAssignableDrawingProjects } from "@/features/drawing_projects/api/server";

export const dynamic = "force-dynamic";

export default async function NewDrawingPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [params, projects] = await Promise.all([
    searchParams,
    listAssignableDrawingProjects()
  ]);
  const requestedProjectId = Array.isArray(params.projectId)
    ? params.projectId[0]
    : params.projectId;
  const initialProjectId = projects.some(
    (project) => project.id === requestedProjectId
  )
    ? requestedProjectId
    : undefined;
  if (!initialProjectId) redirect("/projects");
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-normal">New Drawing</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Start a blank A3 drawing package.
        </p>
      </div>

      <NewDrawingPanel projects={projects} initialProjectId={initialProjectId} />
    </div>
  );
}
