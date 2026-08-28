"use client";

import { Maximize2, Minus, Plus } from "lucide-react";
import { formatZoomPercent } from "../../logic/services/viewport-transform";

export function DrawingViewportToolbar({
  zoom,
  onFit,
  onActualSize,
  onZoomIn,
  onZoomOut
}: {
  zoom: number;
  onFit: () => void;
  onActualSize: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}) {
  return (
    <div className="drawing-viewport-toolbar" aria-label="Drawing viewport controls">
      <button
        type="button"
        className="icon-button h-9"
        onClick={onFit}
        aria-label="Fit drawing"
        title="Fit drawing"
      >
        <Maximize2 aria-hidden="true" size={18} />
        Fit
      </button>
      <button
        type="button"
        className="icon-button h-9"
        onClick={onActualSize}
        aria-label="Set drawing zoom to 100 percent"
        title="Set drawing zoom to 100 percent"
      >
        100%
      </button>
      <button
        type="button"
        className="icon-button h-9 w-9 p-0"
        onClick={onZoomOut}
        aria-label="Zoom out"
        title="Zoom out"
      >
        <Minus aria-hidden="true" size={18} />
      </button>
      <div
        className="drawing-zoom-readout"
        data-testid="drawing-zoom-display"
        aria-label={`Current zoom ${formatZoomPercent(zoom)}`}
      >
        {formatZoomPercent(zoom)}
      </div>
      <button
        type="button"
        className="icon-button h-9 w-9 p-0"
        onClick={onZoomIn}
        aria-label="Zoom in"
        title="Zoom in"
      >
        <Plus aria-hidden="true" size={18} />
      </button>
    </div>
  );
}
