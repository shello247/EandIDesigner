"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type WheelEvent
} from "react";
import {
  ChevronDown,
  ChevronUp,
  ChevronsDown,
  Copy,
  FilePlus2,
  Maximize2,
  Minus,
  Plus,
  StickyNote,
  Trash2
} from "lucide-react";
import type { ApprovedNetworkSymbol } from "../../types";
import type {
  NetworkMapAnnotation,
  NetworkMapModel,
  NetworkMapSheet
} from "../../data/schema";
import { renderNetworkMapSheetToSvg } from "../../logic/services/network-svg-renderer";

const SHEET_PIXEL_SCALE = 2;
const MIN_ZOOM = 0.35;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.15;

type RenderedNetworkSheet = {
  sheet: NetworkMapSheet;
  sheetNumber: number;
  sheetCount: number;
  svg: string;
  stageWidth: number;
  stageHeight: number;
};

type PanState = {
  pointerId: number;
  startPointerX: number;
  startPointerY: number;
  startScrollLeft: number;
  startScrollTop: number;
};

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(value.toFixed(3))));
}

function formatZoom(zoom: number): string {
  return `${Math.round(zoom * 100)}%`;
}

function annotationWidth(annotation: NetworkMapAnnotation): number {
  return annotation.width ?? 80;
}

function annotationHeight(annotation: NetworkMapAnnotation): number {
  return annotation.height ?? 22;
}

function NetworkMapAddMenu({
  onAddSheet,
  onAddNote
}: {
  onAddSheet: () => void;
  onAddNote: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const runAction = (action: () => void) => {
    action();
    setIsOpen(false);
  };

  return (
    <div className="drawing-canvas-add-menu">
      <button
        type="button"
        className="drawing-canvas-add-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <Plus aria-hidden="true" size={15} />
        <span>Add</span>
        <ChevronDown aria-hidden="true" size={13} />
      </button>
      {isOpen ? (
        <div className="drawing-canvas-add-menu-panel" role="menu">
          <button
            type="button"
            className="drawing-canvas-add-menu-item"
            role="menuitem"
            onClick={() => runAction(onAddSheet)}
          >
            <FilePlus2 aria-hidden="true" size={15} />
            <span>Sheet</span>
          </button>
          <button
            type="button"
            className="drawing-canvas-add-menu-item"
            role="menuitem"
            onClick={() => runAction(onAddNote)}
          >
            <StickyNote aria-hidden="true" size={15} />
            <span>Note</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

const NetworkSheetFrame = memo(function NetworkSheetFrame({
  renderedSheet,
  activeSheetId,
  selectedAnnotationId,
  zoom,
  onActiveSheetChange,
  onAnnotationSelect
}: {
  renderedSheet: RenderedNetworkSheet;
  activeSheetId: string;
  selectedAnnotationId?: string;
  zoom: number;
  onActiveSheetChange: (sheetId: string) => void;
  onAnnotationSelect: (annotationId: string | undefined) => void;
}) {
  const isActive = renderedSheet.sheet.id === activeSheetId;
  const scaledWidth = Number((renderedSheet.stageWidth * zoom).toFixed(3));
  const scaledHeight = Number((renderedSheet.stageHeight * zoom).toFixed(3));

  return (
    <div
      className={[
        "drawing-sheet-frame",
        isActive ? "drawing-sheet-frame-active" : "",
        "network-map-sheet-frame"
      ].join(" ")}
      data-testid="network-map-sheet-frame"
      data-network-sheet-id={renderedSheet.sheet.id}
      data-active-sheet={isActive ? "true" : "false"}
      role={isActive ? undefined : "button"}
      tabIndex={isActive ? undefined : 0}
      aria-label={
        isActive
          ? undefined
          : `Activate sheet ${renderedSheet.sheetNumber}: ${renderedSheet.sheet.name}`
      }
      onPointerDown={(event) => {
        if (isActive || event.button !== 0) {
          return;
        }

        event.preventDefault();
        onActiveSheetChange(renderedSheet.sheet.id);
      }}
      onKeyDown={(event) => {
        if (isActive || (event.key !== "Enter" && event.key !== " ")) {
          return;
        }

        event.preventDefault();
        onActiveSheetChange(renderedSheet.sheet.id);
      }}
    >
      <div className="drawing-sheet-caption">
        <span className="drawing-sheet-caption-index">
          Sheet {renderedSheet.sheetNumber} of {renderedSheet.sheetCount}
        </span>
        <span className="drawing-sheet-caption-name">
          {renderedSheet.sheet.name}
        </span>
      </div>
      <div
        className="network-map-sheet-scale-frame"
        style={{
          width: `${scaledWidth}px`,
          height: `${scaledHeight}px`
        }}
      >
        <div
          className="drawing-sheet-stage network-map-sheet-stage"
          data-testid={
            isActive ? "network-map-sheet-stage" : "network-map-sheet-preview"
          }
          style={{
            width: `${renderedSheet.stageWidth}px`,
            height: `${renderedSheet.stageHeight}px`,
            transform: `scale(${zoom})`
          }}
        >
          <div
            className="drawing-sheet-paper"
            data-sheet-paper="true"
            data-testid="network-map-paper"
          >
            <div
              className="drawing-sheet-rendered"
              dangerouslySetInnerHTML={{ __html: renderedSheet.svg }}
            />
            {isActive ? (
              <svg
                className="absolute inset-0 h-full w-full"
                viewBox={`0 0 ${renderedSheet.sheet.page.width} ${renderedSheet.sheet.page.height}`}
                aria-label="Interactive network map overlay"
                pointerEvents="all"
                onPointerDown={(event) => {
                  if (event.target === event.currentTarget) {
                    onAnnotationSelect(undefined);
                  }
                }}
              >
                {renderedSheet.sheet.annotations.map((annotation) => (
                  <rect
                    key={annotation.id}
                    data-testid="network-map-annotation-hit"
                    data-network-annotation-id={annotation.id}
                    x={annotation.x}
                    y={annotation.y}
                    width={annotationWidth(annotation)}
                    height={annotationHeight(annotation)}
                    rx={2}
                    className={[
                      "cursor-pointer fill-transparent",
                      selectedAnnotationId === annotation.id
                        ? "stroke-sky-600"
                        : "stroke-transparent"
                    ].join(" ")}
                    strokeWidth={selectedAnnotationId === annotation.id ? 0.8 : 0}
                    onPointerDown={(event) => {
                      if (event.button !== 0) {
                        return;
                      }

                      event.stopPropagation();
                      onAnnotationSelect(annotation.id);
                    }}
                  />
                ))}
              </svg>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
});

export function NetworkMapSurface({
  model,
  title,
  activeSheetId,
  selectedAnnotationId,
  symbols,
  statusMessage,
  onActiveSheetChange,
  onAddSheet,
  onAddNote,
  onDuplicateSheet,
  onMoveSheet,
  onMoveSheetToEnd,
  onDeleteSheet,
  onAnnotationSelect
}: {
  model: NetworkMapModel;
  title: string;
  activeSheetId: string;
  selectedAnnotationId?: string;
  symbols: ApprovedNetworkSymbol[];
  statusMessage?: string | null;
  onActiveSheetChange: (sheetId: string) => void;
  onAddSheet: () => void;
  onAddNote: () => void;
  onDuplicateSheet: (sheetId: string) => void;
  onMoveSheet: (sheetId: string, direction: -1 | 1) => void;
  onMoveSheetToEnd: (sheetId: string) => void;
  onDeleteSheet: (sheetId: string) => void;
  onAnnotationSelect: (annotationId: string | undefined) => void;
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const panStateRef = useRef<PanState | null>(null);
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const sheetCount = model.sheets.length;
  const activeSheet =
    model.sheets.find((sheet) => sheet.id === activeSheetId) ?? model.sheets[0];
  const activeSheetNumber = Math.max(
    1,
    model.sheets.findIndex((sheet) => sheet.id === activeSheet?.id) + 1
  );
  const canMoveActiveSheetUp = activeSheetNumber > 1;
  const canMoveActiveSheetDown = activeSheetNumber < sheetCount;
  const canMoveActiveSheetToEnd = activeSheetNumber < sheetCount;
  const canDeleteActiveSheet = sheetCount > 1;
  const renderedSheets = useMemo<RenderedNetworkSheet[]>(
    () =>
      model.sheets.map((sheet, index) => ({
        sheet,
        sheetNumber: index + 1,
        sheetCount,
        svg: renderNetworkMapSheetToSvg({
          model,
          sheet,
          approvedSymbols: symbols,
          mapTitle: title,
          sheetNumber: index + 1,
          sheetCount
        }),
        stageWidth: sheet.page.width * SHEET_PIXEL_SCALE,
        stageHeight: sheet.page.height * SHEET_PIXEL_SCALE
      })),
    [model, sheetCount, symbols, title]
  );

  const centerViewport = useCallback(() => {
    window.requestAnimationFrame(() => {
      const viewport = viewportRef.current;

      if (!viewport) {
        return;
      }

      viewport.scrollLeft = Math.max(
        0,
        (viewport.scrollWidth - viewport.clientWidth) / 2
      );
      viewport.scrollTop = Math.max(
        0,
        (viewport.scrollHeight - viewport.clientHeight) / 2
      );
    });
  }, []);

  const fitToViewport = useCallback(() => {
    const viewport = viewportRef.current;
    const firstSheet = renderedSheets[0];

    if (!viewport || !firstSheet) {
      return;
    }

    const availableWidth = Math.max(240, viewport.clientWidth - 112);
    const availableHeight = Math.max(240, viewport.clientHeight - 136);
    const fitZoom = clampZoom(
      Math.min(
        availableWidth / firstSheet.stageWidth,
        availableHeight / firstSheet.stageHeight
      )
    );

    setZoom(fitZoom);
    centerViewport();
  }, [centerViewport, renderedSheets]);

  useEffect(() => {
    fitToViewport();
  }, [fitToViewport]);

  const setActualSize = useCallback(() => {
    setZoom(1);
    centerViewport();
  }, [centerViewport]);

  const changeZoom = useCallback((delta: number) => {
    setZoom((current) => clampZoom(current + delta));
  }, []);

  const zoomAtViewportPoint = useCallback(
    (event: WheelEvent<HTMLDivElement>) => {
      if (!event.ctrlKey && !event.metaKey) {
        return;
      }

      const viewport = viewportRef.current;

      if (!viewport) {
        return;
      }

      event.preventDefault();

      const nextZoom = clampZoom(zoom * (event.deltaY < 0 ? 1.12 : 0.88));

      if (nextZoom === zoom) {
        return;
      }

      const viewportBox = viewport.getBoundingClientRect();
      const pointerX = event.clientX - viewportBox.left;
      const pointerY = event.clientY - viewportBox.top;
      const contentX = viewport.scrollLeft + pointerX;
      const contentY = viewport.scrollTop + pointerY;
      const ratio = nextZoom / zoom;

      setZoom(nextZoom);
      window.requestAnimationFrame(() => {
        viewport.scrollLeft = contentX * ratio - pointerX;
        viewport.scrollTop = contentY * ratio - pointerY;
      });
    },
    [zoom]
  );

  const startMiddlePan = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;

    if (event.button !== 1 || !viewport) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    panStateRef.current = {
      pointerId: event.pointerId,
      startPointerX: event.clientX,
      startPointerY: event.clientY,
      startScrollLeft: viewport.scrollLeft,
      startScrollTop: viewport.scrollTop
    };
    setIsPanning(true);
  }, []);

  const updateMiddlePan = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    const panState = panStateRef.current;

    if (!viewport || !panState || panState.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    viewport.scrollLeft =
      panState.startScrollLeft - (event.clientX - panState.startPointerX);
    viewport.scrollTop =
      panState.startScrollTop - (event.clientY - panState.startPointerY);
  }, []);

  const endMiddlePan = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const panState = panStateRef.current;

    if (panState && panState.pointerId !== event.pointerId) {
      return;
    }

    panStateRef.current = null;
    setIsPanning(false);
  }, []);

  return (
    <section className="tool-panel drawing-canvas-panel network-map-canvas-panel overflow-hidden">
      {statusMessage ? (
        <div className="drawing-canvas-toast" data-testid="network-map-toast">
          {statusMessage}
        </div>
      ) : null}
      <div className="drawing-canvas-header">
        <div>
          <h2 className="text-sm font-bold">Network Sheet</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Sheet {activeSheetNumber} of {sheetCount}
            {activeSheet?.name ? ` / ${activeSheet.name}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="icon-button h-8 w-8 p-0"
              aria-label="Move active sheet up"
              title="Move active sheet up"
              disabled={!canMoveActiveSheetUp}
              onClick={() => activeSheet && onMoveSheet(activeSheet.id, -1)}
            >
              <ChevronUp aria-hidden="true" size={14} />
            </button>
            <button
              type="button"
              className="icon-button h-8 w-8 p-0"
              aria-label="Move active sheet down"
              title="Move active sheet down"
              disabled={!canMoveActiveSheetDown}
              onClick={() => activeSheet && onMoveSheet(activeSheet.id, 1)}
            >
              <ChevronDown aria-hidden="true" size={14} />
            </button>
            <button
              type="button"
              className="icon-button h-8 w-8 p-0"
              aria-label="Move active sheet to end"
              title="Move active sheet to end"
              disabled={!canMoveActiveSheetToEnd}
              onClick={() => activeSheet && onMoveSheetToEnd(activeSheet.id)}
            >
              <ChevronsDown aria-hidden="true" size={14} />
            </button>
            <button
              type="button"
              className="icon-button h-8 w-8 p-0"
              aria-label="Duplicate active sheet"
              title="Duplicate active sheet"
              onClick={() => activeSheet && onDuplicateSheet(activeSheet.id)}
            >
              <Copy aria-hidden="true" size={14} />
            </button>
            <button
              type="button"
              className="icon-button h-8 w-8 p-0"
              aria-label="Delete active sheet"
              title="Delete active sheet"
              disabled={!canDeleteActiveSheet}
              onClick={() => activeSheet && onDeleteSheet(activeSheet.id)}
            >
              <Trash2 aria-hidden="true" size={14} />
            </button>
          </div>
          <div
            className="drawing-viewport-toolbar"
            aria-label="Network map viewport controls"
          >
            <button
              type="button"
              className="icon-button h-8"
              onClick={fitToViewport}
              aria-label="Fit network map"
            >
              <Maximize2 aria-hidden="true" size={14} />
              Fit
            </button>
            <button
              type="button"
              className="icon-button h-8"
              onClick={setActualSize}
              aria-label="Set network map zoom to 100 percent"
            >
              100%
            </button>
            <button
              type="button"
              className="icon-button h-8 w-8 p-0"
              onClick={() => changeZoom(-ZOOM_STEP)}
              aria-label="Zoom out"
            >
              <Minus aria-hidden="true" size={14} />
            </button>
            <div
              className="drawing-zoom-readout"
              data-testid="network-zoom-display"
              aria-label={`Current zoom ${formatZoom(zoom)}`}
            >
              {formatZoom(zoom)}
            </div>
            <button
              type="button"
              className="icon-button h-8 w-8 p-0"
              onClick={() => changeZoom(ZOOM_STEP)}
              aria-label="Zoom in"
            >
              <Plus aria-hidden="true" size={14} />
            </button>
          </div>
        </div>
      </div>
      <div className="drawing-canvas-viewport-shell">
        <NetworkMapAddMenu onAddSheet={onAddSheet} onAddNote={onAddNote} />
        <div
          ref={viewportRef}
          className={[
            "drawing-canvas-viewport",
            "network-map-canvas-viewport",
            isPanning ? "drawing-canvas-viewport-middle-panning" : ""
          ].join(" ")}
          data-testid="network-map-viewport"
          onWheel={zoomAtViewportPoint}
          onPointerDown={startMiddlePan}
          onPointerMove={updateMiddlePan}
          onPointerUp={endMiddlePan}
          onPointerCancel={endMiddlePan}
          onMouseDown={(event) => {
            if (event.button === 1) {
              event.preventDefault();
            }
          }}
        >
          <div
            className="drawing-sheet-stack"
            data-testid="network-map-sheet-stack"
          >
            {renderedSheets.map((renderedSheet) => (
              <NetworkSheetFrame
                key={renderedSheet.sheet.id}
                renderedSheet={renderedSheet}
                activeSheetId={activeSheet?.id ?? activeSheetId}
                selectedAnnotationId={selectedAnnotationId}
                zoom={zoom}
                onActiveSheetChange={onActiveSheetChange}
                onAnnotationSelect={onAnnotationSelect}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
