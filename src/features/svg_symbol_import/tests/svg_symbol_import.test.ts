import { describe, expect, it } from "vitest";
import { validateSymbol } from "@/features/symbol_registry/logic/use_cases/validate-symbol";
import { buildImportedSymbolMetadata } from "../logic/use_cases/build-imported-symbol-metadata";
import { parseImportedSvg } from "../logic/use_cases/parse-imported-svg";

const sourceAsset = {
  fileName: "device.svg",
  mimeType: "image/svg+xml" as const,
  sizeBytes: 512,
  dataUrl: "data:image/svg+xml;base64,PHN2Zy8+"
};

const validSvg = `
<svg viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg">
  <rect x="10" y="10" width="100" height="50" fill="white" stroke="black"/>
  <circle id="terminal:1" cx="20" cy="40" r="2"/>
  <ellipse data-name="terminal_2" cx="60" cy="40" rx="2" ry="2"/>
  <rect id="anchor:GND" x="92" y="54" width="4" height="4"/>
</svg>`;

const networkSvg = `
<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg">
  <rect x="10" y="10" width="140" height="65" fill="white" stroke="black"/>
  <circle id="network_port:eth1" cx="20" cy="80" r="2"/>
  <ellipse data-name="port:ETH2" cx="45" cy="80" rx="2" ry="2" transform="translate(5 2)"/>
  <g id="network_port:FIBER1" transform="matrix(1 0 0 1 10 20)">
    <rect x="70" y="60" width="4" height="4"/>
  </g>
</svg>`;

describe("SVG symbol import", () => {
  it("parses a valid SVG and extracts viewBox and anchors", () => {
    const result = parseImportedSvg({
      rawSvg: validSvg,
      sourceAsset
    });

    expect(result.viewBox).toEqual({ x: 0, y: 0, width: 120, height: 80 });
    expect(result.anchors.map((anchor) => anchor.key)).toEqual([
      "1",
      "2",
      "GND"
    ]);
    expect(result.terminals).toHaveLength(3);
    expect(result.svg).toContain('id="terminal:1"');
  });

  it("detects canonical and alias network ports with normalized keys", () => {
    const result = parseImportedSvg({ rawSvg: networkSvg, sourceAsset });

    expect(result.anchors).toEqual([
      { key: "ETH1", x: 20, y: 80, kind: "network_port" },
      { key: "ETH2", x: 50, y: 82, kind: "network_port" },
      { key: "FIBER1", x: 82, y: 82, kind: "network_port" }
    ]);
    expect(result.networkPorts).toEqual([
      {
        key: "ETH1",
        label: "ETH1",
        anchorKey: "ETH1",
        media: "",
        speedMbps: "",
        protocolHints: ""
      },
      {
        key: "ETH2",
        label: "ETH2",
        anchorKey: "ETH2",
        media: "",
        speedMbps: "",
        protocolHints: ""
      },
      {
        key: "FIBER1",
        label: "FIBER1",
        anchorKey: "FIBER1",
        media: "",
        speedMbps: "",
        protocolHints: ""
      }
    ]);
    expect(result.terminals).toEqual([]);
  });

  it("removes network marker geometry while retaining production geometry", () => {
    const result = parseImportedSvg({ rawSvg: networkSvg, sourceAsset });

    expect(result.svg).toContain('width="140"');
    expect(result.svg).not.toContain("network_port:");
    expect(result.svg).not.toContain("port:ETH2");
    expect(result.svg).not.toContain('cx="20"');
    expect(result.svg).not.toContain('x="70"');
  });

  it("rejects duplicate normalized network port marker keys", () => {
    expect(() =>
      parseImportedSvg({
        rawSvg:
          '<svg viewBox="0 0 100 100"><circle id="network_port:eth1" cx="20" cy="20" r="2"/><circle id="port:ETH1" cx="40" cy="20" r="2"/></svg>',
        sourceAsset
      })
    ).toThrow('Network port marker key "ETH1" is duplicated.');
  });

  it("rejects malformed network port marker names", () => {
    expect(() =>
      parseImportedSvg({
        rawSvg:
          '<svg viewBox="0 0 100 100"><circle id="network_port-ETH1" cx="20" cy="20" r="2"/></svg>',
        sourceAsset
      })
    ).toThrow("must use network_port:<PORT_KEY> or port:<PORT_KEY>");
  });

  it("rejects network marker groups containing production geometry", () => {
    expect(() =>
      parseImportedSvg({
        rawSvg:
          '<svg viewBox="0 0 100 100"><g id="network_port:ETH1"><circle cx="20" cy="20" r="2"/><path d="M 10 10 L 30 30"/></g></svg>',
        sourceAsset
      })
    ).toThrow(
      "Named network port groups must contain exactly one direct circle, ellipse, or rectangle and no production geometry."
    );
  });

  it("sanitizes unsafe SVG before preview", () => {
    const result = parseImportedSvg({
      rawSvg:
        '<svg viewBox="0 0 100 100" onload="alert(1)"><script>alert(1)</script><circle id="terminal:1" cx="50" cy="50" r="2"/></svg>',
      sourceAsset
    });

    expect(result.svg).not.toContain("<script");
    expect(result.svg).not.toContain("onload");
    expect(result.issues.map((issue) => issue.code)).toContain("SCRIPT_DENIED");
  });

  it("blocks SVG files without a viewBox", () => {
    expect(() =>
      parseImportedSvg({
        rawSvg: '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="1" cy="1" r="1"/></svg>',
        sourceAsset
      })
    ).toThrow("SVG root must define a viewBox.");
  });

  it("builds metadata that passes registry validation", () => {
    const preview = parseImportedSvg({
      rawSvg: validSvg,
      sourceAsset
    });
    const metadata = buildImportedSymbolMetadata({
      symbolKey: "Imported Device",
      displayName: "Imported Device",
      manufacturer: "Vendor",
      model: "Model",
      category: "instrument",
      viewBox: preview.viewBox,
      anchors: preview.anchors,
      terminals: preview.terminals
    });
    const validation = validateSymbol(preview.svg, metadata);

    expect(metadata.symbolKey).toBe("imported_device");
    expect(metadata.layoutUsage).toBe("wiring");
    expect(validation.blockingIssueCount).toBe(0);
  });

  it("builds panel layout metadata for approved-symbol placement", () => {
    const preview = parseImportedSvg({
      rawSvg: validSvg,
      sourceAsset
    });
    const metadata = buildImportedSymbolMetadata({
      symbolKey: "MCB 3 Pole",
      displayName: "MCB 3 Pole",
      category: "terminal_block",
      layoutUsage: "panel_layout",
      physicalWidthMm: "54",
      physicalHeightMm: "90",
      mountingType: "din_rail",
      panelCategory: "protection",
      resizable: false,
      viewBox: preview.viewBox,
      anchors: preview.anchors,
      terminals: preview.terminals
    });

    expect(metadata).toMatchObject({
      layoutUsage: "panel_layout",
      physicalWidthMm: 54,
      physicalHeightMm: 90,
      mountingType: "din_rail",
      panelCategory: "protection",
      resizable: false
    });
  });

  it("builds explicit network metadata without panel layout fields", () => {
    const preview = parseImportedSvg({ rawSvg: networkSvg, sourceAsset });
    const metadata = buildImportedSymbolMetadata({
      symbolKey: "Managed Switch",
      displayName: "Managed Switch",
      category: "network_device",
      layoutUsage: "panel_layout",
      physicalWidthMm: "100",
      physicalHeightMm: "80",
      mountingType: "din_rail",
      panelCategory: "controller",
      resizable: true,
      viewBox: preview.viewBox,
      anchors: preview.anchors,
      terminals: preview.terminals,
      networkProfile: {
        deviceType: "switch",
        managed: true,
        ports: preview.networkPorts.map((port, index) => ({
          ...port,
          media: index === 2 ? "fiber" : "copper",
          speedMbps: index === 2 ? "10000" : "1000",
          protocolHints: "Ethernet, Modbus TCP, ethernet"
        }))
      }
    });

    expect(metadata.layoutUsage).toBe("wiring");
    expect(metadata.physicalWidthMm).toBeUndefined();
    expect(metadata.resizable).toBe(false);
    expect(metadata.terminals).toEqual([]);
    expect(metadata.networkProfile).toMatchObject({
      deviceType: "switch",
      managed: true
    });
    expect(metadata.networkProfile?.ports[0]).toMatchObject({
      key: "ETH1",
      anchorKey: "ETH1",
      media: "copper",
      speedMbps: 1000,
      protocolHints: ["Ethernet", "Modbus TCP"]
    });
  });

  it("lets registry validation catch duplicate terminal keys", () => {
    const preview = parseImportedSvg({
      rawSvg: validSvg,
      sourceAsset
    });
    const metadata = buildImportedSymbolMetadata({
      symbolKey: "duplicate_test",
      displayName: "Duplicate Test",
      category: "instrument",
      viewBox: preview.viewBox,
      anchors: preview.anchors,
      terminals: [
        { ...preview.terminals[0], key: "1" },
        { ...preview.terminals[1], key: "1" }
      ]
    });
    const validation = validateSymbol(preview.svg, metadata);

    expect(validation.issues.map((issue) => issue.code)).toContain(
      "TERMINAL_DUPLICATE"
    );
  });
});
