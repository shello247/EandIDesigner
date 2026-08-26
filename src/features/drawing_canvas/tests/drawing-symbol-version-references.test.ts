import { describe, expect, it } from "vitest";
import {
  GENERATED_TERMINAL_BLOCK_SYMBOL_ID,
  GENERATED_TERMINAL_BLOCK_VERSION_ID
} from "@/features/drawing_terminal_blocks/logic/services/terminal-block-layout";
import { drawingModelSchema, createDefaultDrawingModel } from "../data/schema";
import {
  GENERATED_BACKPLANE_SYMBOL_ID,
  GENERATED_BACKPLANE_VERSION_ID
} from "../logic/services/drawing-backplane-layouts";
import {
  GENERATED_PANEL_ENCLOSURE_SYMBOL_ID,
  GENERATED_PANEL_ENCLOSURE_VERSION_ID
} from "../logic/services/drawing-enclosure-constants";
import {
  structuredTerminalStripSymbolId,
  structuredTerminalStripVersionId
} from "../logic/services/drawing-generated-symbols";
import {
  GENERATED_HORIZONTAL_DIMENSION_SYMBOL_ID,
  GENERATED_HORIZONTAL_DIMENSION_VERSION_ID,
  GENERATED_VERTICAL_DIMENSION_SYMBOL_ID,
  GENERATED_VERTICAL_DIMENSION_VERSION_ID
} from "../logic/services/drawing-layout-dimensions";
import {
  GENERATED_PANEL_CONNECTION_VIEW_SYMBOL_ID,
  GENERATED_PANEL_CONNECTION_VIEW_VERSION_ID
} from "../logic/services/drawing-panel-connection-views";
import {
  GENERATED_PANEL_PATTERN_LEGEND_SYMBOL_ID,
  GENERATED_PANEL_PATTERN_LEGEND_VERSION_ID,
  GENERATED_PANEL_REFERENCE_SYMBOL_ID,
  GENERATED_PANEL_REFERENCE_VERSION_ID
} from "../logic/services/drawing-panel-reference-symbols";
import type { ApprovedDrawingSymbol } from "../types";
import {
  collectDrawingSymbolVersionIds,
  selectDrawingRenderDependencies
} from "../logic/services/drawing-symbol-version-references";
import {
  GENERATED_TERMINAL_BLOCK_GROUP_LIBRARY_SYMBOL_ID,
  GENERATED_TERMINAL_BLOCK_GROUP_LIBRARY_VERSION_ID
} from "../logic/services/drawing-terminal-block-groups";
import {
  GENERATED_WIRE_TRAY_SYMBOL_ID,
  GENERATED_WIRE_TRAY_VERSION_ID
} from "../logic/services/drawing-wire-tray-layouts";

function componentSelection(versionId: string, childVersionId?: string) {
  return {
    positionKey: "main_position",
    componentKey: "main_component",
    symbolId: `symbol_${versionId}`,
    versionId,
    children: childVersionId
      ? [
          {
            positionKey: "child_position",
            componentKey: "child_component",
            symbolId: `symbol_${childVersionId}`,
            versionId: childVersionId
          }
        ]
      : undefined
  };
}

function approvedSymbol(versionId: string): ApprovedDrawingSymbol {
  return {
    symbolId: `symbol_${versionId}`,
    symbolKey: `key_${versionId}`,
    displayName: versionId,
    category: "instrument",
    versionId,
    versionNumber: 1,
    svg: "<svg></svg>",
    metadata: {
      symbolKey: `key_${versionId}`,
      displayName: versionId,
      category: "instrument",
      viewBox: { x: 0, y: 0, width: 10, height: 10 },
      anchors: [],
      terminals: []
    }
  };
}

function placement(input: {
  id: string;
  symbolId: string;
  versionId: string;
  terminalBlock?: {
    kind: "modular_terminal_strip";
    count: number;
    startNumber: number;
    orientation: "horizontal";
    modulePitch: number;
    moduleWidth: number;
    moduleHeight: number;
    moduleTemplate?: {
      symbolId: string;
      versionId: string;
      pitchMm: number;
      heightMm: number;
    };
  };
}) {
  return {
    id: input.id,
    symbolId: input.symbolId,
    versionId: input.versionId,
    role: "device" as const,
    tag: input.id.toUpperCase(),
    x: 10,
    y: 20,
    rotation: 0,
    scale: 1,
    terminalBlock: input.terminalBlock
  };
}

const moduleTemplate = (symbolId: string, versionId: string) => ({
  symbolId,
  versionId,
  pitchMm: 5.2,
  heightMm: 42
});

describe("drawing symbol version references", () => {
  it("collects every persisted render dependency exactly once", () => {
    const model = createDefaultDrawingModel();
    model.sheets[0].placements.push(
      placement({
        id: "regular_placement",
        symbolId: "symbol_placement",
        versionId: "version_placement",
        terminalBlock: {
          kind: "modular_terminal_strip",
          count: 4,
          startNumber: 1,
          orientation: "horizontal",
          modulePitch: 5.2,
          moduleWidth: 5.2,
          moduleHeight: 42,
          moduleTemplate: moduleTemplate(
            "symbol_placement_module",
            "version_placement_module"
          )
        }
      }),
      placement({
        id: "generated_terminal",
        symbolId: GENERATED_TERMINAL_BLOCK_SYMBOL_ID,
        versionId: GENERATED_TERMINAL_BLOCK_VERSION_ID,
        terminalBlock: {
          kind: "modular_terminal_strip",
          count: 6,
          startNumber: 1,
          orientation: "horizontal",
          modulePitch: 6.2,
          moduleWidth: 6.2,
          moduleHeight: 48,
          moduleTemplate: moduleTemplate(
            "symbol_generated_module",
            "version_generated_module"
          )
        }
      })
    );
    model.assets.push(
      {
        id: "asset_device",
        tag: "DEV-101",
        type: "instrument",
        title: "Managed device",
        symbolId: "symbol_asset",
        versionId: "version_asset",
        componentSelections: [
          componentSelection("version_asset_component", "version_asset_nested")
        ]
      },
      {
        id: "asset_terminal",
        tag: "TB-101",
        type: "terminal_block",
        title: "Generated terminal block",
        symbolId: GENERATED_TERMINAL_BLOCK_SYMBOL_ID,
        versionId: GENERATED_TERMINAL_BLOCK_VERSION_ID,
        terminalBlock: {
          kind: "modular_terminal_strip",
          count: 6,
          startNumber: 1,
          orientation: "horizontal",
          modulePitch: 6.2,
          moduleWidth: 6.2,
          moduleHeight: 48,
          moduleTemplate: moduleTemplate(
            "symbol_asset_module",
            "version_asset_module"
          )
        }
      },
      {
        id: "asset_strip",
        tag: "TB-201",
        type: "terminal_block",
        title: "Structured terminal strip",
        symbolId: structuredTerminalStripSymbolId("asset_strip"),
        versionId: structuredTerminalStripVersionId("asset_strip"),
        terminalStrip: {
          kind: "structured_terminal_strip",
          nextMemberNumber: 2,
          members: [
            {
              id: "member_1",
              token: "M01",
              symbolId: "symbol_member",
              versionId: "version_member",
              role: "electrical",
              designation: "1",
              componentSelections: [
                componentSelection(
                  "version_member_component",
                  "version_member_nested"
                )
              ]
            }
          ]
        }
      }
    );

    const references = collectDrawingSymbolVersionIds(
      drawingModelSchema.parse(model)
    );
    const expected = [
      "version_placement",
      "version_placement_module",
      "version_generated_module",
      "version_asset",
      "version_asset_component",
      "version_asset_nested",
      "version_asset_module",
      "version_member",
      "version_member_component",
      "version_member_nested"
    ];

    expect(references).toHaveLength(expected.length);
    expect([...references].sort()).toEqual([...expected].sort());
  });

  it("excludes exact system-generated versions without guessing from names", () => {
    const model = createDefaultDrawingModel();
    const generatedReferences = [
      [GENERATED_TERMINAL_BLOCK_SYMBOL_ID, GENERATED_TERMINAL_BLOCK_VERSION_ID],
      [GENERATED_PANEL_ENCLOSURE_SYMBOL_ID, GENERATED_PANEL_ENCLOSURE_VERSION_ID],
      [GENERATED_BACKPLANE_SYMBOL_ID, GENERATED_BACKPLANE_VERSION_ID],
      [GENERATED_WIRE_TRAY_SYMBOL_ID, GENERATED_WIRE_TRAY_VERSION_ID],
      [
        GENERATED_HORIZONTAL_DIMENSION_SYMBOL_ID,
        GENERATED_HORIZONTAL_DIMENSION_VERSION_ID
      ],
      [
        GENERATED_VERTICAL_DIMENSION_SYMBOL_ID,
        GENERATED_VERTICAL_DIMENSION_VERSION_ID
      ],
      [
        GENERATED_PANEL_CONNECTION_VIEW_SYMBOL_ID,
        GENERATED_PANEL_CONNECTION_VIEW_VERSION_ID
      ],
      [GENERATED_PANEL_REFERENCE_SYMBOL_ID, GENERATED_PANEL_REFERENCE_VERSION_ID],
      [
        GENERATED_PANEL_PATTERN_LEGEND_SYMBOL_ID,
        GENERATED_PANEL_PATTERN_LEGEND_VERSION_ID
      ],
      [
        GENERATED_TERMINAL_BLOCK_GROUP_LIBRARY_SYMBOL_ID,
        GENERATED_TERMINAL_BLOCK_GROUP_LIBRARY_VERSION_ID
      ],
      [
        structuredTerminalStripSymbolId("asset_generated"),
        structuredTerminalStripVersionId("asset_generated")
      ]
    ] as const;

    model.sheets[0].placements.push(
      ...generatedReferences.map(([symbolId, versionId], index) =>
        placement({ id: `generated_${index}`, symbolId, versionId })
      ),
      placement({
        id: "persisted_generated_name",
        symbolId: "persisted_symbol",
        versionId: "version_with_generated_in_its_name"
      }),
      placement({
        id: "missing_historical",
        symbolId: "removed_symbol",
        versionId: "missing_exact_historical_version"
      })
    );

    expect(
      collectDrawingSymbolVersionIds(drawingModelSchema.parse(model))
    ).toEqual([
      "version_with_generated_in_its_name",
      "missing_exact_historical_version"
    ]);
  });

  it("keeps unrelated loaded catalogue records outside engineering dependencies", () => {
    const model = createDefaultDrawingModel();
    model.sheets[0].placements.push(
      placement({
        id: "referenced",
        symbolId: "symbol_referenced_version",
        versionId: "referenced_version"
      })
    );
    const referenced = approvedSymbol("referenced_version");
    const browsedOnly = approvedSymbol("browsed_only_version");

    expect(
      selectDrawingRenderDependencies(
        drawingModelSchema.parse(model),
        [referenced, browsedOnly]
      )
    ).toEqual([referenced]);
  });
});
