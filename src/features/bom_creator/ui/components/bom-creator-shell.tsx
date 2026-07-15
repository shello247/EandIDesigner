"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LibraryBig, Search } from "lucide-react";
import type { DrawingBomOption } from "@/features/drawing_canvas/api/public";

export function BomCreatorShell({
  drawings,
  selectedDrawingId,
}: {
  drawings: DrawingBomOption[];
  selectedDrawingId?: string;
}) {
  const router = useRouter();
  const [draftDrawingId, setDraftDrawingId] = useState(
    selectedDrawingId ?? drawings[0]?.id ?? ""
  );

  const openDrawingBom = () => {
    if (!draftDrawingId) {
      router.push("/bom");
      return;
    }

    router.push(`/bom?drawingId=${encodeURIComponent(draftDrawingId)}`);
  };

  return (
      <div className="tool-panel p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-72 flex-1">
            <label className="field-label" htmlFor="bom-drawing-select">
              Drawing package
            </label>
            <select
              id="bom-drawing-select"
              className="field-input"
              value={draftDrawingId}
              onChange={(event) => setDraftDrawingId(event.currentTarget.value)}
              disabled={drawings.length === 0}
            >
              {drawings.map((drawing) => (
                <option key={drawing.id} value={drawing.id}>
                  {drawing.title} / {drawing.drawingKey}
                </option>
              ))}
              {drawings.length === 0 ? (
                <option value="">No drawings available</option>
              ) : null}
            </select>
          </div>
          <button
            type="button"
            className="icon-button icon-button-primary"
            onClick={openDrawingBom}
            disabled={drawings.length === 0}
          >
            <Search aria-hidden="true" size={14} />
            Generate BOM
          </button>
          <Link href="/bom/items" className="icon-button">
            <LibraryBig aria-hidden="true" size={14} />
            Items library
          </Link>
        </div>
    </div>
  );
}
