"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import type { DrawingClientSummary } from "@/features/drawing_clients/api/public";
import type { DrawingProjectDetail } from "../../types";
import { DrawingProjectForm } from "./drawing-project-form";

export function ProjectEditButton({ project, clients }: {
  project: DrawingProjectDetail;
  clients: DrawingClientSummary[];
}) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className="icon-button" onClick={() => setOpen(true)}>
      <Pencil aria-hidden="true" size={16} /> Edit project
    </button>
    {open ? <DrawingProjectForm project={project} initialClients={clients}
      onClose={() => setOpen(false)} onSaved={() => setOpen(false)} /> : null}
  </>;
}
