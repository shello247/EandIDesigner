export const MIN_VIEWPORT_ZOOM = 0.2;
export const MAX_VIEWPORT_ZOOM = 4;
export const DEFAULT_VIEWPORT_PADDING = 36;

export type ViewportTransform = {
  zoom: number;
  panX: number;
  panY: number;
};

export type ViewportSize = {
  width: number;
  height: number;
};

export type SheetSize = {
  width: number;
  height: number;
};

function round(value: number): number {
  return Number(value.toFixed(3));
}

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) {
    return 1;
  }

  return round(Math.min(MAX_VIEWPORT_ZOOM, Math.max(MIN_VIEWPORT_ZOOM, zoom)));
}

export function calculateFitTransform(
  viewport: ViewportSize,
  sheet: SheetSize,
  padding = DEFAULT_VIEWPORT_PADDING
): ViewportTransform {
  const availableWidth = Math.max(1, viewport.width - padding * 2);
  const availableHeight = Math.max(1, viewport.height - padding * 2);
  const fitZoom = clampZoom(
    Math.min(1, availableWidth / sheet.width, availableHeight / sheet.height)
  );

  return {
    zoom: fitZoom,
    panX: round((viewport.width - sheet.width * fitZoom) / 2),
    panY: round((viewport.height - sheet.height * fitZoom) / 2)
  };
}

export function zoomAtPoint(input: {
  current: ViewportTransform;
  nextZoom: number;
  pointerX: number;
  pointerY: number;
}): ViewportTransform {
  const currentZoom = clampZoom(input.current.zoom);
  const nextZoom = clampZoom(input.nextZoom);
  const drawingX = (input.pointerX - input.current.panX) / currentZoom;
  const drawingY = (input.pointerY - input.current.panY) / currentZoom;

  return {
    zoom: nextZoom,
    panX: round(input.pointerX - drawingX * nextZoom),
    panY: round(input.pointerY - drawingY * nextZoom)
  };
}

export function zoomAtViewportCenter(input: {
  current: ViewportTransform;
  nextZoom: number;
  viewport: ViewportSize;
}): ViewportTransform {
  return zoomAtPoint({
    current: input.current,
    nextZoom: input.nextZoom,
    pointerX: input.viewport.width / 2,
    pointerY: input.viewport.height / 2
  });
}

export function formatZoomPercent(zoom: number): string {
  return `${Math.round(clampZoom(zoom) * 100)}%`;
}
