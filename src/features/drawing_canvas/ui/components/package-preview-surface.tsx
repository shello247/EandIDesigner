"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, FileDown } from "lucide-react";
import type { DrawingModel } from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import { toSheetCanvasModel } from "../../logic/commands/drawing-sheet-commands";
import { renderDrawingToSvg } from "../../logic/services/drawing-svg-renderer";
import { getDrawingSheetPresentation } from "../../logic/services/drawing-sheet-presentation";
import { measureDrawingOperation } from "../../logic/services/drawing-performance-diagnostics";
import type { DrawingSectionIndex } from "../../logic/services/drawing-sections";
import type { PanelExternalTerminationDisplayRow } from "@/features/drawing_panel_wiring/api/public";

type PackagePreviewSurfaceProps = {
  model: DrawingModel;
  sectionIndex: DrawingSectionIndex;
  drawingTitle: string;
  symbols: ApprovedDrawingSymbol[];
  panelExternalTerminationsBySheetId?: ReadonlyMap<
    string,
    PanelExternalTerminationDisplayRow[]
  >;
  onExitPreview: () => void;
  onPreviewPdf: () => void;
};

const MAX_MOUNTED_PREVIEW_PAGES = 12;
const EMPTY_PANEL_EXTERNAL_TERMINATIONS_BY_SHEET = new Map<
  string,
  PanelExternalTerminationDisplayRow[]
>();

export function PackagePreviewSurface({
  model,
  sectionIndex,
  drawingTitle,
  symbols,
  panelExternalTerminationsBySheetId =
    EMPTY_PANEL_EXTERNAL_TERMINATIONS_BY_SHEET,
  onExitPreview,
  onPreviewPdf
}: PackagePreviewSurfaceProps) {
  const svgCacheRef = useRef<Map<string, string>>(new Map());
  const [mountedSheetIds, setMountedSheetIds] = useState<string[]>(() =>
    model.sheets.slice(0, 2).map((sheet) => sheet.id)
  );

  const handlePageProximityChange = useCallback(
    (sheetId: string, isNear: boolean) => {
      setMountedSheetIds((current) => {
        const withoutSheet = current.filter((candidate) => candidate !== sheetId);
        if (!isNear) return withoutSheet;
        return [...withoutSheet, sheetId].slice(-MAX_MOUNTED_PREVIEW_PAGES);
      });
    },
    []
  );

  const getCachedSvg = useCallback((sheetId: string, render: () => string) => {
    const svgCache = svgCacheRef.current;
    const cached = svgCache.get(sheetId);
    if (cached !== undefined) {
      svgCache.delete(sheetId);
      svgCache.set(sheetId, cached);
      return cached;
    }
    const svg = render();
    svgCache.set(sheetId, svg);
    while (svgCache.size > MAX_MOUNTED_PREVIEW_PAGES) {
      const oldest = svgCache.keys().next().value;
      if (oldest === undefined) break;
      svgCache.delete(oldest);
    }
    return svg;
  }, []);

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
          {model.sheets.map((sheet, index) => {
            const membership = sectionIndex.membershipBySheetId.get(sheet.id);
            const derivedSectionNumber =
              membership?.kind === "section"
                ? membership.sectionNumber
                : undefined;

            return <PackagePreviewPage
              key={sheet.id}
              model={model}
              drawingTitle={drawingTitle}
              symbols={symbols}
              sheetId={sheet.id}
              sheetNumber={index + 1}
              sheetCount={model.sheets.length}
              derivedSectionNumber={derivedSectionNumber}
              panelExternalTerminations={
                panelExternalTerminationsBySheetId.get(sheet.id) ?? []
              }
              cacheKey={`${sheet.id}:${index + 1}:${derivedSectionNumber ?? 0}`}
              mounted={mountedSheetIds.includes(sheet.id)}
              onProximityChange={handlePageProximityChange}
              getCachedSvg={getCachedSvg}
            />;
          })}
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
  cacheKey,
  sheetNumber,
  sheetCount,
  derivedSectionNumber,
  panelExternalTerminations,
  mounted,
  onProximityChange,
  getCachedSvg
}: {
  model: DrawingModel;
  drawingTitle: string;
  symbols: ApprovedDrawingSymbol[];
  sheetId: string;
  cacheKey: string;
  sheetNumber: number;
  sheetCount: number;
  derivedSectionNumber?: number;
  panelExternalTerminations: PanelExternalTerminationDisplayRow[];
  mounted: boolean;
  onProximityChange: (sheetId: string, isNear: boolean) => void;
  getCachedSvg: (sheetId: string, render: () => string) => string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sheet = model.sheets.find((candidate) => candidate.id === sheetId);
  const svg = useMemo(() => {
    if (!mounted || !sheet) {
      return "";
    }

    return getCachedSvg(cacheKey, () => {
      const sheetModel = toSheetCanvasModel(model, sheetId);
      const sectionTitle = sheet.sectionTitlePage?.title?.trim();

      return measureDrawingOperation("preview.svg", () => renderDrawingToSvg({
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
        sectionTitlePage: sheet.sectionTitlePage,
        derivedSectionNumber,
        panelInternalWires: model.panelWiring?.internalWires,
        panelConnectionPatterns: [
          ...(model.panelWiring?.bridges ?? []).map((record) => ({
            recordType: "bridge" as const,
            record
          })),
          ...(model.panelWiring?.bonds ?? []).map((record) => ({
            recordType: "bond" as const,
            record
          }))
        ],
        panelExternalTerminations,
        connectionVisibility: sheet.panelDrawingContext
          ? "panel_internal"
          : "field"
      }), { sheetId });
    });
  }, [cacheKey, derivedSectionNumber, drawingTitle, getCachedSvg, model, mounted, panelExternalTerminations, sheet, sheetCount, sheetId, sheetNumber, symbols]);

  useEffect(() => {
    const element = containerRef.current;

    if (!element) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        onProximityChange(
          sheetId,
          entries.some((entry) => entry.isIntersecting)
        );
      },
      { rootMargin: "1200px 0px" }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [onProximityChange, sheetId]);

  if (!sheet) {
    return null;
  }

  const typeLabel = getDrawingSheetPresentation(sheet).typeLabel;

  return (
    <article
      ref={containerRef}
      className="drawing-package-preview-page"
      data-testid="drawing-package-preview-page"
      data-preview-svg-mounted={svg ? "true" : "false"}
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
