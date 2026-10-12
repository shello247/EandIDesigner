import { useEffect, type RefObject } from "react";

export function useCanvasWheelZoom(
  viewportRef: RefObject<HTMLDivElement | null>,
  onZoom: (event: WheelEvent) => void
) {
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey || !event.cancelable || event.defaultPrevented) return;

      // React's delegated onWheel listener is passive. Cancel the browser's
      // Ctrl+wheel zoom with a native listener on this viewport only.
      event.preventDefault();
      onZoom(event);
    };

    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", handleWheel);
  }, [onZoom, viewportRef]);
}
