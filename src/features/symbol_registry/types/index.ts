import type {
  SymbolMetadata,
  SymbolStatus,
  SymbolTechnicalKind
} from "../data/schema";
import type { SymbolCategorySummary } from "@/features/symbol_categories/api/public";
import type { DeviceType } from "@/shared/device-classification/device-types";

export type SymbolListItem = {
  deviceType?: DeviceType | null;
  id: string;
  symbolKey: string;
  displayName: string;
  manufacturer?: string | null;
  model?: string | null;
  category: SymbolCategorySummary;
  technicalKind: SymbolTechnicalKind;
  status: SymbolStatus;
  latestVersionNumber?: number;
  linkedItemCount: number;
  updatedAt: string;
};

export type SymbolListPage = {
  items: SymbolListItem[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  categoryId?: string;
  deviceType?: DeviceType | "needs_classification";
};

export type SymbolIdentity = {
  symbolId: string;
  displayName: string;
};

export type SymbolVersionSummary = {
  deviceType?: DeviceType | null;
  id: string;
  versionNumber: number;
  status: SymbolStatus;
  svg: string;
  metadata: SymbolMetadata;
  sourceInputSummary?: string | null;
  aiResponseId?: string | null;
  createdAt: string;
};

export type SymbolDetail = {
  id: string;
  symbolKey: string;
  displayName: string;
  manufacturer?: string | null;
  model?: string | null;
  category: SymbolCategorySummary;
  technicalKind: SymbolTechnicalKind;
  status: SymbolStatus;
  createdAt: string;
  updatedAt: string;
  latestVersion?: SymbolVersionSummary;
  versions: Array<{
    id: string;
    versionNumber: number;
    status: SymbolStatus;
    createdAt: string;
  }>;
};

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };
