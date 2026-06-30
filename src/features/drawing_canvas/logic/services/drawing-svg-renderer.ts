import type { DrawingModel } from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import { getAnchorWorldPoint, getPlacementTransform } from "./drawing-geometry";
import { renderConnectionRouteSvg } from "./connection-route-renderer";

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

function titleBlockText(params: {
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

function titleBlockLabel(x: number, y: number, label: string): string {
  return `<text x="${x}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="2.2" font-weight="700" fill="#475569">${escapeXml(label)}</text>`;
}

function titleBlockCell(params: {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  value?: string;
  maxLength: number;
  valueSize?: number;
  valueWeight?: number;
}): string {
  return `
    <rect x="${params.x}" y="${params.y}" width="${params.width}" height="${params.height}" fill="white" stroke="#111827" stroke-width="0.32"/>
    <rect x="${params.x}" y="${params.y}" width="${params.width}" height="4.2" fill="#f1f5f9" stroke="#111827" stroke-width="0.18"/>
    ${titleBlockLabel(params.x + 2, params.y + 3, params.label)}
    ${titleBlockText({
      x: params.x + 2,
      y: params.y + params.height - 2.2,
      value: params.value,
      maxLength: params.maxLength,
      size: params.valueSize,
      weight: params.valueWeight
    })}
  `;
}

function renderTitleBlock(model: DrawingModel): string {
  const blockWidth = 164;
  const blockHeight = 34;
  const titleBlockX = model.sheet.width - blockWidth - 6;
  const titleBlockY = model.sheet.height - blockHeight - 6;
  const leftWidth = 78;
  const middleWidth = 56;
  const rightWidth = 30;
  const rowHeights = [10, 12, 12];
  const titleBlock = model.sheet.titleBlock;
  const rightX = titleBlockX + leftWidth + middleWidth;
  const middleX = titleBlockX + leftWidth;
  const row2Y = titleBlockY + rowHeights[0];
  const row3Y = row2Y + rowHeights[1];

  return `
    <g data-title-block="professional">
      <rect x="${titleBlockX}" y="${titleBlockY}" width="${blockWidth}" height="${blockHeight}" fill="white" stroke="#0f172a" stroke-width="0.65"/>
      ${titleBlockCell({
        x: titleBlockX,
        y: titleBlockY,
        width: leftWidth,
        height: rowHeights[0],
        label: "CLIENT",
        value: titleBlock.client,
        maxLength: 30,
        valueWeight: 600
      })}
      ${titleBlockCell({
        x: titleBlockX,
        y: row2Y,
        width: leftWidth,
        height: rowHeights[1],
        label: "PROJECT / PROCESS",
        value: titleBlock.project,
        maxLength: 34,
        valueSize: 3.1,
        valueWeight: 600
      })}
      ${titleBlockCell({
        x: titleBlockX,
        y: row3Y,
        width: leftWidth,
        height: rowHeights[2],
        label: "DRAWING NUMBER",
        value: titleBlock.drawingNumber,
        maxLength: 28,
        valueWeight: 600
      })}
      ${titleBlockCell({
        x: middleX,
        y: titleBlockY,
        width: middleWidth,
        height: rowHeights[0],
        label: "PREPARED BY",
        value: titleBlock.preparedBy,
        maxLength: 22
      })}
      ${titleBlockCell({
        x: middleX,
        y: row2Y,
        width: middleWidth,
        height: rowHeights[1],
        label: "CHECKED BY",
        value: titleBlock.checkedBy,
        maxLength: 22
      })}
      ${titleBlockCell({
        x: middleX,
        y: row3Y,
        width: middleWidth,
        height: rowHeights[2],
        label: "REVISION",
        value: titleBlock.revision,
        maxLength: 12,
        valueWeight: 700
      })}
      ${titleBlockCell({
        x: rightX,
        y: titleBlockY,
        width: rightWidth,
        height: rowHeights[0],
        label: "SHEET",
        value: "1 OF 1",
        maxLength: 10,
        valueWeight: 700
      })}
      ${titleBlockCell({
        x: rightX,
        y: row2Y,
        width: rightWidth,
        height: rowHeights[1],
        label: "DATE",
        value: titleBlock.date,
        maxLength: 12,
        valueSize: 2.9
      })}
      ${titleBlockCell({
        x: rightX,
        y: row3Y,
        width: rightWidth,
        height: rowHeights[2],
        label: "SCALE",
        value: "NTS",
        maxLength: 10,
        valueWeight: 700
      })}
    </g>
  `;
}

function stripSvgRoot(svg: string): string {
  return svg
    .replace(/^[\s\S]*?<svg\b[^>]*>/i, "")
    .replace(/<\/svg>\s*$/i, "")
    .trim();
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

function symbolKey(symbolId: string, versionId: string): string {
  return `${symbolId}:${versionId}`;
}

function approvedSymbolMap(approvedSymbols: ApprovedDrawingSymbol[]) {
  return new Map(
    approvedSymbols.map((symbol) => [
      symbolKey(symbol.symbolId, symbol.versionId),
      symbol
    ])
  );
}

export function renderDrawingToSvg(params: {
  model: DrawingModel;
  approvedSymbols: ApprovedDrawingSymbol[];
  showAnchors?: boolean;
  showConnections?: boolean;
}): string {
  const {
    model,
    approvedSymbols,
    showAnchors = true,
    showConnections = true
  } = params;
  const approvedSymbolsByKey = approvedSymbolMap(approvedSymbols);
  const gridSize = model.sheet.gridSize;

  const grid = `
    <defs>
      <pattern id="ei-grid" width="${gridSize}" height="${gridSize}" patternUnits="userSpaceOnUse">
        <path d="M ${gridSize} 0 L 0 0 0 ${gridSize}" fill="none" stroke="#e7edf5" stroke-width="0.25"/>
      </pattern>
    </defs>
    <rect x="0" y="0" width="${model.sheet.width}" height="${model.sheet.height}" fill="white"/>
    <rect x="0" y="0" width="${model.sheet.width}" height="${model.sheet.height}" fill="url(#ei-grid)"/>
    <rect x="4" y="4" width="${model.sheet.width - 8}" height="${model.sheet.height - 8}" fill="none" stroke="#111827" stroke-width="0.5"/>
  `;

  const connections = showConnections
    ? model.connections
        .map((connection) =>
          renderConnectionRouteSvg({
            model,
            symbols: approvedSymbols,
            connection,
            escapeXml
          })
        )
        .join("")
    : "";

  const placements = model.placements
    .map((placement) => {
      const symbol = approvedSymbolsByKey.get(
        symbolKey(placement.symbolId, placement.versionId)
      );

      if (!symbol) {
        return "";
      }

      const transform = getPlacementTransform(placement, symbol.metadata);
      const anchors = showAnchors
        ? symbol.metadata.anchors
            .map((anchor) => {
              const point = getAnchorWorldPoint(placement, symbol.metadata, anchor);
              return `<circle cx="${point.x}" cy="${point.y}" r="1.8" fill="#ffffff" stroke="#0f766e" stroke-width="0.45"><title>${escapeXml(anchor.key)}</title></circle>`;
            })
            .join("")
        : "";

      return `
        <g data-placement-id="${escapeXml(placement.id)}" data-symbol-key="${escapeXml(symbol.symbolKey)}">
          <g transform="${transform}" ${extractInheritedRootAttributes(symbol.svg)}>
            ${stripSvgRoot(symbol.svg)}
          </g>
          <text x="${placement.x}" y="${placement.y - 3}" font-family="Arial" font-size="4" font-weight="700" fill="#111827">${escapeXml(placement.tag)}</text>
          ${anchors}
        </g>
      `;
    })
    .join("");

  const annotations = model.annotations
    .map(
      (annotation) =>
        `<text x="${annotation.x}" y="${annotation.y}" font-family="Arial" font-size="${annotation.kind === "title" ? 5 : 3.5}" font-weight="${annotation.kind === "title" ? 700 : 400}" fill="#111827">${escapeXml(annotation.text)}</text>`
    )
    .join("");

  const titleBlock = renderTitleBlock(model);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${model.sheet.width}mm" height="${model.sheet.height}mm" viewBox="0 0 ${model.sheet.width} ${model.sheet.height}">
    ${grid}
    ${connections}
    ${placements}
    ${annotations}
    ${titleBlock}
  </svg>`;
}
