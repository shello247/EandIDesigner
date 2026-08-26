import type { DrawingSheetCanvasModel } from "@/features/drawing_canvas/api/asset-contracts";
import type {
  PanelDeliverableBundle,
  PanelReportKind
} from "../../data/schema";
import {
  buildPanelTabularRows,
  type PanelTabularRow
} from "./panel-schedule-export";

export type PanelSchedulePrintPage = {
  sheet: DrawingSheetCanvasModel["sheet"];
  svg: string;
  panelAssetId: string;
  report: PanelReportKind;
};

type PrintColumn = { key: string; label: string; width: number };

const PAGE_WIDTH = 420;
const PAGE_HEIGHT = 297;
const TABLE_X = 10;
const TABLE_Y = 34;
const ROW_HEIGHT = 7;
const ROWS_PER_PAGE = 31;

const printColumns: Record<PanelReportKind, PrintColumn[]> = {
  terminal_schedule: [
    { key: "assetTag", label: "Device", width: 34 },
    { key: "terminal", label: "Terminal", width: 28 },
    { key: "function", label: "Function", width: 44 },
    { key: "externalWire", label: "Field Wire", width: 32 },
    { key: "cable", label: "Cable / Cond.", width: 44 },
    { key: "fieldSource", label: "Field Source", width: 58 },
    { key: "internalWire", label: "Internal Wire", width: 34 },
    { key: "connectedDevice", label: "Connected To", width: 72 },
    { key: "patterns", label: "Pattern / Bond", width: 54 }
  ],
  internal_wire_schedule: [
    { key: "wireNumber", label: "Wire #", width: 18 },
    { key: "wireId", label: "Wire ID", width: 42 },
    { key: "from", label: "From", width: 82 },
    { key: "to", label: "To", width: 82 },
    { key: "domain", label: "Domain", width: 32 },
    { key: "size", label: "Size", width: 28 },
    { key: "color", label: "Color", width: 28 },
    { key: "wireType", label: "Type", width: 42 },
    { key: "ownerPattern", label: "Pattern", width: 36 },
    { key: "routeSheets", label: "Route Sheets", width: 30 }
  ],
  panel_asset_schedule: [
    { key: "assetTag", label: "Asset Tag", width: 44 },
    { key: "title", label: "Description", width: 112 },
    { key: "assetType", label: "Type", width: 54 },
    { key: "symbolId", label: "Approved Symbol", width: 78 },
    { key: "terminalCount", label: "Term.", width: 26 },
    { key: "connectionCount", label: "Conn.", width: 26 },
    { key: "sheetRefs", label: "Sheet References", width: 60 }
  ],
  bom: [
    { key: "itemKey", label: "Item", width: 38 },
    { key: "displayName", label: "Description", width: 104 },
    { key: "category", label: "Category", width: 46 },
    { key: "quantity", label: "Qty", width: 24 },
    { key: "unit", label: "Unit", width: 24 },
    { key: "manufacturer", label: "Manufacturer", width: 54 },
    { key: "partNumber", label: "Part Number", width: 54 },
    { key: "sourceAssets", label: "Source Assets", width: 56 }
  ]
};

const reportTitles: Record<PanelReportKind, string> = {
  terminal_schedule: "Terminal Schedule",
  internal_wire_schedule: "Internal Wire Schedule",
  panel_asset_schedule: "Panel Asset Schedule",
  bom: "Panel Bill of Materials"
};

function xml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function truncate(value: unknown, width: number) {
  const text = String(value ?? "");
  const limit = Math.max(4, Math.floor(width / 2.15));
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

function singlePanelBundle(bundle: PanelDeliverableBundle, panelIndex: number): PanelDeliverableBundle {
  return { ...bundle, panels: [bundle.panels[panelIndex]] };
}

function renderPage({
  bundle,
  panelTag,
  report,
  columns,
  rows,
  pageNumber,
  pageCount
}: {
  bundle: PanelDeliverableBundle;
  panelTag: string;
  report: PanelReportKind;
  columns: PrintColumn[];
  rows: PanelTabularRow[];
  pageNumber: number;
  pageCount: number;
}) {
  const issue = bundle.manifest.issueMode === "issued" ? "ISSUED" : "DRAFT";
  let x = TABLE_X;
  const headerCells = columns.map((column) => {
    const cell = `<rect x="${x}" y="${TABLE_Y}" width="${column.width}" height="8" class="header-cell"/><text x="${x + 1.5}" y="${TABLE_Y + 5.2}" class="header-text">${xml(column.label)}</text>`;
    x += column.width;
    return cell;
  }).join("");
  const body = rows.map((row, rowIndex) => {
    let cellX = TABLE_X;
    const y = TABLE_Y + 8 + rowIndex * ROW_HEIGHT;
    return columns.map((column) => {
      const cell = `<rect x="${cellX}" y="${y}" width="${column.width}" height="${ROW_HEIGHT}" class="body-cell"/><text x="${cellX + 1.5}" y="${y + 4.7}" class="body-text">${xml(truncate(row[column.key], column.width))}</text>`;
      cellX += column.width;
      return cell;
    }).join("");
  }).join("");
  const watermark = bundle.manifest.issueMode === "draft"
    ? `<text x="210" y="155" text-anchor="middle" class="watermark" transform="rotate(-24 210 155)">DRAFT - NOT FOR ISSUE</text>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_WIDTH}mm" height="${PAGE_HEIGHT}mm" viewBox="0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}" data-panel-schedule="${report}">
  <style>
    text{font-family:Inter,Poppins,Arial,sans-serif;fill:#172033}.page-border{fill:#fff;stroke:#334155;stroke-width:.4}.header-cell{fill:#e8eff3;stroke:#526579;stroke-width:.25}.body-cell{fill:#fff;stroke:#94a3b8;stroke-width:.18}.header-text{font-size:3.1px;font-weight:700}.body-text{font-size:2.8px}.title{font-size:5px;font-weight:700}.meta{font-size:3.1px}.watermark{font-size:19px;font-weight:700;fill:#b91c1c;opacity:.08;letter-spacing:2px}.footer{font-size:2.8px;fill:#475569}</style>
  <rect x="4" y="4" width="412" height="289" class="page-border"/>
  ${watermark}
  <text x="10" y="13" class="title">${xml(reportTitles[report])}</text>
  <text x="10" y="20" class="meta">${xml(bundle.manifest.drawingKey ?? bundle.manifest.drawingTitle)} | ${xml(panelTag)}</text>
  <text x="410" y="13" text-anchor="end" class="meta">${issue}</text>
  <text x="410" y="20" text-anchor="end" class="meta">QC: ${bundle.manifest.qcCounts.blockingErrors > 0 ? "BLOCKED" : "CLEAR"}</text>
  ${headerCells}${body}
  <line x1="10" y1="281" x2="410" y2="281" stroke="#64748b" stroke-width=".25"/>
  <text x="10" y="287" class="footer">EI Designer | ${xml(bundle.manifest.drawingTitle)}</text>
  <text x="410" y="287" text-anchor="end" class="footer">Schedule ${pageNumber} of ${pageCount}</text>
</svg>`;
}

export function renderPanelScheduleForPrint(
  bundle: PanelDeliverableBundle,
  reports: PanelReportKind[]
): PanelSchedulePrintPage[] {
  const pages: PanelSchedulePrintPage[] = [];
  const orderedReports: PanelReportKind[] = [
    "terminal_schedule",
    "internal_wire_schedule",
    "panel_asset_schedule",
    "bom"
  ];
  bundle.panels.forEach((panel, panelIndex) => {
    const panelBundle = singlePanelBundle(bundle, panelIndex);
    orderedReports.filter((report) => reports.includes(report)).forEach((report) => {
      const rows = buildPanelTabularRows(panelBundle, report);
      const chunks = rows.length === 0
        ? [[]]
        : Array.from({ length: Math.ceil(rows.length / ROWS_PER_PAGE) }, (_, index) =>
            rows.slice(index * ROWS_PER_PAGE, (index + 1) * ROWS_PER_PAGE)
          );
      chunks.forEach((chunk, index) => {
        pages.push({
          sheet: {
            size: "A3_LANDSCAPE",
            width: PAGE_WIDTH,
            height: PAGE_HEIGHT,
            gridSize: 10,
            titleBlock: {}
          },
          svg: renderPage({
            bundle,
            panelTag: panel.panelTag,
            report,
            columns: printColumns[report],
            rows: chunk,
            pageNumber: index + 1,
            pageCount: chunks.length
          }),
          panelAssetId: panel.panelAssetId,
          report
        });
      });
    });
  });
  return pages;
}
