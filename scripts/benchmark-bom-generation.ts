import { performance } from "node:perf_hooks";
import { generateDrawingBom } from "../src/features/bom_creator/logic/use_cases/generate-drawing-bom";
import { createBomGenerationFixture } from "../src/features/bom_creator/tests/fixtures/bom-generation-fixtures";

for (const assetCount of [50, 500, 2_500]) {
  const input = createBomGenerationFixture(assetCount);
  generateDrawingBom(input);
  const durations: number[] = [];
  let result = generateDrawingBom(input);

  for (let run = 0; run < 5; run += 1) {
    const startedAt = performance.now();
    result = generateDrawingBom(input);
    durations.push(performance.now() - startedAt);
  }

  durations.sort((first, second) => first - second);
  const outputBytes = Buffer.byteLength(JSON.stringify(result));
  const lineCount = result.assemblies.reduce(
    (total, assembly) => total + assembly.lines.length,
    0
  );

  console.log(
    JSON.stringify({
      assets: assetCount,
      placements: assetCount * 2,
      connections: assetCount * 2,
      medianMs: Number(durations[2].toFixed(2)),
      runsMs: durations.map((duration) => Number(duration.toFixed(2))),
      outputBytes,
      assemblies: result.assemblies.length,
      lines: lineCount,
      warnings: result.warnings.length
    })
  );
}
