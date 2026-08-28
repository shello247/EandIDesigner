import { mkdir, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import {
  buildPanelDiscoveryIndex,
  buildPanelEngineeringSnapshot,
  buildPanelQualityIndex,
  buildPlacementWireContextDisplayIndex,
  runPackagePanelDrawingQualityChecks,
  runPanelDrawingQualityChecks
} from "../src/features/drawing_panel_wiring/api/public";
import { buildPanelDeliverableBundle } from "../src/features/drawing_panel_reports/api/public";
import { buildPanelTerminalSchedule } from "../src/features/drawing_panel_reports/logic/services/panel-terminal-schedule";
import { createLargePanelPerformanceSource } from "../src/features/drawing_panel_wiring/tests/release-fixtures";

const ITERATIONS = Math.max(
  Number(process.env.PANEL_PERF_ITERATIONS ?? 30),
  process.env.PANEL_PERF_ENFORCE === "1" ? 20 : 1
);
const ENFORCE = process.env.PANEL_PERF_ENFORCE === "1";

type Metric = {
  budgetMs: number;
  samplesMs: number[];
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
  passed: boolean;
};

function percentile(samples: number[], value: number): number {
  const ordered = [...samples].sort((first, second) => first - second);
  return ordered[Math.max(0, Math.ceil(ordered.length * value) - 1)] ?? 0;
}

function rounded(value: number): number {
  return Math.round(value * 100) / 100;
}

function measure(name: string, budgetMs: number, operation: () => void): Metric {
  for (let warmup = 0; warmup < 5; warmup += 1) {
    operation();
  }
  const samplesMs = Array.from({ length: ITERATIONS }, () => {
    const start = performance.now();
    operation();
    return rounded(performance.now() - start);
  });
  const p50Ms = rounded(percentile(samplesMs, 0.5));
  const p95Ms = rounded(percentile(samplesMs, 0.95));
  const maxMs = rounded(Math.max(...samplesMs));
  const result = {
    budgetMs,
    samplesMs,
    p50Ms,
    p95Ms,
    maxMs,
    passed: p95Ms <= budgetMs
  };
  process.stdout.write(
    `${result.passed ? "PASS" : "FAIL"} ${name}: p95 ${p95Ms} ms (budget ${budgetMs} ms)\n`
  );
  return result;
}

const source = createLargePanelPerformanceSource();
const snapshot = buildPanelEngineeringSnapshot(source, "large-fixture");
const graph = snapshot.graph;
const packageQuality = runPackagePanelDrawingQualityChecks(graph);
const panelAssetId = snapshot.panelAssetIds[0];
const detailedSheetId = source.sheets.find(
  (sheet) => sheet.panelDrawingContext?.panelAssetId === panelAssetId
)!.id;
const reports = [
  "terminal_schedule",
  "internal_wire_schedule",
  "panel_asset_schedule",
  "bom"
] as const;

const metrics: Record<string, Metric> = {};
metrics.sourceAdapterAndGraph = measure(
  "source adapter plus connectivity graph",
  100,
  () => {
    buildPanelEngineeringSnapshot(source, "large-fixture");
  }
);
const connectionDisplayRequests = source.sheets.flatMap((sheet) =>
  sheet.panelDrawingContext
    ? sheet.occurrences.map((occurrence) => ({
        sheetId: sheet.id,
        placementId: occurrence.placementId,
        mode: "all_connected" as const
      }))
    : []
);
metrics.connectionDisplayProjection = measure(
  "connection-display projection",
  100,
  () => {
    buildPlacementWireContextDisplayIndex({
      graph,
      requests: connectionDisplayRequests
    });
  }
);
metrics.packageQuality = measure("package-wide QC", 150, () => {
  runPackagePanelDrawingQualityChecks(graph);
});
metrics.activePanelCatalogsAndQuality = measure(
  "active-panel catalogs and QC",
  75,
  () => {
    buildPanelDiscoveryIndex({ graph, panelAssetId, detailedSheetId });
    runPanelDrawingQualityChecks(
      buildPanelQualityIndex({ graph, panelAssetId })
    );
  }
);
metrics.activePanelDeliverables = measure(
  "active-panel deliverables",
  75,
  () => {
    buildPanelDeliverableBundle({
      drawingId: "performance-drawing",
      drawingTitle: "Detailed Panel Performance Fixture",
      drawingStatus: "needs_review",
      issueMode: "draft",
      reports: [...reports],
      scope: { kind: "active_panel", panelAssetId },
      graph,
      quality: packageQuality
    });
  }
);
metrics.allPanelDeliverables = measure("all-panel deliverables", 200, () => {
  buildPanelDeliverableBundle({
    drawingId: "performance-drawing",
    drawingTitle: "Detailed Panel Performance Fixture",
    drawingStatus: "needs_review",
    issueMode: "draft",
    reports: [...reports],
    scope: { kind: "all_panels" },
    graph,
    quality: packageQuality
  });
});

const terminalRows = snapshot.panelAssetIds.flatMap((id) =>
  buildPanelTerminalSchedule({ graph, panelAssetId: id })
);
metrics.tableSearchFilterSort = measure(
  "search/filter/sort over 2,000 rows",
  100,
  () => {
    terminalRows
      .filter((row) =>
        `${row.panelTag} ${row.assetTag} ${row.terminalLabel}`
          .toLowerCase()
          .includes("t1")
      )
      .sort(
        (first, second) =>
          first.assetTag.localeCompare(second.assetTag, undefined, {
            numeric: true
          }) || first.terminalLabel.localeCompare(second.terminalLabel)
      );
  }
);

const cardinalities = {
  sheets: source.sheets.length,
  panels: snapshot.panelAssetIds.length,
  assets: source.assets.length,
  logicalTerminals: graph.terminalsById.size,
  connections: source.sheets.reduce(
    (count, sheet) => count + sheet.connections.length,
    0
  ),
  connectionDisplayOccurrences: connectionDisplayRequests.length,
  internalWires: source.panelWiring?.internalWires.length ?? 0,
  connectionPatterns: source.panelWiring?.bridges.length ?? 0
};
const result = {
  generatedAt: new Date().toISOString(),
  fixture: "detailed-panel-large-v1",
  iterations: ITERATIONS,
  enforced: ENFORCE,
  cardinalities,
  metrics,
  browserOnlyBudgets: {
    warmSheetLoaderTransitionMs: 250,
    pointerPreviewFrameMs: 16.7,
    pointerLongTaskMs: 50,
    mountedPackagePreviewSvgPages: 12,
    modelCommitsPerGesture: 1
  },
  passed: Object.values(metrics).every((metric) => metric.passed)
};

await mkdir("artifacts/panel-performance", { recursive: true });
await writeFile(
  "artifacts/panel-performance/latest.json",
  `${JSON.stringify(result, null, 2)}\n`,
  "utf8"
);
process.stdout.write(`${JSON.stringify({ cardinalities, passed: result.passed }, null, 2)}\n`);

if (ENFORCE && !result.passed) {
  process.exitCode = 1;
}
