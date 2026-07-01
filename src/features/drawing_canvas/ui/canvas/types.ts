import type {
  DrawingConnection,
  DrawingConnectionRoute,
  DrawingEndpoint
} from "../../data/schema";
import type {
  SymbolAnchor,
  SymbolTerminal
} from "@/features/symbol_registry/data/schema";

export type DragState = {
  placementId: string;
  startPointer: { x: number; y: number };
  startPlacement: { x: number; y: number };
};

export type ResizeHandle = "nw" | "ne" | "sw" | "se";

export type PlacementResizeState = {
  placementId: string;
  handle: ResizeHandle;
  fixedPoint: { x: number; y: number };
  baseSize: { width: number; height: number };
};

export type PanState = {
  pointerId: number;
  startPointer: { x: number; y: number };
  startPan: { panX: number; panY: number };
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
  pointerId: number;
  startPointer: { x: number; y: number };
  startAnnotation: { x: number; y: number };
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
