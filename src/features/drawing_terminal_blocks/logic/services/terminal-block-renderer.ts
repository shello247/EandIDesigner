import type { TerminalBlockPlacement } from "../../data/schema";
import type { ResolvedTerminalBlockModule } from "./terminal-block-groups";
import {
  normalizeTerminalBlockPlacement,
  terminalBlockTerminals,
  terminalBlockViewBox
} from "./terminal-block-layout";

function format(value: number): string {
  return Number(value.toFixed(2)).toString();
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function terminalModule(x: number): string {
  return `
    <g transform="translate(${format(x)} 0)" data-terminal-module="true">
      <path d="M20 63H5V114H20V178H0V0H20V63Z" fill="white" fill-opacity="0.55" stroke="black" stroke-width="0.5"/>
      <rect x="0.25" y="0.25" width="19.5" height="27.5" fill="white" stroke="black" stroke-width="0.5"/>
      <rect x="0.25" y="28.25" width="19.5" height="12.5" fill="white" stroke="black" stroke-width="0.5"/>
      <rect x="0.25" y="41.25" width="19.5" height="17.5" fill="white" stroke="black" stroke-width="0.5"/>
      <circle cx="10.5" cy="50.5" r="5.25" fill="white" stroke="black" stroke-width="0.5"/>
      <rect x="0.25" y="150.25" width="19.5" height="27.5" fill="white" stroke="black" stroke-width="0.5"/>
      <rect x="0.25" y="137.25" width="19.5" height="12.5" fill="white" stroke="black" stroke-width="0.5"/>
      <rect x="0.25" y="119.25" width="19.5" height="17.5" fill="white" stroke="black" stroke-width="0.5"/>
      <circle cx="9.5" cy="127.5" r="5.25" fill="white" stroke="black" stroke-width="0.5"/>
      <circle cx="10" cy="1" r="0.8" fill="#f8fafc" stroke="black" stroke-width="0.6"/>
      <circle cx="10" cy="177" r="0.8" fill="#f8fafc" stroke="black" stroke-width="0.6"/>
    </g>
  `;
}

function stripSvgRoot(svg: string): string {
  const start = svg.indexOf(">");
  const end = svg.toLowerCase().lastIndexOf("</svg>");

  if (start === -1 || end === -1 || end <= start) {
    return svg;
  }

  return svg.slice(start + 1, end);
}

function safeSvgId(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, "_");
}

function terminalModuleTemplate({
  module,
  id
}: {
  module: ResolvedTerminalBlockModule;
  id: string;
}): string {
  const viewBox = module.viewBox;

  return `<symbol id="${id}" viewBox="${format(viewBox.x)} ${format(
    viewBox.y
  )} ${format(viewBox.width)} ${format(
    viewBox.height
  )}" overflow="visible">${stripSvgRoot(module.svg)}</symbol>`;
}

export function renderTerminalBlockSvgContent(
  config: TerminalBlockPlacement,
  options: {
    module?: ResolvedTerminalBlockModule;
    instanceId?: string;
  } = {}
): string {
  const normalized = normalizeTerminalBlockPlacement(config);
  const terminals = terminalBlockTerminals(normalized);
  const templateId = `terminal-block-module-${safeSvgId(
    options.instanceId ?? "generated"
  )}`;
  const modules = terminals
    .map((terminal, index) => {
      const moduleX = index * normalized.modulePitch;
      const centerX = moduleX + normalized.moduleWidth / 2;
      const body = options.module
        ? `<use href="#${templateId}" x="${format(moduleX)}" y="0" width="${format(
            normalized.moduleWidth
          )}" height="${format(
            normalized.moduleHeight
          )}" preserveAspectRatio="none" data-terminal-module="true"/>`
        : terminalModule(moduleX);

      return `
        ${body}
        <text x="${format(centerX)}" y="${format(
          normalized.moduleHeight / 2 + 2.5
        )}" text-anchor="middle" font-family="Inter, Poppins, Arial, Helvetica, sans-serif" font-size="7" font-weight="700" fill="#111827">${escapeXml(
          terminal.label
        )}</text>
      `;
    })
    .join("");

  const definitions = options.module
    ? `<defs>${terminalModuleTemplate({
        module: options.module,
        id: templateId
      })}</defs>`
    : "";

  return `<g data-generated-terminal-block="true">${definitions}${modules}</g>`;
}

export function renderTerminalBlockSvg(
  config: TerminalBlockPlacement,
  options: {
    module?: ResolvedTerminalBlockModule;
    instanceId?: string;
  } = {}
): string {
  const normalized = normalizeTerminalBlockPlacement(config);
  const viewBox = terminalBlockViewBox(normalized);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}" fill="none">${renderTerminalBlockSvgContent(
    normalized,
    options
  )}</svg>`;
}
