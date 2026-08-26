import type {
  ConnectedWireScheduleAnnotation,
  ConnectedWireScheduleColumnRatios
} from "../data/schema";

export type ConnectedWireEndpoint = {
  assetTag: string;
  assetTitle?: string;
  terminalKey: string;
  terminalLabel?: string;
  terminalFunction?: string;
};

export type ConnectedWireSpecification = {
  name?: string;
  wireType?: string;
  size?: string;
  color?: string;
};

export type AssetConnectedWireRow = {
  canonicalKind: "field_connection" | "internal_wire";
  canonicalId: string;
  wireNumber?: number;
  wireId: string;
  from: ConnectedWireEndpoint;
  to: ConnectedWireEndpoint;
  specification?: ConnectedWireSpecification;
  description?: string;
  sourceSheets: Array<{ id: string; number: number; name: string }>;
};

export type ConnectedWireScheduleProjection = {
  annotationId: string;
  allRows: AssetConnectedWireRow[];
  rows: AssetConnectedWireRow[];
  totalRows: number;
  pageIndex: number;
  pageCount: number;
  rowsPerPage?: number;
  firstRowNumber?: number;
  lastRowNumber?: number;
  isPageInRange: boolean;
  unresolvedCount: number;
  linkedOccurrenceAvailable: boolean;
};

export type ConnectedWireScheduleIndex = ReadonlyMap<
  string,
  ConnectedWireScheduleProjection
>;

export type ConnectedWireScheduleColumnKey =
  | "wireNumber"
  | "wireId"
  | "from"
  | "to"
  | "specification"
  | "description";

export type ConnectedWireScheduleLayoutRow = {
  row: AssetConnectedWireRow;
  y: number;
  height: number;
  cells: Record<ConnectedWireScheduleColumnKey, string[]>;
  secondaryCells: Record<ConnectedWireScheduleColumnKey, string[]>;
};

export type ConnectedWireScheduleLayout = {
  annotation: ConnectedWireScheduleAnnotation;
  pageIndex: number;
  pageCount: number;
  totalRows: number;
  width: number;
  height: number;
  titleHeight: number;
  headerHeight: number;
  columnRatios: ConnectedWireScheduleColumnRatios;
  columns: Array<{
    key: ConnectedWireScheduleColumnKey;
    label: string;
    x: number;
    width: number;
  }>;
  rows: ConnectedWireScheduleLayoutRow[];
  overflow: boolean;
};
