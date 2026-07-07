import {
  useCallback,
  useRef,
  useState,
  type PointerEvent,
  type RefObject
} from "react";
import type { ScrollPanState } from "../types";

function isActiveSheetPaperTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }

  const sheetPaper = target.closest("[data-sheet-paper]");
  const activeFrame = target.closest('[data-active-sheet="true"]');

  return Boolean(sheetPaper && activeFrame);
}

export function useSheetScrollPan({
  viewportRef,
  onPanStart
}: {
  viewportRef: RefObject<HTMLDivElement | null>;
  onPanStart: () => void;
}) {
  const panStateRef = useRef<ScrollPanState | null>(null);
  const [isPanning, setIsPanning] = useState(false);

  const startMiddleButtonPan = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const viewportElement = viewportRef.current;

      if (
        event.button !== 1 ||
        !viewportElement ||
        !isActiveSheetPaperTarget(event.target)
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      viewportElement.focus();
      event.currentTarget.setPointerCapture(event.pointerId);
      onPanStart();
      setIsPanning(true);
      panStateRef.current = {
        pointerId: event.pointerId,
        startPointer: { x: event.clientX, y: event.clientY },
        startScroll: {
          left: viewportElement.scrollLeft,
          top: viewportElement.scrollTop
        }
      };
    },
    [onPanStart, viewportRef]
  );

  const updateMiddleButtonPan = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const viewportElement = viewportRef.current;
      const panState = panStateRef.current;

      if (
        !viewportElement ||
        !panState ||
        panState.pointerId !== event.pointerId
      ) {
        return;
      }

      event.preventDefault();
      viewportElement.scrollLeft =
        panState.startScroll.left - (event.clientX - panState.startPointer.x);
      viewportElement.scrollTop =
        panState.startScroll.top - (event.clientY - panState.startPointer.y);
    },
    [viewportRef]
  );

  const endMiddleButtonPan = useCallback(
    (event?: PointerEvent<HTMLDivElement>) => {
      if (
        event &&
        panStateRef.current &&
        panStateRef.current.pointerId !== event.pointerId
      ) {
        return;
      }

      panStateRef.current = null;
      setIsPanning(false);
    },
    []
  );

  const preventMiddleButtonAutoscroll = useCallback(
    (event: { button: number; preventDefault: () => void }) => {
      if (event.button === 1) {
        event.preventDefault();
      }
    },
    []
  );

  return {
    isPanning,
    startMiddleButtonPan,
    updateMiddleButtonPan,
    endMiddleButtonPan,
    preventMiddleButtonAutoscroll
  };
}
