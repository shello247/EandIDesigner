"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LibraryBig, Search } from "lucide-react";
import type { DrawingListItem } from "@/features/drawing_canvas/types";
import type { GeneratedDrawingBom } from "../../data/schema";
import { GeneratedBomTable } from "./generated-bom-table";

export function BomCreatorShell({
  drawings,
  selectedDrawingId,
  bom
}: {
  drawings: DrawingListItem[];
  selectedDrawingId?: string;
  bom?: GeneratedDrawingBom;
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
    <div className="space-y-5">
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

      {bom ? (
        <GeneratedBomTable bom={bom} />
      ) : (
        <div className="tool-panel flex min-h-[260px] items-center justify-center p-8 text-center">
          <div>
            <h2 className="text-lg font-bold">No drawing selected</h2>
            <p className="mt-2 max-w-md text-sm text-slate-600">
              Select a drawing package to generate its live BOM.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
