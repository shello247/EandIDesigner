"use client";

import {
  useCallback,
  useEffect,
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
import type {
  ApprovedNetworkSymbol,
  NetworkMapSelection,
  NetworkPlacementToolState
} from "../../types";
import type { NetworkMapModel } from "../../data/schema";
import type {
  NetworkNodeSize,
  NetworkPoint
} from "../../logic/services/network-node-geometry";
import { NetworkMapSheetFrame } from "./network-map-sheet-frame";

const SHEET_PIXEL_SCALE = 2;
const MIN_ZOOM = 0.35;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.15;

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

const IDLE_PLACEMENT_TOOL: NetworkPlacementToolState = { mode: "idle" };

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

export function NetworkMapSurface({
  model,
  title,
  activeSheetId,
  selection,
  placementTool,
  referencedSymbols,
  statusMessage,
  onActiveSheetChange,
  onAddSheet,
  onAddNote,
  onDuplicateSheet,
  onMoveSheet,
  onMoveSheetToEnd,
  onDeleteSheet,
  onSelectionChange,
  onNodePlace,
  onNodeMove,
  onNodeDelete,
  onPlacementCancel
}: {
  model: NetworkMapModel;
  title: string;
  activeSheetId: string;
  selection: NetworkMapSelection;
  placementTool: NetworkPlacementToolState;
  referencedSymbols: ApprovedNetworkSymbol[];
  statusMessage?: string | null;
  onActiveSheetChange: (sheetId: string) => void;
  onAddSheet: () => void;
  onAddNote: () => void;
  onDuplicateSheet: (sheetId: string) => void;
  onMoveSheet: (sheetId: string, direction: -1 | 1) => void;
  onMoveSheetToEnd: (sheetId: string) => void;
  onDeleteSheet: (sheetId: string) => void;
  onSelectionChange: (selection: NetworkMapSelection) => void;
  onNodePlace: (point: NetworkPoint) => void;
  onNodeMove: (
    nodeId: string,
    delta: NetworkPoint,
    size: NetworkNodeSize
  ) => void;
  onNodeDelete: (nodeId: string) => void;
  onPlacementCancel: () => void;
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
  const firstSheetStageWidth =
    (model.sheets[0]?.page.width ?? 420) * SHEET_PIXEL_SCALE;
  const firstSheetStageHeight =
    (model.sheets[0]?.page.height ?? 297) * SHEET_PIXEL_SCALE;
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
    if (!viewport) {
      return;
    }

    const availableWidth = Math.max(240, viewport.clientWidth - 112);
    const availableHeight = Math.max(240, viewport.clientHeight - 136);
    const fitZoom = clampZoom(
      Math.min(
        availableWidth / firstSheetStageWidth,
        availableHeight / firstSheetStageHeight
      )
    );

    setZoom(fitZoom);
    centerViewport();
  }, [centerViewport, firstSheetStageHeight, firstSheetStageWidth]);

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
          {placementTool.mode !== "idle" ? (
            <p
              className="mt-1 text-xs font-semibold text-teal-700"
              data-testid="network-placement-status"
            >
              {placementTool.mode === "loading" ? "Loading" : "Placing"}: {" "}
              {placementTool.item.displayName}
            </p>
          ) : null}
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
            {model.sheets.map((sheet, index) => {
              const isActive = sheet.id === (activeSheet?.id ?? activeSheetId);

              return (
                <NetworkMapSheetFrame
                  key={sheet.id}
                  sheet={sheet}
                  titleBlock={model.titleBlock}
                  mapTitle={title}
                  sheetNumber={index + 1}
                  sheetCount={sheetCount}
                  approvedSymbols={referencedSymbols}
                  isActive={isActive}
                  zoom={zoom}
                  selection={isActive ? selection : null}
                  placementTool={isActive ? placementTool : IDLE_PLACEMENT_TOOL}
                  onActivate={onActiveSheetChange}
                  onPlace={onNodePlace}
                  onSelectionChange={onSelectionChange}
                  onNodeMove={onNodeMove}
                  onNodeDelete={onNodeDelete}
                  onPlacementCancel={onPlacementCancel}
                />
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
