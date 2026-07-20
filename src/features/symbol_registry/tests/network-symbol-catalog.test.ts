import { describe, expect, it } from "vitest";
import {
  buildApprovedNetworkSymbol,
  buildApprovedNetworkSymbolCatalogItem
} from "../logic/services/network-symbol-catalog";

const metadataJson = JSON.stringify({
  symbolKey: "switch_8",
  displayName: "Managed Switch",
  category: "network_device",
  viewBox: { x: 0, y: 0, width: 120, height: 80 },
  terminals: [],
  anchors: [
    { key: "ETH1", x: 20, y: 60, kind: "network_port" },
    { key: "FO1", x: 40, y: 60, kind: "network_port" }
  ],
  networkProfile: {
    deviceType: "switch",
    managed: true,
    ports: [
      {
        key: "ETH1",
        label: "Control LAN",
        anchorKey: "ETH1",
        media: "copper",
        speedMbps: 1000,
        protocolHints: ["Ethernet", "PROFINET"]
      },
      {
        key: "FO1",
        label: "Fiber uplink",
        anchorKey: "FO1",
        media: "fiber",
        protocolHints: []
      }
    ]
  }
});

const row = {
  symbolId: "symbol_1",
  symbolKey: "switch_8",
  displayName: "Managed Switch",
  manufacturer: "Network Works",
  model: "SW-8",
  versionId: "version_1",
  versionNumber: 1,
  metadataJson
};

describe("network symbol catalog projection", () => {
  it("builds a deterministic lightweight searchable catalog item", () => {
    const item = buildApprovedNetworkSymbolCatalogItem(row);

    expect(item).toMatchObject({
      category: "network_device",
      deviceType: "switch",
      managed: true,
      portCount: 2,
      mediaTypes: ["copper", "fiber"],
      previewUrl: "/symbols/network-assets/version_1"
    });
    expect(item?.searchIndex).toContain("network works");
    expect(item?.searchIndex).toContain("profinet");
    expect(item).not.toHaveProperty("svg");
    expect(item).not.toHaveProperty("metadata");
    expect(Buffer.byteLength(JSON.stringify(item), "utf8")).toBeLessThanOrEqual(
      1024
    );
  });

  it("rejects malformed and non-network metadata without failing the catalog", () => {
    expect(
      buildApprovedNetworkSymbolCatalogItem({ ...row, metadataJson: "{" })
    ).toBeNull();
    expect(
      buildApprovedNetworkSymbolCatalogItem({
        ...row,
        metadataJson: metadataJson.replace("network_device", "instrument")
      })
    ).toBeNull();
  });

  it("builds complete assets only when SVG is explicitly requested", () => {
    const symbol = buildApprovedNetworkSymbol({
      ...row,
      svg: '<svg viewBox="0 0 120 80"></svg>'
    });

    expect(symbol?.svg).toContain("<svg");
    expect(symbol?.metadata.networkProfile.ports).toHaveLength(2);
  });
});
