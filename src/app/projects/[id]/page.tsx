import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  getDrawingProjectDetail,
  listProjectDrawingPage,
  parseDrawingProjectPage
} from "@/features/drawing_projects/api/server";
import { DrawingProjectDetail } from "@/features/drawing_projects/ui/components/drawing-project-detail";
import { listDrawingClients } from "@/features/drawing_clients/api/server";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const requestedPage = parseDrawingProjectPage(query.drawingPage);
  const [project, drawings, clients] = await Promise.all([
    getDrawingProjectDetail(id),
    listProjectDrawingPage({ projectId: id, requestedPage }),
    listDrawingClients()
  ]);
  if (!project) notFound();
  if (drawings.page !== requestedPage) {
    redirect(
      drawings.page === 1
        ? `/projects/${id}`
        : `/projects/${id}?drawingPage=${drawings.page}`
    );
  }
  return (
    <div className="space-y-4">
      <Link
        href="/projects"
        className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-teal-800"
      >
        <ArrowLeft aria-hidden="true" size={14} /> Project register
      </Link>
      <DrawingProjectDetail
        project={project}
        drawings={drawings}
        clients={clients}
      />
    </div>
  );
}
