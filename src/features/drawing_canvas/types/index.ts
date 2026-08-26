import type {
  SymbolMetadata,
  SymbolTechnicalKind
} from "@/features/symbol_registry/data/schema";
import type { SymbolCategorySummary } from "@/features/symbol_categories/api/public";
import type { DrawingModel, DrawingStatus } from "../data/schema";
import type { PackagePanelDrawingQualityReport } from "@/features/drawing_panel_wiring/api/contracts";

export type ApprovedDrawingSymbol = {
  symbolId: string;
  symbolKey: string;
  displayName: string;
  manufacturer?: string | null;
  model?: string | null;
  /** @deprecated Technical compatibility field; use managedCategory for grouping. */
  category: SymbolTechnicalKind;
  technicalKind?: SymbolTechnicalKind;
  managedCategory?: SymbolCategorySummary;
  versionId: string;
  versionNumber: number;
  svg: string;
  metadata: SymbolMetadata;
  selectable?: boolean;
};

export type DrawingListItem = {
  id: string;
  title: string;
  status: DrawingStatus;
  sheetCount: number;
  updatedAt: string;
};

export type DrawingDetail = {
  id: string;
  drawingKey: string;
  title: string;
  status: DrawingStatus;
  model: DrawingModel;
  createdAt: string;
  updatedAt: string;
};

export type DrawingApprovalOutcome = {
  drawing: DrawingDetail;
  quality: PackagePanelDrawingQualityReport;
  approved: boolean;
};

export type DrawingBomOption = {
  id: string;
  drawingKey: string;
  title: string;
};

export type DrawingBomSource = {
  id: string;
  title: string;
  model: DrawingModel;
};

export type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: string;
      code?: "conflict" | "validation" | "unavailable";
      latestUpdatedAt?: string;
    };
