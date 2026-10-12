"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Archive, ArchiveRestore } from "lucide-react";
import { setDrawingProjectStatusAction } from "../../api/actions";
import type { DrawingProjectDetail } from "../../types";

export function ProjectStatusAction({
  project
}: {
  project: DrawingProjectDetail;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>();
  const archive = project.status === "active";

  const updateStatus = () => {
    if (
      archive &&
      !window.confirm(
        "Archive this Project? Existing drawing links will remain, but new drawings cannot be assigned until it is restored."
      )
    ) {
      return;
    }
    setMessage(undefined);
    startTransition(async () => {
      const result = await setDrawingProjectStatusAction({
        projectId: project.id,
        status: archive ? "archived" : "active"
      });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="icon-button"
        disabled={isPending}
        onClick={updateStatus}
      >
        {archive ? (
          <Archive aria-hidden="true" size={15} />
        ) : (
          <ArchiveRestore aria-hidden="true" size={15} />
        )}
        {isPending ? "Updating…" : archive ? "Archive Project" : "Restore Project"}
      </button>
      {message ? (
        <span className="text-xs text-red-700" role="status">
          {message}
        </span>
      ) : null}
    </div>
  );
}

