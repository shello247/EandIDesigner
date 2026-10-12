"use client";

import { memo, useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import type { DrawingPlacement, DrawingSheetCanvasModel } from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import {
  layoutLabelDisplayToStored, resolveLayoutLabelGeometry,
  renderLayoutLabelText, renderLayoutLabelLeader
} from "../../logic/services/drawing-layout-labels";
import { toSvgPoint } from "./utils/canvasGeometry";

type Point = { x: number; y: number };
type Drag = {
  pointerId: number; target: SVGCircleElement; offset: Point; latest: Point;
  initial: Point; frame: number | null; hidden: Array<{ node: SVGElement; visibility: string }>;
  leaderHost: Element | null;
};

// Only this leaf rerenders while dragging. Equipment SVG, model preparation and
// history remain untouched until the single accepted pointer-up command.
export const PanelLayoutLabelOverlay = memo(function PanelLayoutLabelOverlay({
  placement, displayed, symbol, sheet, zoom, onCommit, onFocusCanvas
}: {
  placement: DrawingPlacement; displayed: DrawingPlacement;
  symbol: ApprovedDrawingSymbol | undefined; sheet: DrawingSheetCanvasModel["sheet"]; zoom: number;
  onCommit: (id: string, updates: Partial<DrawingPlacement>) => void;
  onFocusCanvas: () => void;
}) {
  const drag = useRef<Drag | null>(null);
  const [preview, setPreview] = useState<{ point: Point; leaderHost: Element | null } | null>(null);
  const committed = resolveLayoutLabelGeometry({ placement: displayed, symbol });
  const geometry = preview ? resolveLayoutLabelGeometry({
    placement: { ...displayed, labelPosition: preview.point }, symbol
  }) : committed;
  const radius = Math.max(1.2, Math.min(2.4, 2.1 / zoom));
  const handle = { x: geometry.point.x - radius - .9, y: geometry.point.y - 1.25 };

  const release = useCallback(() => {
    const current = drag.current;
    drag.current = null;
    if (!current) return;
    if (current.frame !== null) cancelAnimationFrame(current.frame);
    current.hidden.forEach(({ node, visibility }) => { node.style.visibility = visibility; });
    if (current.target.hasPointerCapture(current.pointerId)) current.target.releasePointerCapture(current.pointerId);
  }, []);
  const cancel = useCallback(() => { release(); setPreview(null); }, [release]);

  useEffect(() => {
    // Escape/undo are resolved before drawing shortcuts. Other editing shortcuts
    // cannot run mid-gesture; Ctrl+wheel remains owned by the canvas viewport.
    const keyDown = (event: KeyboardEvent) => {
      if (!drag.current) return;
      if (event.key === "Escape") {
        event.preventDefault(); event.stopImmediatePropagation(); cancel();
      } else if ((event.ctrlKey || event.metaKey) && ["z", "y"].includes(event.key.toLowerCase())) {
        cancel();
      } else if (!["Control", "Shift", "Alt", "Meta"].includes(event.key)) {
        event.preventDefault(); event.stopImmediatePropagation();
      }
    };
    document.addEventListener("keydown", keyDown, true);
    return () => { document.removeEventListener("keydown", keyDown, true); release(); };
  }, [cancel, release]);

  useEffect(() => { cancel(); }, [placement, sheet, cancel]);

  function start(event: PointerEvent<SVGCircleElement>) {
    if (event.button !== 0 || drag.current) return;
    event.preventDefault(); event.stopPropagation();
    const pointer = toSvgPoint(event, sheet);
    const paper = event.currentTarget.closest("[data-sheet-paper]");
    const hidden = Array.from(paper?.querySelectorAll<SVGElement>(
      ".drawing-sheet-rendered [data-layout-helper-label-id], .drawing-sheet-rendered [data-layout-label-leader-id]"
    ) ?? []).filter(node =>
      node.getAttribute("data-layout-helper-label-id") === placement.id ||
      node.getAttribute("data-layout-label-leader-id") === placement.id
    ).map(node => ({ node, visibility: node.style.visibility }));
    hidden.forEach(({ node }) => { node.style.visibility = "hidden"; });
    const leaderHost = paper?.querySelector(".drawing-sheet-rendered [data-layout-label-leaders]") ?? null;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointerId: event.pointerId, target: event.currentTarget,
      offset: { x: committed.point.x - pointer.x, y: committed.point.y - pointer.y },
      latest: committed.point, initial: committed.point, frame: null, hidden, leaderHost };
    setPreview({ point: committed.point, leaderHost });
    onFocusCanvas();
  }
  function update(event: PointerEvent<SVGCircleElement>, schedule = true) {
    const current = drag.current;
    if (!current || event.pointerId !== current.pointerId) return;
    event.preventDefault(); event.stopPropagation();
    const pointer = toSvgPoint(event, sheet);
    current.latest = { x: pointer.x + current.offset.x, y: pointer.y + current.offset.y };
    if (schedule && current.frame === null) current.frame = requestAnimationFrame(() => {
      current.frame = null;
      if (drag.current === current) setPreview({ point: current.latest, leaderHost: current.leaderHost });
    });
  }
  function finish(event: PointerEvent<SVGCircleElement>) {
    const current = drag.current;
    if (!current || event.pointerId !== current.pointerId) return;
    update(event, false);
    const point = current.latest;
    const changed = Math.hypot(point.x - current.initial.x, point.y - current.initial.y) > .01;
    release(); setPreview(null);
    if (changed) onCommit(placement.id, { labelPosition: layoutLabelDisplayToStored(point, placement, displayed) });
  }
  return <g data-testid="panel-layout-label-overlay">
    {preview ? <g data-testid="panel-label-drag-preview" pointerEvents="none"
      dangerouslySetInnerHTML={{ __html: renderLayoutLabelText(placement.id, geometry) }} /> : null}
    {preview?.leaderHost ? createPortal(
      <g data-testid="panel-label-leader-preview" pointerEvents="none"
        dangerouslySetInnerHTML={{ __html: renderLayoutLabelLeader(placement.id, geometry) }} />,
      preview.leaderHost
    ) : null}
    <circle data-testid="canvas-placement-title-handle" cx={handle.x} cy={handle.y} r={radius}
      className="fill-purple-300 stroke-purple-700" style={{ cursor: "move", touchAction: "none" }}
      strokeWidth={.5 / zoom} onPointerDown={start} onPointerMove={update}
      onPointerUp={finish} onPointerCancel={event => { event.stopPropagation(); cancel(); }}
      onLostPointerCapture={() => { if (drag.current) cancel(); }}>
      <title>Drag panel label</title>
    </circle>
  </g>;
});
