import { describe, expect, it } from "vitest";
import { parseImportedSvg } from "@/features/svg_symbol_import/logic/use_cases/parse-imported-svg";
import { extractFigmaComponents } from "../logic/services/figma-component-detector";
import { mergeImportedComponentConfiguration } from "../logic/use_cases/configure-symbol-components";

const sourceAsset = {
  fileName: "relay-base.svg",
  mimeType: "image/svg+xml" as const,
  sizeBytes: 2048
};

const relayBaseSvg = `
<svg viewBox="0 0 30 93" xmlns="http://www.w3.org/2000/svg">
  <g id="Relay Base">
    <path id="production-body" d="M1 1h28v91H1z"/>
    <g id="Channel 1">
      <g id="Terminal A1"><circle id="Pin A1" cx="23" cy="75" r="1"/></g>
      <g id="Terminal A2"><circle id="Pin A2" cx="7" cy="75" r="1"/></g>
    </g>
    <g id="Components">
      <g id="Position 1">
        <g id="Component: Relay">
          <rect id="Position Box" x="3.3" y="25.38" width="23" height="40"/>
        </g>
      </g>
    </g>
  </g>
</svg>`;

describe("Figma component positions", () => {
  it("extracts the relay position geometry and removes marker groups only", () => {
    const result = parseImportedSvg({ rawSvg: relayBaseSvg, sourceAsset });

    expect(result.componentPositions).toEqual([
      {
        key: "1",
        label: "Position 1",
        required: false,
        components: [
          {
            key: "relay",
            label: "Relay",
            box: {
              centerX: 14.8,
              centerY: 45.38,
              width: 23,
              height: 40,
              rotationDeg: 0
            },
            allowedSymbolIds: []
          }
        ]
      }
    ]);
    expect(result.anchors.map((anchor) => anchor.key)).toEqual(["A1", "A2"]);
    expect(result.svg).toContain('id="production-body"');
    expect(result.svg).toContain('id="Channel 1"');
    expect(result.svg).not.toContain('id="Components"');
    expect(result.svg).not.toContain('id="Position Box"');
  });

  it("preserves document order across positions and component groups", () => {
    const result = extractFigmaComponents(
      `
      <svg viewBox="10 20 100 80">
        <g id="Components">
          <g id="Position: Left">
            <g id="Component: Fuse"><rect id="Position Box" x="12" y="22" width="10" height="20"/></g>
            <g id="Component: Disconnect"><rect id="Position Box" x="24" y="22" width="12" height="20"/></g>
          </g>
          <g id="Position Right">
            <g id="Component: Indicator"><rect id="Position Box" x="80" y="50" width="10" height="10"/></g>
          </g>
        </g>
      </svg>`,
      { x: 10, y: 20, width: 100, height: 80 }
    );

    expect(
      result.componentPositions.map((position) => ({
        key: position.key,
        components: position.components.map((component) => component.key)
      }))
    ).toEqual([
      { key: "left", components: ["fuse", "disconnect"] },
      { key: "right", components: ["indicator"] }
    ]);
  });

  it("accumulates nested transforms and decomposes rotation and scale", () => {
    const result = extractFigmaComponents(
      `
      <svg viewBox="0 0 200 200">
        <g id="Outer" transform="translate(10 20)">
          <g id="Components" transform="rotate(90 50 50)">
            <g id="Position 1" transform="translate(5 0)">
              <g id="Component: Relay">
                <rect id="Position Box" x="20" y="30" width="10" height="20" transform="scale(2 1)"/>
              </g>
            </g>
          </g>
        </g>
      </svg>`,
      { x: 0, y: 0, width: 200, height: 200 }
    );

    expect(result.issues).toEqual([]);
    expect(result.componentPositions[0].components[0].box).toEqual({
      centerX: 70,
      centerY: 75,
      width: 20,
      height: 20,
      rotationDeg: 90
    });
  });

  it("warns for a partially clipped box", () => {
    const result = extractFigmaComponents(
      `
      <svg viewBox="0 0 100 100">
        <g id="Components"><g id="Position 1"><g id="Component: Relay">
          <rect id="Position Box" x="90" y="90" width="20" height="20"/>
        </g></g></g>
      </svg>`,
      { x: 0, y: 0, width: 100, height: 100 }
    );

    expect(result.issues.map((issue) => issue.code)).toEqual([
      "COMPONENT_POSITION_PARTIAL_VIEWBOX"
    ]);
    expect(result.productionSvg).not.toContain("Components");
  });

  it.each([
    {
      name: "duplicate position keys",
      svg: '<g id="Components"><g id="Position 1"><g id="Component: Relay"><rect id="Position Box" x="1" y="1" width="5" height="5"/></g></g><g id="Position: 1"><g id="Component: Fuse"><rect id="Position Box" x="10" y="1" width="5" height="5"/></g></g></g>',
      error: "duplicated"
    },
    {
      name: "multiple boxes",
      svg: '<g id="Components"><g id="Position 1"><g id="Component: Relay"><rect id="Position Box" x="1" y="1" width="5" height="5"/><rect id="Position Box" x="2" y="2" width="5" height="5"/></g></g></g>',
      error: "exactly one"
    },
    {
      name: "reflected geometry",
      svg: '<g id="Components"><g id="Position 1"><g id="Component: Relay"><rect id="Position Box" x="1" y="1" width="5" height="5" transform="scale(-1 1)"/></g></g></g>',
      error: "degenerate, reflected, skewed"
    },
    {
      name: "skewed geometry",
      svg: '<g id="Components"><g id="Position 1"><g id="Component: Relay"><rect id="Position Box" x="1" y="1" width="5" height="5" transform="matrix(1 0 0.5 1 0 0)"/></g></g></g>',
      error: "degenerate, reflected, skewed"
    }
  ])("rejects $name", ({ svg, error }) => {
    expect(() =>
      parseImportedSvg({
        rawSvg: `<svg viewBox="0 0 100 100">${svg}</svg>`,
        sourceAsset
      })
    ).toThrow(error);
  });
});

describe("component configuration reimport", () => {
  it("preserves assignments and required flags by normalized keys only", () => {
    const imported = parseImportedSvg({
      rawSvg: relayBaseSvg.replace('x="3.3"', 'x="4.3"'),
      sourceAsset
    }).componentPositions;
    const previous = parseImportedSvg({
      rawSvg: relayBaseSvg,
      sourceAsset
    }).componentPositions.map((position) => ({
      ...position,
      required: true,
      components: position.components.map((component) => ({
        ...component,
        allowedSymbolIds: ["relay-24", "relay-115"]
      }))
    }));

    expect(mergeImportedComponentConfiguration(imported, previous)).toEqual([
      {
        ...imported[0],
        required: true,
        components: [
          {
            ...imported[0].components[0],
            allowedSymbolIds: ["relay-24", "relay-115"]
          }
        ]
      }
    ]);
  });

  it("treats removed markers as intentional deletion", () => {
    expect(
      mergeImportedComponentConfiguration(undefined, [
        {
          key: "1",
          label: "Position 1",
          required: true,
          components: [
            {
              key: "relay",
              label: "Relay",
              box: {
                centerX: 1,
                centerY: 1,
                width: 2,
                height: 2,
                rotationDeg: 0
              },
              allowedSymbolIds: ["relay-24"]
            }
          ]
        }
      ])
    ).toBeUndefined();
  });
});
