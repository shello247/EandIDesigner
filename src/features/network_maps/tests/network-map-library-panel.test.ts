import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type {
  ApprovedNetworkSymbolCatalogItem,
  NetworkLibraryFilters
} from "../types";
import { NetworkMapLibraryPanel } from "../ui/components/network-map-library-panel";

const defaultFilters: NetworkLibraryFilters = {
  query: "",
  deviceType: "all",
  managed: "all"
};

function catalogItem(): ApprovedNetworkSymbolCatalogItem {
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
    previewUrl: "/symbols/network-assets/version_switch"
  };
}

function renderLibrary(
  catalogItems: ApprovedNetworkSymbolCatalogItem[],
  filters: NetworkLibraryFilters = defaultFilters
): string {
  return renderToStaticMarkup(
    createElement(NetworkMapLibraryPanel, {
      catalogItems,
      filters,
      placementTool: { mode: "idle" },
      onFiltersChange: () => undefined,
      onPlacementToggle: () => undefined
    })
  );
}

describe("NetworkMapLibraryPanel", () => {
  it("renders the approved-catalog empty state", () => {
    const markup = renderLibrary([]);

    expect(markup).toContain("No approved network devices are available");
    expect(markup).not.toContain("Clear filters");
  });

  it("renders the no-results state with a clear-filter command", () => {
    const markup = renderLibrary([catalogItem()], {
      ...defaultFilters,
      query: "wireless"
    });

    expect(markup).toContain("No network devices match the current filters");
    expect(markup).toContain("Clear filters");
  });
});
