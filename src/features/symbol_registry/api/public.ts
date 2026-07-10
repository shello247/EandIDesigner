import { saveSymbolDraft } from "../data/mutations";
import {
  listDrawingSymbolVersions,
  listNetworkSymbolVersions
} from "../data/queries";
import type { SaveSymbolDraftInput, SymbolMetadata } from "../data/schema";

export type ApprovedNetworkSymbol = {
  symbolId: string;
  symbolKey: string;
  displayName: string;
  manufacturer?: string | null;
  model?: string | null;
  category: "network_device";
  versionId: string;
  versionNumber: number;
  svg: string;
  metadata: SymbolMetadata & {
    category: "network_device";
    networkProfile: NonNullable<SymbolMetadata["networkProfile"]>;
  };
};

export type {
  AnchorKind,
  NetworkDeviceType,
  NetworkPortMedia,
  SaveSymbolDraftInput,
  SymbolAnchor,
  SymbolCategory,
  SymbolLayoutMetadata,
  SymbolLayoutUsage,
  SymbolMetadata,
  SymbolNetworkPort,
  SymbolNetworkProfile,
  SymbolPanelCategory,
  SymbolPanelMountingType,
  SymbolTerminal
} from "../data/schema";
export {
  networkDeviceTypeSchema,
  networkPortMediaSchema,
  symbolCategorySchema,
  symbolMetadataSchema
} from "../data/schema";

export async function saveSymbolDraftToRegistry(input: SaveSymbolDraftInput) {
  return saveSymbolDraft(input);
}

export async function listSymbolsForDrawing() {
  return listDrawingSymbolVersions();
}

export async function listApprovedSymbolsForDrawing() {
  return listDrawingSymbolVersions();
}

export async function listNetworkSymbolsForMapping(): Promise<
  ApprovedNetworkSymbol[]
> {
  return listNetworkSymbolVersions().then((symbols) =>
    symbols.flatMap((symbol) => {
      if (
        symbol.category !== "network_device" ||
        symbol.metadata.category !== "network_device" ||
        !symbol.metadata.networkProfile
      ) {
        return [];
      }

      return [
        {
          ...symbol,
          category: "network_device" as const,
          metadata: {
            ...symbol.metadata,
            category: "network_device" as const,
            networkProfile: symbol.metadata.networkProfile
          }
        }
      ];
    })
  );
}
