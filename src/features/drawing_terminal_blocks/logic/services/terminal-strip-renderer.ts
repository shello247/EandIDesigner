import type { StructuredTerminalStrip } from "../../data/schema";
import { composeSelectedComponents } from "@/features/symbol_components/api/public";
import { composeTerminalStripGeometry } from "./terminal-strip-composition-geometry";
import { applyStructuredTerminalStripMemberOrders } from "./structured-terminal-strip";
import type { TerminalStripMemberSymbol } from "./terminal-strip-validation";

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function stripSvgRoot(svg: string): string {
  const start = svg.indexOf(">");
  const end = svg.toLowerCase().lastIndexOf("</svg>");
  return start >= 0 && end > start ? svg.slice(start + 1, end) : svg;
}

function inheritedRootAttributes(svg: string): string {
  const root = svg.match(/<svg\b([^>]*)>/i)?.[1] ?? "";
  const allowed = new Set([
    "fill",
    "fill-opacity",
    "fill-rule",
    "stroke",
    "stroke-width",
    "stroke-linecap",
    "stroke-linejoin",
    "color"
  ]);
  const result: string[] = [];
  const pattern = /\s([A-Za-z_:][-\w:.]*)=(?:"([^"]*)"|'([^']*)')/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(root)) !== null) {
    const name = match[1].toLowerCase();
    const value = match[2] ?? match[3] ?? "";
    if (allowed.has(name) && !/url\s*\(/i.test(value)) {
      result.push(`${name}="${escapeXml(value)}"`);
    }
  }
  return result.join(" ");
}

export function renderStructuredTerminalStripSvg(
  strip: StructuredTerminalStrip,
  symbols: TerminalStripMemberSymbol[]
): string {
  const orderedStrip = applyStructuredTerminalStripMemberOrders(strip);
  const geometry = composeTerminalStripGeometry(orderedStrip, symbols);
  const memberById = new Map(
    orderedStrip.members.map((member) => [member.id, member])
  );
  const memberMarkup = geometry.members
    .map((layout) => {
      const member = memberById.get(layout.memberId);
      if (!member) {
        return "";
      }
      if (!layout.symbol) {
        return `<g data-terminal-strip-member="${escapeXml(member.token)}" data-missing-member="true">
          <rect x="${layout.xMm}" y="${layout.yMm}" width="${layout.widthMm}" height="${layout.heightMm}" fill="#fff7ed" stroke="#c2410c" stroke-width="0.35" stroke-dasharray="1.5 1"/>
          <text x="${layout.xMm + layout.widthMm / 2}" y="${layout.yMm + layout.heightMm / 2}" text-anchor="middle" font-family="Arial, sans-serif" font-size="2" fill="#9a3412">${escapeXml(member.token)} missing</text>
        </g>`;
      }
      const viewBox = layout.symbol.metadata.viewBox;
      const designation =
        member.role === "electrical" && member.designation
          ? `<text x="${layout.xMm + layout.widthMm / 2}" y="${layout.yMm + layout.heightMm - 1.2}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="2.2" font-weight="700" fill="#111827" stroke="#ffffff" stroke-width="0.7" paint-order="stroke">${escapeXml(member.designation)}</text>`
          : "";
      const components = member.componentSelections?.length
        ? composeSelectedComponents({
            parentPlacement: {
              x: layout.xMm,
              y: layout.yMm,
              rotation: 0,
              scale: 1,
              layoutDimensions: {
                lengthMm: layout.widthMm,
                widthMm: layout.heightMm
              }
            },
            parentSymbol: layout.symbol,
            selections: member.componentSelections,
            symbols
          }).placements
            .map((component) => {
              const componentViewBox = component.symbol.metadata.viewBox;
              return `<g data-terminal-strip-component-path="${escapeXml(component.path.join(" / "))}" data-component-symbol-id="${escapeXml(component.symbol.symbolId)}" data-component-version-id="${escapeXml(component.symbol.versionId)}" transform="translate(${component.centerX} ${component.centerY}) rotate(${component.rotationDeg})" pointer-events="none">
                <svg x="${-component.widthMm / 2}" y="${-component.heightMm / 2}" width="${component.widthMm}" height="${component.heightMm}" viewBox="${componentViewBox.x} ${componentViewBox.y} ${componentViewBox.width} ${componentViewBox.height}" preserveAspectRatio="xMidYMid meet" ${inheritedRootAttributes(component.symbol.svg)}>${stripSvgRoot(component.symbol.svg)}</svg>
              </g>`;
            })
            .join("")
        : "";

      return `<g data-terminal-strip-member="${escapeXml(member.token)}" data-member-role="${member.role}">
        <svg x="${layout.xMm}" y="${layout.yMm}" width="${layout.widthMm}" height="${layout.heightMm}" viewBox="${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}" preserveAspectRatio="xMidYMid meet" ${inheritedRootAttributes(layout.symbol.svg)}>${stripSvgRoot(layout.symbol.svg)}</svg>
        ${components}
        ${designation}
      </g>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${geometry.widthMm} ${geometry.heightMm}" overflow="visible">${memberMarkup}</svg>`;
}
