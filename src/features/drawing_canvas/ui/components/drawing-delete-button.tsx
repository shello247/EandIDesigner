"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteDrawingAction } from "../../api/actions";

export function DrawingDeleteButton({
  drawingId,
  title
}: {
  drawingId: string;
  title: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const deleteDrawing = () => {
    if (!window.confirm(`Delete "${title}" permanently?`)) {
      return;
    }

    startTransition(async () => {
      const result = await deleteDrawingAction(drawingId);

      if (!result.ok) {
        window.alert(result.error);
        return;
      }

      router.refresh();
    });
  };

  return (
    <button
      type="button"
      className="icon-button icon-button-danger min-h-7 px-2 py-1 text-[12px]"
      disabled={isPending}
      onClick={deleteDrawing}
      aria-label={`Delete ${title}`}
    >
      <Trash2 aria-hidden="true" size={13} />
      Delete
    </button>
  );
}
