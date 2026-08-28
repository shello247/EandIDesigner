import { performance } from "node:perf_hooks";
import { createDefaultDrawingModel } from "../../src/features/drawing_canvas/data/schema";
import type { DrawingPlacement } from "../../src/features/drawing_canvas/data/schema";
import { getRenderableSymbolForPlacement } from "../../src/features/drawing_canvas/logic/services/drawing-generated-symbols";
import { createTerminalBlockPlacement } from "../../src/features/drawing_canvas/logic/services/drawing-terminal-blocks";
import type { ApprovedDrawingSymbol } from "../../src/features/drawing_canvas/types";

const WARMUPS = 5;
const SAMPLES = 30;

function percentile(values: number[], fraction: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)]!;
}

function summarize(values: number[]) {
  return {
    medianMs: Number(percentile(values, 0.5).toFixed(2)),
    p95Ms: Number(percentile(values, 0.95).toFixed(2)),
    minMs: Number(Math.min(...values).toFixed(2)),
    maxMs: Number(Math.max(...values).toFixed(2))
  };
}

function symbol(index: number): ApprovedDrawingSymbol {
  return {
    symbolId: `symbol_${index}`,
    symbolKey: `symbol_${index}`,
    displayName: `Symbol ${index}`,
    category: "instrument",
    versionId: `version_${index}`,
    versionNumber: 1,
    svg: '<svg viewBox="0 0 20 10"><rect width="20" height="10"/></svg>',
    metadata: {
      symbolKey: `symbol_${index}`,
      displayName: `Symbol ${index}`,
      category: "instrument",
      viewBox: { x: 0, y: 0, width: 20, height: 10 },
      anchors: [],
      terminals: []
    }
  };
}

const approvedSymbols = Array.from({ length: 1_000 }, (_, index) => symbol(index));
const exactPlacements: DrawingPlacement[] = Array.from(
  { length: 5_000 },
  (_, index) => ({
    id: `placement_${index}`,
    symbolId: `symbol_${index % approvedSymbols.length}`,
    versionId: `version_${index % approvedSymbols.length}`,
    role: "device",
    tag: `X-${index}`,
    x: index % 100,
    y: Math.floor(index / 100),
    rotation: 0,
    scale: 1
  })
);
const base = createDefaultDrawingModel();
const generatedPlacements = Array.from({ length: 100 }, (_, index) => {
  const placement = createTerminalBlockPlacement({
    model: base,
    activeSheet: base.sheets[0],
    assetId: `asset_tb_${index}`,
    tag: `TB-${index + 1}`,
    terminalBlock: { count: 20, startNumber: 1, orientation: "horizontal" }
  });
  return { ...placement, id: `generated_tb_${index}` };
});

function exactLookup(): number {
  let checksum = 0;
  for (const placement of exactPlacements) {
    const resolved = getRenderableSymbolForPlacement(placement, approvedSymbols);
    checksum += resolved?.displayName.length ?? 0;
  }
  return checksum;
}

function generatedGeometry(): number {
  let checksum = 0;
  for (let repeat = 0; repeat < 10; repeat += 1) {
    for (const placement of generatedPlacements) {
      const resolved = getRenderableSymbolForPlacement(placement, approvedSymbols);
      checksum += resolved?.svg.length ?? 0;
      checksum += resolved?.metadata.anchors.length ?? 0;
    }
  }
  return checksum;
}

function measure(work: () => number) {
  const checksums: number[] = [];
  for (let index = 0; index < WARMUPS; index += 1) work();
  const samples = Array.from({ length: SAMPLES }, () => {
    const started = performance.now();
    checksums.push(work());
    return performance.now() - started;
  });
  if (new Set(checksums).size !== 1) throw new Error("Unstable benchmark checksum");
  return { ...summarize(samples), checksum: checksums[0] };
}

console.log(
  JSON.stringify(
    {
      approvedSymbols: approvedSymbols.length,
      exactPlacements: exactPlacements.length,
      generatedPlacements: generatedPlacements.length,
      generatedResolutionsPerSample: generatedPlacements.length * 10,
      exactLookup: measure(exactLookup),
      generatedGeometry: measure(generatedGeometry)
    },
    null,
    2
  )
);
