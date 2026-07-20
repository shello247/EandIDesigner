export const DRAWING_PERFORMANCE_BUDGETS_MS = {
  sourceAndGraphP95: 100,
  packageQualityP95: 150,
  activePanelDerivationP95: 75,
  activePanelDeliverablesP95: 75,
  packageDeliverablesP95: 200,
  sheetLoadP95: 250,
  tableOperationP95: 100,
  pointerPreviewFrameP95: 16.7,
  longTask: 50
} as const;

export type DrawingPerformanceMetricName =
  | "panel.source"
  | "panel.graph"
  | "panel.quality"
  | "panel.discovery"
  | "panel.reports"
  | "canvas.svg"
  | "canvas.sheet-load"
  | "canvas.gesture-preview"
  | "preview.svg";

export type DrawingPerformanceSample = {
  name: DrawingPerformanceMetricName;
  durationMs: number;
  recordedAt: number;
  attributes?: Record<string, string | number | boolean>;
};

declare global {
  var __EI_DRAWING_PERFORMANCE_SAMPLES__: DrawingPerformanceSample[] | undefined;
  var __EI_DRAWING_PERFORMANCE_ENABLED__: boolean | undefined;
}

const SAMPLE_LIMIT = 400;

export function drawingPerformanceDiagnosticsEnabled(): boolean {
  return (
    globalThis.__EI_DRAWING_PERFORMANCE_ENABLED__ === true ||
    (typeof process !== "undefined" &&
      process.env.NEXT_PUBLIC_DRAWING_PERF_DIAGNOSTICS === "true")
  );
}

export function recordDrawingPerformanceSample(
  sample: DrawingPerformanceSample
): void {
  if (!drawingPerformanceDiagnosticsEnabled()) return;
  const samples = globalThis.__EI_DRAWING_PERFORMANCE_SAMPLES__ ?? [];
  samples.push(sample);
  if (samples.length > SAMPLE_LIMIT) {
    samples.splice(0, samples.length - SAMPLE_LIMIT);
  }
  globalThis.__EI_DRAWING_PERFORMANCE_SAMPLES__ = samples;
}

export function measureDrawingOperation<T>(
  name: DrawingPerformanceMetricName,
  operation: () => T,
  attributes?: Record<string, string | number | boolean>
): T {
  if (!drawingPerformanceDiagnosticsEnabled()) return operation();
  const startedAt = performance.now();
  try {
    return operation();
  } finally {
    recordDrawingPerformanceSample({
      name,
      durationMs: Number((performance.now() - startedAt).toFixed(3)),
      recordedAt: Date.now(),
      attributes
    });
  }
}

export function getDrawingPerformanceSamples(): DrawingPerformanceSample[] {
  return [...(globalThis.__EI_DRAWING_PERFORMANCE_SAMPLES__ ?? [])];
}

export function clearDrawingPerformanceSamples(): void {
  globalThis.__EI_DRAWING_PERFORMANCE_SAMPLES__ = [];
}
