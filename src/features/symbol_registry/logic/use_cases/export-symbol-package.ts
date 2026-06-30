import type { SymbolMetadata } from "../../data/schema";

export type SymbolPackage = {
  fileName: string;
  svg: string;
  metadata: SymbolMetadata;
  metadataJson: string;
};

export function createSymbolPackage(params: {
  symbolKey: string;
  svg: string;
  metadata: SymbolMetadata;
}): SymbolPackage {
  const fileSafeKey = params.symbolKey.replace(/[^a-z0-9_-]+/gi, "_").toLowerCase();
  const metadataJson = JSON.stringify(params.metadata, null, 2);

  return {
    fileName: `${fileSafeKey}.symbol.json`,
    svg: params.svg,
    metadata: params.metadata,
    metadataJson
  };
}
