import {
  useCallback,
  useRef,
  useState,
  type Dispatch,
  type PointerEvent,
  type RefObject,
  type SetStateAction,
  type WheelEvent
} from "react";
import {
  clampZoom,
  type ViewportTransform,
  zoomAtPoint
} from "../../../logic/services/viewport-transform";
import type { PanState } from "../types";

export function useViewportPan({
  viewportRef,
  viewportTransform,
  setViewportTransform,
  onActiveAnchorChange
}: {
  viewportRef: RefObject<HTMLDivElement | null>;
  viewportTransform: ViewportTransform;
  setViewportTransform: Dispatch<SetStateAction<ViewportTransform>>;
  onActiveAnchorChange: (anchorId: string | null) => void;
}) {
  const panStateRef = useRef<PanState | null>(null);
  const [isPanning, setIsPanning] = useState(false);

  const handleWheel = useCallback(
    (event: WheelEvent<HTMLDivElement>) => {
      event.preventDefault();

      const rect = event.currentTarget.getBoundingClientRect();

      if (event.ctrlKey) {
        const pointerX = event.clientX - rect.left;
        const pointerY = event.clientY - rect.top;

        setViewportTransform((current) =>
          zoomAtPoint({
            current,
            nextZoom: clampZoom(current.zoom * Math.exp(-event.deltaY * 0.0015)),
            pointerX,
            pointerY
          })
        );
        return;
      }

      setViewportTransform((current) => ({
        ...current,
        panX: Number((current.panX - event.deltaX).toFixed(3)),
        panY: Number((current.panY - event.deltaY).toFixed(3))
      }));
    },
    [setViewportTransform]
  );

  const endMiddleButtonPan = useCallback(() => {
    panStateRef.current = null;
    setIsPanning(false);
  }, []);

  const startMiddleButtonPan = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (event.button !== 1) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      viewportRef.current?.focus();
      event.currentTarget.setPointerCapture(event.pointerId);
      onActiveAnchorChange(null);
      setIsPanning(true);
      panStateRef.current = {
        pointerId: event.pointerId,
        startPointer: { x: event.clientX, y: event.clientY },
        startPan: {
          panX: viewportTransform.panX,
          panY: viewportTransform.panY
        }
      };
    },
    [
      onActiveAnchorChange,
      viewportRef,
      viewportTransform.panX,
      viewportTransform.panY
    ]
  );

  const updateMiddleButtonPan = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const panState = panStateRef.current;

      if (!panState || panState.pointerId !== event.pointerId) {
        return;
      }

      event.preventDefault();
      setViewportTransform((current) => ({
        ...current,
        panX: Number(
          (
            panState.startPan.panX +
            event.clientX -
            panState.startPointer.x
          ).toFixed(3)
        ),
        panY: Number(
          (
            panState.startPan.panY +
            event.clientY -
            panState.startPointer.y
          ).toFixed(3)
        )
      }));
    },
    [setViewportTransform]
  );

  return {
    isPanning,
    handleWheel,
    startMiddleButtonPan,
    updateMiddleButtonPan,
    endMiddleButtonPan
  };
}
