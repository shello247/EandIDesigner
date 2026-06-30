"use client";

import { Upload } from "lucide-react";
import type { SvgImportPreview } from "../../types";

function formatBytes(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SvgImportPanel({
  preview,
  isPending,
  onFileSelected
}: {
  preview: SvgImportPreview | null;
  isPending: boolean;
  onFileSelected: (file: File) => void;
}) {
  return (
    <section className="tool-panel overflow-hidden">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-bold">SVG Import</h2>
      </div>
      <div className="space-y-4 p-4">
        <div>
          <label className="field-label" htmlFor="svg-file">
            SVG file
          </label>
          <input
            id="svg-file"
            className="field-input"
            type="file"
            accept=".svg,image/svg+xml"
            disabled={isPending}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) {
                onFileSelected(file);
              }
            }}
          />
        </div>

        <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4">
          {preview ? (
            <dl className="grid gap-3 text-xs text-slate-600 sm:grid-cols-2">
              <div>
                <dt className="font-semibold text-slate-900">File</dt>
                <dd className="mt-1 break-all">{preview.sourceAsset.fileName}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-900">Size</dt>
                <dd className="mt-1">{formatBytes(preview.sourceAsset.sizeBytes)}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-900">ViewBox</dt>
                <dd className="mt-1">
                  {preview.viewBox.x} {preview.viewBox.y} {preview.viewBox.width}{" "}
                  {preview.viewBox.height}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-900">Detected anchors</dt>
                <dd className="mt-1">{preview.anchors.length}</dd>
              </div>
            </dl>
          ) : (
            <div className="flex min-h-28 items-center justify-center text-center text-sm text-slate-500">
              <div>
                <Upload
                  aria-hidden="true"
                  className="mx-auto mb-3 text-slate-400"
                  size={24}
                />
                Upload an SVG exported from Figma.
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
