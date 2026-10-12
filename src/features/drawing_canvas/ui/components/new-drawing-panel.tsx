"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useTransition } from "react";
import { FilePlus2 } from "lucide-react";
import { createDrawingAction } from "../../api/actions";
import type { DrawingProjectAssignableOption } from "@/features/drawing_projects/api/public";

export function NewDrawingPanel({
  projects,
  initialProjectId
}: {
  projects: DrawingProjectAssignableOption[];
  initialProjectId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState("New Wiring Drawing");
  const projectId = initialProjectId;
  const project = projects.find((entry) => entry.id === projectId);
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const createBlank = () => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("title", title);
      formData.set("description", description);
      formData.set("projectId", projectId);
      const result = await createDrawingAction(formData);

      if (!result.ok) {
        setMessage(result.error);
        return;
      }

      router.push(`/drawings/${result.data.id}`);
      router.refresh();
    });
  };

  return (
    <div className="grid max-w-xl gap-5">
      <section className="tool-panel overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-bold">Blank Drawing</h2>
        </div>
        <div className="space-y-4 p-4">
          <div>
            <p className="field-label">Project</p>
            <Link href={`/projects/${encodeURIComponent(projectId)}`} className="text-sm font-semibold text-teal-700">
              {project?.projectNumber ? `${project.projectNumber} — ` : ""}{project?.name}
            </Link>
          </div>
          <div>
            <label className="field-label" htmlFor="title">
              Title
            </label>
            <input
              id="title"
              className="field-input"
              value={title}
              onChange={(event) => setTitle(event.currentTarget.value)}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="drawing-description">
              Description <span className="font-normal text-slate-400">Optional</span>
            </label>
            <textarea
              id="drawing-description"
              className="field-input min-h-24 resize-y"
              value={description}
              maxLength={500}
              onChange={(event) => setDescription(event.currentTarget.value)}
              placeholder="Purpose, scope, or engineering context"
            />
            <p className="mt-1 text-right text-xs text-slate-400">
              {description.length}/500
            </p>
          </div>
          <button
            type="button"
            className="icon-button icon-button-primary"
            disabled={isPending || !project}
            onClick={createBlank}
          >
            <FilePlus2 aria-hidden="true" size={15} />
            Create blank drawing
          </button>
        </div>
      </section>

      {message ? (
        <div className="tool-panel p-4 text-sm text-red-700">{message}</div>
      ) : null}
    </div>
  );
}
