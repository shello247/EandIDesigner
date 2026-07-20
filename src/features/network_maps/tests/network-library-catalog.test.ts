import { describe, expect, it } from "vitest";
import type { ApprovedNetworkSymbolCatalogItem } from "../types";
import {
  collectReferencedNetworkSymbolVersionIds,
  filterAndGroupNetworkCatalog
} from "../logic/services/network-library-catalog";
import { createDefaultNetworkMapModel } from "../data/schema";

function catalogItem(
  overrides: Partial<ApprovedNetworkSymbolCatalogItem> = {}
): ApprovedNetworkSymbolCatalogItem {
  return {
    symbolId: "symbol_switch",
    symbolKey: "managed_switch",
    displayName: "Managed Switch",
    manufacturer: "Network Works",
    model: "SW-8",
    category: "network_device",
    versionId: "version_switch",
    versionNumber: 1,
    deviceType: "switch",
    managed: true,
    portCount: 8,
    mediaTypes: ["copper"],
    searchIndex: "managed switch network works sw-8 profinet eth1 copper",
    previewUrl: "/symbols/network-assets/version_switch",
    ...overrides
  };
}

describe("network library catalog", () => {
  it("groups in canonical device order with deterministic item sorting", () => {
    const groups = filterAndGroupNetworkCatalog(
      [
        catalogItem({ displayName: "Zulu Switch", symbolKey: "zulu" }),
        catalogItem({ displayName: "Alpha Switch", symbolKey: "alpha" }),
        catalogItem({
          symbolId: "symbol_server",
          versionId: "version_server",
          symbolKey: "scada_server",
          displayName: "SCADA Server",
          deviceType: "server",
          managed: null,
          searchIndex: "scada server virtual opc ua"
        })
      ],
      { query: "", deviceType: "all", managed: "all" }
    );

    expect(groups.map((group) => group.key)).toEqual(["switch", "server"]);
    expect(groups[0].items.map((item) => item.displayName)).toEqual([
      "Alpha Switch",
      "Zulu Switch"
    ]);
  });

  it("searches profile data and filters managed state", () => {
    const items = [
      catalogItem(),
      catalogItem({
        symbolId: "symbol_server",
        versionId: "version_server",
        displayName: "SCADA Server",
        deviceType: "server",
        managed: null,
        searchIndex: "scada server virtual opc ua"
      })
    ];

    expect(
      filterAndGroupNetworkCatalog(items, {
        query: "PROFINET ETH1",
        deviceType: "switch",
        managed: "managed"
      }).flatMap((group) => group.items)
    ).toHaveLength(1);
    expect(
      filterAndGroupNetworkCatalog(items, {
        query: "",
        deviceType: "all",
        managed: "unspecified"
      }).flatMap((group) => group.items)[0].displayName
    ).toBe("SCADA Server");
  });

  it("collects each referenced version once in stable order", () => {
    const model = createDefaultNetworkMapModel();
    model.sheets[0].nodes = [
      {
        id: "node_1",
        symbolId: "symbol_1",
        versionId: "version_b",
        tag: "SW-01",
        deviceType: "switch",
        x: 10,
        y: 10,
        rotation: 0,
        scale: 1
      },
      {
        id: "node_2",
        symbolId: "symbol_2",
        versionId: "version_a",
        tag: "SRV-01",
        deviceType: "server",
        x: 20,
        y: 20,
        rotation: 0,
        scale: 1
      },
      {
        id: "node_3",
        symbolId: "symbol_1",
        versionId: "version_b",
        tag: "SW-02",
        deviceType: "switch",
        x: 30,
        y: 30,
        rotation: 0,
        scale: 1
      }
    ];

    expect(collectReferencedNetworkSymbolVersionIds(model)).toEqual([
      "version_a",
      "version_b"
    ]);
  });
});
