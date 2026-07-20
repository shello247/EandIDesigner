import type {
  ApprovedNetworkSymbol as RegistryApprovedNetworkSymbol,
  ApprovedNetworkSymbolCatalogItem as RegistryApprovedNetworkSymbolCatalogItem,
  NetworkDeviceType
} from "@/features/symbol_registry/api/public";
import type {
  NetworkMapModel,
  NetworkMapStatus,
  NetworkMapNode
} from "../data/schema";

export type ApprovedNetworkSymbol = RegistryApprovedNetworkSymbol;
export type ApprovedNetworkSymbolCatalogItem =
  RegistryApprovedNetworkSymbolCatalogItem;

export type NetworkLibraryFilters = {
  query: string;
  deviceType: NetworkDeviceType | "all";
  managed: "all" | "managed" | "unmanaged" | "unspecified";
};

export type NetworkMapSelection =
  | { kind: "node"; id: string }
  | { kind: "annotation"; id: string }
  | null;

export type NetworkPlacementToolState =
  | { mode: "idle" }
  | { mode: "loading"; item: ApprovedNetworkSymbolCatalogItem }
  | {
      mode: "placing";
      item: ApprovedNetworkSymbolCatalogItem;
      symbol: ApprovedNetworkSymbol;
    };

export type NetworkNodeDragState = {
  pointerId: number;
  nodeId: string;
  startPointer: { x: number; y: number };
  startNode: Pick<NetworkMapNode, "x" | "y">;
  previewNode: Pick<NetworkMapNode, "x" | "y">;
};

export type NetworkMapListItem = {
  id: string;
  mapKey: string;
  title: string;
  status: NetworkMapStatus;
  sheetCount: number;
  nodeCount: number;
  linkCount: number;
  updatedAt: string;
};

export type NetworkMapDetail = {
  id: string;
  mapKey: string;
  title: string;
  status: NetworkMapStatus;
  model: NetworkMapModel;
  createdAt: string;
  updatedAt: string;
};

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };
