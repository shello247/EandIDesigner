import { describe, expect, it } from "vitest";
import {
  createDefaultDrawingModel,
  type DrawingConnection,
  type DrawingModel,
  type DrawingPlacement
} from "@/features/drawing_canvas/data/schema";
import type { ApprovedDrawingSymbol } from "@/features/drawing_canvas/types";
import {
  MAX_BOM_ITEM_IMAGE_BYTES,
  bomItemImagesInputSchema,
  bomItemOptionInputSchema,
  bomItemInputSchema,
  type BomItemSummary,
  type SymbolBomTemplateDetail
} from "../data/schema";
import { generateDrawingBom } from "../logic/use_cases/generate-drawing-bom";
import { validateSymbolBomTemplateInput } from "../logic/use_cases/symbol-bom-template-use-cases";

function symbol(input: {
  id: string;
  key: string;
  name: string;
  category: ApprovedDrawingSymbol["category"];
}): ApprovedDrawingSymbol {
  return {
    symbolId: input.id,
    symbolKey: input.key,
    displayName: input.name,
    category: input.category,
    versionId: `${input.id}_v1`,
    versionNumber: 1,
    svg: '<svg viewBox="0 0 100 40" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="40"/></svg>',
    metadata: {
      symbolKey: input.key,
      displayName: input.name,
      category: input.category,
      viewBox: { x: 0, y: 0, width: 100, height: 40 },
      anchors: [
        { key: "A", x: 0, y: 20, kind: "terminal" },
        { key: "B", x: 100, y: 20, kind: "terminal" }
      ],
      terminals: []
    }
  };
}

const cableSymbol = symbol({
  id: "sym_cable",
  key: "clx_cable_1_pair",
  name: "CLX Cable 1 Pair",
  category: "cable_assembly"
});

const instrumentSymbol = symbol({
  id: "sym_instrument",
  key: "nmt81_average_temperature_probe",
  name: "NMT81 Average Temperature Probe",
  category: "instrument"
});

function item(input: Partial<BomItemSummary> & { id: string }): BomItemSummary {
  return {
    id: input.id,
    itemKey: input.itemKey ?? input.id.toUpperCase(),
    displayName: input.displayName ?? input.id,
    category: input.category ?? "accessory",
    unit: input.unit ?? "each",
    status: input.status ?? "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    manufacturer: input.manufacturer,
    partNumber: input.partNumber,
    model: input.model,
    description: input.description,
    notes: input.notes,
    supplierName: input.supplierName,
    supplierContactName: input.supplierContactName,
    supplierEmail: input.supplierEmail,
    supplierPhone: input.supplierPhone,
    supplierWebsite: input.supplierWebsite,
    supplierSku: input.supplierSku,
    unitCost: input.unitCost,
    currency: input.currency,
    leadTimeDays: input.leadTimeDays,
    minimumOrderQuantity: input.minimumOrderQuantity,
    costNotes: input.costNotes,
    images: input.images ?? [],
    primaryImage: input.primaryImage,
    templateLineCount: input.templateLineCount ?? 0
  };
}

const cableItem = item({
  id: "item_cable",
  itemKey: "CLX_CABLE",
  displayName: "CLX Instrument Cable",
  category: "cable"
});
const glandItem = item({
  id: "item_gland",
  itemKey: "GLAND_M20",
  displayName: "M20 Cable Gland",
  category: "gland"
});
const wireEndItem = item({
  id: "item_wire_end",
  itemKey: "WIRE_END",
  displayName: "Wire End Ferrule",
  category: "termination"
});
const sealantItem = item({
  id: "item_sealant",
  itemKey: "SEALANT",
  displayName: "Cable Sealant",
  category: "sealant",
  status: "archived"
});
const labelItem = item({
  id: "item_label",
  itemKey: "CABLE_LABEL",
  displayName: "Cable Label",
  category: "label"
});

function cablePlacement(overrides: Partial<DrawingPlacement> = {}): DrawingPlacement {
  return {
    id: "cable_101",
    assetId: "asset_c_101",
    symbolId: cableSymbol.symbolId,
    versionId: cableSymbol.versionId,
    role: "cable_assembly",
    tag: "C-101",
    title: "CLX Cable 1 Pair",
    x: 100,
    y: 80,
    rotation: 0,
    scale: 0.5,
    ...overrides
  };
}

function instrumentPlacement(
  overrides: Partial<DrawingPlacement> = {}
): DrawingPlacement {
  return {
    id: "tt_101",
    assetId: "asset_tt_101",
    symbolId: instrumentSymbol.symbolId,
    versionId: instrumentSymbol.versionId,
    role: "device",
    tag: "TT-101",
    title: "Temperature Probe",
    x: 20,
    y: 60,
    rotation: 0,
    scale: 0.35,
    ...overrides
  };
}

function connection(input: {
  id: string;
  fromPlacementId: string;
  toPlacementId: string;
  conductorKey: string;
}): DrawingConnection {
  return {
    id: input.id,
    from: { placementId: input.fromPlacementId, anchorKey: "A" },
    to: { placementId: input.toPlacementId, anchorKey: "B" },
    cablePlacementId: "cable_101",
    conductorKey: input.conductorKey,
    wireId: `C-101-${input.conductorKey}`
  };
}

function modelWithCableAssembly(): DrawingModel {
  const model = createDefaultDrawingModel();
  const firstSheet = model.sheets[0];

  return {
    ...model,
    assets: [
      {
        id: "asset_c_101",
        tag: "C-101",
        type: "cable",
        title: "CLX Cable 1 Pair",
        symbolId: cableSymbol.symbolId,
        versionId: cableSymbol.versionId
      },
      {
        id: "asset_tt_101",
        tag: "TT-101",
        type: "instrument",
        title: "Temperature Probe",
        symbolId: instrumentSymbol.symbolId,
        versionId: instrumentSymbol.versionId
      },
      {
        id: "asset_tb_101",
        tag: "TB-101",
        type: "terminal_block",
        title: "Terminal Block",
        symbolId: "__generated_terminal_block__",
        versionId: "generated_terminal_block_v1"
      }
    ],
    sheets: [
      {
        ...firstSheet,
        name: "Field Wiring",
        placements: [instrumentPlacement(), cablePlacement()],
        connections: [
          connection({
            id: "conn_wht",
            fromPlacementId: "tt_101",
            toPlacementId: "cable_101",
            conductorKey: "WHT"
          }),
          connection({
            id: "conn_blk",
            fromPlacementId: "tt_101",
            toPlacementId: "cable_101",
            conductorKey: "BLK"
          })
        ]
      },
      {
        ...firstSheet,
        id: "sheet_2",
        name: "Reference",
        placements: [
          cablePlacement({
            id: "cable_101_reference",
            x: 200
          })
        ],
        connections: []
      }
    ]
  };
}

function cableTemplate(): SymbolBomTemplateDetail {
  return {
    id: "template_cable",
    symbolId: cableSymbol.symbolId,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    lines: [
      {
        id: "line_cable",
        itemId: cableItem.id,
        lineNumber: 1,
        quantityRule: "fixed_per_assembly",
        quantity: 1,
        item: cableItem
      },
      {
        id: "line_gland",
        itemId: glandItem.id,
        lineNumber: 2,
        quantityRule: "per_cable_end",
        quantity: 1,
        item: glandItem
      },
      {
        id: "line_wire_end",
        itemId: wireEndItem.id,
        lineNumber: 3,
        quantityRule: "per_conductor_termination",
        quantity: 1,
        item: wireEndItem
      },
      {
        id: "line_sealant",
        itemId: sealantItem.id,
        lineNumber: 4,
        quantityRule: "per_connection",
        quantity: 1,
        item: sealantItem
      },
      {
        id: "line_label",
        itemId: labelItem.id,
        lineNumber: 5,
        quantityRule: "manual",
        quantity: 1,
        item: labelItem
      }
    ]
  };
}

describe("bom creator", () => {
  it("validates required item fields", () => {
    expect(() =>
      bomItemInputSchema.parse({
        displayName: "",
        category: "cable",
        unit: "each"
      })
    ).toThrow();

    expect(
      bomItemInputSchema.parse({
        displayName: "Instrument Cable",
        category: "cable",
        unit: "m"
      })
    ).toMatchObject({ displayName: "Instrument Cable" });
  });

  it("validates small category and manufacturer option inputs", () => {
    expect(bomItemOptionInputSchema.parse({ name: "Cable Tray" })).toEqual({
      name: "Cable Tray"
    });

    expect(() => bomItemOptionInputSchema.parse({ name: "" })).toThrow();
  });

  it("validates item image and supplier cost fields", () => {
    expect(
      bomItemInputSchema.parse({
        displayName: "Cable Gland",
        category: "cable_gland",
        unit: "each",
        supplierName: "ACME Supply",
        supplierSku: "ACME-M20",
        unitCost: "12.50",
        currency: "USD",
        leadTimeDays: "14",
        minimumOrderQuantity: "10",
        images: [
          {
            fileName: "gland.png",
            mimeType: "image/png",
            sizeBytes: 3,
            dataUrl: "data:image/png;base64,YWJj",
            caption: "Installed gland",
            isPrimary: true,
            sortOrder: 0
          }
        ]
      })
    ).toMatchObject({
      supplierName: "ACME Supply",
      unitCost: 12.5,
      leadTimeDays: 14,
      images: [{ isPrimary: true }]
    });
  });

  it("rejects invalid BOM item image inputs", () => {
    expect(() =>
      bomItemImagesInputSchema.parse([
        {
          fileName: "document.pdf",
          mimeType: "application/pdf",
          sizeBytes: 1024,
          dataUrl: "data:application/pdf;base64,abc",
          isPrimary: false,
          sortOrder: 0
        }
      ])
    ).toThrow(/image/);

    expect(() =>
      bomItemImagesInputSchema.parse([
        {
          fileName: "large.png",
          mimeType: "image/png",
          sizeBytes: MAX_BOM_ITEM_IMAGE_BYTES + 1,
          dataUrl: "data:image/png;base64,YWJj",
          isPrimary: false,
          sortOrder: 0
        }
      ])
    ).toThrow();

    expect(() =>
      bomItemImagesInputSchema.parse([
        {
          fileName: "first.png",
          mimeType: "image/png",
          sizeBytes: 3,
          dataUrl: "data:image/png;base64,YWJj",
          isPrimary: true,
          sortOrder: 0
        },
        {
          fileName: "second.png",
          mimeType: "image/png",
          sizeBytes: 3,
          dataUrl: "data:image/png;base64,YWJj",
          isPrimary: true,
          sortOrder: 1
        }
      ])
    ).toThrow(/Only one/);
  });

  it("rejects symbol templates that reference items outside the library", () => {
    expect(() =>
      validateSymbolBomTemplateInput(
        {
          symbolId: cableSymbol.symbolId,
          lines: [
            {
              itemId: "missing_item",
              quantityRule: "fixed_per_assembly",
              quantity: 1
            }
          ]
        },
        [cableItem]
      )
    ).toThrow(/outside the library/);
  });

  it("expands a cable assembly mini BOM and aggregates calculated items", () => {
    const bom = generateDrawingBom({
      drawingId: "drawing_1",
      drawingTitle: "Tank Wiring",
      model: modelWithCableAssembly(),
      symbols: [cableSymbol, instrumentSymbol],
      templates: [cableTemplate()]
    });
    const cableAssembly = bom.assemblies.find(
      (assembly) => assembly.assetTag === "C-101"
    );

    expect(cableAssembly?.lines).toHaveLength(5);
    expect(
      cableAssembly?.lines.find((line) => line.itemId === glandItem.id)?.quantity
    ).toBe(2);
    expect(
      cableAssembly?.lines.find((line) => line.itemId === wireEndItem.id)?.quantity
    ).toBe(2);
    expect(
      bom.consolidatedLines.find((line) => line.itemId === glandItem.id)
        ?.quantity
    ).toBe(2);
  });

  it("counts a shared drawing asset once across multiple sheets", () => {
    const bom = generateDrawingBom({
      drawingId: "drawing_1",
      drawingTitle: "Tank Wiring",
      model: modelWithCableAssembly(),
      symbols: [cableSymbol, instrumentSymbol],
      templates: [cableTemplate()]
    });

    expect(
      bom.assemblies.filter((assembly) => assembly.assetTag === "C-101")
    ).toHaveLength(1);
    expect(
      bom.assemblies.find((assembly) => assembly.assetTag === "C-101")?.sheetRefs
    ).toHaveLength(2);
  });

  it("warns for missing templates, generated symbols, manual quantities, and archived items", () => {
    const bom = generateDrawingBom({
      drawingId: "drawing_1",
      drawingTitle: "Tank Wiring",
      model: modelWithCableAssembly(),
      symbols: [cableSymbol, instrumentSymbol],
      templates: [cableTemplate()]
    });

    expect(bom.warnings.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "missing_template",
        "generated_symbol",
        "manual_quantity_required",
        "archived_item"
      ])
    );
  });
});
