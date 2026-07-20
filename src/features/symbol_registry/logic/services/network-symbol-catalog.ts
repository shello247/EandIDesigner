import {
  networkPortMediaSchema,
  symbolMetadataSchema,
  type NetworkDeviceType,
  type NetworkPortMedia,
  type SymbolMetadata
} from "../../data/schema";

export type ApprovedNetworkSymbolCatalogItem = {
  symbolId: string;
  symbolKey: string;
  displayName: string;
  manufacturer: string | null;
  model: string | null;
  category: "network_device";
  versionId: string;
  versionNumber: number;
  deviceType: NetworkDeviceType;
  managed: boolean | null;
  portCount: number;
  mediaTypes: NetworkPortMedia[];
  searchIndex: string;
  previewUrl: string;
};

export type ApprovedNetworkSymbol = {
  symbolId: string;
  symbolKey: string;
  displayName: string;
  manufacturer: string | null;
  model: string | null;
  category: "network_device";
  versionId: string;
  versionNumber: number;
  svg: string;
  metadata: SymbolMetadata & {
    category: "network_device";
    networkProfile: NonNullable<SymbolMetadata["networkProfile"]>;
  };
};

type NetworkSymbolRow = {
  symbolId: string;
  symbolKey: string;
  displayName: string;
  manufacturer: string | null;
  model: string | null;
  versionId: string;
  versionNumber: number;
  metadataJson: string;
};

function parseNetworkMetadata(
  metadataJson: string
): ApprovedNetworkSymbol["metadata"] | null {
  let input: unknown;

  try {
    input = JSON.parse(metadataJson);
  } catch {
    return null;
  }

  const result = symbolMetadataSchema.safeParse(input);
  if (
    !result.success ||
    result.data.category !== "network_device" ||
    !result.data.networkProfile
  ) {
    return null;
  }

  return {
    ...result.data,
    category: "network_device",
    networkProfile: result.data.networkProfile
  };
}

function buildSearchIndex(
  row: NetworkSymbolRow,
  metadata: ApprovedNetworkSymbol["metadata"]
): string {
  const profile = metadata.networkProfile;
  const managedLabel =
    profile.managed === undefined
      ? "unspecified"
      : profile.managed
        ? "managed"
        : "unmanaged";
  const values = [
    row.displayName,
    row.manufacturer ?? "",
    row.model ?? "",
    row.symbolKey,
    profile.deviceType,
    managedLabel,
    ...profile.ports.flatMap((port) => [
      port.key,
      port.label,
      port.media,
      port.speedMbps === undefined ? "" : String(port.speedMbps),
      ...port.protocolHints
    ])
  ];

  return values
    .join(" ")
    .toLocaleLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function buildApprovedNetworkSymbolCatalogItem(
  row: NetworkSymbolRow
): ApprovedNetworkSymbolCatalogItem | null {
  const metadata = parseNetworkMetadata(row.metadataJson);

  if (!metadata) {
    return null;
  }

  const usedMedia = new Set(
    metadata.networkProfile.ports.map((port) => port.media)
  );

  return {
    symbolId: row.symbolId,
    symbolKey: row.symbolKey,
    displayName: row.displayName,
    manufacturer: row.manufacturer,
    model: row.model,
    category: "network_device",
    versionId: row.versionId,
    versionNumber: row.versionNumber,
    deviceType: metadata.networkProfile.deviceType,
    managed: metadata.networkProfile.managed ?? null,
    portCount: metadata.networkProfile.ports.length,
    mediaTypes: networkPortMediaSchema.options.filter((media) =>
      usedMedia.has(media)
    ),
    searchIndex: buildSearchIndex(row, metadata),
    previewUrl: `/symbols/network-assets/${encodeURIComponent(row.versionId)}`
  };
}

export function buildApprovedNetworkSymbol(
  row: NetworkSymbolRow & { svg: string }
): ApprovedNetworkSymbol | null {
  const metadata = parseNetworkMetadata(row.metadataJson);

  if (!metadata) {
    return null;
  }

  return {
    symbolId: row.symbolId,
    symbolKey: row.symbolKey,
    displayName: row.displayName,
    manufacturer: row.manufacturer,
    model: row.model,
    category: "network_device",
    versionId: row.versionId,
    versionNumber: row.versionNumber,
    svg: row.svg,
    metadata
  };
}
