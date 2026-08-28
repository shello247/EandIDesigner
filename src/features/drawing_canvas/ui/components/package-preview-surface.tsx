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
import type { PlacementWireContextDisplayRow } from "@/features/drawing_panel_wiring/api/public";
import {
  isConnectedWireScheduleAnnotation,
  type ConnectedWireScheduleIndex,
  type ConnectedWireScheduleProjection
} from "@/features/drawing_connected_wire_schedule/api/public";

type PackagePreviewSurfaceProps = {
  model: DrawingModel;
  sectionIndex: DrawingSectionIndex;
  drawingTitle: string;
  symbols: ApprovedDrawingSymbol[];
  placementWireContextRowsBySheetId?: ReadonlyMap<
    string,
    PlacementWireContextDisplayRow[]
  >;
  connectedWireScheduleProjections?: ConnectedWireScheduleIndex;
  onExitPreview: () => void;
  previewPdfHref: string;
};

const MAX_MOUNTED_PREVIEW_PAGES = 12;
const EMPTY_PLACEMENT_WIRE_CONTEXT_BY_SHEET = new Map<
  string,
  PlacementWireContextDisplayRow[]
>();
const EMPTY_CONNECTED_WIRE_SCHEDULE_PROJECTIONS = new Map<
  string,
  ConnectedWireScheduleProjection
>();

export function PackagePreviewSurface({
  model,
  sectionIndex,
  drawingTitle,
  symbols,
  placementWireContextRowsBySheetId = EMPTY_PLACEMENT_WIRE_CONTEXT_BY_SHEET,
  connectedWireScheduleProjections =
    EMPTY_CONNECTED_WIRE_SCHEDULE_PROJECTIONS,
  onExitPreview,
  previewPdfHref
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
          <a
            href={previewPdfHref}
            target="_blank"
            rel="noopener noreferrer"
            className="icon-button"
          >
            <FileDown aria-hidden="true" size={14} />
            Preview PDF
          </a>
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
            const placementWireContextRows =
              placementWireContextRowsBySheetId.get(sheet.id) ?? [];
            const placementWireContextCacheKey = placementWireContextRows
              .map(
                (row) =>
                  `${row.placementId}:${row.canonicalKind}:${row.canonicalId}:${row.anchorKey}:${row.physicalPosition ?? "inferred"}:${row.direction}:${row.wireId}:${row.externalTerminationId ?? ""}:${row.cableTag ?? ""}:${row.conductorKey ?? ""}`
              )
              .join("|");
            const connectedWireScheduleCacheKey = sheet.annotations
              .filter(isConnectedWireScheduleAnnotation)
              .map((annotation) => {
                const projection = connectedWireScheduleProjections.get(
                  annotation.id
                );
                const linkedAssetTag =
                  model.assets.find(
                    (asset) => asset.id === annotation.schedule.assetId
                  )?.tag ?? annotation.schedule.assetId;
                const rowSignature = projection?.rows
                  .map((row) =>
                    [
                      row.canonicalKind,
                      row.canonicalId,
                      row.wireId,
                      row.wireNumber ?? "",
                      row.from.assetTag,
                      row.from.terminalKey,
                      row.from.assetTitle ?? "",
                      row.from.terminalLabel ?? "",
                      row.from.terminalFunction ?? "",
                      row.to.assetTag,
                      row.to.terminalKey,
                      row.to.assetTitle ?? "",
                      row.to.terminalLabel ?? "",
                      row.to.terminalFunction ?? "",
                      row.specification?.name ?? "",
                      row.specification?.wireType ?? "",
                      row.specification?.size ?? "",
                      row.specification?.color ?? "",
                      row.description ?? ""
                    ].join(":")
                  )
                  .join(",") ?? "";
                const columnRatioSignature = annotation.schedule.columnRatios
                  ? Object.values(annotation.schedule.columnRatios).join(":")
                  : "default";
                return `${annotation.id}:${annotation.x}:${annotation.y}:${annotation.width}:${annotation.schedule.assetId}:${linkedAssetTag}:${annotation.schedule.sourcePlacementId}:${annotation.schedule.scope}:${columnRatioSignature}:${projection?.linkedOccurrenceAvailable ?? false}:${projection?.unresolvedCount ?? 0}:${rowSignature}`;
              })
              .join("|");

            return <PackagePreviewPage
              key={sheet.id}
              model={model}
              drawingTitle={drawingTitle}
              symbols={symbols}
              sheetId={sheet.id}
              sheetNumber={index + 1}
              sheetCount={model.sheets.length}
              derivedSectionNumber={derivedSectionNumber}
              placementWireContextRows={placementWireContextRows}
              connectedWireScheduleProjections={connectedWireScheduleProjections}
              cacheKey={`${sheet.id}:${index + 1}:${derivedSectionNumber ?? 0}:${model.measurementUnit}:${placementWireContextCacheKey}:${connectedWireScheduleCacheKey}`}
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
  placementWireContextRows,
  connectedWireScheduleProjections,
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
  placementWireContextRows: PlacementWireContextDisplayRow[];
  connectedWireScheduleProjections: ConnectedWireScheduleIndex;
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
        assets: model.assets,
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
        placementWireContextRows,
        connectedWireScheduleProjections,
        connectionVisibility: sheet.panelDrawingContext
          ? "panel_internal"
          : "field",
        measurementUnit: model.measurementUnit
      }), { sheetId });
    });
  }, [cacheKey, connectedWireScheduleProjections, derivedSectionNumber, drawingTitle, getCachedSvg, model, mounted, placementWireContextRows, sheet, sheetCount, sheetId, sheetNumber, symbols]);

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
