export {
  drawingAnnotationSchema,
  drawingConnectionSchema,
  drawingPlacementSchema,
  drawingSheetPageSchema,
  drawingPackageModelSchema,
  type DrawingAnnotation,
  type DrawingConnection,
  type DrawingModel,
  type DrawingPackageSheet,
  type DrawingPlacement,
  type DrawingPlacementRole,
  type DrawingSheetPage
} from "../data/schema";
export type { ApprovedDrawingSymbol } from "../types";
export {
  allocateNextTagFromPrefix,
  allocateNextPackageTag,
  buildDrawingAssetCatalog,
  canReferenceExistingAsset,
  createDrawingAssetId,
  getSymbolForPackagePlacement,
  isBreakerLikeSymbol,
  normalizeAssetTag,
  parseSteppableTag,
  placementAssetId,
  stepEngineeringTag
} from "../logic/services/drawing-asset-identity";
export {
  GENERATED_PANEL_ENCLOSURE_SYMBOL_ID,
  GENERATED_PANEL_ENCLOSURE_VERSION_ID,
  PANEL_ENCLOSURE_TAG_PREFIX,
  isGeneratedPanelEnclosurePlacement
} from "../logic/services/drawing-asset-containment";
export { deriveWireId } from "../logic/services/drawing-identification";
