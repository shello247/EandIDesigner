import type {
  SymbolMetadata,
  SymbolStatus,
  SymbolTechnicalKind,
  ValidationIssue
} from "../data/schema";
import type { SymbolCategorySummary } from "@/features/symbol_categories/api/public";

export type SymbolListItem = {
  id: string;
  symbolKey: string;
  displayName: string;
  manufacturer?: string | null;
  model?: string | null;
  category: SymbolCategorySummary;
  technicalKind: SymbolTechnicalKind;
  status: SymbolStatus;
  latestVersionNumber?: number;
  blockingIssueCount: number;
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
};

export type SymbolIdentity = {
  symbolId: string;
  displayName: string;
};

export type SymbolVersionSummary = {
  id: string;
  versionNumber: number;
  status: SymbolStatus;
  svg: string;
  metadata: SymbolMetadata;
  sourceInputSummary?: string | null;
  aiResponseId?: string | null;
  createdAt: string;
};

export type SymbolEngineerNoteSummary = {
  id: string;
  symbolId: string;
  versionId?: string | null;
  notes: string;
  imageFileName?: string | null;
  imageMimeType?: string | null;
  imageSizeBytes?: number | null;
  imageDataUrl?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SymbolDocumentSummary = {
  id: string;
  symbolId: string;
  versionId?: string | null;
  title: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
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
  validationIssues: ValidationIssue[];
  engineerNotes: SymbolEngineerNoteSummary[];
  documents: SymbolDocumentSummary[];
};

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };
