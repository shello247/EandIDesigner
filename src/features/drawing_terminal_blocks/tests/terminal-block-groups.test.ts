import { describe, expect, it } from "vitest";
import type { ApprovedDrawingSymbol } from "@/features/drawing_canvas/types";
import {
  buildTerminalBlockGroupDefinition,
  getTerminalBlockGroupPhysicalSize,
  resolveDefaultTerminalBlockModule
} from "../logic/services/terminal-block-groups";
import { terminalBlockAnchors } from "../logic/services/terminal-block-layout";
import { renderTerminalBlockSvg } from "../logic/services/terminal-block-renderer";

const terminalModule: ApprovedDrawingSymbol = {
  symbolId: "symbol_terminal_module",
  symbolKey: "terminal_block_single_scaled",
  displayName: "Terminal Block Single Scaled",
  category: "terminal_block",
  versionId: "version_terminal_module",
  versionNumber: 1,
  svg: '<svg viewBox="0 0 20 178" xmlns="http://www.w3.org/2000/svg"><rect width="20" height="178" fill="white" stroke="black"/></svg>',
  metadata: {
    symbolKey: "terminal_block_single_scaled",
    displayName: "Terminal Block Single Scaled",
    category: "terminal_block",
    layoutUsage: "both",
    panelCategory: "termination",
    mountingType: "din_rail",
    physicalWidthMm: 5.2,
    physicalHeightMm: 50,
    viewBox: { x: 0, y: 0, width: 20, height: 178 },
    anchors: [
      { key: "1", x: 10, y: 10, kind: "terminal" },
      { key: "2", x: 10, y: 168, kind: "terminal" }
    ],
    terminals: []
  }
};

describe("terminal block groups", () => {
  it("resolves the legacy scaled terminal as the default internal module", () => {
    const result = resolveDefaultTerminalBlockModule([terminalModule]);

    expect(result).toMatchObject({
      ok: true,
      module: {
        symbolId: terminalModule.symbolId,
        pitchMm: 5.2,
        heightMm: 50,
        terminalAnchors: terminalModule.metadata.anchors,
        source: "legacy_default"
      }
    });
  });

  it("maps approved module terminal anchors into every generated module", () => {
    const configuredModule: ApprovedDrawingSymbol = {
      ...terminalModule,
      symbolId: "symbol_pt_2_5",
      symbolKey: "phoenix_contact_pt_2_5_3209510",
      versionId: "version_pt_2_5",
      metadata: {
        ...terminalModule.metadata,
        physicalHeightMm: 48.6,
        viewBox: { x: 0, y: 0, width: 20, height: 184 },
        anchors: [
          { key: "1", x: 10, y: 10, kind: "terminal" },
          { key: "2", x: 10, y: 170, kind: "terminal" }
        ],
        terminalBlockModule: {
          kind: "feed_through",
          defaultForGeneratedGroups: true
        }
      }
    };
    const resolution = resolveDefaultTerminalBlockModule([configuredModule]);
    if (!resolution.ok) throw new Error(resolution.error);

    const definition = buildTerminalBlockGroupDefinition({
      count: 2,
      module: resolution.module
    });
    const anchors = terminalBlockAnchors(definition, resolution.module);

    expect(getTerminalBlockGroupPhysicalSize(definition)).toEqual({
      lengthMm: 10.4,
      widthMm: 48.6
    });
    expect(anchors).toEqual([
      { key: "T1_TOP", x: 10, y: 10, kind: "terminal" },
      { key: "T1_BOTTOM", x: 10, y: 170, kind: "terminal" },
      { key: "T2_TOP", x: 30, y: 10, kind: "terminal" },
      { key: "T2_BOTTOM", x: 30, y: 170, kind: "terminal" }
    ]);
  });

  it("maps non-zero-origin module anchors through the rendered module scale", () => {
    const definition = {
      ...buildTerminalBlockGroupDefinition({
        count: 2,
        module: {
          symbolId: "symbol_offset",
          versionId: "version_offset",
          symbolKey: "offset_module",
          displayName: "Offset module",
          svg: '<svg viewBox="100 200 40 100"/>',
          viewBox: { x: 100, y: 200, width: 40, height: 100 },
          terminalAnchors: [
            { key: "bottom", x: 130, y: 290, kind: "terminal" },
            { key: "top", x: 120, y: 210, kind: "terminal" }
          ],
          pitchMm: 5.2,
          heightMm: 48.6,
          source: "configured"
        }
      }),
      modulePitch: 20,
      moduleWidth: 20,
      moduleHeight: 184
    };
    const moduleGeometry = {
      viewBox: { x: 100, y: 200, width: 40, height: 100 },
      terminalAnchors: [
        { key: "bottom", x: 130, y: 290, kind: "terminal" as const },
        { key: "top", x: 120, y: 210, kind: "terminal" as const }
      ]
    };

    expect(terminalBlockAnchors(definition, moduleGeometry)).toEqual([
      { key: "T1_TOP", x: 10, y: 18.4, kind: "terminal" },
      { key: "T1_BOTTOM", x: 15, y: 165.6, kind: "terminal" },
      { key: "T2_TOP", x: 30, y: 18.4, kind: "terminal" },
      { key: "T2_BOTTOM", x: 35, y: 165.6, kind: "terminal" }
    ]);
  });

  it("builds fixed 1..N definitions and physical dimensions", () => {
    const resolution = resolveDefaultTerminalBlockModule([terminalModule]);
    if (!resolution.ok) throw new Error(resolution.error);

    const definition = buildTerminalBlockGroupDefinition({
      count: 5,
      module: resolution.module
    });

    expect(definition).toMatchObject({
      kind: "modular_terminal_strip",
      count: 5,
      startNumber: 1,
      moduleTemplate: {
        symbolId: terminalModule.symbolId,
        versionId: terminalModule.versionId,
        pitchMm: 5.2,
        heightMm: 50
      }
    });
    expect(getTerminalBlockGroupPhysicalSize(definition)).toEqual({
      lengthMm: 26,
      widthMm: 50
    });
  });

  it("rejects singular new groups and repeats the approved module", () => {
    const resolution = resolveDefaultTerminalBlockModule([terminalModule]);
    if (!resolution.ok) throw new Error(resolution.error);

    expect(() =>
      buildTerminalBlockGroupDefinition({
        count: 1,
        module: resolution.module
      })
    ).toThrow();

    const definition = buildTerminalBlockGroupDefinition({
      count: 3,
      module: resolution.module
    });
    const svg = renderTerminalBlockSvg(definition, {
      module: resolution.module,
      instanceId: "tb-101"
    });

    expect(svg.match(/data-terminal-module="true"/g)).toHaveLength(3);
    expect(svg).toContain('id="terminal-block-module-tb-101"');
    expect(svg).toContain(">1</text>");
    expect(svg).toContain(">3</text>");
  });
});
