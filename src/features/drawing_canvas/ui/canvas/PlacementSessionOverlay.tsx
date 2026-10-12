"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { DrawingModel } from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import { canContinuePlacement, resolvePointerPlacementTarget, getPlacementTargets, preparePlacementCandidate, resolvePlacementPreview,
  type PlacementCandidate, type PlacementPoint, type PlacementSource } from "../../logic/services/drawing-placement";
import { renderDrawingToSvg } from "../../logic/services/drawing-svg-renderer";
import { updateLayoutDimensionPlacement, renderLayoutDimensionSvg } from "../../logic/services/drawing-layout-dimensions";
import { PlacementInstructions } from "./PlacementInstructions";

type PreviewPosition = { point: PlacementPoint; transform: string };
export function PlacementSessionOverlay({ source, model, symbols, viewportRef, viewportRevision, onCancel, onCommit }: {
  source: PlacementSource; model: DrawingModel; symbols: ApprovedDrawingSymbol[];
  viewportRef: RefObject<HTMLDivElement | null>; viewportRevision: string;
  onCancel: () => void;
  onCommit: (candidate: PlacementCandidate, point: PlacementPoint, ctrlKey: boolean) => { ok: boolean; error?: string };
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const gestureRef = useRef<{ id: number; x: number; y: number; ignore: boolean } | null>(null);
  const completedGestureRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  const [position, setPosition] = useState<PreviewPosition | null>(null);
  const targetRef = useRef<string | undefined>(undefined);
  const [pointerTarget, setPointerTarget] = useState<{ id?: string; reason?: string }>({});
  const [rotation, setRotation] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const targets = useMemo(() => getPlacementTargets(model, source.sheetId, source.targetKind), [model, source.sheetId, source.targetKind]);
  const targetId = pointerTarget.id;
  const prepared = useMemo(() => {
    void retry; // Explicit retry invalidates failed preparation without pointer work.
    if (source.targetKind !== "sheet" && !targetId) return { candidate: null, error: null };
    try { return { candidate: preparePlacementCandidate(source, model, symbols, targetId, rotation), error: null }; }
    catch (e) { return { candidate: null, error: e instanceof Error ? e.message : "Unable to prepare this placement." }; }
    // A retry is explicit; movement never rebuilds the candidate.
  }, [source, model, symbols, targetId, rotation, retry]);
  const candidate = prepared.candidate;
  const artwork = useMemo(() => candidate ? renderDrawingToSvg({ model: candidate.canvas, approvedSymbols: candidate.symbols,
    assets: candidate.model.assets, showAnchors: false, showConnections: false,
    connectedWireScheduleProjections: candidate.scheduleProjections,
    renderOnly: { placementIds: new Set(candidate.selection.placementIds), annotationIds: new Set(candidate.selection.annotationIds) }
  }).replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "") : "", [candidate]);
  const resolution = candidate && position ? resolvePlacementPreview(candidate, position.point) : null;
  let dimensionArtwork: string | null = null;
  if (candidate && resolution?.dimensionOffset !== undefined) {
    const placement = candidate.placements[0];
    const backplane = candidate.canvas.placements.find(p => p.id === placement.layoutParentId)!;
    const next = updateLayoutDimensionPlacement({ placement, backplane, sheet: candidate.canvas.sheet, updates: { offsetMm: resolution.dimensionOffset } });
    dimensionArtwork = renderLayoutDimensionSvg({ model: candidate.canvas, sourcePlacement: next, backplane, measurementUnit: model.measurementUnit });
  }
  const readPointer = useCallback((): PreviewPosition | null => {
    const viewport = viewportRef.current, host = hostRef.current, mouse = mouseRef.current;
    const paper = viewport?.querySelector<HTMLElement>("[data-sheet-paper='true']");
    const svg = paper?.querySelector<SVGSVGElement>('svg[aria-label="Interactive drawing overlay"]');
    const sheet = model.sheets.find(s => s.id === source.sheetId);
    if (!paper || !svg || !viewport || !host || !mouse || !sheet) return null;
    const rect = paper.getBoundingClientRect(), visible = viewport.getBoundingClientRect(), hostRect = host.getBoundingClientRect();
    if (!rect.width || !rect.height || mouse.clientX < Math.max(rect.left, visible.left) || mouse.clientX > Math.min(rect.right, visible.right) || mouse.clientY < Math.max(rect.top, visible.top) || mouse.clientY > Math.min(rect.bottom, visible.bottom)) return null;
    // Use the same SVG transform as the committed artwork, including viewBox
    // letterboxing and fractional layout/browser zoom. Paper bounds alone can
    // differ from the SVG's user-space origin and scale.
    const matrix = svg.getScreenCTM();
    if (!matrix || !matrix.a || !matrix.d) return null;
    const point = new DOMPoint(mouse.clientX, mouse.clientY).matrixTransform(matrix.inverse());
    return { point: { x: point.x, y: point.y },
      transform: `matrix(${matrix.a} ${matrix.b} ${matrix.c} ${matrix.d} ${matrix.e - hostRect.left} ${matrix.f - hostRect.top})` };
  }, [viewportRef, model.sheets, source.sheetId]);
  const update = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      const next = readPointer();
      setPosition(next);
      const target = resolvePointerPlacementTarget(source, targets, next?.point ?? null, targetRef.current);
      targetRef.current = target.id;
      setPointerTarget(previous => previous.id === target.id && previous.reason === target.reason ? previous : target);
    });
  }, [readPointer, targets, source]);
  const rotate = useCallback(() => setRotation(r => (r + 90) % 360), []);
  const retryPreview = useCallback(() => { setRetry(n => n + 1); setError(null); }, []);
  useEffect(() => {
    viewportRef.current?.focus();
  }, [viewportRef]);
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const move = (e: PointerEvent) => {
      mouseRef.current = e; setError(null); update();
      if ((e.buttons & 4) === 0 && e.target instanceof Element && e.target.closest("[data-sheet-paper='true']")) e.stopPropagation();
    };
    const down = (e: PointerEvent) => {
      if (e.button !== 0 || !(e.target instanceof Element) || !e.target.closest("[data-sheet-paper='true']")) return;
      e.preventDefault(); e.stopPropagation();
      viewport.focus();
      mouseRef.current = e;
      completedGestureRef.current = false;
      gestureRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY, ignore: e.detail > 1 };
      viewport.setPointerCapture?.(e.pointerId);
    };
    const up = (e: PointerEvent) => {
      const gesture = gestureRef.current;
      if (!gesture || gesture.id !== e.pointerId) return;
      e.preventDefault(); e.stopPropagation(); gestureRef.current = null;
      if (viewport.hasPointerCapture?.(e.pointerId)) viewport.releasePointerCapture(e.pointerId);
      mouseRef.current = e;
      completedGestureRef.current = !gesture.ignore && Math.hypot(e.clientX - gesture.x, e.clientY - gesture.y) <= 4;
      update();
    };
    const click = (e: MouseEvent) => {
      if (!completedGestureRef.current) return;
      completedGestureRef.current = false;
      e.preventDefault(); e.stopPropagation();
      // PointerEvent.detail is zero in Chromium/Firefox. Mouse click.detail
      // carries the browser's real click count, including double-clicks.
      if (e.detail > 1 || e.button !== 0) return;
      // Keep pointerup's fractional coordinates. MouseEvent coordinates can be
      // rounded to whole CSS pixels, unlike the preview's PointerEvent values.
      const next = readPointer();
      if (next && candidate) {
        const target = resolvePointerPlacementTarget(source, targets, next.point, targetRef.current);
        if (target.id !== candidate.target?.id || target.reason) {
          setError(target.reason ?? "Review the preview in this container, then click to place.");
          update();
          return;
        }
        const result = onCommit(candidate, next.point, e.ctrlKey);
        setError(result.ok ? null : result.error ?? "Could not place this object.");
        if (!result.ok) setRetry(n => n + 1);
      }
      update();
    };
    const leave = () => { if (!gestureRef.current) { mouseRef.current = null; setPosition(null); } };
    const cancelGesture = () => { gestureRef.current = null; completedGestureRef.current = false; mouseRef.current = null; setPosition(null); };
    const key = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest("input,textarea,select,[contenteditable='true']")) return;
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onCancel(); }
      else if (e.key.toLowerCase() === "r" && !e.ctrlKey && !e.metaKey && source.canRotate) { e.preventDefault(); e.stopPropagation(); rotate(); }
      else if ((e.ctrlKey || e.metaKey) && ["z", "y", "v"].includes(e.key.toLowerCase())) onCancel();
      else if (["Delete", "Backspace", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) { e.preventDefault(); e.stopPropagation(); }
    };
    viewport.addEventListener("pointermove", move, true);
    viewport.addEventListener("pointerdown", down, true);
    viewport.addEventListener("pointerup", up, true);
    viewport.addEventListener("click", click, true);
    viewport.addEventListener("pointercancel", cancelGesture, true);
    viewport.addEventListener("pointerleave", leave);
    window.addEventListener("keydown", key, true);
    viewport.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    window.addEventListener("blur", onCancel);
    const observer = new ResizeObserver(update); observer.observe(viewport);
    update();
    return () => {
      viewport.removeEventListener("pointermove", move, true); viewport.removeEventListener("pointerdown", down, true);
      viewport.removeEventListener("pointerup", up, true); viewport.removeEventListener("pointercancel", cancelGesture, true);
      viewport.removeEventListener("click", click, true);
      viewport.removeEventListener("pointerleave", leave); window.removeEventListener("keydown", key, true);
      viewport.removeEventListener("scroll", update); window.removeEventListener("resize", update); window.removeEventListener("blur", onCancel);
      observer.disconnect();
      if (frameRef.current !== null) { cancelAnimationFrame(frameRef.current); frameRef.current = null; }
      if (gestureRef.current && viewport.hasPointerCapture?.(gestureRef.current.id)) viewport.releasePointerCapture(gestureRef.current.id);
      gestureRef.current = null;
      completedGestureRef.current = false;
    };
  }, [viewportRef, source, targets, candidate, onCommit, onCancel, update, readPointer, rotate]);
  useEffect(() => { update(); }, [viewportRevision, update]);
  const repeatAllowed = canContinuePlacement(source, true);
  const reason = error ?? pointerTarget.reason ?? prepared.error ?? resolution?.reason;
  const hint = source.tool === "backplane" ? "Fitted to this panel. Click the panel to confirm."
    : source.fixedPosition ? "This linked representation keeps its existing physical position. Click to confirm."
    : source.autoSpan ? "Sized to the backplane. Click to choose its position along the free axis."
    : source.identity.mode === "reference" ? "Existing asset: its identity and tag are preserved."
    : !repeatAllowed ? "This custom tag has no number; it can only be placed once." : undefined;
  return <div ref={hostRef} className="pointer-events-none absolute inset-0 z-30 overflow-hidden" data-testid="placement-session" data-target-kind={source.targetKind} data-configured-target-id={source.targetId}>
    <PlacementInstructions label={source.label} tag={candidate?.tag ?? source.label} canContinue={repeatAllowed}
      canRotate={source.canRotate} reason={reason} hint={hint} onRotate={rotate} onRetry={prepared.error ? retryPreview : undefined} />
    {position && candidate && resolution ? <svg className="absolute inset-0 h-full w-full" aria-hidden="true" data-testid="placement-ghost" data-valid={resolution.valid}>
      <g transform={position.transform}>
        {candidate.target ? <rect {...candidate.target.bounds} fill="none" stroke="#0d9488" strokeWidth="1" vectorEffect="non-scaling-stroke" /> : null}
        <g opacity={resolution.valid ? 0.6 : 0.3} transform={dimensionArtwork === null ? `translate(${resolution.delta.x} ${resolution.delta.y})` : undefined} dangerouslySetInnerHTML={{ __html: dimensionArtwork ?? artwork }} />
        <rect {...resolution.bounds} fill="none" stroke={resolution.valid ? "#0d9488" : "#dc2626"} strokeWidth="1.5" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
      </g>
    </svg> : null}
  </div>;
}
