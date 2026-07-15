import { describe, expect, it } from "vitest";
import type { ApprovedDrawingSymbol } from "@/features/drawing_canvas/types";
import {
  buildTerminalBlockGroupDefinition,
  getTerminalBlockGroupPhysicalSize,
  resolveDefaultTerminalBlockModule
} from "../logic/services/terminal-block-groups";
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
    anchors: [],
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
        source: "legacy_default"
      }
    });
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
