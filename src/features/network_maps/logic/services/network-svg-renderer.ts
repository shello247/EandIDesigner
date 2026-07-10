import type {
  NetworkMapAnnotation,
  NetworkMapLink,
  NetworkMapModel,
  NetworkMapNode,
  NetworkMapSheet
} from "../../data/schema";
import type { ApprovedNetworkSymbol } from "../../types";
import {
  buildDefaultNetworkLinkRoute,
  networkRoutePathData
} from "./network-link-routing";

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function truncateText(value: string | undefined, maxLength: number): string {
  const normalized = (value ?? "").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function nameInitials(value: string | undefined): string {
  const parts = (value ?? "")
    .trim()
    .split(/[\s._-]+/)
    .map((part) => part.replace(/[^A-Za-z0-9]/g, ""))
    .filter(Boolean);

  if (parts.length === 0) {
    return "";
  }

  return parts.map((part) => `${part[0].toUpperCase()}.`).join("");
}

function nameWithInitials(value: string | undefined): string {
  const normalized = (value ?? "").trim();
  const initials = nameInitials(normalized);

  return normalized && initials ? `${normalized} (${initials})` : normalized;
}

function cadText(params: {
  x: number;
  y: number;
  value: string | undefined;
  maxLength: number;
  size?: number;
  weight?: number;
  anchor?: "start" | "middle" | "end";
}): string {
  const {
    x,
    y,
    value,
    maxLength,
    size = 3.2,
    weight = 500,
    anchor = "start"
  } = params;

  return `<text x="${x}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" fill="#111827">${escapeXml(truncateText(value, maxLength))}</text>`;
}

function cadLabel(x: number, y: number, label: string): string {
  return `<text x="${x}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="2.05" font-weight="700" fill="#111827">${escapeXml(label.toUpperCase())}</text>`;
}

function line(params: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width?: number;
}): string {
  return `<line x1="${params.x1}" y1="${params.y1}" x2="${params.x2}" y2="${params.y2}" stroke="#111827" stroke-width="${params.width ?? 0.28}"/>`;
}

function technicalCell(params: {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  value?: string;
  maxLength: number;
  valueSize?: number;
  valueWeight?: number;
  valueAnchor?: "start" | "middle" | "end";
}): string {
  const textX =
    params.valueAnchor === "middle"
      ? params.x + params.width / 2
      : params.valueAnchor === "end"
        ? params.x + params.width - 2
        : params.x + 2;

  return `
    <rect x="${params.x}" y="${params.y}" width="${params.width}" height="${params.height}" fill="none" stroke="#111827" stroke-width="0.28"/>
    ${cadLabel(params.x + 1.6, params.y + 3, params.label)}
    ${cadText({
      x: textX,
      y: params.y + params.height - 2.2,
      value: params.value,
      maxLength: params.maxLength,
      size: params.valueSize,
      weight: params.valueWeight,
      anchor: params.valueAnchor
    })}
  `;
}

function stripSvgRoot(svg: string): string {
  return svg
    .replace(/^[\s\S]*?<svg\b[^>]*>/i, "")
    .replace(/<\/svg>\s*$/i, "")
    .trim();
}

function wrapText(value: string, maxCharacters: number): string[] {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;

    if (candidate.length > maxCharacters && current) {
      lines.push(current);
      current = word;
      continue;
    }

    current = candidate;
  }

  if (current) {
    lines.push(current);
  }

  return lines.length > 0 ? lines : [" "];
}

function renderRevisionGrid(params: {
  x: number;
  y: number;
  width: number;
  height: number;
  revision?: string;
  date?: string;
  preparedBy?: string;
  checkedBy?: string;
}): string {
  const columnWidths = [10, 18, 13, 13, 13, params.width - 67];
  const labels = ["REV", "DATE", "BY", "CHK", "APP", "REMARKS"];
  const headerHeight = 5.2;
  const rowHeight = (params.height - headerHeight) / 4;
  let x = params.x;
  const columns = columnWidths.map((width, index) => {
    const currentX = x;
    x += width;

    return { x: currentX, width, label: labels[index] };
  });

  return `
    <g data-title-block-section="revisions">
      <rect x="${params.x}" y="${params.y}" width="${params.width}" height="${params.height}" fill="none" stroke="#111827" stroke-width="0.42"/>
      ${cadText({
        x: params.x + params.width / 2,
        y: params.y + params.height - 1.8,
        value: "REVISIONS",
        maxLength: 12,
        size: 2.35,
        weight: 700,
        anchor: "middle"
      })}
      ${line({
        x1: params.x,
        y1: params.y + headerHeight,
        x2: params.x + params.width,
        y2: params.y + headerHeight,
        width: 0.34
      })}
      ${[1, 2, 3].map((row) =>
        line({
          x1: params.x,
          y1: params.y + headerHeight + row * rowHeight,
          x2: params.x + params.width,
          y2: params.y + headerHeight + row * rowHeight
        })
      ).join("")}
      ${columns.slice(1).map((column) =>
        line({
          x1: column.x,
          y1: params.y,
          x2: column.x,
          y2: params.y + params.height
        })
      ).join("")}
      ${columns.map((column) =>
        cadText({
          x: column.x + column.width / 2,
          y: params.y + 3.5,
          value: column.label,
          maxLength: 9,
          size: 1.8,
          weight: 700,
          anchor: "middle"
        })
      ).join("")}
      ${cadText({
        x: columns[0].x + columns[0].width / 2,
        y: params.y + headerHeight + rowHeight - 1.8,
        value: params.revision,
        maxLength: 5,
        size: 2.1,
        weight: 700,
        anchor: "middle"
      })}
      ${cadText({
        x: columns[1].x + columns[1].width / 2,
        y: params.y + headerHeight + rowHeight - 1.8,
        value: params.date,
        maxLength: 10,
        size: 1.9,
        weight: 500,
        anchor: "middle"
      })}
      ${cadText({
        x: columns[2].x + columns[2].width / 2,
        y: params.y + headerHeight + rowHeight - 1.8,
        value: nameInitials(params.preparedBy),
        maxLength: 8,
        size: 1.9,
        weight: 500,
        anchor: "middle"
      })}
      ${cadText({
        x: columns[3].x + columns[3].width / 2,
        y: params.y + headerHeight + rowHeight - 1.8,
        value: nameInitials(params.checkedBy),
        maxLength: 8,
        size: 1.9,
        weight: 500,
        anchor: "middle"
      })}
    </g>
  `;
}

function renderApprovalGrid(params: {
  x: number;
  y: number;
  width: number;
  height: number;
  preparedBy?: string;
  checkedBy?: string;
  date?: string;
  scaleLabel: string;
}): string {
  const labelWidth = 37;
  const rowHeight = params.height / 6;
  const rows = [
    { label: "DRAWN", value: nameWithInitials(params.preparedBy) },
    { label: "DATE", value: params.date },
    { label: "CHECKED", value: nameWithInitials(params.checkedBy) },
    { label: "APPROVED", value: "" },
    { label: "ORIGINAL SCALE", value: params.scaleLabel },
    { label: "D/O MOC NO.", value: "" }
  ];

  return `
    <g data-title-block-section="approval">
      <rect x="${params.x}" y="${params.y}" width="${params.width}" height="${params.height}" fill="none" stroke="#111827" stroke-width="0.42"/>
      ${line({
        x1: params.x + labelWidth,
        y1: params.y,
        x2: params.x + labelWidth,
        y2: params.y + params.height,
        width: 0.34
      })}
      ${rows.slice(1).map((_, index) =>
        line({
          x1: params.x,
          y1: params.y + (index + 1) * rowHeight,
          x2: params.x + params.width,
          y2: params.y + (index + 1) * rowHeight
        })
      ).join("")}
      ${rows.map((row, index) => `
        ${cadLabel(params.x + 2, params.y + index * rowHeight + 3.8, row.label)}
        ${cadText({
          x: params.x + labelWidth + 2,
          y: params.y + index * rowHeight + 4.3,
          value: row.value,
          maxLength: 34,
          size: 2.05,
          weight: 500
        })}
      `).join("")}
    </g>
  `;
}

function renderTitleField(params: {
  x: number;
  y: number;
  width: number;
  height: number;
  sheetTitle: string;
}): string {
  const topHeight = 6.4;
  const maxCharacters = Math.max(24, Math.floor(params.width / 4.2));
  const titleLines = wrapText(params.sheetTitle, maxCharacters)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3);
  const titleFontSize = titleLines.length > 1 ? 4.25 : 4.85;
  const titleLineGap = titleFontSize + 1.75;
  const firstTitleBaseline =
    params.y + topHeight + 5.2 + titleFontSize * 0.72;
  const titleText = titleLines.length
    ? `<text x="${params.x + params.width / 2}" y="${firstTitleBaseline}" font-family="Arial, Helvetica, sans-serif" font-size="${titleFontSize}" font-weight="500" text-anchor="middle" fill="#111827">
        ${titleLines
          .map(
            (line, index) =>
              `<tspan x="${params.x + params.width / 2}" dy="${index === 0 ? 0 : titleLineGap}">${escapeXml(line)}</tspan>`
          )
          .join("")}
      </text>`
    : "";

  return `
    <g data-title-block-section="drawing-title">
      <rect x="${params.x}" y="${params.y}" width="${params.width}" height="${params.height}" fill="none" stroke="#111827" stroke-width="0.42"/>
      ${line({
        x1: params.x,
        y1: params.y + topHeight,
        x2: params.x + params.width,
        y2: params.y + topHeight
      })}
      ${cadLabel(params.x + 2, params.y + 3.2, "TITLE")}
      ${titleText}
    </g>
  `;
}

function renderMetadataGrid(params: {
  x: number;
  y: number;
  width: number;
  height: number;
  drawingNumber?: string;
  sheetNumber: number;
  sheetCount: number;
  revision?: string;
  date?: string;
  scaleLabel: string;
}): string {
  const rowHeight = params.height / 5;

  return `
    <g data-title-block-section="metadata">
      ${technicalCell({
        x: params.x,
        y: params.y,
        width: params.width,
        height: rowHeight,
        label: "DRAWING No.",
        value: params.drawingNumber,
        maxLength: 22,
        valueSize: 2.25,
        valueWeight: 700
      })}
      ${technicalCell({
        x: params.x,
        y: params.y + rowHeight,
        width: params.width,
        height: rowHeight,
        label: "SHEET No.",
        value: `${params.sheetNumber} OF ${params.sheetCount}`,
        maxLength: 10,
        valueSize: 2.35,
        valueWeight: 700
      })}
      ${technicalCell({
        x: params.x,
        y: params.y + rowHeight * 2,
        width: params.width,
        height: rowHeight,
        label: "ISSUE",
        value: params.revision,
        maxLength: 8,
        valueSize: 2.35,
        valueWeight: 700
      })}
      ${technicalCell({
        x: params.x,
        y: params.y + rowHeight * 3,
        width: params.width,
        height: rowHeight,
        label: "DATE",
        value: params.date,
        maxLength: 12,
        valueSize: 2.1
      })}
      ${technicalCell({
        x: params.x,
        y: params.y + rowHeight * 4,
        width: params.width,
        height: rowHeight,
        label: "SCALE",
        value: params.scaleLabel,
        maxLength: 8,
        valueSize: 2.35,
        valueWeight: 700
      })}
    </g>
  `;
}

function renderSheetFrame(sheet: NetworkMapSheet): string {
  const gridSize = sheet.page.gridSize;

  return `
    <defs>
      <pattern id="network-grid" width="${gridSize}" height="${gridSize}" patternUnits="userSpaceOnUse">
        <path d="M ${gridSize} 0 L 0 0 0 ${gridSize}" fill="none" stroke="#e7edf5" stroke-width="0.25"/>
      </pattern>
    </defs>
    <rect x="0" y="0" width="${sheet.page.width}" height="${sheet.page.height}" fill="white"/>
    <rect x="0" y="0" width="${sheet.page.width}" height="${sheet.page.height}" fill="url(#network-grid)"/>
    <rect x="4" y="4" width="${sheet.page.width - 8}" height="${sheet.page.height - 8}" fill="none" stroke="#111827" stroke-width="0.78"/>
    <rect x="6" y="6" width="${sheet.page.width - 12}" height="${sheet.page.height - 12}" fill="none" stroke="#111827" stroke-width="0.32"/>
  `;
}

function renderTitleBlock(input: {
  model: NetworkMapModel;
  sheet: NetworkMapSheet;
  drawingTitle: string;
  sheetNumber: number;
  sheetCount: number;
}): string {
  const titleBlock = input.model.titleBlock;
  const margin = 6;
  const blockX = margin;
  const blockHeight = 36;
  const blockY = input.sheet.page.height - margin - blockHeight;
  const blockWidth = input.sheet.page.width - 12;
  const revisionWidth = 112;
  const approvalWidth = 94;
  const metadataWidth = 62;
  const titleWidth = blockWidth - revisionWidth - approvalWidth - metadataWidth;
  const approvalX = blockX + revisionWidth;
  const titleX = approvalX + approvalWidth;
  const metadataX = titleX + titleWidth;
  const scaleLabel = "NTS";
  const resolvedTitle =
    input.sheet.name.trim() ||
    input.drawingTitle.trim() ||
    titleBlock.project?.trim() ||
    "NETWORK MAP";

  return `
    <g data-network-title-block="true" data-title-block="technical-full-width">
      <rect x="${blockX}" y="${blockY}" width="${blockWidth}" height="${blockHeight}" fill="white" stroke="#111827" stroke-width="0.72"/>
      ${renderRevisionGrid({
        x: blockX,
        y: blockY,
        width: revisionWidth,
        height: blockHeight,
        revision: titleBlock.revision,
        date: titleBlock.date,
        preparedBy: titleBlock.preparedBy,
        checkedBy: titleBlock.checkedBy
      })}
      ${renderApprovalGrid({
        x: approvalX,
        y: blockY,
        width: approvalWidth,
        height: blockHeight,
        preparedBy: titleBlock.preparedBy,
        checkedBy: titleBlock.checkedBy,
        date: titleBlock.date,
        scaleLabel
      })}
      ${renderTitleField({
        x: titleX,
        y: blockY,
        width: titleWidth,
        height: blockHeight,
        sheetTitle: resolvedTitle
      })}
      ${renderMetadataGrid({
        x: metadataX,
        y: blockY,
        width: metadataWidth,
        height: blockHeight,
        drawingNumber: titleBlock.mapNumber,
        sheetNumber: input.sheetNumber,
        sheetCount: input.sheetCount,
        revision: titleBlock.revision,
        date: titleBlock.date,
        scaleLabel
      })}
    </g>
  `;
}

function renderZones(sheet: NetworkMapSheet): string {
  return sheet.zones
    .map(
      (zone) => `
        <g data-network-zone-id="${escapeXml(zone.id)}">
          <rect x="${zone.x}" y="${zone.y}" width="${zone.width}" height="${zone.height}" rx="2" fill="${escapeXml(zone.color ?? "#f8fafc")}" fill-opacity="0.42" stroke="#94a3b8" stroke-width="0.42" stroke-dasharray="4 2"/>
          <text x="${zone.x + 4}" y="${zone.y + 7}" font-family="Arial, Helvetica, sans-serif" font-size="3.4" font-weight="700" fill="#334155">${escapeXml(zone.name)}</text>
        </g>
      `
    )
    .join("");
}

function symbolForNode(
  node: NetworkMapNode,
  symbols: ApprovedNetworkSymbol[]
): ApprovedNetworkSymbol | undefined {
  return symbols.find(
    (symbol) =>
      symbol.symbolId === node.symbolId && symbol.versionId === node.versionId
  );
}

function renderNodes(
  sheet: NetworkMapSheet,
  symbols: ApprovedNetworkSymbol[]
): string {
  return sheet.nodes
    .map((node) => {
      const symbol = symbolForNode(node, symbols);

      if (!symbol) {
        return "";
      }

      const label = node.label?.trim() || symbol.displayName;
      const width = symbol.metadata.viewBox.width * node.scale;
      const height = symbol.metadata.viewBox.height * node.scale;
      const titleY = node.y - 7;
      const ipY = node.y + height + 8;
      const rotation = node.rotation
        ? ` rotate(${node.rotation} ${node.x + width / 2} ${node.y + height / 2})`
        : "";

      return `
        <g data-network-node-id="${escapeXml(node.id)}" data-symbol-key="${escapeXml(symbol.symbolKey)}">
          <text x="${node.x + width / 2}" y="${titleY}" font-family="Arial, Helvetica, sans-serif" font-size="3.7" font-weight="700" text-anchor="middle" fill="#111827">${escapeXml(node.tag)}</text>
          <g transform="translate(${node.x} ${node.y})${rotation} scale(${node.scale})">
            ${stripSvgRoot(symbol.svg)}
          </g>
          <text x="${node.x + width / 2}" y="${node.y + height + 3.8}" font-family="Arial, Helvetica, sans-serif" font-size="3" font-weight="600" text-anchor="middle" fill="#475569">${escapeXml(label)}</text>
          ${
            node.ipAddress
              ? `<text x="${node.x + width / 2}" y="${ipY}" font-family="Arial, Helvetica, sans-serif" font-size="2.65" font-weight="600" text-anchor="middle" fill="#0f766e">${escapeXml(node.ipAddress)}</text>`
              : ""
          }
        </g>
      `;
    })
    .join("");
}

function linkStroke(media: NetworkMapLink["media"]): string {
  switch (media) {
    case "fiber":
      return "#7c3aed";
    case "wireless":
      return "#ea580c";
    case "serial":
      return "#64748b";
    case "virtual":
      return "#0ea5e9";
    case "copper":
      return "#0f766e";
    case "other":
      return "#334155";
  }
}

function renderLinks(
  sheet: NetworkMapSheet,
  symbols: ApprovedNetworkSymbol[]
): string {
  return sheet.links
    .map((linkItem) => {
      const routePoints =
        linkItem.route?.points ??
        buildDefaultNetworkLinkRoute({
          sheet,
          symbols,
          link: linkItem
        });

      if (!routePoints) {
        return "";
      }

      const pathData = networkRoutePathData(routePoints);
      const label = [
        linkItem.label,
        linkItem.vlanId ? `VLAN ${linkItem.vlanId}` : undefined
      ]
        .filter(Boolean)
        .join(" / ");
      const labelPoint =
        linkItem.route?.labelPosition ??
        routePoints[Math.max(1, Math.floor(routePoints.length / 2))];

      return `
        <g data-network-link-id="${escapeXml(linkItem.id)}">
          <path d="${pathData}" fill="none" stroke="${linkStroke(linkItem.media)}" stroke-width="0.7" stroke-linecap="round" stroke-linejoin="round"/>
          ${
            label
              ? `<rect x="${labelPoint.x - label.length * 1.55}" y="${labelPoint.y - 7}" width="${label.length * 3.1}" height="5.5" rx="1.3" fill="white" opacity="0.88"/>
                <text x="${labelPoint.x}" y="${labelPoint.y - 2.8}" font-family="Arial, Helvetica, sans-serif" font-size="2.65" font-weight="700" text-anchor="middle" fill="#334155">${escapeXml(label)}</text>`
              : ""
          }
        </g>
      `;
    })
    .join("");
}

function renderAnnotation(annotation: NetworkMapAnnotation): string {
  const width = annotation.width ?? 80;
  const height = annotation.height ?? 22;
  const title = annotation.title
    ? `<text x="${annotation.x + 3}" y="${annotation.y + 6}" font-family="Arial, Helvetica, sans-serif" font-size="2.85" font-weight="700" fill="#0f172a">${escapeXml(annotation.title)}</text>`
    : "";
  const lines = wrapText(annotation.text, Math.max(14, Math.floor(width / 2.2)))
    .slice(0, 3)
    .map(
      (line, index) =>
        `<tspan x="${annotation.x + 3}" dy="${index === 0 ? 0 : 4}">${escapeXml(line)}</tspan>`
    )
    .join("");

  return `
    <g data-network-annotation-id="${escapeXml(annotation.id)}">
      <rect x="${annotation.x}" y="${annotation.y}" width="${width}" height="${height}" rx="2" fill="#ffffff" stroke="#cbd5e1" stroke-width="0.34"/>
      ${title}
      <text x="${annotation.x + 3}" y="${annotation.y + (annotation.title ? 11 : 6)}" font-family="Arial, Helvetica, sans-serif" font-size="2.7" font-weight="500" fill="#475569">${lines}</text>
    </g>
  `;
}

export function renderNetworkMapSheetToSvg(params: {
  model: NetworkMapModel;
  sheet: NetworkMapSheet;
  approvedSymbols: ApprovedNetworkSymbol[];
  mapTitle: string;
  sheetNumber: number;
  sheetCount: number;
}): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${params.sheet.page.width}mm" height="${params.sheet.page.height}mm" viewBox="0 0 ${params.sheet.page.width} ${params.sheet.page.height}">
    ${renderSheetFrame(params.sheet)}
    ${renderZones(params.sheet)}
    ${renderLinks(params.sheet, params.approvedSymbols)}
    ${renderNodes(params.sheet, params.approvedSymbols)}
    ${params.sheet.annotations.map(renderAnnotation).join("")}
    ${renderTitleBlock({
      model: params.model,
      sheet: params.sheet,
      drawingTitle: params.mapTitle,
      sheetNumber: params.sheetNumber,
      sheetCount: params.sheetCount
    })}
  </svg>`;
}
