import type { SymbolMetadata } from "../../data/schema";
import type { DeviceType } from "@/shared/device-classification/device-types";

export type SymbolPackage = {
  deviceType?: DeviceType | null;
  fileName: string;
  svg: string;
  metadata: SymbolMetadata;
  metadataJson: string;
};

export function createSymbolPackage(params: {
  deviceType?: DeviceType | null;
  symbolKey: string;
  svg: string;
  metadata: SymbolMetadata;
}): SymbolPackage {
  const fileSafeKey = params.symbolKey.replace(/[^a-z0-9_-]+/gi, "_").toLowerCase();
  const metadataJson = JSON.stringify(params.metadata, null, 2);

  return {
    fileName: `${fileSafeKey}.symbol.json`,
    deviceType: params.deviceType ?? null,
    svg: params.svg,
    metadata: params.metadata,
    metadataJson
  };
}
