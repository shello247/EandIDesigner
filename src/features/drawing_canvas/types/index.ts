import type { SymbolCategory, SymbolMetadata } from "@/features/symbol_registry/data/schema";
import type { DrawingModel, DrawingStatus } from "../data/schema";

export type ApprovedDrawingSymbol = {
  symbolId: string;
  symbolKey: string;
  displayName: string;
  manufacturer?: string | null;
  model?: string | null;
  category: SymbolCategory;
  versionId: string;
  versionNumber: number;
  svg: string;
  metadata: SymbolMetadata;
};

export type DrawingListItem = {
  id: string;
  drawingKey: string;
  title: string;
  status: DrawingStatus;
  sheetCount: number;
  placementCount: number;
  connectionCount: number;
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
  | { ok: false; error: string };
