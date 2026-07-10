import { readFile } from "node:fs/promises";
import { prisma } from "../src/lib/prisma";

async function execute(sql: string) {
  await prisma.$executeRawUnsafe(sql);
}

type SeedSymbolInput = {
  symbolKey: string;
  displayName: string;
  manufacturer?: string;
  model?: string;
  category: string;
  svg: string;
  metadata: {
    symbolKey: string;
    displayName: string;
    manufacturer?: string;
    model?: string;
    category: string;
    viewBox: { x: number; y: number; width: number; height: number };
    terminals: Array<{
      key: string;
      label: string;
      function?: string;
      anchorKey: string;
      requiredForWiring: boolean;
    }>;
    anchors: Array<{
      key: string;
      x: number;
      y: number;
      kind: string;
    }>;
  };
};

async function seedApprovedSymbol(input: SeedSymbolInput) {
  const existing = await prisma.symbol.findUnique({
    where: { symbolKey: input.symbolKey },
    select: { id: true }
  });

  if (existing) {
    return;
  }

  await prisma.symbol.create({
    data: {
      symbolKey: input.symbolKey,
      displayName: input.displayName,
      manufacturer: input.manufacturer,
      model: input.model,
      category: input.category,
      status: "approved",
      versions: {
        create: {
          versionNumber: 1,
          status: "approved",
          svg: input.svg,
          metadataJson: JSON.stringify(input.metadata, null, 2),
          sourceInputSummary: "Development bootstrap seed for drawing canvas sample."
        }
      }
    }
  });
}

async function main() {
  await execute("PRAGMA foreign_keys = ON;");

  await execute(`
    CREATE TABLE IF NOT EXISTS "Symbol" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "symbolKey" TEXT NOT NULL,
      "displayName" TEXT NOT NULL,
      "manufacturer" TEXT,
      "model" TEXT,
      "category" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'draft',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    );
  `);

  await execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS "Symbol_symbolKey_key"
    ON "Symbol"("symbolKey");
  `);

  await execute(`
    CREATE INDEX IF NOT EXISTS "Symbol_status_idx"
    ON "Symbol"("status");
  `);

  await execute(`
    CREATE INDEX IF NOT EXISTS "Symbol_category_idx"
    ON "Symbol"("category");
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS "SymbolVersion" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "symbolId" TEXT NOT NULL,
      "versionNumber" INTEGER NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'needs_review',
      "svg" TEXT NOT NULL,
      "metadataJson" TEXT NOT NULL,
      "sourceInputSummary" TEXT,
      "aiResponseId" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "SymbolVersion_symbolId_fkey"
        FOREIGN KEY ("symbolId") REFERENCES "Symbol" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);

  await execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS "SymbolVersion_symbolId_versionNumber_key"
    ON "SymbolVersion"("symbolId", "versionNumber");
  `);

  await execute(`
    CREATE INDEX IF NOT EXISTS "SymbolVersion_symbolId_status_idx"
    ON "SymbolVersion"("symbolId", "status");
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS "SymbolValidationIssue" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "symbolId" TEXT NOT NULL,
      "versionId" TEXT,
      "severity" TEXT NOT NULL,
      "code" TEXT NOT NULL,
      "message" TEXT NOT NULL,
      "path" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "SymbolValidationIssue_symbolId_fkey"
        FOREIGN KEY ("symbolId") REFERENCES "Symbol" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "SymbolValidationIssue_versionId_fkey"
        FOREIGN KEY ("versionId") REFERENCES "SymbolVersion" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);

  await execute(`
    CREATE INDEX IF NOT EXISTS "SymbolValidationIssue_symbolId_idx"
    ON "SymbolValidationIssue"("symbolId");
  `);

  await execute(`
    CREATE INDEX IF NOT EXISTS "SymbolValidationIssue_versionId_idx"
    ON "SymbolValidationIssue"("versionId");
  `);

  await execute(`
    CREATE INDEX IF NOT EXISTS "SymbolValidationIssue_severity_idx"
    ON "SymbolValidationIssue"("severity");
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS "SymbolSourceAsset" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "symbolId" TEXT,
      "versionId" TEXT,
      "fileName" TEXT NOT NULL,
      "mimeType" TEXT NOT NULL,
      "sizeBytes" INTEGER NOT NULL,
      "dataUrl" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "SymbolSourceAsset_symbolId_fkey"
        FOREIGN KEY ("symbolId") REFERENCES "Symbol" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "SymbolSourceAsset_versionId_fkey"
        FOREIGN KEY ("versionId") REFERENCES "SymbolVersion" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);

  await execute(`
    CREATE INDEX IF NOT EXISTS "SymbolSourceAsset_symbolId_idx"
    ON "SymbolSourceAsset"("symbolId");
  `);

  await execute(`
    CREATE INDEX IF NOT EXISTS "SymbolSourceAsset_versionId_idx"
    ON "SymbolSourceAsset"("versionId");
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS "SymbolEngineerNote" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "symbolId" TEXT NOT NULL,
      "versionId" TEXT,
      "notes" TEXT NOT NULL,
      "imageFileName" TEXT,
      "imageMimeType" TEXT,
      "imageSizeBytes" INTEGER,
      "imageDataUrl" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "SymbolEngineerNote_symbolId_fkey"
        FOREIGN KEY ("symbolId") REFERENCES "Symbol" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "SymbolEngineerNote_versionId_fkey"
        FOREIGN KEY ("versionId") REFERENCES "SymbolVersion" ("id")
        ON DELETE SET NULL ON UPDATE CASCADE
    );
  `);

  await execute(`
    CREATE INDEX IF NOT EXISTS "SymbolEngineerNote_symbolId_idx"
    ON "SymbolEngineerNote"("symbolId");
  `);

  await execute(`
    CREATE INDEX IF NOT EXISTS "SymbolEngineerNote_versionId_idx"
    ON "SymbolEngineerNote"("versionId");
  `);

  await execute(`
    CREATE INDEX IF NOT EXISTS "SymbolEngineerNote_createdAt_idx"
    ON "SymbolEngineerNote"("createdAt");
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS "SymbolDocument" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "symbolId" TEXT NOT NULL,
      "versionId" TEXT,
      "title" TEXT NOT NULL,
      "fileName" TEXT NOT NULL,
      "mimeType" TEXT NOT NULL,
      "sizeBytes" INTEGER NOT NULL,
      "dataUrl" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "SymbolDocument_symbolId_fkey"
        FOREIGN KEY ("symbolId") REFERENCES "Symbol" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "SymbolDocument_versionId_fkey"
        FOREIGN KEY ("versionId") REFERENCES "SymbolVersion" ("id")
        ON DELETE SET NULL ON UPDATE CASCADE
    );
  `);

  await execute(`
    CREATE INDEX IF NOT EXISTS "SymbolDocument_symbolId_idx"
    ON "SymbolDocument"("symbolId");
  `);

  await execute(`
    CREATE INDEX IF NOT EXISTS "SymbolDocument_versionId_idx"
    ON "SymbolDocument"("versionId");
  `);

  await execute(`
    CREATE INDEX IF NOT EXISTS "SymbolDocument_createdAt_idx"
    ON "SymbolDocument"("createdAt");
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS "Drawing" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "drawingKey" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'draft',
      "modelJson" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    );
  `);

  await execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS "Drawing_drawingKey_key"
    ON "Drawing"("drawingKey");
  `);

  await execute(`
    CREATE INDEX IF NOT EXISTS "Drawing_status_idx"
    ON "Drawing"("status");
  `);

  await execute(`
    CREATE INDEX IF NOT EXISTS "Drawing_updatedAt_idx"
    ON "Drawing"("updatedAt");
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS "DrawingSheetTemplate" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "templateKey" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "description" TEXT,
      "category" TEXT,
      "status" TEXT NOT NULL DEFAULT 'active',
      "modelJson" TEXT NOT NULL,
      "metadataJson" TEXT NOT NULL,
      "sourceDrawingId" TEXT,
      "sourceSheetId" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    );
  `);

  await execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS "DrawingSheetTemplate_templateKey_key"
    ON "DrawingSheetTemplate"("templateKey");
  `);

  await execute(`
    CREATE INDEX IF NOT EXISTS "DrawingSheetTemplate_status_idx"
    ON "DrawingSheetTemplate"("status");
  `);

  await execute(`
    CREATE INDEX IF NOT EXISTS "DrawingSheetTemplate_updatedAt_idx"
    ON "DrawingSheetTemplate"("updatedAt");
  `);

  await execute(`
    CREATE INDEX IF NOT EXISTS "DrawingSheetTemplate_category_idx"
    ON "DrawingSheetTemplate"("category");
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS "DrawingValidationIssue" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "drawingId" TEXT NOT NULL,
      "severity" TEXT NOT NULL,
      "code" TEXT NOT NULL,
      "message" TEXT NOT NULL,
      "path" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "DrawingValidationIssue_drawingId_fkey"
        FOREIGN KEY ("drawingId") REFERENCES "Drawing" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);

  await execute(`
    CREATE INDEX IF NOT EXISTS "DrawingValidationIssue_drawingId_idx"
    ON "DrawingValidationIssue"("drawingId");
  `);

  await execute(`
    CREATE INDEX IF NOT EXISTS "DrawingValidationIssue_severity_idx"
    ON "DrawingValidationIssue"("severity");
  `);

  await execute(`
    UPDATE "Symbol"
    SET "category" = 'cable_assembly'
    WHERE "symbolKey" IN ('clx_cable_1_pair', 'clx_cable_2_pair');
  `);

  const miniatureCircuitBreaker3PoleSvg = await readFile(
    new URL(
      "../src/features/symbol_registry/assets/miniature-circuit-breaker-3-pole.svg",
      import.meta.url
    ),
    "utf8"
  );

  await seedApprovedSymbol({
    symbolKey: "nmt81_average_temperature_probe",
    displayName: "NMT81 Average Temperature Probe",
    manufacturer: "Endress+Hauser",
    model: "NMT81",
    category: "instrument",
    svg: `<svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg"><rect x="18" y="12" width="84" height="28" fill="white" stroke="black"/><circle cx="48" cy="72" r="8" fill="white" stroke="black"/><circle cx="72" cy="72" r="8" fill="white" stroke="black"/><text x="60" y="88" text-anchor="middle" font-size="8">NMT81</text></svg>`,
    metadata: {
      symbolKey: "nmt81_average_temperature_probe",
      displayName: "NMT81 Average Temperature Probe",
      manufacturer: "Endress+Hauser",
      model: "NMT81",
      category: "instrument",
      viewBox: { x: 0, y: 0, width: 120, height: 100 },
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
        }
      ],
      anchors: [
        { key: "1", x: 48, y: 72, kind: "terminal" },
        { key: "2", x: 72, y: 72, kind: "terminal" }
      ]
    }
  });

  await seedApprovedSymbol({
    symbolKey: "nrf81_tank_side_monitor",
    displayName: "NRF81 Tank Side Monitor",
    manufacturer: "Endress+Hauser",
    model: "NRF81",
    category: "monitor",
    svg: `<svg viewBox="0 0 180 140" xmlns="http://www.w3.org/2000/svg"><circle cx="90" cy="70" r="58" fill="white" stroke="black"/><rect x="22" y="54" width="22" height="24" fill="white" stroke="black"/><circle cx="34" cy="62" r="3" fill="white" stroke="black"/><circle cx="34" cy="72" r="3" fill="white" stroke="black"/><text x="90" y="18" text-anchor="middle" font-size="9">NRF81</text></svg>`,
    metadata: {
      symbolKey: "nrf81_tank_side_monitor",
      displayName: "NRF81 Tank Side Monitor",
      manufacturer: "Endress+Hauser",
      model: "NRF81",
      category: "monitor",
      viewBox: { x: 0, y: 0, width: 180, height: 140 },
      terminals: [
        {
          key: "E1",
          label: "Terminal E1",
          function: "Local HART signal conductor",
          anchorKey: "E1",
          requiredForWiring: true
        },
        {
          key: "E2",
          label: "Terminal E2",
          function: "Local HART signal conductor",
          anchorKey: "E2",
          requiredForWiring: true
        }
      ],
      anchors: [
        { key: "E1", x: 34, y: 62, kind: "terminal" },
        { key: "E2", x: 34, y: 72, kind: "terminal" }
      ]
    }
  });

  await seedApprovedSymbol({
    symbolKey: "clx_cable_1_pair",
    displayName: "CLX Cable 1 Pair",
    model: "1 Pair",
    category: "cable_assembly",
    svg: `<svg viewBox="0 0 220 90" xmlns="http://www.w3.org/2000/svg"><path d="M32 22 C 52 74 154 74 184 22" fill="none" stroke="black" stroke-width="2"/><rect x="8" y="8" width="36" height="24" fill="white" stroke="black"/><rect x="176" y="8" width="36" height="24" fill="white" stroke="black"/><circle cx="18" cy="20" r="3" fill="white" stroke="black"/><circle cx="32" cy="20" r="3" fill="white" stroke="black"/><circle cx="188" cy="20" r="3" fill="white" stroke="black"/><circle cx="202" cy="20" r="3" fill="white" stroke="black"/></svg>`,
    metadata: {
      symbolKey: "clx_cable_1_pair",
      displayName: "CLX Cable 1 Pair",
      model: "1 Pair",
      category: "cable_assembly",
      viewBox: { x: 0, y: 0, width: 220, height: 90 },
      terminals: [
        {
          key: "CH1_T1",
          label: "Channel 1 terminal 1",
          function: "Cable pair conductor 1",
          anchorKey: "CH1_T1",
          requiredForWiring: true
        },
        {
          key: "CH1_T2",
          label: "Channel 1 terminal 2",
          function: "Cable pair conductor 2",
          anchorKey: "CH1_T2",
          requiredForWiring: true
        },
        {
          key: "CH2_T1",
          label: "Channel 2 terminal 1",
          function: "Cable pair conductor 1",
          anchorKey: "CH2_T1",
          requiredForWiring: true
        },
        {
          key: "CH2_T2",
          label: "Channel 2 terminal 2",
          function: "Cable pair conductor 2",
          anchorKey: "CH2_T2",
          requiredForWiring: true
        }
      ],
      anchors: [
        { key: "CH1_T1", x: 18, y: 20, kind: "terminal" },
        { key: "CH1_T2", x: 32, y: 20, kind: "terminal" },
        { key: "CH2_T1", x: 188, y: 20, kind: "terminal" },
        { key: "CH2_T2", x: 202, y: 20, kind: "terminal" }
      ]
    }
  });

  await seedApprovedSymbol({
    symbolKey: "miniature_circuit_breaker_3_pole",
    displayName: "Miniature Circuit Breaker 3 Pole",
    model: "3 Pole",
    category: "terminal_block",
    svg: miniatureCircuitBreaker3PoleSvg,
    metadata: {
      symbolKey: "miniature_circuit_breaker_3_pole",
      displayName: "Miniature Circuit Breaker 3 Pole",
      model: "3 Pole",
      category: "terminal_block",
      viewBox: { x: 0, y: 0, width: 109, height: 147 },
      terminals: [
        {
          key: "L1",
          label: "Line 1",
          function: "Incoming line phase 1",
          anchorKey: "L1",
          requiredForWiring: true
        },
        {
          key: "L2",
          label: "Line 2",
          function: "Incoming line phase 2",
          anchorKey: "L2",
          requiredForWiring: true
        },
        {
          key: "L3",
          label: "Line 3",
          function: "Incoming line phase 3",
          anchorKey: "L3",
          requiredForWiring: true
        },
        {
          key: "T1",
          label: "Load 1",
          function: "Outgoing protected phase 1",
          anchorKey: "T1",
          requiredForWiring: true
        },
        {
          key: "T2",
          label: "Load 2",
          function: "Outgoing protected phase 2",
          anchorKey: "T2",
          requiredForWiring: true
        },
        {
          key: "T3",
          label: "Load 3",
          function: "Outgoing protected phase 3",
          anchorKey: "T3",
          requiredForWiring: true
        }
      ],
      anchors: [
        { key: "L1", x: 18, y: 23, kind: "terminal" },
        { key: "L2", x: 54, y: 23, kind: "terminal" },
        { key: "L3", x: 90, y: 23, kind: "terminal" },
        { key: "T1", x: 18, y: 121, kind: "terminal" },
        { key: "T2", x: 54, y: 121, kind: "terminal" },
        { key: "T3", x: 90, y: 121, kind: "terminal" }
      ]
    }
  });

  console.log("SQLite schema is ready.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
