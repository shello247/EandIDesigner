import { describe, expect, it } from "vitest";
import {
  createDefaultDrawingModel,
  drawingPackageModelSchema,
  type DrawingModel,
  type DrawingSheetCanvasModel
} from "@/features/drawing_canvas/data/schema";
import {
  assignPlacementToContainer,
  createPanelEnclosurePlacement
} from "@/features/drawing_canvas/logic/services/drawing-asset-containment";
import { renameDrawingAssetTag } from "@/features/drawing_canvas/logic/services/drawing-asset-identity";
import { getAnchorForEndpoint } from "@/features/drawing_canvas/logic/services/drawing-connections";
import { createTerminalBlockPlacement } from "@/features/drawing_canvas/logic/services/drawing-terminal-blocks";
import { renderDrawingToSvg } from "@/features/drawing_canvas/logic/services/drawing-svg-renderer";
import { terminalBlockPlacementSchema } from "../data/schema";
import {
  normalizeTerminalBlockPlacement,
  terminalBlockAnchors,
  terminalBlockMetadata,
  terminalBlockTerminals
} from "../logic/services/terminal-block-layout";
import { renderTerminalBlockSvg } from "../logic/services/terminal-block-renderer";
import {
  buildTerminalBlockCatalog,
  detectTerminalBlockWarnings
} from "../logic/services/terminal-block-qc";

describe("configurable terminal block module", () => {
  it("accepts generated terminal block placement metadata", () => {
    const config = terminalBlockPlacementSchema.parse({
      kind: "modular_terminal_strip",
      count: 5,
      startNumber: 1,
      orientation: "horizontal",
      modulePitch: 20,
      moduleWidth: 20,
      moduleHeight: 178
    });

    expect(config).toMatchObject({
      count: 5,
      startNumber: 1,
      orientation: "horizontal"
    });
  });

  it("stores generated terminal blocks in drawing model json", () => {
    const model = createDefaultDrawingModel();
    const placement = createTerminalBlockPlacement({
      model,
      activeSheet: model.sheets[0],
      assetId: "asset_tb_101",
      tag: "TB-101"
    });
    const parsed = drawingPackageModelSchema.parse({
      ...model,
      sheets: [
        {
          ...model.sheets[0],
          placements: [placement]
        }
      ]
    });

    expect(parsed.sheets[0].placements[0]).toMatchObject({
      role: "terminal_block",
      tag: "TB-101",
      terminalBlock: {
        kind: "modular_terminal_strip",
        count: 5,
        startNumber: 1
      }
    });
  });

  it("allocates TB tags across the package", () => {
    const first = createDefaultDrawingModel();
    const firstTerminalBlock = createTerminalBlockPlacement({
      model: first,
      activeSheet: first.sheets[0]
    });
    const secondModel: DrawingModel = {
      ...first,
      sheets: [
        {
          ...first.sheets[0],
          placements: [firstTerminalBlock]
        }
      ]
    };
    const secondTerminalBlock = createTerminalBlockPlacement({
      model: secondModel,
      activeSheet: secondModel.sheets[0]
    });

    expect(firstTerminalBlock.tag).toBe("TB-101");
    expect(secondTerminalBlock.tag).toBe("TB-102");
  });

  it("generates terminal labels, common top and bottom anchors, and metadata", () => {
    const config = normalizeTerminalBlockPlacement({
      count: 3,
      startNumber: 7,
      orientation: "horizontal"
    });
    const terminals = terminalBlockTerminals(config);
    const anchors = terminalBlockAnchors(config);
    const metadata = terminalBlockMetadata(config);

    expect(terminals.map((terminal) => terminal.label)).toEqual([
      "7",
      "8",
      "9"
    ]);
    expect(anchors.map((anchor) => anchor.key)).toEqual([
      "T7_TOP",
      "T7_BOTTOM",
      "T8_TOP",
      "T8_BOTTOM",
      "T9_TOP",
      "T9_BOTTOM"
    ]);
    expect(metadata.terminals.filter((terminal) => terminal.key === "T7")).toHaveLength(2);
    expect(metadata.viewBox.width).toBe(60);
  });

  it("renders repeated terminal modules without duplicate svg ids", () => {
    const svg = renderTerminalBlockSvg(
      normalizeTerminalBlockPlacement({
        count: 4,
        startNumber: 1,
        orientation: "horizontal"
      })
    );

    expect(svg.match(/data-terminal-module="true"/g)).toHaveLength(4);
    expect(svg).not.toContain("id=");
    expect(svg).not.toContain("url(#");
  });

  it("resolves generated terminal anchors for connections and svg rendering", () => {
    const model = createDefaultDrawingModel();
    const terminalBlock = createTerminalBlockPlacement({
      model,
      activeSheet: model.sheets[0],
      assetId: "asset_tb_101",
      tag: "TB-101",
      terminalBlock: { count: 2, startNumber: 1, orientation: "horizontal" }
    });
    const canvas: DrawingSheetCanvasModel = {
      sheet: {
        ...model.sheets[0].page,
        titleBlock: model.titleBlock
      },
      placements: [terminalBlock],
      connections: [
        {
          id: "conn_tb_1",
          from: { placementId: terminalBlock.id, anchorKey: "T1_TOP" },
          to: { placementId: terminalBlock.id, anchorKey: "T2_BOTTOM" }
        }
      ],
      annotations: []
    };

    expect(
      getAnchorForEndpoint(canvas, [], {
        placementId: terminalBlock.id,
        anchorKey: "T1_TOP"
      })?.anchor.key
    ).toBe("T1_TOP");

    const svg = renderDrawingToSvg({
      model: canvas,
      approvedSymbols: []
    });

    expect(svg).toContain('data-generated-terminal-block="true"');
    expect(svg).toContain("conn_tb_1");
  });

  it("supports panel containment and linked terminal block tag renaming", () => {
    const model = createDefaultDrawingModel();
    const panel = createPanelEnclosurePlacement({
      model,
      activeSheet: model.sheets[0],
      assetId: "asset_pdp_101",
      tag: "PDP-101"
    });
    const terminalBlock = createTerminalBlockPlacement({
      model,
      activeSheet: model.sheets[0],
      assetId: "asset_tb_101",
      tag: "TB-101"
    });
    const canvas = assignPlacementToContainer(
      {
        sheet: {
          ...model.sheets[0].page,
          titleBlock: model.titleBlock
        },
        placements: [panel, terminalBlock],
        connections: [],
        annotations: []
      },
      terminalBlock.id,
      "asset_pdp_101"
    );
    const linkedModel: DrawingModel = {
      ...model,
      sheets: [
        {
          ...model.sheets[0],
          placements: canvas.placements
        },
        {
          ...model.sheets[0],
          id: "sheet_2",
          name: "Sheet 2",
          placements: [{ ...terminalBlock, id: "tb_sheet_2" }]
        }
      ]
    };
    const renamed = renameDrawingAssetTag(linkedModel, "asset_tb_101", "TB-201", []);

    expect(canvas.placements[1].containerAssetId).toBe("asset_pdp_101");
    expect(
      renamed.sheets.flatMap((sheet) =>
        sheet.placements
          .filter((placement) => placement.assetId === "asset_tb_101")
          .map((placement) => placement.tag)
      )
    ).toEqual(["TB-201", "TB-201"]);
  });

  it("builds catalog entries and reports linked config mismatches", () => {
    const model = createDefaultDrawingModel();
    const terminalBlock = createTerminalBlockPlacement({
      model,
      activeSheet: model.sheets[0],
      assetId: "asset_tb_101",
      tag: "TB-101"
    });
    const placements = [
      terminalBlock,
      {
        ...terminalBlock,
        id: "tb_ref",
        terminalBlock: normalizeTerminalBlockPlacement({
          count: 6,
          startNumber: 1,
          orientation: "horizontal"
        })
      }
    ];

    expect(buildTerminalBlockCatalog(placements)[0]).toMatchObject({
      tag: "TB-101",
      terminalLabels: ["1", "2", "3", "4", "5"]
    });
    expect(detectTerminalBlockWarnings(placements)[0]).toMatchObject({
      code: "linked_config_mismatch"
    });
  });
});
