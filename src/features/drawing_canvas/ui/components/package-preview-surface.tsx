"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, FileDown } from "lucide-react";
import type { DrawingModel } from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import { toSheetCanvasModel } from "../../logic/commands/drawing-sheet-commands";
import { renderDrawingToSvg } from "../../logic/services/drawing-svg-renderer";
import { getDrawingSheetPresentation } from "../../logic/services/drawing-sheet-presentation";

type PackagePreviewSurfaceProps = {
  model: DrawingModel;
  drawingTitle: string;
  symbols: ApprovedDrawingSymbol[];
  onExitPreview: () => void;
  onPreviewPdf: () => void;
};

export function PackagePreviewSurface({
  model,
  drawingTitle,
  symbols,
  onExitPreview,
  onPreviewPdf
}: PackagePreviewSurfaceProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onExitPreview();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onExitPreview]);

  return (
    <section className="tool-panel drawing-package-preview-panel overflow-hidden">
      <div className="drawing-package-preview-header">
        <div className="min-w-0">
          <h2 className="text-sm font-bold">Package Preview</h2>
          <p className="mt-0.5 truncate text-xs font-medium text-slate-500">
            Read-only review. Editing tools are disabled while previewing{" "}
            {model.sheets.length} sheet{model.sheets.length === 1 ? "" : "s"}.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            className="icon-button"
            onClick={onPreviewPdf}
          >
            <FileDown aria-hidden="true" size={14} />
            Preview PDF
          </button>
          <button
            type="button"
            className="icon-button icon-button-primary"
            onClick={onExitPreview}
          >
            <ArrowLeft aria-hidden="true" size={14} />
            Exit preview
          </button>
        </div>
      </div>
      <div
        className="drawing-package-preview-viewport"
        data-testid="drawing-package-preview"
      >
        <div className="drawing-package-preview-stack">
          {model.sheets.map((sheet, index) => (
            <PackagePreviewPage
              key={sheet.id}
              model={model}
              drawingTitle={drawingTitle}
              symbols={symbols}
              sheetId={sheet.id}
              sheetNumber={index + 1}
              sheetCount={model.sheets.length}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function PackagePreviewPage({
  model,
  drawingTitle,
  symbols,
  sheetId,
  sheetNumber,
  sheetCount
}: {
  model: DrawingModel;
  drawingTitle: string;
  symbols: ApprovedDrawingSymbol[];
  sheetId: string;
  sheetNumber: number;
  sheetCount: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [shouldRender, setShouldRender] = useState(sheetNumber <= 2);
  const sheet = model.sheets.find((candidate) => candidate.id === sheetId);
  const svg = useMemo(() => {
    if (!shouldRender || !sheet) {
      return "";
    }

    const sheetModel = toSheetCanvasModel(model, sheetId);
    const sectionTitle = sheet.sectionTitlePage?.title?.trim();

    return renderDrawingToSvg({
      model: sheetModel,
      approvedSymbols: symbols,
      showAnchors: false,
      showConnections: true,
      sheetNumber,
      sheetCount,
      drawingTitle,
      sheetTitle:
        sheet.kind === "section_title" && sectionTitle
          ? sectionTitle
          : sheet.name,
      sheetKind: sheet.kind,
      sectionTitlePage: sheet.sectionTitlePage
    });
  }, [drawingTitle, model, sheet, sheetCount, sheetId, sheetNumber, shouldRender, symbols]);

  useEffect(() => {
    const element = containerRef.current;

    if (!element || shouldRender) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldRender(true);
        }
      },
      { rootMargin: "900px 0px" }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [shouldRender]);

  if (!sheet) {
    return null;
  }

  const typeLabel = getDrawingSheetPresentation(sheet).typeLabel;

  return (
    <article
      ref={containerRef}
      className="drawing-package-preview-page"
      data-testid="drawing-package-preview-page"
    >
      <div className="drawing-sheet-caption">
        <span className="drawing-sheet-caption-index">
          Sheet {sheetNumber} of {sheetCount}
        </span>
        <span className="drawing-sheet-caption-name">
          {sheet.name} / {typeLabel}
        </span>
      </div>
      <div
        className="drawing-package-preview-paper"
        style={{ aspectRatio: `${sheet.page.width} / ${sheet.page.height}` }}
      >
        {svg ? (
          <div dangerouslySetInnerHTML={{ __html: svg }} />
        ) : (
          <div className="drawing-package-preview-placeholder">
            Loading sheet {sheetNumber}
          </div>
        )}
      </div>
    </article>
  );
}
