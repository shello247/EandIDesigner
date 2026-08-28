"use client";

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEventHandler,
  type MouseEventHandler,
  type PointerEventHandler,
  type ReactNode,
  type RefObject
} from "react";
import type { SvgViewBox } from "./svg-inspector";
import {
  getContainedSvgStageDimensions,
  getMaximumSvgStageDimensions,
  getRenderedPixelsPerUserUnit,
  transformClientPoint,
  type SvgPoint
} from "./svg-coordinate-geometry";

export type SvgCoordinateStageFitMode = "width" | "container";

type SvgCoordinateStageEvents = {
  onPointerMove?: PointerEventHandler<SVGSVGElement>;
  onPointerLeave?: PointerEventHandler<SVGSVGElement>;
  onPointerDown?: PointerEventHandler<SVGSVGElement>;
  onPointerUp?: PointerEventHandler<SVGSVGElement>;
  onPointerCancel?: PointerEventHandler<SVGSVGElement>;
  onLostPointerCapture?: PointerEventHandler<SVGSVGElement>;
  onClick?: MouseEventHandler<SVGSVGElement>;
};

export type SvgCoordinateStageGeometry = {
  overlayRef: RefObject<SVGSVGElement | null>;
  pixelsPerUserUnit: number;
  clientToViewBoxPoint: (clientX: number, clientY: number) => SvgPoint | null;
};

export function useSvgCoordinateStageGeometry(
  viewBox: SvgViewBox
): SvgCoordinateStageGeometry {
  const overlayRef = useRef<SVGSVGElement | null>(null);
  const [pixelsPerUserUnit, setPixelsPerUserUnit] = useState(0);
  const { width: viewBoxWidth, height: viewBoxHeight } = viewBox;

  useLayoutEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) {
      return;
    }

    const measure = () => {
      const rect = overlay.getBoundingClientRect();
      const nextScale = getRenderedPixelsPerUserUnit(
        { x: 0, y: 0, width: viewBoxWidth, height: viewBoxHeight },
        { width: rect.width, height: rect.height }
      );
      setPixelsPerUserUnit((currentScale) =>
        Math.abs(currentScale - nextScale) < 0.0001
          ? currentScale
          : nextScale
      );
    };

    measure();

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measure);
    resizeObserver?.observe(overlay);
    window.addEventListener("resize", measure);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [viewBoxHeight, viewBoxWidth]);

  const clientToViewBoxPoint = useCallback(
    (clientX: number, clientY: number): SvgPoint | null => {
      const screenMatrix = overlayRef.current?.getScreenCTM();
      if (!screenMatrix) {
        return null;
      }

      try {
        return transformClientPoint(
          { x: clientX, y: clientY },
          screenMatrix.inverse()
        );
      } catch {
        return null;
      }
    },
    []
  );

  return { overlayRef, pixelsPerUserUnit, clientToViewBoxPoint };
}

export function SvgCoordinateStage({
  svg,
  viewBox,
  overlayRef,
  overlayLabel,
  overlayChildren,
  htmlOverlay,
  overlayClassName = "",
  fitMode = "width",
  onStageKeyDown,
  ...overlayEvents
}: {
  svg: string;
  viewBox: SvgViewBox;
  overlayRef: RefObject<SVGSVGElement | null>;
  overlayLabel: string;
  overlayChildren?: ReactNode;
  htmlOverlay?: ReactNode;
  overlayClassName?: string;
  fitMode?: SvgCoordinateStageFitMode;
  onStageKeyDown?: KeyboardEventHandler<HTMLDivElement>;
} & SvgCoordinateStageEvents) {
  const maximumSize = getMaximumSvgStageDimensions(viewBox);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [availableSize, setAvailableSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  useLayoutEffect(() => {
    if (fitMode !== "container") {
      return;
    }

    const container = stageRef.current?.parentElement;
    if (!container) {
      return;
    }

    const updateSize = (width: number, height: number) => {
      setAvailableSize((current) =>
        current &&
        Math.abs(current.width - width) < 0.5 &&
        Math.abs(current.height - height) < 0.5
          ? current
          : { width, height }
      );
    };
    const measure = () => {
      const styles = window.getComputedStyle(container);
      const horizontalPadding =
        Number.parseFloat(styles.paddingLeft) +
        Number.parseFloat(styles.paddingRight);
      const verticalPadding =
        Number.parseFloat(styles.paddingTop) +
        Number.parseFloat(styles.paddingBottom);

      updateSize(
        Math.max(0, container.clientWidth - horizontalPadding),
        Math.max(0, container.clientHeight - verticalPadding)
      );
    };

    measure();

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver((entries) => {
            const entry = entries[0];
            if (entry) {
              updateSize(entry.contentRect.width, entry.contentRect.height);
            }
          });
    resizeObserver?.observe(container);
    window.addEventListener("resize", measure);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [fitMode]);

  const containedSize =
    fitMode === "container" && availableSize
      ? getContainedSvgStageDimensions(viewBox, availableSize)
      : null;

  return (
    <div
      ref={stageRef}
      data-testid="svg-coordinate-stage"
      className="relative w-full shrink-0"
      style={{
        aspectRatio: `${viewBox.width} / ${viewBox.height}`,
        maxWidth: `${maximumSize.width}px`,
        ...(containedSize && containedSize.width > 0
          ? {
              height: `${containedSize.height}px`,
              width: `${containedSize.width}px`
            }
          : {})
      }}
      onKeyDown={onStageKeyDown}
    >
      <div
        data-testid="svg-coordinate-artwork"
        className="svg-coordinate-stage-artwork absolute inset-0 h-full w-full"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <svg
        {...overlayEvents}
        ref={overlayRef}
        data-testid="svg-coordinate-overlay"
        className={`absolute inset-0 h-full w-full overflow-visible ${overlayClassName}`}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        preserveAspectRatio="xMidYMid meet"
        aria-label={overlayLabel}
      >
        {overlayChildren}
      </svg>
      {htmlOverlay}
    </div>
  );
}
