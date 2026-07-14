import type {
  DrawingAnnotation,
  DrawingPackageSheetKind,
  DrawingSectionTitlePage,
  DrawingSheetCanvasModel as DrawingModel
} from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import type {
  PanelConnectionPatternRecord
} from "@/features/drawing_panel_wiring/api/public";
import { getAnchorWorldPoint, getPlacementTransform } from "./drawing-geometry";
import { renderConnectionRouteSvg } from "./connection-route-renderer";
import {
  getAnnotationSize,
  getLeaderStartPoint
} from "./drawing-annotations";
import {
  getPlacementDisplayTitle,
  getPlacementLabelPoints,
  shouldShowPlacementTitle
} from "./placement-title-labels";
import {
  getPanelEnclosureBounds,
  getPanelEnclosureTitle,
  isGeneratedPanelEnclosurePlacement
} from "./drawing-asset-containment";
import {
  isBackplanePlacement,
  isLayoutHelperPlacement,
  normalizeLayoutHelperDimensionsForSymbol,
  renderBackplanePlacement
} from "./drawing-backplane-layouts";
import {
  resolveDrawingBackplaneScaleLabel,
  resolveLayoutHelperDisplayPlacement
} from "./drawing-backplane-scale";
import {
  getRenderableSymbolForPlacement,
  isGeneratedTerminalBlockPlacement
} from "./drawing-generated-symbols";
import {
  isGeneratedWireTraySymbolReference,
  renderWireTraySvg
} from "./drawing-wire-tray-layouts";
import {
  type LayoutLabelPosition,
  resolveLayoutLabel
} from "./drawing-layout-labels";
import {
  isGeneratedLayoutDimensionSymbolReference,
  renderLayoutDimensionSvg
} from "./drawing-layout-dimensions";
import {
  isGeneratedPanelPatternLegendPlacement
} from "./drawing-panel-reference-symbols";
import {
  renderPanelConnectionPatternSvg,
  renderPanelPatternLegendSvg
} from "./panel-connection-pattern-renderer";

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

function renderTitleBlock(
  model: DrawingModel,
  sheetNumber: number,
  sheetCount: number,
  drawingTitle?: string,
  sheetTitle?: string,
  scaleLabel = "NTS"
): string {
  const titleBlock = model.sheet.titleBlock;
  const margin = 6;
  const blockX = margin;
  const blockHeight = 36;
  const blockY = model.sheet.height - margin - blockHeight;
  const blockWidth = model.sheet.width - margin * 2;
  const revisionWidth = 112;
  const approvalWidth = 94;
  const metadataWidth = 62;
  const titleWidth = blockWidth - revisionWidth - approvalWidth - metadataWidth;
  const approvalX = blockX + revisionWidth;
  const titleX = approvalX + approvalWidth;
  const metadataX = titleX + titleWidth;
  const resolvedTitle =
    sheetTitle?.trim() ||
    drawingTitle?.trim() ||
    titleBlock.project?.trim() ||
    "DRAWING";

  return `
    <g data-title-block="technical-full-width">
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
        drawingNumber: titleBlock.drawingNumber,
        sheetNumber,
        sheetCount,
        revision: titleBlock.revision,
        date: titleBlock.date,
        scaleLabel
      })}
    </g>
  `;
}

function renderSheetFrame(model: DrawingModel, showGrid: boolean): string {
  const outerMargin = 4;
  const innerMargin = 6;
  const gridFill = showGrid
    ? `<rect x="0" y="0" width="${model.sheet.width}" height="${model.sheet.height}" fill="url(#ei-grid)"/>`
    : "";

  return `
    <rect x="0" y="0" width="${model.sheet.width}" height="${model.sheet.height}" fill="white"/>
    ${gridFill}
    <rect x="${outerMargin}" y="${outerMargin}" width="${model.sheet.width - outerMargin * 2}" height="${model.sheet.height - outerMargin * 2}" fill="none" stroke="#111827" stroke-width="0.78"/>
    <rect x="${innerMargin}" y="${innerMargin}" width="${model.sheet.width - innerMargin * 2}" height="${model.sheet.height - innerMargin * 2}" fill="none" stroke="#111827" stroke-width="0.32"/>
  `;
}

function stripSvgRoot(svg: string): string {
  return svg
    .replace(/^[\s\S]*?<svg\b[^>]*>/i, "")
    .replace(/<\/svg>\s*$/i, "")
    .trim();
}

function stripSvgText(svg: string): string {
  return svg
    .replace(/<text\b[\s\S]*?<\/text>/gi, "")
    .replace(/<tspan\b[\s\S]*?<\/tspan>/gi, "");
}

function labelPointForPosition({
  placement,
  position
}: {
  placement: DrawingModel["placements"][number];
  position: LayoutLabelPosition;
}): {
  x: number;
  y: number;
  textAnchor: "start" | "middle" | "end";
} {
  const width = placement.layoutDimensions?.lengthMm ?? 0;
  const height = placement.layoutDimensions?.widthMm ?? 0;
  const left = placement.x;
  const top = placement.y;
  const right = placement.x + width;
  const bottom = placement.y + height;
  const inset = 1.2;
  const outsideOffset = 1.35;
  const baselineCenterOffset = 0.75;
  const baselineBottomOffset = 3;

  switch (position) {
    case "center":
      return {
        x: Number((left + width / 2).toFixed(2)),
        y: Number((top + height / 2 + baselineCenterOffset).toFixed(2)),
        textAnchor: "middle"
      };
    case "top-left":
      return {
        x: Number((left + inset).toFixed(2)),
        y: Number((top - outsideOffset).toFixed(2)),
        textAnchor: "start"
      };
    case "top-right":
      return {
        x: Number((right - inset).toFixed(2)),
        y: Number((top - outsideOffset).toFixed(2)),
        textAnchor: "end"
      };
    case "bottom-left":
      return {
        x: Number((left + inset).toFixed(2)),
        y: Number((bottom + baselineBottomOffset).toFixed(2)),
        textAnchor: "start"
      };
    case "bottom-center":
      return {
        x: Number((left + width / 2).toFixed(2)),
        y: Number((bottom + baselineBottomOffset).toFixed(2)),
        textAnchor: "middle"
      };
    case "bottom-right":
      return {
        x: Number((right - inset).toFixed(2)),
        y: Number((bottom + baselineBottomOffset).toFixed(2)),
        textAnchor: "end"
      };
    case "top-center":
    default:
      return {
        x: Number((left + width / 2).toFixed(2)),
        y: Number((top - outsideOffset).toFixed(2)),
        textAnchor: "middle"
      };
  }
}

function layoutLabelRotation(placement: DrawingModel["placements"][number]): number {
  const normalizedRotation = ((placement.rotation % 360) + 360) % 360;

  return Math.abs(normalizedRotation - 90) < 1 ||
    Math.abs(normalizedRotation - 270) < 1
    ? 90
    : 0;
}

function layoutHelperTagLabel({
  placement,
  symbol
}: {
  placement: DrawingModel["placements"][number];
  symbol: ApprovedDrawingSymbol | undefined;
}): string {
  if (!isLayoutHelperPlacement(placement)) {
    return "";
  }

  const label = resolveLayoutLabel({ placement, symbol });

  if (!label.visible) {
    return "";
  }

  const labelPoint = labelPointForPosition({
    placement,
    position: label.position
  });
  const text = escapeXml(label.text);
  const transform = label.alignWithRotation
    ? ` transform="rotate(${layoutLabelRotation(placement)} ${labelPoint.x} ${labelPoint.y})"`
    : "";

  return `
    <g data-layout-helper-label-id="${escapeXml(placement.id)}"${transform}>
      <text data-placement-tag="${escapeXml(placement.id)}" x="${labelPoint.x}" y="${labelPoint.y}" text-anchor="${labelPoint.textAnchor}" font-family="Inter, Poppins, Arial, Helvetica, sans-serif" font-size="2.25" font-weight="600" letter-spacing="0.06" fill="#1f2937">${text}</text>
    </g>
  `;
}

const inheritedSvgAttributes = new Set([
  "clip-rule",
  "color",
  "dominant-baseline",
  "fill",
  "fill-opacity",
  "fill-rule",
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "stroke",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-miterlimit",
  "stroke-opacity",
  "stroke-width",
  "text-anchor"
]);

function extractInheritedRootAttributes(svg: string): string {
  const rootMatch = svg.match(/<svg\b([^>]*)>/i);

  if (!rootMatch) {
    return "";
  }

  const attributes: string[] = [];
  const attributePattern = /\s([A-Za-z_:][-\w:.]*)=(?:"([^"]*)"|'([^']*)')/g;
  let attributeMatch: RegExpExecArray | null;

  while ((attributeMatch = attributePattern.exec(rootMatch[1])) !== null) {
    const name = attributeMatch[1].toLowerCase();
    const value = attributeMatch[2] ?? attributeMatch[3] ?? "";

    if (!inheritedSvgAttributes.has(name) || /url\s*\(/i.test(value)) {
      continue;
    }

    attributes.push(`${name}="${escapeXml(value)}"`);
  }

  return attributes.join(" ");
}

function wrapText(value: string, maxCharacters: number): string[] {
  return value
    .split(/\r?\n/)
    .flatMap((line) => {
      const words = line.trim().split(/\s+/).filter(Boolean);
      const output: string[] = [];
      let current = "";

      for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;

        if (candidate.length > maxCharacters && current) {
          output.push(current);
          current = word;
          continue;
        }

        current = candidate;
      }

      return [...output, current || " "];
    });
}

function renderAnnotation(annotation: DrawingAnnotation): string {
  if (annotation.kind === "title") {
    return `<text x="${annotation.x}" y="${annotation.y}" font-family="Arial" font-size="5" font-weight="700" fill="#111827">${escapeXml(annotation.text)}</text>`;
  }

  const size = getAnnotationSize(annotation);
  const title = annotation.title?.trim() ?? "";
  const titleText = title
    ? `<text x="${annotation.x + 4}" y="${annotation.y + 6.2}" font-family="Arial, Helvetica, sans-serif" font-size="2.75" font-weight="700" fill="#0f172a">${escapeXml(title)}</text>`
    : "";
  const bodyY = title ? annotation.y + 11.2 : annotation.y + 6.2;
  const bodyHeight = title ? size.height - 13 : size.height - 8;
  const maxCharacters = Math.max(12, Math.floor((size.width - 8) / 2));
  const lines = annotation.text.trim()
    ? wrapText(annotation.text, maxCharacters).slice(
        0,
        Math.max(1, Math.floor(bodyHeight / 4.1))
      )
    : [];
  const leader = annotation.leader?.enabled
    ? (() => {
        const start = getLeaderStartPoint(annotation);

        return `<line data-annotation-leader="${escapeXml(annotation.id)}" x1="${start.x}" y1="${start.y}" x2="${annotation.leader.targetX}" y2="${annotation.leader.targetY}" stroke="#64748b" stroke-width="0.34" marker-end="url(#ei-note-arrow)"/>`;
      })()
    : "";

  return `
    <g data-annotation-id="${escapeXml(annotation.id)}" data-annotation-kind="${escapeXml(annotation.kind)}">
      ${leader}
      ${titleText}
      <text x="${annotation.x + 4}" y="${bodyY}" font-family="Arial, Helvetica, sans-serif" font-size="2.7" font-weight="500" fill="#475569">
        ${lines
          .map(
            (line, index) =>
              `<tspan x="${annotation.x + 4}" dy="${index === 0 ? 0 : 4.1}">${escapeXml(line)}</tspan>`
          )
          .join("")}
      </text>
    </g>
  `;
}

function renderCenteredText(params: {
  x: number;
  y: number;
  lines: string[];
  size: number;
  weight: number;
  fill: string;
  lineGap: number;
  letterSpacing?: number;
}): string {
  if (params.lines.length === 0) {
    return "";
  }

  return `<text x="${params.x}" y="${params.y}" font-family="Arial, Helvetica, sans-serif" font-size="${params.size}" font-weight="${params.weight}" text-anchor="middle" fill="${params.fill}" letter-spacing="${params.letterSpacing ?? 0}">
    ${params.lines
      .map(
        (line, index) =>
          `<tspan x="${params.x}" dy="${index === 0 ? 0 : params.lineGap}">${escapeXml(line)}</tspan>`
      )
      .join("")}
  </text>`;
}

function renderSectionTitlePage(params: {
  model: DrawingModel;
  sectionTitlePage?: DrawingSectionTitlePage;
  derivedSectionNumber?: number;
  fallbackTitle?: string;
}): string {
  const title =
    params.sectionTitlePage?.title?.trim() ||
    params.fallbackTitle?.trim() ||
    "SECTION TITLE";
  const subtitle = params.sectionTitlePage?.subtitle?.trim() ?? "";
  const legacySectionNumber =
    params.sectionTitlePage?.sectionNumber?.trim() ?? "";
  const sectionNumber =
    params.derivedSectionNumber !== undefined
      ? `SECTION ${params.derivedSectionNumber}`
      : legacySectionNumber
        ? legacySectionNumber.toUpperCase().startsWith("SECTION")
          ? legacySectionNumber
          : `SECTION ${legacySectionNumber}`
        : "";
  const titleLines = wrapText(title.toUpperCase(), 28).slice(0, 3);
  const subtitleLines = subtitle ? wrapText(subtitle, 54).slice(0, 3) : [];
  const centerX = params.model.sheet.width / 2;
  const usableCenterY = (params.model.sheet.height - 42) / 2;
  const titleStartY = usableCenterY - titleLines.length * 6;
  const subtitleStartY =
    titleStartY + Math.max(1, titleLines.length) * 11 + 9;
  const topRuleY = titleStartY - 14;

  return `
    <g data-section-title-page="true">
      ${sectionNumber
        ? cadText({
            x: centerX,
            y: topRuleY - 7,
            value: sectionNumber.toUpperCase(),
            maxLength: 28,
            size: 5,
            weight: 700,
            anchor: "middle"
          })
        : ""}
      <line x1="${centerX - 66}" y1="${topRuleY}" x2="${centerX + 66}" y2="${topRuleY}" stroke="#111827" stroke-width="0.46"/>
      ${renderCenteredText({
        x: centerX,
        y: titleStartY,
        lines: titleLines,
        size: 10.8,
        weight: 700,
        fill: "#111827",
        lineGap: 11.4
      })}
      ${subtitleLines.length > 0
        ? renderCenteredText({
            x: centerX,
            y: subtitleStartY,
            lines: subtitleLines,
            size: 4.3,
            weight: 500,
            fill: "#475569",
            lineGap: 6
          })
        : ""}
      <line x1="${centerX - 42}" y1="${subtitleStartY + subtitleLines.length * 6 + 7}" x2="${centerX + 42}" y2="${subtitleStartY + subtitleLines.length * 6 + 7}" stroke="#111827" stroke-width="0.32"/>
    </g>
  `;
}

function renderPanelEnclosure(placement: DrawingModel["placements"][number]): string {
  if (!isGeneratedPanelEnclosurePlacement(placement)) {
    return "";
  }

  const bounds = getPanelEnclosureBounds(placement);
  const headerHeight = Math.min(12, Math.max(8, bounds.height * 0.12));
  const label = `${placement.tag}  ${getPanelEnclosureTitle(placement).toUpperCase()}`;

  return `
    <g data-placement-id="${escapeXml(placement.id)}" data-panel-enclosure="true" pointer-events="none">
      <rect x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" fill="#f8fafc" fill-opacity="0.38" stroke="#475569" stroke-width="0.48"/>
      <rect x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${headerHeight}" fill="#eff6ff" fill-opacity="0.62" stroke="#475569" stroke-width="0.42"/>
      <path d="M ${bounds.x + 4} ${bounds.y + headerHeight + 3} H ${bounds.x + bounds.width - 4}" stroke="#cbd5e1" stroke-width="0.25" stroke-dasharray="2 2"/>
      <text x="${bounds.x + 4}" y="${bounds.y + headerHeight - 3}" font-family="Arial, Helvetica, sans-serif" font-size="3.4" font-weight="700" fill="#0f172a">${escapeXml(label)}</text>
    </g>
  `;
}

export function renderDrawingToSvg(params: {
  model: DrawingModel;
  approvedSymbols: ApprovedDrawingSymbol[];
  showAnchors?: boolean;
  showConnections?: boolean;
  sheetNumber?: number;
  sheetCount?: number;
  drawingTitle?: string;
  sheetTitle?: string;
  sheetKind?: DrawingPackageSheetKind;
  sectionTitlePage?: DrawingSectionTitlePage;
  derivedSectionNumber?: number;
  panelInternalWires?: Array<{ id: string; wireId: string }>;
  panelConnectionPatterns?: PanelConnectionPatternRecord[];
  connectionVisibility?: "all" | "field" | "panel_internal";
}): string {
  const {
    model,
    approvedSymbols,
    showAnchors = true,
    showConnections = true,
    sheetNumber = 1,
    sheetCount = 1,
    drawingTitle,
    sheetTitle,
    sheetKind = "drawing",
    sectionTitlePage,
    derivedSectionNumber,
    panelInternalWires = [],
    panelConnectionPatterns = [],
    connectionVisibility = "all"
  } = params;
  const panelWireById = new Map(panelInternalWires.map((wire) => [wire.id, wire]));
  const panelPatternById = new Map(
    panelConnectionPatterns.map((pattern) => [pattern.record.id, pattern])
  );
  const gridSize = model.sheet.gridSize;
  const isSectionTitlePage = sheetKind === "section_title";
  const panelPlacements = model.placements.filter(
    isGeneratedPanelEnclosurePlacement
  );
  const backplanePlacements = model.placements.filter(isBackplanePlacement);
  const backplaneById = new Map(
    backplanePlacements.map((placement) => [placement.id, placement])
  );
  const renderPlacementForSheet = (
    placement: DrawingModel["placements"][number],
    symbol: ApprovedDrawingSymbol
  ) => {
    const parentBackplane =
      isLayoutHelperPlacement(placement) && placement.layoutParentId
        ? backplaneById.get(placement.layoutParentId)
        : undefined;
    const normalizedPlacement = normalizeLayoutHelperDimensionsForSymbol(
      placement,
      symbol
    );

    return parentBackplane
      ? resolveLayoutHelperDisplayPlacement({
          sheet: model.sheet,
          placement: normalizedPlacement,
          backplane: parentBackplane
        })
      : normalizedPlacement;
  };
  const normalPlacements = model.placements.filter(
    (placement) =>
      !isGeneratedPanelEnclosurePlacement(placement) &&
      !isBackplanePlacement(placement)
  );

  const grid = `
    <defs>
      <pattern id="ei-grid" width="${gridSize}" height="${gridSize}" patternUnits="userSpaceOnUse">
        <path d="M ${gridSize} 0 L 0 0 0 ${gridSize}" fill="none" stroke="#e7edf5" stroke-width="0.25"/>
      </pattern>
      <marker id="ei-note-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
        <path d="M 0 0 L 8 4 L 0 8 z" fill="#64748b"/>
      </marker>
    </defs>
    ${renderSheetFrame(model, !isSectionTitlePage)}
  `;

  const connections = showConnections
    ? model.connections
        .filter((connection) =>
          connectionVisibility === "all"
            ? true
            : connectionVisibility === "panel_internal"
              ? Boolean(
                  (connection.panelConnectionId && panelWireById.has(connection.panelConnectionId)) ||
                    (connection.panelPatternId && panelPatternById.has(connection.panelPatternId))
                )
              : !connection.panelConnectionId && !connection.panelPatternId
        )
        .map((connection) => {
          const pattern = connection.panelPatternId
            ? panelPatternById.get(connection.panelPatternId)
            : undefined;
          const wire = connection.panelConnectionId
            ? panelWireById.get(connection.panelConnectionId)
            : undefined;
          return pattern
            ? renderPanelConnectionPatternSvg({
                model,
                symbols: approvedSymbols,
                connection,
                pattern,
                wire,
                escapeXml
              })
            : renderConnectionRouteSvg({
                model,
                symbols: approvedSymbols,
                connection: wire
                  ? { ...connection, wireId: wire.wireId }
                  : connection,
                stroke: connection.panelConnectionId ? "#1f4e79" : undefined,
                strokeWidth: connection.panelConnectionId ? 0.52 : undefined,
                escapeXml
              });
        })
        .join("")
    : "";

  const panelEnclosures = panelPlacements.map(renderPanelEnclosure).join("");
  const backplanes = backplanePlacements
    .map((placement) => renderBackplanePlacement(placement, model.sheet))
    .join("");

  const placements = normalPlacements
        .map((placement) => {
      const symbol = getRenderableSymbolForPlacement(
        placement,
        approvedSymbols
      );

      if (!symbol) {
        return "";
      }

      const renderPlacement = renderPlacementForSheet(placement, symbol);

      if (isGeneratedPanelPatternLegendPlacement(placement)) {
        const representedPatternIds = new Set(
          model.connections.flatMap((connection) =>
            connection.panelPatternId ? [connection.panelPatternId] : []
          )
        );
        return renderPanelPatternLegendSvg({
          placement,
          patterns: panelConnectionPatterns.filter((pattern) =>
            representedPatternIds.has(pattern.record.id)
          ),
          escapeXml
        });
      }

      if (isGeneratedLayoutDimensionSymbolReference(placement)) {
        const parentBackplane = placement.layoutParentId
          ? backplaneById.get(placement.layoutParentId)
          : undefined;

        if (!parentBackplane) {
          return "";
        }

        return `
          <g data-placement-id="${escapeXml(placement.id)}" data-symbol-key="${escapeXml(symbol.symbolKey)}">
            ${renderLayoutDimensionSvg({
              model,
              sourcePlacement: placement,
              backplane: parentBackplane
            })}
          </g>
        `;
      }

      const transform = getPlacementTransform(renderPlacement, symbol.metadata);
      const anchors = showAnchors
        ? symbol.metadata.anchors
            .map((anchor) => {
              const point = getAnchorWorldPoint(
                renderPlacement,
                symbol.metadata,
                anchor
              );
              return `<circle cx="${point.x}" cy="${point.y}" r="1.8" fill="#ffffff" stroke="#0f766e" stroke-width="0.45"><title>${escapeXml(anchor.key)}</title></circle>`;
            })
            .join("")
        : "";

      return `
        <g data-placement-id="${escapeXml(placement.id)}" data-symbol-key="${escapeXml(symbol.symbolKey)}">
          <g transform="${transform}" ${extractInheritedRootAttributes(symbol.svg)}>
            ${
              isGeneratedWireTraySymbolReference(placement)
                ? renderWireTraySvg({ placement, model })
                : isLayoutHelperPlacement(placement) &&
              !isGeneratedTerminalBlockPlacement(placement)
                ? stripSvgText(stripSvgRoot(symbol.svg))
                : stripSvgRoot(symbol.svg)
            }
          </g>
          ${anchors}
        </g>
      `;
        })
        .join("");
  const placementLabels = normalPlacements
        .map((placement) => {
      if (isGeneratedPanelPatternLegendPlacement(placement)) {
        return "";
      }
      const symbol = getRenderableSymbolForPlacement(
        placement,
        approvedSymbols
      );

      if (!symbol) {
        return "";
      }

      const renderPlacement = renderPlacementForSheet(placement, symbol);

      if (isGeneratedLayoutDimensionSymbolReference(placement)) {
        return "";
      }

      if (isLayoutHelperPlacement(placement)) {
        return layoutHelperTagLabel({ placement: renderPlacement, symbol });
      }

      const showPlacementTitle = shouldShowPlacementTitle(renderPlacement, symbol);
      const placementLabelPoints = showPlacementTitle
        ? getPlacementLabelPoints(renderPlacement)
        : undefined;
      const placementTitleText = getPlacementDisplayTitle(renderPlacement, symbol);
      const tagPoint = placementLabelPoints?.tagPoint ?? {
        x: renderPlacement.x,
        y: renderPlacement.y - 3
      };
      const placementTitle =
        showPlacementTitle && placementLabelPoints
          ? `<text data-placement-title="${escapeXml(placement.id)}" x="${placementLabelPoints.titlePoint.x}" y="${placementLabelPoints.titlePoint.y}" font-family="Arial, Helvetica, sans-serif" font-size="3.1" font-weight="600" fill="#64748b">${escapeXml(placementTitleText)}</text>`
          : "";

      return `
        <g data-placement-label-id="${escapeXml(placement.id)}">
          <text data-placement-tag="${escapeXml(placement.id)}" x="${tagPoint.x}" y="${tagPoint.y}" font-family="Arial, Helvetica, sans-serif" font-size="4" font-weight="700" fill="#111827">${escapeXml(placement.tag)}</text>
          ${placementTitle}
        </g>
      `;
        })
        .join("");

  const annotations = model.annotations.map(renderAnnotation).join("");
  const sectionTitlePageContent = isSectionTitlePage
    ? renderSectionTitlePage({
        model,
        sectionTitlePage,
        derivedSectionNumber,
        fallbackTitle: sheetTitle
      })
    : "";

  const titleBlock = renderTitleBlock(
    model,
    sheetNumber,
    sheetCount,
    drawingTitle,
    sheetTitle,
    resolveDrawingBackplaneScaleLabel(model)
  );

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${model.sheet.width}mm" height="${model.sheet.height}mm" viewBox="0 0 ${model.sheet.width} ${model.sheet.height}">
    ${grid}
    ${panelEnclosures}
    ${backplanes}
    ${placements}
    ${connections}
    ${placementLabels}
    ${sectionTitlePageContent}
    ${annotations}
    ${titleBlock}
  </svg>`;
}
