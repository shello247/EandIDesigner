import { describe, expect, it } from "vitest";
import type { TerminalStripMemberSymbol } from "../api/public";
import {
  composeTerminalStripGeometry,
  projectStructuredTerminalStripTerminals,
  renderStructuredTerminalStripSvg
} from "../api/public";

const symbols: TerminalStripMemberSymbol[] = [
  {
    symbolId: "small",
    versionId: "small_v1",
    displayName: "Small terminal",
    svg: '<svg viewBox="0 0 10 20"/>',
    metadata: {
      symbolKey: "small",
      displayName: "Small terminal",
      category: "terminal_block",
      layoutUsage: "panel_layout",
      physicalWidthMm: 5,
      physicalHeightMm: 20,
      mountingType: "din_rail",
      terminalStripCapability: { role: "electrical", railDatumMm: 12 },
      viewBox: { x: 0, y: 0, width: 10, height: 20 },
      anchors: [{ key: "a", x: 10, y: 20, kind: "terminal" }],
      terminals: [
        {
          key: "1",
          label: "1",
          anchorKey: "a",
          panelSide: "single",
          requiredForWiring: true
        }
      ]
    }
  },
  {
    symbolId: "tall",
    versionId: "tall_v1",
    displayName: "Tall terminal",
    svg: '<svg viewBox="0 0 10 30"/>',
    metadata: {
      symbolKey: "tall",
      displayName: "Tall terminal",
      category: "terminal_block",
      layoutUsage: "panel_layout",
      physicalWidthMm: 8,
      physicalHeightMm: 30,
      mountingType: "din_rail",
      terminalStripCapability: { role: "electrical", railDatumMm: 20 },
      viewBox: { x: 0, y: 0, width: 10, height: 30 },
      anchors: [{ key: "line", x: 0, y: 15, kind: "terminal" }],
      terminals: [
        {
          key: "LINE",
          label: "Line",
          anchorKey: "line",
          panelSide: "external",
          requiredForWiring: true
        }
      ]
    }
  }
];

const strip = {
  kind: "structured_terminal_strip" as const,
  nextMemberNumber: 3,
  members: [
    {
      id: "member_1",
      token: "M01",
      symbolId: "small",
      versionId: "small_v1",
      role: "electrical" as const,
      designation: "1"
    },
    {
      id: "member_2",
      token: "M02",
      symbolId: "tall",
      versionId: "tall_v1",
      role: "electrical" as const,
      designation: "F1"
    }
  ]
};

describe("terminal strip composition geometry", () => {
  it("aligns mixed members on a shared DIN-rail datum", () => {
    const result = composeTerminalStripGeometry(strip, symbols);

    expect(result.widthMm).toBe(13);
    expect(result.heightMm).toBe(30);
    expect(result.railDatumMm).toBe(20);
    expect(result.members[0]).toMatchObject({ xMm: 0, yMm: 8 });
    expect(result.members[1]).toMatchObject({ xMm: 5, yMm: 0 });
  });

  it("projects namespaced terminals while preserving terminal attributes", () => {
    const result = projectStructuredTerminalStripTerminals(strip, symbols);

    expect(result.terminals.map((terminal) => terminal.key)).toEqual([
      "M01.1",
      "M02.LINE"
    ]);
    expect(result.terminals[1].panelSide).toBe("external");
    expect(result.terminals[1].label).toMatch(/^2\s/);
    expect(result.anchors.map((anchor) => anchor.key)).toEqual([
      "M01.a",
      "M02.line"
    ]);
  });

  it("namespaces permanent member topology without joining unrelated members", () => {
    const twoTerminalSymbols: TerminalStripMemberSymbol[] = [
      {
        ...symbols[0],
        metadata: {
          ...symbols[0].metadata,
          anchors: [
            { key: "a", x: 0, y: 20, kind: "terminal" },
            { key: "b", x: 10, y: 20, kind: "terminal" }
          ],
          terminals: [
            {
              key: "1",
              label: "1",
              anchorKey: "a",
              panelSide: "external",
              requiredForWiring: true
            },
            {
              key: "2",
              label: "2",
              anchorKey: "b",
              panelSide: "internal",
              requiredForWiring: true
            }
          ],
          electricalTopology: {
            version: 1,
            permanentContinuityGroups: [
              { key: "feed", terminalKeys: ["1", "2"] }
            ]
          }
        }
      },
      symbols[1]
    ];
    const projected = projectStructuredTerminalStripTerminals(
      strip,
      twoTerminalSymbols
    );

    expect(projected.electricalTopology).toEqual({
      version: 1,
      permanentContinuityGroups: [
        {
          key: "M01.feed",
          terminalKeys: ["M01.1", "M01.2"]
        }
      ]
    });
  });

  it("renders pinned installed components inside member artwork", () => {
    const componentSymbols: TerminalStripMemberSymbol[] = [
      {
        ...symbols[0],
        metadata: {
          ...symbols[0].metadata,
          componentPositions: [
            {
              key: "fuse",
              label: "Fuse",
              required: true,
              components: [
                {
                  key: "cartridge",
                  label: "Cartridge",
                  box: {
                    centerX: 5,
                    centerY: 10,
                    width: 4,
                    height: 8,
                    rotationDeg: 0
                  },
                  allowedSymbolIds: ["fuse"]
                }
              ]
            }
          ]
        }
      },
      symbols[1],
      {
        symbolId: "fuse",
        versionId: "fuse_v1",
        displayName: "Fuse",
        svg: '<svg viewBox="0 0 2 6"><rect width="2" height="6"/></svg>',
        metadata: {
          symbolKey: "fuse",
          displayName: "Fuse",
          category: "protection",
          layoutUsage: "panel_layout",
          physicalWidthMm: 2,
          physicalHeightMm: 6,
          mountingType: "surface",
          viewBox: { x: 0, y: 0, width: 2, height: 6 },
          anchors: [],
          terminals: []
        }
      }
    ];
    const withComponent = {
      ...strip,
      members: strip.members.map((member, index) =>
        index === 0
          ? {
              ...member,
              componentSelections: [
                {
                  positionKey: "fuse",
                  componentKey: "cartridge",
                  symbolId: "fuse",
                  versionId: "fuse_v1"
                }
              ]
            }
          : member
      )
    };

    const svg = renderStructuredTerminalStripSvg(withComponent, componentSymbols);

    expect(svg).toContain(">2</text>");
    expect(svg).toContain('data-terminal-strip-component-path="Fuse"');
    expect(svg).toContain('data-component-symbol-id="fuse"');
  });
});
