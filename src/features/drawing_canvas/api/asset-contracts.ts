import type {
  DrawingAssetRecord,
  DrawingAssetType,
  DrawingConnection,
  DrawingModel,
  DrawingPackageSheet,
  DrawingPlacement,
  DrawingSheetCanvasModel
} from "../data/schema";
import { drawingAssetTypeSchema } from "../data/schema";
import type { ApprovedDrawingSymbol } from "../types";
import {
  allocateNextTagFromPrefix,
  assertUniqueAssetTag,
  createDrawingAssetId,
  findAssetTagConflict,
  formatAssetTagConflictMessage,
  getSymbolForPackagePlacement,
  isBreakerLikeSymbol,
  normalizeAssetTag,
  placementAssetId,
  renameDrawingAssetTag,
  stepEngineeringTag
} from "../logic/services/drawing-asset-identity";
import {
  getPanelEnclosureTitle,
  isGeneratedPanelEnclosurePlacement
} from "../logic/services/drawing-asset-containment";
import { isGeneratedTerminalBlockReference } from "@/features/drawing_terminal_blocks/logic/services/terminal-block-layout";

export type {
  ApprovedDrawingSymbol,
  DrawingAssetRecord,
  DrawingAssetType,
  DrawingConnection,
  DrawingModel,
  DrawingPackageSheet,
  DrawingPlacement,
  DrawingSheetCanvasModel
};

export {
  allocateNextTagFromPrefix,
  assertUniqueAssetTag,
  createDrawingAssetId,
  drawingAssetTypeSchema,
  findAssetTagConflict,
  formatAssetTagConflictMessage,
  getPanelEnclosureTitle,
  getSymbolForPackagePlacement,
  isBreakerLikeSymbol,
  isGeneratedPanelEnclosurePlacement,
  isGeneratedTerminalBlockReference,
  normalizeAssetTag,
  placementAssetId,
  renameDrawingAssetTag,
  stepEngineeringTag
};
