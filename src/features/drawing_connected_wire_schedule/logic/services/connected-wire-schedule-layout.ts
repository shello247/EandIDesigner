import { formatWireNumber } from "@/features/drawing_panel_wiring/api/public";
import type {
  ConnectedWireScheduleAnnotation,
  ConnectedWireScheduleColumnRatios
} from "../../data/schema";
import type {
  AssetConnectedWireRow,
  ConnectedWireScheduleColumnKey,
  ConnectedWireScheduleLayout,
  ConnectedWireScheduleProjection
} from "../../types";

export const DEFAULT_CONNECTED_WIRE_SCHEDULE_WIDTH = 190;
export const MIN_CONNECTED_WIRE_SCHEDULE_WIDTH = 120;
export const CONNECTED_WIRE_SCHEDULE_SHEET_MARGIN = 5;
export const MIN_CONNECTED_WIRE_SCHEDULE_COLUMN_RATIO = 1 / 15;

export const DEFAULT_CONNECTED_WIRE_SCHEDULE_COLUMN_RATIOS: ConnectedWireScheduleColumnRatios = {
  wireNumber: 0.08,
  wireId: 0.16,
  from: 0.16,
  to: 0.16,
  specification: 0.2,
  description: 0.24
};

const TITLE_HEIGHT = 8;
const HEADER_HEIGHT = 7;
const MIN_ROW_HEIGHT = 7;
const CELL_PADDING = 2;
const LINE_HEIGHT = 3.35;
const SECONDARY_LINE_HEIGHT = 2.85;
const SECONDARY_GAP = 0.5;
const COLUMN_DEFINITIONS: Array<{
  key: ConnectedWireScheduleColumnKey;
  label: string;
}> = [
  { key: "wireNumber", label: "WIRE #" },
  { key: "wireId", label: "WIRE ID" },
  { key: "from", label: "FROM" },
  { key: "to", label: "TO" },
  { key: "specification", label: "WIRE SPECIFICATION" },
  { key: "description", label: "DESCRIPTION" }
];

export const CONNECTED_WIRE_SCHEDULE_COLUMN_KEYS = COLUMN_DEFINITIONS.map(
  (definition) => definition.key
);

export function resolveConnectedWireScheduleColumnRatios(
  ratios?: ConnectedWireScheduleColumnRatios
): ConnectedWireScheduleColumnRatios {
  if (!ratios) return { ...DEFAULT_CONNECTED_WIRE_SCHEDULE_COLUMN_RATIOS };
  const values = CONNECTED_WIRE_SCHEDULE_COLUMN_KEYS.map((key) => ratios[key]);
  const total = values.reduce((sum, value) => sum + value, 0);
  if (
    values.some(
      (value) =>
        !Number.isFinite(value) ||
        value < MIN_CONNECTED_WIRE_SCHEDULE_COLUMN_RATIO
    ) ||
    total <= 0
  ) {
    return { ...DEFAULT_CONNECTED_WIRE_SCHEDULE_COLUMN_RATIOS };
  }
  return Object.fromEntries(
    CONNECTED_WIRE_SCHEDULE_COLUMN_KEYS.map((key) => [
      key,
      ratios[key] / total
    ])
  ) as ConnectedWireScheduleColumnRatios;
}

export function resizeConnectedWireScheduleColumns(input: {
  ratios?: ConnectedWireScheduleColumnRatios;
  dividerIndex: number;
  delta: number;
  tableWidth: number;
}): ConnectedWireScheduleColumnRatios {
  const ratios = resolveConnectedWireScheduleColumnRatios(input.ratios);
  if (
    input.dividerIndex < 0 ||
    input.dividerIndex >= CONNECTED_WIRE_SCHEDULE_COLUMN_KEYS.length - 1 ||
    !Number.isFinite(input.delta) ||
    !Number.isFinite(input.tableWidth) ||
    input.tableWidth <= 0
  ) {
    return ratios;
  }
  const leftKey = CONNECTED_WIRE_SCHEDULE_COLUMN_KEYS[input.dividerIndex];
  const rightKey =
    CONNECTED_WIRE_SCHEDULE_COLUMN_KEYS[input.dividerIndex + 1];
  const combined = ratios[leftKey] + ratios[rightKey];
  const left = Math.min(
    combined - MIN_CONNECTED_WIRE_SCHEDULE_COLUMN_RATIO,
    Math.max(
      MIN_CONNECTED_WIRE_SCHEDULE_COLUMN_RATIO,
      ratios[leftKey] + input.delta / input.tableWidth
    )
  );
  const next = {
    ...ratios,
    [leftKey]: Number(left.toFixed(6)),
    [rightKey]: Number((combined - left).toFixed(6))
  };
  const total = CONNECTED_WIRE_SCHEDULE_COLUMN_KEYS.reduce(
    (sum, key) => sum + next[key],
    0
  );
  next[rightKey] = Number((next[rightKey] + 1 - total).toFixed(6));
  return next;
}

function endpointText(endpoint: AssetConnectedWireRow["from"]): string {
  return `${endpoint.assetTag}:${endpoint.terminalKey}`;
}

function endpointDetailText(endpoint: AssetConnectedWireRow["from"]): string {
  const terminalLabel = endpoint.terminalLabel?.trim();
  const meaningfulLabel =
    terminalLabel &&
    terminalLabel.localeCompare(endpoint.terminalKey, undefined, {
      sensitivity: "accent"
    }) !== 0
      ? terminalLabel
      : undefined;
  const terminalFunction = endpoint.terminalFunction?.trim();
  const terminalDetails = [meaningfulLabel, terminalFunction]
    .filter(
      (value, index, values): value is string =>
        Boolean(value) &&
        values.findIndex(
          (candidate) =>
            candidate?.localeCompare(value ?? "", undefined, {
              sensitivity: "accent"
            }) === 0
        ) === index
    )
    .join(" - ");

  return [endpoint.assetTitle?.trim(), terminalDetails]
    .filter((value): value is string => Boolean(value))
    .join(" | ");
}

export function connectedWireSpecificationText(
  row: AssetConnectedWireRow
): string {
  if (!row.specification) return "—";
  const values = [
    row.specification.name,
    row.specification.wireType,
    row.specification.size,
    row.specification.color
  ].filter(
    (value, index, all): value is string =>
      Boolean(value?.trim()) && all.indexOf(value) === index
  );
  return values.length > 0 ? values.join(" / ") : "—";
}

function rowCellText(
  row: AssetConnectedWireRow
): Record<ConnectedWireScheduleColumnKey, string> {
  return {
    wireNumber: row.wireNumber ? formatWireNumber(row.wireNumber) : "—",
    wireId: row.wireId || "—",
    from: endpointText(row.from),
    to: endpointText(row.to),
    specification: connectedWireSpecificationText(row),
    description: row.description?.trim() || ""
  };
}

function rowCellSecondaryText(
  row: AssetConnectedWireRow
): Record<ConnectedWireScheduleColumnKey, string> {
  return {
    wireNumber: "",
    wireId: "",
    from: endpointDetailText(row.from),
    to: endpointDetailText(row.to),
    specification: "",
    description: ""
  };
}

function wrapText(text: string, maxCharacters: number): string[] {
  const value = text.trim();
  if (!value) return [""];
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (word.length > maxCharacters) {
      if (line) lines.push(line);
      for (let index = 0; index < word.length; index += maxCharacters) {
        lines.push(word.slice(index, index + maxCharacters));
      }
      line = "";
      continue;
    }
    const next = line ? `${line} ${word}` : word;
    if (next.length <= maxCharacters) {
      line = next;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length > 0 ? lines : [""];
}

export function clampConnectedWireScheduleWidth(
  width: number,
  sheetWidth: number
): number {
  const maximum = Math.max(
    MIN_CONNECTED_WIRE_SCHEDULE_WIDTH,
    sheetWidth - CONNECTED_WIRE_SCHEDULE_SHEET_MARGIN * 2
  );
  return Number(
    Math.min(maximum, Math.max(MIN_CONNECTED_WIRE_SCHEDULE_WIDTH, width)).toFixed(
      2
    )
  );
}

export function createConnectedWireScheduleLayout(input: {
  annotation: ConnectedWireScheduleAnnotation;
  projection: ConnectedWireScheduleProjection;
  sheet: { width: number; height: number };
}): ConnectedWireScheduleLayout {
  const width = clampConnectedWireScheduleWidth(
    input.annotation.width,
    input.sheet.width
  );
  const columnRatios = resolveConnectedWireScheduleColumnRatios(
    input.annotation.schedule.columnRatios
  );
  let currentX = 0;
  const columns = COLUMN_DEFINITIONS.map((definition, index) => {
    const columnWidth =
      index === COLUMN_DEFINITIONS.length - 1
        ? width - currentX
        : Number((width * columnRatios[definition.key]).toFixed(2));
    const column = {
      key: definition.key,
      label: definition.label,
      x: currentX,
      width: columnWidth
    };
    currentX = Number((currentX + columnWidth).toFixed(2));
    return column;
  });
  const titleHeight = input.annotation.schedule.pagination ? 12 : TITLE_HEIGHT;
  let rowY = titleHeight + HEADER_HEIGHT;
  const rows = input.projection.rows.map((row) => {
    const texts = rowCellText(row);
    const secondaryTexts = rowCellSecondaryText(row);
    const cells = Object.fromEntries(
      columns.map((column) => {
        const maxCharacters = Math.max(
          4,
          Math.floor((column.width - CELL_PADDING * 2) / 1.35)
        );
        return [column.key, wrapText(texts[column.key], maxCharacters)];
      })
    ) as ConnectedWireScheduleLayout["rows"][number]["cells"];
    const secondaryCells = Object.fromEntries(
      columns.map((column) => {
        const maxCharacters = Math.max(
          4,
          Math.floor((column.width - CELL_PADDING * 2) / 1.15)
        );
        const text = secondaryTexts[column.key];
        return [column.key, text ? wrapText(text, maxCharacters) : []];
      })
    ) as ConnectedWireScheduleLayout["rows"][number]["secondaryCells"];
    const contentHeight = Math.max(
      ...columns.map((column) => {
        const primaryHeight = cells[column.key].length * LINE_HEIGHT;
        const secondaryLines = secondaryCells[column.key];
        return (
          primaryHeight +
          (secondaryLines.length > 0
            ? SECONDARY_GAP + secondaryLines.length * SECONDARY_LINE_HEIGHT
            : 0)
        );
      })
    );
    const height = Math.max(
      MIN_ROW_HEIGHT,
      Number((CELL_PADDING * 2 + contentHeight).toFixed(2))
    );
    const result = { row, y: rowY, height, cells, secondaryCells };
    rowY = Number((rowY + height).toFixed(2));
    return result;
  });
  const emptyHeight = rows.length === 0 ? MIN_ROW_HEIGHT : 0;
  const height = Number((rowY + emptyHeight).toFixed(2));
  return {
    annotation: input.annotation,
    pageIndex: input.projection.pageIndex,
    pageCount: input.projection.pageCount,
    totalRows: input.projection.totalRows,
    width,
    height,
    titleHeight,
    headerHeight: HEADER_HEIGHT,
    columnRatios,
    columns,
    rows,
    overflow:
      input.annotation.x < CONNECTED_WIRE_SCHEDULE_SHEET_MARGIN ||
      input.annotation.x + width >
        input.sheet.width - CONNECTED_WIRE_SCHEDULE_SHEET_MARGIN ||
      input.annotation.y < CONNECTED_WIRE_SCHEDULE_SHEET_MARGIN ||
      input.annotation.y + height >
        input.sheet.height - CONNECTED_WIRE_SCHEDULE_SHEET_MARGIN
  };
}

export function defaultConnectedWireSchedulePosition(input: {
  sheet: { width: number; height: number };
  placementBounds: { left: number; right: number; top: number };
  width?: number;
}): { x: number; y: number; width: number } {
  const width = clampConnectedWireScheduleWidth(
    input.width ?? DEFAULT_CONNECTED_WIRE_SCHEDULE_WIDTH,
    input.sheet.width
  );
  const rightX = input.placementBounds.right + 10;
  const leftX = input.placementBounds.left - width - 10;
  const x =
    rightX + width <=
    input.sheet.width - CONNECTED_WIRE_SCHEDULE_SHEET_MARGIN
      ? rightX
      : leftX >= CONNECTED_WIRE_SCHEDULE_SHEET_MARGIN
        ? leftX
        : Math.max(
            CONNECTED_WIRE_SCHEDULE_SHEET_MARGIN,
            Math.min(
              input.sheet.width -
                CONNECTED_WIRE_SCHEDULE_SHEET_MARGIN -
                width,
              rightX
            )
          );
  return {
    x: Number(x.toFixed(2)),
    y: Number(
      Math.max(
        CONNECTED_WIRE_SCHEDULE_SHEET_MARGIN,
        Math.min(
          input.sheet.height - CONNECTED_WIRE_SCHEDULE_SHEET_MARGIN,
          input.placementBounds.top
        )
      ).toFixed(2)
    ),
    width
  };
}
