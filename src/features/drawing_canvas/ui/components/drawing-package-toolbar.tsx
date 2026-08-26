"use client";

import {
  Check,
  CheckCircle2,
  FileDown,
  LoaderCircle,
  PackageSearch,
  Save,
  Settings
} from "lucide-react";
import { DrawingPreviewMenu } from "./drawing-preview-menu";

export function DrawingPackageToolbar({
  title,
  viewMode,
  isDirty,
  isSaving,
  isPending,
  readOnly,
  approveDisabled,
  onOpenAssetManager,
  onOpenDrawingSettings,
  onSave,
  onPackagePreview,
  previewPdfHref,
  onApprove,
  onExitPreview
}: {
  title: string;
  viewMode: "edit" | "preview";
  isDirty: boolean;
  isSaving: boolean;
  isPending: boolean;
  readOnly: boolean;
  approveDisabled: boolean;
  onOpenAssetManager: () => void;
  onOpenDrawingSettings: () => void;
  onSave: () => void;
  onPackagePreview: () => void;
  previewPdfHref: string;
  onApprove: () => void;
  onExitPreview: () => void;
}) {
  return (
    <header className="tool-panel drawing-package-toolbar">
      <div className="drawing-package-toolbar-title">
        <h1 className="truncate text-lg font-semibold">{title}</h1>
      </div>

      {viewMode === "preview" ? (
        <div className="drawing-package-toolbar-actions">
          <a
            href={previewPdfHref}
            target="_blank"
            rel="noopener noreferrer"
            className="icon-button h-9"
            aria-disabled={isPending}
            tabIndex={isPending ? -1 : undefined}
            onClick={(event) => {
              if (isPending) event.preventDefault();
            }}
          >
            <FileDown aria-hidden="true" size={18} />
            Preview PDF
          </a>
          <button
            type="button"
            className="icon-button icon-button-primary h-9"
            onClick={onExitPreview}
          >
            Exit preview
          </button>
        </div>
      ) : (
        <div className="drawing-package-toolbar-row">
          <div className="drawing-package-toolbar-utilities">
            <button
              type="button"
              className="icon-button drawing-toolbar-icon-action"
              disabled={isPending}
              onClick={onOpenAssetManager}
              aria-label="Asset Manager"
              data-tooltip="Asset Manager"
            >
              <PackageSearch aria-hidden="true" size={18} />
            </button>
            <button
              type="button"
              className="icon-button drawing-toolbar-icon-action"
              disabled={isPending || readOnly}
              onClick={onOpenDrawingSettings}
              aria-label="Drawing Settings"
              data-tooltip="Drawing Settings"
            >
              <Settings aria-hidden="true" size={18} />
            </button>
          </div>
          <div className="drawing-package-toolbar-actions">
            <button
              type="button"
              className={[
                "icon-button h-9",
                !isDirty && !isSaving ? "drawing-save-current" : ""
              ].join(" ")}
              disabled={isPending || readOnly || !isDirty || isSaving}
              onClick={onSave}
              aria-label={
                isSaving ? "Saving drawing" : isDirty ? "Save" : "Drawing saved"
              }
              data-testid="drawing-save-state"
            >
              {isSaving ? (
                <LoaderCircle
                  aria-hidden="true"
                  size={18}
                  className="animate-spin"
                />
              ) : isDirty ? (
                <Save aria-hidden="true" size={18} />
              ) : (
                <Check aria-hidden="true" size={18} />
              )}
              {isSaving ? "Saving…" : isDirty ? "Save" : "Saved"}
            </button>
            <DrawingPreviewMenu
              disabled={isPending}
              onPackagePreview={onPackagePreview}
              previewPdfHref={previewPdfHref}
            />
            <button
              type="button"
              className="icon-button icon-button-primary h-9"
              disabled={isPending || approveDisabled}
              onClick={onApprove}
            >
              <CheckCircle2 aria-hidden="true" size={18} />
              Approve
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
