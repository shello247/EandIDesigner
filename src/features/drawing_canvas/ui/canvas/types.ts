import type {
  DrawingConnection,
  DrawingConnectionRoute,
  DrawingEndpoint,
  DrawingSheetCanvasModel
} from "../../data/schema";
import type {
  SymbolAnchor,
  SymbolTerminal
} from "@/features/symbol_registry/data/schema";
import type { DimensionAttachmentTarget } from "../../logic/services/drawing-dimension-snapping";

export type DragState = {
  placementId: string;
  placementIds: string[];
  startPointer: { x: number; y: number };
  startPlacement: { x: number; y: number };
  startModel: DrawingSheetCanvasModel;
  previewDelta?: { x: number; y: number };
};

export type ResizeHandle =
  | "nw"
  | "ne"
  | "sw"
  | "se"
  | "dimension-start"
  | "dimension-end"
  | "dimension-offset"
  | "dimension-label";

export type PlacementResizeState = {
  placementId: string;
  handle: ResizeHandle;
  fixedPoint: { x: number; y: number };
  baseSize: { width: number; height: number };
  center?: { x: number; y: number };
  rotation?: number;
};

export type DimensionSnapFeedback = {
  placementId: string;
  backplaneId: string;
  handle: "dimension-start" | "dimension-end";
  target: DimensionAttachmentTarget;
  guideSheetPoint: { x: number; y: number };
};

export type PlacementRotationState = {
  placementId: string;
  center: { x: number; y: number };
  startPointerAngle: number;
  startRotation: number;
};

export type PanState = {
  pointerId: number;
  startPointer: { x: number; y: number };
  startPan: { panX: number; panY: number };
};

export type ScrollPanState = {
  pointerId: number;
  startPointer: { x: number; y: number };
  startScroll: { left: number; top: number };
};

export type RouteDragState = {
  connectionId: string;
  pointId: string;
  pointerId: number;
};

export type RouteLabelDragState = {
  connectionId: string;
  pointerId: number;
  labelOffset: { x: number; y: number };
};

export type PlacementTitleDragState = {
  placementId: string;
  pointerId: number;
  labelOffset: { x: number; y: number };
};

export type AnnotationDragState = {
  annotationId: string;
  annotationIds: string[];
  pointerId: number;
  startPointer: { x: number; y: number };
  startAnnotation: { x: number; y: number };
  startAnnotations: Record<string, { x: number; y: number }>;
};

export type AnnotationLeaderDragState = {
  annotationId: string;
  pointerId: number;
};

export type AnchorHotspot = {
  id: string;
  placementId: string;
  placementTag: string;
  symbolName: string;
  symbolModel?: string | null;
  anchor: SymbolAnchor;
  terminal?: SymbolTerminal;
  point: { x: number; y: number };
};

export type ConnectionDraft = {
  from?: DrawingEndpoint;
  pointer?: { x: number; y: number };
};

export type ConnectionSegment = {
  connection: DrawingConnection;
  route: DrawingConnectionRoute;
  pathData: string;
  label: string | null;
  labelPoint: { x: number; y: number; anchor: "start" | "middle" };
};

export type PlacementTitleLabel = {
  placementId: string;
  label: string;
  point: { x: number; y: number };
};
