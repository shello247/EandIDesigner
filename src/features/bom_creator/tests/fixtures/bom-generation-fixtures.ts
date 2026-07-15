import type {
  DrawingConnection,
  DrawingModel,
  DrawingPlacement
} from "@/features/drawing_canvas/api/asset-contracts";
import type {
  BomGenerationItem,
  BomGenerationTemplate,
  BomQuantityRule
} from "../../data/schema";
import type { GenerateDrawingBomInput } from "../../logic/use_cases/generate-drawing-bom";

const standardRules: BomQuantityRule[] = [
  "fixed_per_assembly",
  "per_cable_end",
  "per_conductor_termination",
  "per_connection",
  "fixed_per_assembly"
];

function item(index: number, archived = false): BomGenerationItem {
  return {
    id: `perf_item_${index}`,
    itemKey: `PERF-${String(index).padStart(6, "0")}`,
    displayName: `Performance Item ${index}`,
    category: "accessory",
    unit: "each",
    status: archived ? "archived" : "active"
  };
}

function placement(input: {
  id: string;
  assetId: string;
  tag: string;
  x: number;
}): DrawingPlacement {
  return {
    id: input.id,
    assetId: input.assetId,
    symbolId: "perf_symbol",
    versionId: "perf_symbol_v1",
    role: "cable_assembly",
    tag: input.tag,
    title: `Cable ${input.tag}`,
    x: input.x,
    y: 20,
    rotation: 0,
    scale: 1
  };
}

function connection(input: {
  id: string;
  placementId: string;
}): DrawingConnection {
  return {
    id: input.id,
    from: { placementId: input.placementId, anchorKey: "A" },
    to: { placementId: `${input.id}_external`, anchorKey: "B" },
    cablePlacementId: input.placementId,
    conductorKey: input.id
  };
}

export function createBomGenerationFixture(
  assetCount: number,
  { warningHeavy = false }: { warningHeavy?: boolean } = {}
): GenerateDrawingBomInput {
  const rules = warningHeavy
    ? [...standardRules.slice(0, 4), "manual" as const]
    : standardRules;
  const items = rules.map((_, index) => item(index + 1, warningHeavy && index === 3));
  const template: BomGenerationTemplate = {
    id: "perf_template",
    symbolId: "perf_symbol",
    lines: rules.map((quantityRule, index) => ({
      id: `perf_line_${index + 1}`,
      itemId: items[index].id,
      lineNumber: index + 1,
      quantityRule,
      quantity: 1,
      item: items[index]
    }))
  };
  const sheetCount = Math.min(25, Math.max(2, Math.ceil(assetCount / 100)));
  const sheets: DrawingModel["sheets"] = Array.from(
    { length: sheetCount },
    (_, index) => ({
      id: `perf_sheet_${index + 1}`,
      name: `Performance Sheet ${index + 1}`,
      kind: "drawing",
      page: { size: "A3_LANDSCAPE", width: 420, height: 297, gridSize: 10 },
      placements: [],
      connections: [],
      annotations: []
    })
  );
  const assets: DrawingModel["assets"] = [];

  for (let index = 0; index < assetCount; index += 1) {
    const assetId = `perf_asset_${index}`;
    const tag = `C-${String(index + 1).padStart(5, "0")}`;
    const primaryId = `perf_placement_${index}_a`;
    const referenceId = `perf_placement_${index}_b`;
    assets.push({
      id: assetId,
      tag,
      type: "cable",
      title: `Cable ${index + 1}`,
      symbolId: "perf_symbol",
      versionId: "perf_symbol_v1"
    });
    sheets[index % sheetCount].placements.push(
      placement({ id: primaryId, assetId, tag, x: 10 })
    );
    sheets[(index + 1) % sheetCount].placements.push(
      placement({ id: referenceId, assetId, tag, x: 30 })
    );
    sheets[index % sheetCount].connections.push(
      connection({ id: `perf_connection_${index}_1`, placementId: primaryId }),
      connection({ id: `perf_connection_${index}_2`, placementId: primaryId })
    );
  }

  return {
    drawingId: "perf_drawing",
    drawingTitle: "BOM Performance Drawing",
    model: {
      version: 2,
      titleBlock: {},
      assets,
      sheets
    },
    symbols: [{ symbolId: "perf_symbol", displayName: "Performance Cable" }],
    templates: [template]
  };
}
