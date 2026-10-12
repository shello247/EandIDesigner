import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DrawingProjectForm } from "@/features/drawing_projects/ui/components/drawing-project-form";
import { listDrawingClients } from "@/features/drawing_clients/api/server";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  const clients = await listDrawingClients();
  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <Link
          href="/projects"
          className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-teal-800"
        >
          <ArrowLeft aria-hidden="true" size={14} /> Project register
        </Link>
        <h1 className="text-xl font-semibold tracking-normal">New Project</h1>
        <p className="mt-1 text-sm text-slate-600">
          Create an organizational home for related drawing packages.
        </p>
      </div>
      <DrawingProjectForm initialClients={clients} />
    </div>
  );
}
