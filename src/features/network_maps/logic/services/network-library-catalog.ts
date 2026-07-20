import { networkDeviceTypeSchema } from "@/features/symbol_registry/api/public";
import type { NetworkMapModel } from "../../data/schema";
import type {
  ApprovedNetworkSymbolCatalogItem,
  NetworkLibraryFilters
} from "../../types";

export type NetworkLibraryGroup = {
  key: ApprovedNetworkSymbolCatalogItem["deviceType"];
  label: string;
  items: ApprovedNetworkSymbolCatalogItem[];
};

export const DEFAULT_NETWORK_LIBRARY_FILTERS: NetworkLibraryFilters = {
  query: "",
  deviceType: "all",
  managed: "all"
};

export function networkDeviceTypeLabel(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
    .replace("Router Firewall", "Router / Firewall")
    .replace("Controller Plc", "Controller / PLC")
    .replace("Hmi Workstation", "HMI / Workstation");
}

function matchesManagedFilter(
  item: ApprovedNetworkSymbolCatalogItem,
  filter: NetworkLibraryFilters["managed"]
): boolean {
  if (filter === "all") {
    return true;
  }

  if (filter === "unspecified") {
    return item.managed === null;
  }

  return filter === "managed" ? item.managed === true : item.managed === false;
}

export function filterAndGroupNetworkCatalog(
  items: ApprovedNetworkSymbolCatalogItem[],
  filters: NetworkLibraryFilters
): NetworkLibraryGroup[] {
  const query = filters.query.trim().toLocaleLowerCase().replace(/\s+/g, " ");
  const queryTerms = query ? query.split(" ") : [];
  const grouped = new Map<
    ApprovedNetworkSymbolCatalogItem["deviceType"],
    ApprovedNetworkSymbolCatalogItem[]
  >();

  for (const item of items) {
    if (filters.deviceType !== "all" && item.deviceType !== filters.deviceType) {
      continue;
    }

    if (!matchesManagedFilter(item, filters.managed)) {
      continue;
    }

    if (queryTerms.some((term) => !item.searchIndex.includes(term))) {
      continue;
    }

    const existingItems = grouped.get(item.deviceType);
    if (existingItems) {
      existingItems.push(item);
    } else {
      grouped.set(item.deviceType, [item]);
    }
  }

  return networkDeviceTypeSchema.options.flatMap((deviceType) => {
    const groupItems = grouped.get(deviceType);

    if (!groupItems?.length) {
      return [];
    }

    return [
      {
        key: deviceType,
        label: networkDeviceTypeLabel(deviceType),
        items: [...groupItems].sort(
          (first, second) =>
            first.displayName.localeCompare(second.displayName) ||
            first.symbolKey.localeCompare(second.symbolKey) ||
            first.versionId.localeCompare(second.versionId)
        )
      }
    ];
  });
}

export function collectReferencedNetworkSymbolVersionIds(
  model: NetworkMapModel
): string[] {
  const versionIds = new Set<string>();

  for (const sheet of model.sheets) {
    for (const node of sheet.nodes) {
      versionIds.add(node.versionId);
    }
  }

  return [...versionIds].sort((first, second) => first.localeCompare(second));
}
