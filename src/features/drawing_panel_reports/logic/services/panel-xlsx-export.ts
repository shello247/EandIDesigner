import type {
  PanelDeliverableBundle,
  PanelReportKind
} from "../../data/schema";
import {
  buildBomAssemblyTabularRows,
  buildPanelTabularRows,
  panelReportColumns,
  type PanelTabularColumn,
  type PanelTabularRow
} from "./panel-schedule-export";

const bomAssemblyColumns: PanelTabularColumn[] = [
  { key: "issueStatus", label: "Issue Status", width: 14 },
  { key: "drawingKey", label: "Drawing", width: 18 },
  { key: "qcStatus", label: "QC Status", width: 14 },
  { key: "panelTag", label: "Panel", width: 16 },
  { key: "assetTag", label: "Source Asset", width: 18 },
  { key: "assetTitle", label: "Asset Description", width: 28 },
  { key: "itemKey", label: "Item", width: 16 },
  { key: "displayName", label: "Item Description", width: 34 },
  { key: "quantity", label: "Quantity", width: 12 },
  { key: "unit", label: "Unit", width: 12 },
  { key: "manufacturer", label: "Manufacturer", width: 20 },
  { key: "partNumber", label: "Part Number", width: 20 },
  { key: "quantityRule", label: "Quantity Rule", width: 22 },
  { key: "quantityStatus", label: "Quantity Status", width: 18 },
  { key: "notes", label: "Notes", width: 28 }
];

function addTableSheet(
  workbook: import("exceljs").Workbook,
  name: string,
  columns: PanelTabularColumn[],
  rows: PanelTabularRow[]
) {
  const worksheet = workbook.addWorksheet(name, {
    views: [{ state: "frozen", ySplit: 1 }]
  });
  worksheet.columns = columns.map((column) => ({
    key: column.key,
    header: column.label,
    width: column.width
  }));
  rows.forEach((row) => worksheet.addRow(row));
  const header = worksheet.getRow(1);
  header.height = 24;
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0F4C5C" }
  };
  header.alignment = { vertical: "middle", wrapText: true };
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: Math.max(columns.length, 1) }
  };
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      row.alignment = { vertical: "top", wrapText: true };
    }
  });
}

function addManifest(workbook: import("exceljs").Workbook, bundle: PanelDeliverableBundle) {
  const worksheet = workbook.addWorksheet("Manifest");
  const rows: Array<[string, string | number | boolean]> = [
    ["Drawing", bundle.manifest.drawingKey ?? bundle.manifest.drawingTitle],
    ["Title", bundle.manifest.drawingTitle],
    ["Drawing status", bundle.manifest.drawingStatus],
    ["Issue status", bundle.manifest.issueMode],
    ["Scope", bundle.manifest.scope.kind],
    ["Panels", bundle.panels.map((panel) => panel.panelTag).join(", ")],
    ["Blocking QC findings", bundle.manifest.qcCounts.blockingErrors],
    ["QC warnings", bundle.manifest.qcCounts.warnings],
    ["QC information", bundle.manifest.qcCounts.information],
    ["Issued eligible", bundle.manifest.canIssue],
    ["Generated (UTC)", new Date().toISOString()]
  ];
  rows.forEach((row) => worksheet.addRow(row));
  worksheet.getColumn(1).width = 28;
  worksheet.getColumn(2).width = 70;
  worksheet.getColumn(1).font = { bold: true };
  worksheet.eachRow((row) => {
    row.alignment = { vertical: "top", wrapText: true };
  });
}

export async function buildPanelScheduleWorkbook(
  bundle: PanelDeliverableBundle,
  reports: PanelReportKind[]
): Promise<Uint8Array> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "EI Designer";
  workbook.subject = "Detailed Panel Engineering Deliverables";
  workbook.title = bundle.manifest.drawingTitle;
  workbook.calcProperties.fullCalcOnLoad = false;
  addManifest(workbook, bundle);

  const uniqueReports = [...new Set(reports)];
  const names: Record<PanelReportKind, string> = {
    terminal_schedule: "Terminal Schedule",
    internal_wire_schedule: "Internal Wires",
    panel_asset_schedule: "Panel Assets",
    bom: "BOM Summary"
  };
  uniqueReports.forEach((report) => {
    addTableSheet(
      workbook,
      names[report],
      panelReportColumns(report),
      buildPanelTabularRows(bundle, report)
    );
  });
  if (uniqueReports.includes("bom")) {
    addTableSheet(
      workbook,
      "BOM Assemblies",
      bomAssemblyColumns,
      buildBomAssemblyTabularRows(bundle)
    );
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}
