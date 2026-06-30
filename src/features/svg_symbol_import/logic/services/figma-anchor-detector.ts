import type { SymbolAnchor } from "@/features/symbol_registry/data/schema";

type ParsedAttributes = Record<string, string>;

type MarkerElement = {
  tagName: "circle" | "ellipse" | "rect";
  attributes: ParsedAttributes;
  groupAttributes?: ParsedAttributes;
};

const MARKER_PATTERN = /<(circle|ellipse|rect)\b([^>]*)>/gi;
const GROUP_PATTERN = /<g\b([^>]*)>([\s\S]*?)<\/g>/gi;
const ATTR_PATTERN = /([:\w-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
const ANCHOR_NAME_PATTERN =
  /(?:^|[\s_-])(terminal|anchor)[:_\-\s]+([A-Za-z0-9][A-Za-z0-9_.-]*)$/i;

function parseAttributes(source: string): ParsedAttributes {
  const attributes: ParsedAttributes = {};

  for (const match of source.matchAll(ATTR_PATTERN)) {
    attributes[match[1]] = match[3] ?? match[4] ?? "";
  }

  return attributes;
}

function attributeName(attributes?: ParsedAttributes): string | undefined {
  if (!attributes) {
    return undefined;
  }

  return (
    attributes["data-name"] ||
    attributes["aria-label"] ||
    attributes["inkscape:label"] ||
    attributes.name ||
    attributes.id
  );
}

function parseAnchorName(value: string): {
  key: string;
  kind: SymbolAnchor["kind"];
} | null {
  const normalized = value.trim();
  const match = normalized.match(ANCHOR_NAME_PATTERN);

  if (!match) {
    return null;
  }

  const key = match[2].trim();
  const keyUpper = key.toUpperCase();

  if (keyUpper.includes("GND") || keyUpper.includes("GROUND")) {
    return { key, kind: "ground" };
  }

  if (keyUpper.includes("SHIELD") || keyUpper.includes("DRAIN")) {
    return { key, kind: "shield" };
  }

  return {
    key,
    kind: match[1].toLowerCase() === "terminal" ? "terminal" : "other"
  };
}

function numberAttribute(attributes: ParsedAttributes, key: string): number | null {
  const value = Number(attributes[key]);
  return Number.isFinite(value) ? value : null;
}

function translateOffset(attributes?: ParsedAttributes): { x: number; y: number } {
  const transform = attributes?.transform;

  if (!transform) {
    return { x: 0, y: 0 };
  }

  const translateMatch = transform.match(
    /translate\(\s*([+-]?\d*\.?\d+)(?:[\s,]+([+-]?\d*\.?\d+))?\s*\)/i
  );
  if (translateMatch) {
    return {
      x: Number(translateMatch[1]),
      y: Number(translateMatch[2] ?? 0)
    };
  }

  const matrixMatch = transform.match(
    /matrix\(\s*[+-]?\d*\.?\d+[\s,]+[+-]?\d*\.?\d+[\s,]+[+-]?\d*\.?\d+[\s,]+[+-]?\d*\.?\d+[\s,]+([+-]?\d*\.?\d+)[\s,]+([+-]?\d*\.?\d+)\s*\)/i
  );

  if (matrixMatch) {
    return {
      x: Number(matrixMatch[1]),
      y: Number(matrixMatch[2])
    };
  }

  return { x: 0, y: 0 };
}

function markerCenter(marker: MarkerElement): { x: number; y: number } | null {
  const elementOffset = translateOffset(marker.attributes);
  const groupOffset = translateOffset(marker.groupAttributes);
  const offsetX = elementOffset.x + groupOffset.x;
  const offsetY = elementOffset.y + groupOffset.y;

  if (marker.tagName === "circle" || marker.tagName === "ellipse") {
    const cx = numberAttribute(marker.attributes, "cx");
    const cy = numberAttribute(marker.attributes, "cy");

    if (cx === null || cy === null) {
      return null;
    }

    return {
      x: Number((cx + offsetX).toFixed(2)),
      y: Number((cy + offsetY).toFixed(2))
    };
  }

  const x = numberAttribute(marker.attributes, "x");
  const y = numberAttribute(marker.attributes, "y");
  const width = numberAttribute(marker.attributes, "width");
  const height = numberAttribute(marker.attributes, "height");

  if (x === null || y === null || width === null || height === null) {
    return null;
  }

  return {
    x: Number((x + width / 2 + offsetX).toFixed(2)),
    y: Number((y + height / 2 + offsetY).toFixed(2))
  };
}

function collectMarkerElements(svg: string): MarkerElement[] {
  const markers: MarkerElement[] = [];

  for (const match of svg.matchAll(MARKER_PATTERN)) {
    markers.push({
      tagName: match[1].toLowerCase() as MarkerElement["tagName"],
      attributes: parseAttributes(match[2])
    });
  }

  for (const groupMatch of svg.matchAll(GROUP_PATTERN)) {
    const groupAttributes = parseAttributes(groupMatch[1]);
    const markerMatch = MARKER_PATTERN.exec(groupMatch[2]);
    MARKER_PATTERN.lastIndex = 0;

    if (markerMatch) {
      markers.push({
        tagName: markerMatch[1].toLowerCase() as MarkerElement["tagName"],
        attributes: parseAttributes(markerMatch[2]),
        groupAttributes
      });
    }
  }

  return markers;
}

export function detectFigmaAnchors(svg: string): SymbolAnchor[] {
  const anchors: SymbolAnchor[] = [];
  const seenKeys = new Set<string>();

  for (const marker of collectMarkerElements(svg)) {
    const parsedName =
      parseAnchorName(attributeName(marker.attributes) ?? "") ??
      parseAnchorName(attributeName(marker.groupAttributes) ?? "");

    if (!parsedName || seenKeys.has(parsedName.key)) {
      continue;
    }

    const center = markerCenter(marker);
    if (!center) {
      continue;
    }

    seenKeys.add(parsedName.key);
    anchors.push({
      key: parsedName.key,
      x: center.x,
      y: center.y,
      kind: parsedName.kind
    });
  }

  return anchors;
}

