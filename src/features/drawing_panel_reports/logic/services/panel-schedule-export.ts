import type {
  PanelDeliverableBundle,
  PanelReportKind,
  PanelTerminalOccupantSchedule,
  PanelTerminalSideSchedule
} from "../../data/schema";

export type PanelTabularValue = string | number | boolean | undefined;
export type PanelTabularRow = Record<string, PanelTabularValue>;
export type PanelTabularColumn = {
  key: string;
  label: string;
  width: number;
};

const commonColumns: PanelTabularColumn[] = [
  { key: "issueStatus", label: "Issue Status", width: 14 },
  { key: "drawingKey", label: "Drawing", width: 18 },
  { key: "qcStatus", label: "QC Status", width: 14 },
  { key: "panelTag", label: "Panel", width: 16 }
];

const columns: Record<PanelReportKind, PanelTabularColumn[]> = {
  terminal_schedule: [
    ...commonColumns,
    { key: "assetTag", label: "Terminal Block / Device", width: 22 },
    { key: "terminal", label: "Terminal", width: 14 },
    { key: "function", label: "Function", width: 24 },
    { key: "externalWire", label: "Field Wire", width: 18 },
    { key: "cable", label: "Cable", width: 18 },
    { key: "conductor", label: "Conductor", width: 16 },
    { key: "fieldSource", label: "Field Source", width: 28 },
    { key: "internalWire", label: "Internal Wire", width: 18 },
    { key: "connectedDevice", label: "Connected Device / Terminal", width: 30 },
    { key: "patterns", label: "Jumper / Common / Bond", width: 28 },
    { key: "occupancy", label: "Occupancy", width: 16 },
    { key: "sourceSheets", label: "Source Sheets", width: 24 },
    { key: "findings", label: "QC Findings", width: 14 }
  ],
  internal_wire_schedule: [
    ...commonColumns,
    { key: "wireId", label: "Wire ID", width: 18 },
    { key: "from", label: "From", width: 30 },
    { key: "to", label: "To", width: 30 },
    { key: "domain", label: "Domain", width: 16 },
    { key: "size", label: "Size", width: 14 },
    { key: "color", label: "Color", width: 14 },
    { key: "wireType", label: "Wire Type", width: 20 },
    { key: "ownerPattern", label: "Pattern", width: 18 },
    { key: "routeSheets", label: "Route Sheets", width: 24 },
    { key: "routeMode", label: "Route Mode", width: 16 },
    { key: "represented", label: "Represented", width: 14 },
    { key: "description", label: "Description", width: 28 },
    { key: "findings", label: "QC Findings", width: 14 }
  ],
  panel_asset_schedule: [
    ...commonColumns,
    { key: "assetTag", label: "Asset Tag", width: 18 },
    { key: "title", label: "Description", width: 30 },
    { key: "assetType", label: "Type", width: 18 },
    { key: "symbolId", label: "Symbol", width: 26 },
    { key: "terminalCount", label: "Terminals", width: 12 },
    { key: "occurrenceCount", label: "Occurrences", width: 12 },
    { key: "connectionCount", label: "Connections", width: 12 },
    { key: "sheetRefs", label: "Sheet References", width: 28 },
    { key: "findings", label: "QC Findings", width: 14 }
  ],
  bom: [
    ...commonColumns,
    { key: "itemKey", label: "Item", width: 16 },
    { key: "displayName", label: "Description", width: 34 },
    { key: "category", label: "Category", width: 18 },
    { key: "quantity", label: "Quantity", width: 12 },
    { key: "unit", label: "Unit", width: 12 },
    { key: "manufacturer", label: "Manufacturer", width: 20 },
    { key: "partNumber", label: "Part Number", width: 20 },
    { key: "sourceAssets", label: "Source Assets", width: 30 },
    { key: "quantityStatus", label: "Quantity Status", width: 18 }
  ]
};

function joined(values: Array<string | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].join("; ");
}

function occupants(side: PanelTerminalSideSchedule, kind?: PanelTerminalOccupantSchedule["kind"]) {
  return side.occupants.filter((occupant) => !kind || occupant.kind === kind);
}

function bundleMetadata(bundle: PanelDeliverableBundle, panelTag: string) {
  return {
    issueStatus: bundle.manifest.issueMode === "issued" ? "ISSUED" : "DRAFT",
    drawingKey: bundle.manifest.drawingKey ?? bundle.manifest.drawingTitle,
    qcStatus: bundle.manifest.qcCounts.blockingErrors > 0 ? "BLOCKED" : "CLEAR",
    panelTag
  };
}

export function panelReportColumns(kind: PanelReportKind): PanelTabularColumn[] {
  return columns[kind];
}

export function buildPanelTabularRows(
  bundle: PanelDeliverableBundle,
  kind: PanelReportKind
): PanelTabularRow[] {
  if (kind === "terminal_schedule") {
    return bundle.panels.flatMap((panel) =>
      panel.terminalSchedule.map((row) => {
        const allSides = [row.external, row.internal, row.single];
        const external = occupants(row.external, "external_termination");
        const internal = [
          ...occupants(row.internal, "internal_wire"),
          ...occupants(row.single, "internal_wire")
        ];
        return {
          rowId: row.id,
          ...bundleMetadata(bundle, panel.panelTag),
          assetTag: row.assetTag,
          terminal: row.terminalLabel,
          function: row.function,
          externalWire: joined(external.map((item) => item.wireId ?? item.label)),
          cable: joined(external.map((item) => item.cableTag)),
          conductor: joined(external.map((item) => item.conductorKey)),
          fieldSource: joined(external.map((item) =>
            [item.connectedAssetTag, item.sourceSheet?.sheetName].filter(Boolean).join(" / ")
          )),
          internalWire: joined(internal.map((item) => item.wireId ?? item.label)),
          connectedDevice: joined(internal.map((item) =>
            item.connectedTerminalLabel ?? item.connectedAssetTag
          )),
          patterns: joined([
            ...row.patterns.map((pattern) => `${pattern.patternCode} (${pattern.topology})`),
            ...allSides.flatMap((side) =>
              side.occupants
                .filter((item) => item.kind === "bridge" || item.kind === "bond")
                .map((item) => item.ownerPatternCode ?? item.label)
            )
          ]),
          occupancy: joined(allSides.map((side) =>
            side.status === "not_applicable" ? undefined : `${side.side}: ${side.status}`
          )),
          sourceSheets: joined(row.sourceSheets.map((sheet) =>
            `${sheet.sheetNumber} - ${sheet.sheetName}`
          )),
          findings: row.findings.length
        };
      })
    );
  }

  if (kind === "internal_wire_schedule") {
    return bundle.panels.flatMap((panel) =>
      panel.wireSchedule.map((row) => ({
        rowId: row.id,
        ...bundleMetadata(bundle, panel.panelTag),
        wireId: row.wireId,
        from: row.fromLabel,
        to: row.toLabel,
        domain: row.domain,
        size: row.size,
        color: row.color,
        wireType: row.wireType,
        ownerPattern: row.ownerPatternCode,
        routeSheets: joined(row.routes.map((route) => `${route.sheetNumber} - ${route.sheetName}`)),
        routeMode: joined(row.routes.map((route) => route.routeMode)),
        represented: row.represented,
        description: row.description,
        findings: row.findings.length
      }))
    );
  }

  if (kind === "panel_asset_schedule") {
    return bundle.panels.flatMap((panel) =>
      panel.assetSchedule.map((row) => ({
        rowId: row.id,
        ...bundleMetadata(bundle, panel.panelTag),
        assetTag: row.assetTag,
        title: row.title,
        assetType: row.assetType,
        symbolId: row.symbolId,
        terminalCount: row.terminalCount,
        occurrenceCount: row.occurrenceCount,
        connectionCount: row.connectionCount,
        sheetRefs: joined(row.sheetRefs.map((sheet) => `${sheet.sheetNumber} - ${sheet.sheetName}`)),
        findings: row.findings.length
      }))
    );
  }

  return bundle.panels.flatMap((panel) =>
    (panel.bom?.consolidatedLines ?? []).map((line) => ({
      rowId: `bom:${panel.panelAssetId}:${line.id}`,
      ...bundleMetadata(bundle, panel.panelTag),
      itemKey: line.itemKey,
      displayName: line.displayName,
      category: line.category,
      quantity: line.quantity,
      unit: line.unit,
      manufacturer: line.manufacturer,
      partNumber: line.partNumber,
      sourceAssets: line.sourceAssetTags.join("; "),
      quantityStatus: line.quantityStatus
    }))
  );
}

export function buildBomAssemblyTabularRows(bundle: PanelDeliverableBundle): PanelTabularRow[] {
  return bundle.panels.flatMap((panel) =>
    (panel.bom?.assemblies ?? []).flatMap((assembly) =>
      assembly.lines.map((line) => ({
        ...bundleMetadata(bundle, panel.panelTag),
        assetTag: assembly.assetTag,
        assetTitle: assembly.title,
        itemKey: line.itemKey,
        displayName: line.displayName,
        quantity: line.quantity,
        unit: line.unit,
        manufacturer: line.manufacturer,
        partNumber: line.partNumber,
        quantityRule: line.quantityRule,
        quantityStatus: line.quantityStatus,
        notes: line.notes
      }))
    )
  );
}

function csvCell(value: PanelTabularValue): string {
  const text = value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function buildPanelScheduleCsv(
  bundle: PanelDeliverableBundle,
  kind: PanelReportKind
): string {
  const reportColumns = panelReportColumns(kind);
  const rows = buildPanelTabularRows(bundle, kind);
  return `\uFEFF${[
    reportColumns.map((column) => csvCell(column.label)).join(","),
    ...rows.map((row) => reportColumns.map((column) => csvCell(row[column.key])).join(","))
  ].join("\r\n")}\r\n`;
}
