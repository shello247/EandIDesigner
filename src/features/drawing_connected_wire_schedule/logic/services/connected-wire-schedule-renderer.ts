import type { ConnectedWireScheduleLayout } from "../../types";
import {
  formatConnectedWireSchedulePageLabel,
  formatConnectedWireScheduleRowRange
} from "./connected-wire-schedule-pagination";

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function format(value: number): string {
  return Number(value.toFixed(2)).toString();
}

export function renderConnectedWireScheduleSvg(input: {
  layout: ConnectedWireScheduleLayout;
  assetTag: string;
  linkedOccurrenceAvailable: boolean;
  unresolvedCount: number;
}): string {
  const { layout } = input;
  const pageLabel = layout.annotation.schedule.pagination
    ? `${formatConnectedWireSchedulePageLabel({
        pageIndex: layout.pageIndex,
        pageCount: layout.pageCount
      })} · ${formatConnectedWireScheduleRowRange({
        firstRowNumber: layout.rows[0]
          ? layout.pageIndex *
              layout.annotation.schedule.pagination.rowsPerPage +
            1
          : undefined,
        lastRowNumber: layout.rows[0]
          ? layout.pageIndex *
              layout.annotation.schedule.pagination.rowsPerPage +
            layout.rows.length
          : undefined,
        totalRows: layout.totalRows
      })}`
    : "";
  const title = `CONNECTED WIRE SCHEDULE — ${input.assetTag}`;
  const warning = !input.linkedOccurrenceAvailable
    ? "LINKED EQUIPMENT OCCURRENCE UNAVAILABLE"
    : input.unresolvedCount > 0
      ? `${input.unresolvedCount} UNRESOLVED CONNECTION${input.unresolvedCount === 1 ? "" : "S"}`
      : "";
  const header = layout.columns
    .map(
      (column) =>
        `<rect x="${format(column.x)}" y="${format(layout.titleHeight)}" width="${format(column.width)}" height="${format(layout.headerHeight)}" fill="#e2e8f0" stroke="#64748b" stroke-width=".35"/><text x="${format(column.x + 2)}" y="${format(layout.titleHeight + 4.6)}" font-family="Inter, Arial, sans-serif" font-size="2.35" font-weight="700" fill="#0f172a">${escapeXml(column.label)}</text>`
    )
    .join("");
  const rows = layout.rows
    .map((layoutRow) =>
      layout.columns
        .map((column) => {
          const lines = layoutRow.cells[column.key];
          const secondaryLines = layoutRow.secondaryCells[column.key];
          const text = lines
            .map(
              (line, index) =>
                `<tspan x="${format(column.x + 2)}" dy="${index === 0 ? 0 : 3.35}">${escapeXml(line)}</tspan>`
            )
            .join("");
          const secondaryText = secondaryLines
            .map(
              (line, index) =>
                `<tspan x="${format(column.x + 2)}" dy="${index === 0 ? 0 : 2.85}">${escapeXml(line)}</tspan>`
            )
            .join("");
          const secondaryY =
            layoutRow.y + 4.45 + lines.length * 3.35 + 0.2;
          return `<rect x="${format(column.x)}" y="${format(layoutRow.y)}" width="${format(column.width)}" height="${format(layoutRow.height)}" fill="#ffffff" stroke="#94a3b8" stroke-width=".3"/><text x="${format(column.x + 2)}" y="${format(layoutRow.y + 4.45)}" font-family="Inter, Arial, sans-serif" font-size="2.35" font-weight="500" fill="#334155">${text}</text>${secondaryText ? `<text data-endpoint-detail="${column.key}" x="${format(column.x + 2)}" y="${format(secondaryY)}" font-family="Inter, Arial, sans-serif" font-size="1.95" font-weight="450" fill="#64748b">${secondaryText}</text>` : ""}`;
        })
        .join("")
    )
    .join("");
  const empty =
    layout.rows.length === 0
      ? `<rect x="0" y="${format(layout.titleHeight + layout.headerHeight)}" width="${format(layout.width)}" height="7" fill="#ffffff" stroke="#94a3b8" stroke-width=".3"/><text x="2" y="${format(layout.titleHeight + layout.headerHeight + 4.5)}" font-family="Inter, Arial, sans-serif" font-size="2.35" fill="#64748b">No connected wires</text>`
      : "";
  return `<g data-connected-wire-schedule="${escapeXml(layout.annotation.id)}" transform="translate(${format(layout.annotation.x)} ${format(layout.annotation.y)})" pointer-events="none"><rect x="0" y="0" width="${format(layout.width)}" height="${format(layout.titleHeight)}" fill="#0f766e" stroke="#0f172a" stroke-width=".4"/><text x="3" y="5.25" font-family="Inter, Arial, sans-serif" font-size="2.9" font-weight="700" fill="#ffffff">${escapeXml(title)}</text>${pageLabel ? `<text x="3" y="9.25" font-family="Inter, Arial, sans-serif" font-size="2.1" font-weight="600" fill="#ccfbf1">${escapeXml(pageLabel)}</text>` : ""}${warning ? `<text x="${format(layout.width - 3)}" y="${pageLabel ? "9.25" : "5.2"}" text-anchor="end" font-family="Inter, Arial, sans-serif" font-size="2.1" font-weight="700" fill="#fef3c7">${escapeXml(warning)}</text>` : ""}${header}${rows}${empty}</g>`;
}
