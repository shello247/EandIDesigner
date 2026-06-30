import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { prisma } from "../src/lib/prisma";
import { saveSymbolDraft } from "../src/features/symbol_registry/data/mutations";
import type { SymbolMetadata } from "../src/features/symbol_registry/data/schema";

type ExistingSymbol = {
  filePath: string;
  metadata: SymbolMetadata;
};

const existingSymbols: ExistingSymbol[] = [
  {
    filePath: "C:\\Users\\Sheldon\\Desktop\\SVG Drawings\\NRF81 Tank Side Monitor(1).svg",
    metadata: {
      symbolKey: "nrf81_tank_side_monitor",
      displayName: "NRF81 Tank Side Monitor",
      manufacturer: "Endress+Hauser",
      model: "NRF81",
      category: "monitor",
      viewBox: { x: 0, y: 0, width: 377, height: 377 },
      anchors: [
        { key: "E1", x: 125.5, y: 58.5, kind: "terminal" },
        { key: "E2", x: 125.5, y: 69.5, kind: "terminal" },
        { key: "F1", x: 116.5, y: 161.5, kind: "terminal" },
        { key: "F2", x: 116.5, y: 169.5, kind: "terminal" },
        { key: "F3", x: 124.5, y: 161.5, kind: "terminal" },
        { key: "F4", x: 124.5, y: 169.5, kind: "terminal" },
        { key: "G1", x: 91, y: 204, kind: "terminal" },
        { key: "G2", x: 91, y: 221, kind: "terminal" },
        { key: "G3", x: 91, y: 239, kind: "terminal" },
        { key: "D1", x: 235, y: 72, kind: "terminal" },
        { key: "D2", x: 247, y: 72, kind: "terminal" },
        { key: "D3", x: 260, y: 72, kind: "terminal" },
        { key: "D4", x: 271, y: 72, kind: "terminal" },
        { key: "C1", x: 235, y: 136, kind: "terminal" },
        { key: "C2", x: 247, y: 136, kind: "terminal" },
        { key: "C3", x: 260, y: 136, kind: "terminal" },
        { key: "C4", x: 271, y: 136, kind: "terminal" },
        { key: "B1", x: 235, y: 200, kind: "terminal" },
        { key: "B2", x: 247, y: 200, kind: "terminal" },
        { key: "B3", x: 260, y: 200, kind: "terminal" },
        { key: "B4", x: 271, y: 200, kind: "terminal" },
        { key: "A1", x: 235, y: 266, kind: "terminal" },
        { key: "A2", x: 247, y: 266, kind: "terminal" },
        { key: "A3", x: 260, y: 266, kind: "terminal" },
        { key: "A4", x: 271, y: 266, kind: "terminal" },
        { key: "GND", x: 100, y: 318, kind: "ground" }
      ],
      terminals: [
        ...["A", "B", "C", "D"].flatMap((channel) =>
          [1, 2, 3, 4].map((terminal) => ({
            key: `${channel}${terminal}`,
            label: `${channel}${terminal}`,
            function: "",
            anchorKey: `${channel}${terminal}`,
            requiredForWiring: true
          }))
        ),
        ...["E"].flatMap((channel) =>
          [1, 2].map((terminal) => ({
            key: `${channel}${terminal}`,
            label: `${channel}${terminal}`,
            function: "",
            anchorKey: `${channel}${terminal}`,
            requiredForWiring: true
          }))
        ),
        ...["F"].flatMap((channel) =>
          [1, 2, 3, 4].map((terminal) => ({
            key: `${channel}${terminal}`,
            label: `${channel}${terminal}`,
            function: "",
            anchorKey: `${channel}${terminal}`,
            requiredForWiring: true
          }))
        ),
        ...[1, 2, 3].map((terminal) => ({
          key: `G${terminal}`,
          label: `G${terminal}`,
          function: "Power",
          anchorKey: `G${terminal}`,
          requiredForWiring: true
        })),
        {
          key: "GND",
          label: "Ground",
          function: "Protective earth",
          anchorKey: "GND",
          requiredForWiring: false
        }
      ]
    }
  },
  {
    filePath: "C:\\Users\\Sheldon\\Desktop\\SVG Drawings\\FMP51(1).svg",
    metadata: {
      symbolKey: "fmp51_guided_wave_radar",
      displayName: "FMP51 Guided Wave Radar",
      manufacturer: "Endress+Hauser",
      model: "FMP51",
      category: "instrument",
      viewBox: { x: 0, y: 0, width: 908, height: 911 },
      anchors: [
        { key: "1", x: 458, y: 375, kind: "terminal" },
        { key: "2", x: 516, y: 387, kind: "terminal" },
        { key: "GND", x: 769, y: 533, kind: "ground" }
      ],
      terminals: [
        {
          key: "1",
          label: "Terminal 1",
          function: "Signal +",
          anchorKey: "1",
          requiredForWiring: true
        },
        {
          key: "2",
          label: "Terminal 2",
          function: "Signal -",
          anchorKey: "2",
          requiredForWiring: true
        },
        {
          key: "GND",
          label: "Ground",
          function: "Shield / ground",
          anchorKey: "GND",
          requiredForWiring: false
        }
      ]
    }
  },
  {
    filePath: "C:\\Users\\Sheldon\\Desktop\\SVG Drawings\\NMT81(1).svg",
    metadata: {
      symbolKey: "nmt81_average_temperature_probe",
      displayName: "NMT81 Average Temperature Probe",
      manufacturer: "Endress+Hauser",
      model: "NMT81",
      category: "instrument",
      viewBox: { x: 0, y: 0, width: 364, height: 413 },
      anchors: [
        { key: "1", x: 256.09, y: 305.5, kind: "terminal" },
        { key: "2", x: 220.31, y: 305.66, kind: "terminal" },
        { key: "GND_INTERNAL", x: 174.17, y: 154.58, kind: "ground" },
        { key: "GND_EXTERNAL", x: 26.5, y: 327.5, kind: "ground" }
      ],
      terminals: [
        {
          key: "1",
          label: "Terminal 1",
          function: "Temperature signal conductor",
          anchorKey: "1",
          requiredForWiring: true
        },
        {
          key: "2",
          label: "Terminal 2",
          function: "Temperature signal conductor",
          anchorKey: "2",
          requiredForWiring: true
        },
        {
          key: "GND_INTERNAL",
          label: "Internal ground",
          function: "Shield / ground",
          anchorKey: "GND_INTERNAL",
          requiredForWiring: false
        },
        {
          key: "GND_EXTERNAL",
          label: "External ground",
          function: "Protective earth",
          anchorKey: "GND_EXTERNAL",
          requiredForWiring: false
        }
      ]
    }
  }
];

async function main() {
  for (const symbol of existingSymbols) {
    if (!existsSync(symbol.filePath)) {
      console.warn(`Skipped missing SVG: ${symbol.filePath}`);
      continue;
    }

    const svg = await readFile(symbol.filePath, "utf8");
    const saved = await saveSymbolDraft({
      svg,
      metadata: symbol.metadata,
      sourceInputSummary: `Imported from ${symbol.filePath}`
    });

    console.log(`Imported ${saved?.displayName ?? symbol.metadata.displayName}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
