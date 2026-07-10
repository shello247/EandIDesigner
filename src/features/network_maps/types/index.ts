import type { ApprovedNetworkSymbol as RegistryApprovedNetworkSymbol } from "@/features/symbol_registry/api/public";
import type { NetworkMapModel, NetworkMapStatus } from "../data/schema";

export type ApprovedNetworkSymbol = RegistryApprovedNetworkSymbol;

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
