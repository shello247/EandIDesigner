import Link from "next/link";
import { redirect } from "next/navigation";
import { FolderPlus } from "lucide-react";
import {
  listDrawingProjectPage,
  parseDrawingProjectPage,
  parseDrawingProjectStatus
} from "@/features/drawing_projects/api/server";
import { DrawingProjectTable } from "@/features/drawing_projects/ui/components/drawing-project-table";

export const dynamic = "force-dynamic";

export default async function ProjectsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const requestedPage = parseDrawingProjectPage(params.page);
  const status = parseDrawingProjectStatus(params.status);
  const result = await listDrawingProjectPage({ requestedPage, status });
  if (result.page !== requestedPage) {
    const query = new URLSearchParams();
    if (status === "archived") query.set("status", status);
    if (result.page > 1) query.set("page", String(result.page));
    const suffix = query.toString();
    redirect(suffix ? `/projects?${suffix}` : "/projects");
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-normal">Projects</h1>
          <p className="mt-1 text-sm text-slate-600">
            Group related drawing packages by engineering Project and client.
          </p>
        </div>
        <Link href="/projects/new" className="icon-button icon-button-primary">
          <FolderPlus aria-hidden="true" size={18} /> New Project
        </Link>
      </div>
      <DrawingProjectTable result={result} />
    </div>
  );
}

