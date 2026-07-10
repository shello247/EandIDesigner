import { describe, expect, it } from "vitest";
import {
  createDefaultNetworkMapModel,
  networkMapModelSchema,
  stringifyNetworkMapModel,
  type NetworkMapModel
} from "../data/schema";
import { renderNetworkMapSheetToSvg } from "../logic/services/network-svg-renderer";
import { buildNetworkMapPrintHtml } from "../logic/services/network-pdf-export";

function modelWithDuplicateIps(): NetworkMapModel {
  const model = createDefaultNetworkMapModel();

  return {
    ...model,
    sheets: [
      {
        ...model.sheets[0],
        nodes: [
          {
            id: "node_1",
            symbolId: "symbol_1",
            versionId: "version_1",
            tag: "SW-001",
            label: "Switch",
            deviceType: "switch",
            ipAddress: "192.168.1.10",
            x: 80,
            y: 80,
            rotation: 0,
            scale: 1
          },
          {
            id: "node_2",
            symbolId: "symbol_2",
            versionId: "version_2",
            tag: "PLC-001",
            label: "Controller",
            deviceType: "controller_plc",
            ipAddress: "192.168.1.10",
            x: 180,
            y: 80,
            rotation: 0,
            scale: 1
          }
        ]
      }
    ]
  };
}

describe("network maps", () => {
  it("creates a blank canvas model by default", () => {
    const model = createDefaultNetworkMapModel();
    const sheet = model.sheets[0];

    expect(sheet.name).toBe("Network Topology");
    expect(sheet.nodes).toHaveLength(0);
    expect(sheet.links).toHaveLength(0);
    expect(sheet.zones).toHaveLength(0);
    expect(sheet.annotations).toHaveLength(0);
    expect(networkMapModelSchema.parse(model).version).toBe(1);
  });

  it("rejects duplicate IP addresses inside a map package", () => {
    expect(() => networkMapModelSchema.parse(modelWithDuplicateIps())).toThrow(
      /already used/
    );
  });

  it("stringifies and renders a deterministic blank network canvas SVG", () => {
    const model = createDefaultNetworkMapModel();
    const serialized = stringifyNetworkMapModel(model);
    const parsed = networkMapModelSchema.parse(JSON.parse(serialized));
    const svg = renderNetworkMapSheetToSvg({
      model: parsed,
      sheet: parsed.sheets[0],
      approvedSymbols: [],
      mapTitle: "Tank Farm Network",
      sheetNumber: 1,
      sheetCount: 1
    });

    expect(svg).toContain("<svg");
    expect(svg).toContain('data-network-title-block="true"');
    expect(svg).toContain("Network Topology");
    expect(svg).not.toContain('data-network-node-id="');
    expect(svg).not.toContain('data-network-link-id="');
  });

  it("builds print-ready HTML from rendered blank network map pages", () => {
    const model = createDefaultNetworkMapModel();
    const svg = renderNetworkMapSheetToSvg({
      model,
      sheet: model.sheets[0],
      approvedSymbols: [],
      mapTitle: "Blank Network Map",
      sheetNumber: 1,
      sheetCount: 1
    });
    const html = buildNetworkMapPrintHtml({
      title: "Blank Network Map",
      pages: [{ page: model.sheets[0].page, svg }],
      networkMapUrl: "/networking/example"
    });

    expect(html).toContain("<!doctype html>");
    expect(html).toContain("network-map-page");
    expect(html).toContain("window.print()");
    expect(html).toContain("Back to network map");
  });
});
