"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FolderInput, X } from "lucide-react";
import type {
  SheetLoaderGroup,
  SheetLoaderRow
} from "../../logic/services/sheet-loader-rows";

export function MoveSheetToSectionDialog({
  sheet,
  groups,
  onCancel,
  onMove
}: {
  sheet: SheetLoaderRow;
  groups: SheetLoaderGroup[];
  onCancel: () => void;
  onMove: (targetSectionId: string | "front_matter") => void;
}) {
  const titleId = "move-sheet-to-section-title";
  const currentGroup = groups.find(
    (group) => group.rows.some((row) => row.sheetId === sheet.sheetId)
  );
  const options = useMemo(
    () => [
      ...(currentGroup?.kind === "front_matter"
        ? []
        : [{ id: "front_matter", label: "Front Matter" }]),
      ...groups.flatMap((group) =>
        group.kind === "section" && group.id !== currentGroup?.id
          ? [
              {
                id: group.id,
                label: `Section ${group.sectionNumber} - ${group.title}`
              }
            ]
          : []
      )
    ],
    [currentGroup?.id, currentGroup?.kind, groups]
  );
  const [targetSectionId, setTargetSectionId] = useState<
    string | "front_matter"
  >(options[0]?.id ?? "front_matter");
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/20 p-4 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-700">
            <FolderInput aria-hidden="true" size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-sm font-semibold text-slate-950">
              Move sheet to section
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              {sheet.name} will be appended to the selected section.
            </p>
          </div>
          <button
            type="button"
            className="icon-button h-8 w-8 p-0"
            onClick={onCancel}
            aria-label="Close move sheet dialog"
          >
            <X aria-hidden="true" size={14} />
          </button>
        </div>
        <div className="px-5 py-4">
          <label className="field-label" htmlFor="move-sheet-target-section">
            Destination
          </label>
          <select
            id="move-sheet-target-section"
            className="field-input"
            value={targetSectionId}
            onChange={(event) => setTargetSectionId(event.currentTarget.value)}
          >
            {options.map((group) => (
              <option key={group.id} value={group.id}>
                {group.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button ref={cancelRef} type="button" className="icon-button" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="icon-button icon-button-primary"
            disabled={options.length === 0}
            onClick={() => onMove(targetSectionId)}
          >
            <FolderInput aria-hidden="true" size={14} />
            Move sheet
          </button>
        </div>
      </div>
    </div>
  );
}
