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
  | "panel.placement-wire-context"
  | "panel.connected-wire-schedule"
  | "canvas.svg"
  | "canvas.normalize"
  | "canvas.history-commit"
  | "canvas.sheet-dispatch"
  | "canvas.sheet-load"
  | "canvas.gesture-preview"
  | "preview.svg";

export type DrawingPerformanceSample = {
  name: DrawingPerformanceMetricName;
  durationMs: number;
  recordedAt: number;
  attributes?: Record<string, string | number | boolean>;
};

export type DrawingPerformanceInvocation = {
  count: number;
  totalMs: number;
  maxMs: number;
};

export type DrawingPerformanceContext = {
  actionId?: string;
  revision?: string;
};

declare global {
  var __EI_DRAWING_PERFORMANCE_SAMPLES__: DrawingPerformanceSample[] | undefined;
  var __EI_DRAWING_PERFORMANCE_ENABLED__: boolean | undefined;
  var __EI_DRAWING_PERFORMANCE_CONTEXT__: DrawingPerformanceContext | undefined;
  var __EI_DRAWING_PERFORMANCE_COUNTS__:
    | Partial<Record<DrawingPerformanceMetricName, DrawingPerformanceInvocation>>
    | undefined;
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

export function updateDrawingPerformanceContext(
  context: DrawingPerformanceContext
): void {
  if (!drawingPerformanceDiagnosticsEnabled()) return;
  globalThis.__EI_DRAWING_PERFORMANCE_CONTEXT__ = {
    ...globalThis.__EI_DRAWING_PERFORMANCE_CONTEXT__,
    ...context
  };
}

function recordDrawingPerformanceInvocation(
  name: DrawingPerformanceMetricName,
  durationMs: number
): void {
  const counters = globalThis.__EI_DRAWING_PERFORMANCE_COUNTS__ ?? {};
  const current = counters[name] ?? { count: 0, totalMs: 0, maxMs: 0 };
  counters[name] = {
    count: current.count + 1,
    totalMs: Number((current.totalMs + durationMs).toFixed(3)),
    maxMs: Math.max(current.maxMs, durationMs)
  };
  globalThis.__EI_DRAWING_PERFORMANCE_COUNTS__ = counters;
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
    const durationMs = Number((performance.now() - startedAt).toFixed(3));
    recordDrawingPerformanceInvocation(name, durationMs);
    recordDrawingPerformanceSample({
      name,
      durationMs,
      recordedAt: Date.now(),
      attributes: {
        ...attributes,
        ...globalThis.__EI_DRAWING_PERFORMANCE_CONTEXT__
      }
    });
  }
}

export function getDrawingPerformanceSamples(): DrawingPerformanceSample[] {
  return [...(globalThis.__EI_DRAWING_PERFORMANCE_SAMPLES__ ?? [])];
}

export function clearDrawingPerformanceSamples(): void {
  globalThis.__EI_DRAWING_PERFORMANCE_SAMPLES__ = [];
  globalThis.__EI_DRAWING_PERFORMANCE_COUNTS__ = {};
}

export function getDrawingPerformanceInvocations(): Partial<
  Record<DrawingPerformanceMetricName, DrawingPerformanceInvocation>
> {
  return structuredClone(globalThis.__EI_DRAWING_PERFORMANCE_COUNTS__ ?? {});
}
