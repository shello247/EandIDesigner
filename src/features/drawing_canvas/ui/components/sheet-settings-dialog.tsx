"use client";

import { useEffect, useRef, useState } from "react";
import { FilePenLine, X } from "lucide-react";
import type { CompatiblePanelOption } from "@/features/drawing_panel_wiring/api/public";
import {
  sheetSettingsDraftSchema,
  type DrawingPackageSheet,
  type SheetSettingsDraft
} from "../../data/schema";

export function SheetSettingsDialog({
  sheet,
  sheetNumber,
  sheetCount,
  sectionLabel,
  sectionMoveOptions,
  showPanelContext,
  panelOptions,
  panelContextWarning,
  onCancel,
  onApply
}: {
  sheet: DrawingPackageSheet;
  sheetNumber: number;
  sheetCount: number;
  sectionLabel: string;
  sectionMoveOptions: Array<{ id: string; label: string }>;
  showPanelContext: boolean;
  panelOptions: CompatiblePanelOption[];
  panelContextWarning?: string;
  onCancel: () => void;
  onApply: (settings: SheetSettingsDraft) => void;
}) {
  const isSectionTitlePage = sheet.kind === "section_title";
  const [name, setName] = useState(sheet.name);
  const [description, setDescription] = useState(sheet.description ?? "");
  const [sectionTitle, setSectionTitle] = useState(
    sheet.sectionTitlePage?.title ?? ""
  );
  const [sectionSubtitle, setSectionSubtitle] = useState(
    sheet.sectionTitlePage?.subtitle ?? ""
  );
  const [targetSectionId, setTargetSectionId] = useState("");
  const [panelAssetId, setPanelAssetId] = useState(
    sheet.panelDrawingContext?.panelAssetId ?? ""
  );
  const [error, setError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const titleId = "sheet-settings-dialog-title";
  const descriptionId = "sheet-settings-dialog-description";

  useEffect(() => {
    nameInputRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  const apply = () => {
    const parsed = sheetSettingsDraftSchema.safeParse({
      name,
      description: description.trim() || undefined,
      sectionTitlePage: isSectionTitlePage
        ? {
            title: sectionTitle.trim() || undefined,
            subtitle: sectionSubtitle.trim() || undefined
          }
        : undefined,
      targetSectionId: targetSectionId || undefined,
      panelAssetId:
        showPanelContext && panelAssetId ? panelAssetId : undefined
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Review the sheet settings.");
      return;
    }

    onApply(parsed.data);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/20 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
        onSubmit={(event) => {
          event.preventDefault();
          apply();
        }}
      >
        <div className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-700">
            <FilePenLine aria-hidden="true" size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-sm font-semibold text-slate-950">
              Edit Active Sheet
            </h2>
            <p id={descriptionId} className="mt-1 text-xs leading-5 text-slate-600">
              Sheet {sheetNumber} of {sheetCount}. Apply updates the local
              drawing draft.
            </p>
          </div>
          <button
            type="button"
            className="icon-button h-8 w-8 p-0"
            aria-label="Close sheet settings"
            onClick={onCancel}
          >
            <X aria-hidden="true" size={14} />
          </button>
        </div>

        <div className="max-h-[calc(90vh-9rem)] space-y-4 overflow-y-auto px-5 py-4">
          <div>
            <label className="field-label" htmlFor="sheet-settings-name">
              Sheet name
            </label>
            <input
              ref={nameInputRef}
              id="sheet-settings-name"
              className="field-input"
              value={name}
              maxLength={120}
              onChange={(event) => {
                setName(event.currentTarget.value);
                setError(null);
              }}
            />
          </div>

          {isSectionTitlePage ? (
            <>
              <div>
                <label className="field-label" htmlFor="sheet-settings-section-title">
                  Section title
                </label>
                <input
                  id="sheet-settings-section-title"
                  className="field-input"
                  value={sectionTitle}
                  maxLength={160}
                  onChange={(event) =>
                    setSectionTitle(event.currentTarget.value)
                  }
                />
              </div>
              <div>
                <label
                  className="field-label"
                  htmlFor="sheet-settings-section-subtitle"
                >
                  Subtitle / description
                </label>
                <textarea
                  id="sheet-settings-section-subtitle"
                  className="field-input min-h-24 resize-y leading-relaxed"
                  value={sectionSubtitle}
                  maxLength={400}
                  onChange={(event) =>
                    setSectionSubtitle(event.currentTarget.value)
                  }
                />
              </div>
            </>
          ) : (
            <div>
              <label className="field-label" htmlFor="sheet-settings-description">
                Description
              </label>
              <textarea
                id="sheet-settings-description"
                className="field-input min-h-24 resize-y leading-relaxed"
                value={description}
                maxLength={400}
                placeholder="Optional sheet description"
                onChange={(event) => setDescription(event.currentTarget.value)}
              />
            </div>
          )}

          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[11px] font-bold uppercase text-slate-500">
              Current package section
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {sectionLabel}
            </p>
          </div>

          {!isSectionTitlePage && sectionMoveOptions.length > 0 ? (
            <div>
              <label className="field-label" htmlFor="sheet-settings-section">
                Move to section
              </label>
              <select
                id="sheet-settings-section"
                className="field-input"
                value={targetSectionId}
                onChange={(event) =>
                  setTargetSectionId(event.currentTarget.value)
                }
              >
                <option value="">Keep current section</option>
                {sectionMoveOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {showPanelContext ? (
            <section className="border-t border-slate-200 pt-4">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Detailed panel context
              </h3>
              {panelContextWarning ? (
                <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  {panelContextWarning}
                </div>
              ) : null}
              <div className="mt-3">
                <label className="field-label" htmlFor="sheet-settings-panel">
                  Panel / enclosure
                </label>
                <select
                  id="sheet-settings-panel"
                  className="field-input"
                  value={panelAssetId}
                  disabled={panelOptions.length === 0}
                  onChange={(event) =>
                    setPanelAssetId(event.currentTarget.value)
                  }
                >
                  {!panelAssetId ? (
                    <option value="">Select a compatible asset</option>
                  ) : null}
                  {panelOptions.map((option) => (
                    <option key={option.assetId} value={option.assetId}>
                      {option.tag} / {option.title}
                    </option>
                  ))}
                </select>
              </div>
            </section>
          ) : null}

          {error ? (
            <div
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-800"
            >
              {error}
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button type="button" className="icon-button" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="icon-button icon-button-primary">
            Apply
          </button>
        </div>
      </form>
    </div>
  );
}
