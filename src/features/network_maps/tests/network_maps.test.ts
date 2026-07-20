import { describe, expect, it } from "vitest";
import {
  createDefaultNetworkMapModel,
  networkMapModelSchema,
  stringifyNetworkMapModel,
  type NetworkMapModel
} from "../data/schema";
import { renderNetworkMapSheetToSvg } from "../logic/services/network-svg-renderer";
import { buildNetworkMapPrintHtml } from "../logic/services/network-pdf-export";
import type { ApprovedNetworkSymbol } from "../types";
import { getNetworkPortWorldPoint } from "../logic/services/network-link-routing";

const approvedSwitch: ApprovedNetworkSymbol = {
  symbolId: "symbol_1",
  symbolKey: "managed_switch",
  displayName: "Managed Switch",
  manufacturer: null,
  model: null,
  category: "network_device",
  versionId: "version_1",
  versionNumber: 1,
  svg: '<svg viewBox="10 20 100 60"><rect x="10" y="20" width="100" height="60"/></svg>',
  metadata: {
    symbolKey: "managed_switch",
    displayName: "Managed Switch",
    category: "network_device",
    viewBox: { x: 10, y: 20, width: 100, height: 60 },
    terminals: [],
    anchors: [{ key: "ETH1", x: 110, y: 50, kind: "network_port" }],
    networkProfile: {
      deviceType: "switch",
      managed: true,
      ports: [
        {
          key: "ETH1",
          label: "Uplink",
          anchorKey: "ETH1",
          media: "copper",
          protocolHints: []
        }
      ]
    }
  }
};

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

  it("renders approved nodes with deterministic transforms and missing versions with placeholders", () => {
    const model = modelWithDuplicateIps();
    model.sheets[0].nodes[1].ipAddress = "192.168.1.11";
    model.sheets[0].nodes[0].rotation = 90;
    model.sheets[0].nodes[0].scale = 0.5;
    const svg = renderNetworkMapSheetToSvg({
      model,
      sheet: model.sheets[0],
      approvedSymbols: [approvedSwitch],
      mapTitle: "Rendered Network",
      sheetNumber: 1,
      sheetCount: 1
    });

    expect(svg).toContain('data-network-node-id="node_1"');
    expect(svg).toContain('transform="rotate(90 105 95)"');
    expect(svg).toContain("translate(80 80) scale(0.5) translate(-10 -20)");
    expect(svg).toContain('data-network-node-id="node_2"');
    expect(svg).toContain('data-network-node-missing="true"');
    expect(svg).toContain("MISSING SYMBOL");
  });

  it("rotates network port endpoints with their node", () => {
    const sheet = modelWithDuplicateIps().sheets[0];
    sheet.nodes[0].rotation = 90;
    sheet.nodes[0].scale = 0.5;
    const point = getNetworkPortWorldPoint({
      sheet,
      symbolsByReference: new Map([["symbol_1:version_1", approvedSwitch]]),
      nodeId: "node_1",
      portKey: "ETH1"
    });

    expect(point).toEqual({ x: 105, y: 120 });
  });
});
