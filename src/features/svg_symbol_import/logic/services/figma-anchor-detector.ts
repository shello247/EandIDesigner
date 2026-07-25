import {
  networkPortKeySchema,
  type SymbolAnchor,
  type ValidationIssue
} from "@/features/symbol_registry/data/schema";
import {
  SVG_PRIMITIVE_PATTERN,
  applySvgMatrix,
  collectSvgGroups,
  collectSvgPrimitives,
  getSvgElementMatrix,
  getSvgElementName,
  getSvgNumberAttribute,
  removeSvgSourceRanges,
  type SvgGroupElement,
  type SvgPrimitiveElement,
  type SvgSourceRange
} from "@/shared/svg/figma-svg-structure";

type MarkerElement = SvgPrimitiveElement & {
  tagName: "circle" | "ellipse" | "rect";
  removalRange?: SvgSourceRange;
};

type ParsedMarkerName = {
  key: string;
  kind: SymbolAnchor["kind"];
  networkPort: boolean;
};

export type FigmaAnchorExtraction = {
  anchors: SymbolAnchor[];
  productionSvg: string;
  issues: ValidationIssue[];
};

const ELECTRICAL_ANCHOR_NAME_PATTERN =
  /(?:^|[\s_-])(terminal|anchor)[:_\-\s]+([A-Za-z0-9][A-Za-z0-9_.-]*)$/i;
const NETWORK_PORT_NAME_PATTERN = /^(network_port|port)\s*:\s*(.*)$/i;
const NETWORK_PORT_PREFIX_PATTERN = /^(network_port|port)\b/i;

function parseMarkerName(value: string):
  | { marker: ParsedMarkerName }
  | { error: string }
  | null {
  const normalized = value.trim();
  const networkMatch = normalized.match(NETWORK_PORT_NAME_PATTERN);

  if (networkMatch) {
    const keyResult = networkPortKeySchema.safeParse(networkMatch[2]);

    if (!keyResult.success) {
      return {
        error: `Network port marker "${normalized}" has an invalid port key.`
      };
    }

    return {
      marker: {
        key: keyResult.data,
        kind: "network_port",
        networkPort: true
      }
    };
  }

  if (NETWORK_PORT_PREFIX_PATTERN.test(normalized)) {
    return {
      error: `Network port marker "${normalized}" must use network_port:<PORT_KEY> or port:<PORT_KEY>.`
    };
  }

  const electricalMatch = normalized.match(ELECTRICAL_ANCHOR_NAME_PATTERN);
  if (!electricalMatch) {
    return null;
  }

  const key = electricalMatch[2].trim();
  const keyUpper = key.toUpperCase();

  if (keyUpper.includes("GND") || keyUpper.includes("GROUND")) {
    return { marker: { key, kind: "ground", networkPort: false } };
  }

  if (keyUpper.includes("SHIELD") || keyUpper.includes("DRAIN")) {
    return { marker: { key, kind: "shield", networkPort: false } };
  }

  return {
    marker: {
      key,
      kind:
        electricalMatch[1].toLowerCase() === "terminal"
          ? "terminal"
          : "other",
      networkPort: false
    }
  };
}

function markerCenter(marker: MarkerElement): { x: number; y: number } | null {
  let center: { x: number; y: number } | null = null;

  if (marker.tagName === "circle" || marker.tagName === "ellipse") {
    const cx = getSvgNumberAttribute(marker.attributes, "cx");
    const cy = getSvgNumberAttribute(marker.attributes, "cy");

    if (cx !== null && cy !== null) {
      center = { x: cx, y: cy };
    }
  } else {
    const x = getSvgNumberAttribute(marker.attributes, "x");
    const y = getSvgNumberAttribute(marker.attributes, "y");
    const width = getSvgNumberAttribute(marker.attributes, "width");
    const height = getSvgNumberAttribute(marker.attributes, "height");

    if (x !== null && y !== null && width !== null && height !== null) {
      center = { x: x + width / 2, y: y + height / 2 };
    }
  }

  if (!center) {
    return null;
  }

  const elementMatrix = getSvgElementMatrix(marker);
  if (!elementMatrix) {
    return null;
  }

  const transformed = applySvgMatrix(center, elementMatrix);

  return {
    x: Number(transformed.x.toFixed(2)),
    y: Number(transformed.y.toFixed(2))
  };
}

function groupMarkerCandidate(
  group: SvgGroupElement,
  primitives: MarkerElement[],
  strictNetworkGroup: boolean
): { marker?: MarkerElement; error?: string } {
  const directPrimitives = primitives.filter(
    (primitive) => primitive.group?.start === group.start
  );

  if (!strictNetworkGroup) {
    const marker = directPrimitives[0];
    return marker ? { marker: { ...marker, group } } : {};
  }

  const remainingContent = group.content
    .replace(SVG_PRIMITIVE_PATTERN, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim();

  if (directPrimitives.length !== 1 || remainingContent.length > 0) {
    return {
      error:
        "Named network port groups must contain exactly one direct circle, ellipse, or rectangle and no production geometry."
    };
  }

  return {
    marker: {
      ...directPrimitives[0],
      group,
      removalRange: { start: group.start, end: group.end }
    }
  };
}

export function extractFigmaAnchors(svg: string): FigmaAnchorExtraction {
  const anchors: SymbolAnchor[] = [];
  const issues: ValidationIssue[] = [];
  const removals: SvgSourceRange[] = [];
  const seenKeys = new Map<string, SymbolAnchor["kind"]>();
  const consumedPrimitiveStarts = new Set<number>();
  const groups = collectSvgGroups(svg);
  const primitives = collectSvgPrimitives(svg, groups);
  const candidates: Array<{
    marker: MarkerElement;
    parsedName: ParsedMarkerName;
  }> = [];

  for (const group of groups) {
    const name = getSvgElementName(group.attributes);
    if (!name) {
      continue;
    }

    const parsed = parseMarkerName(name);
    if (!parsed) {
      continue;
    }

    if ("error" in parsed) {
      issues.push({
        severity: "blocking",
        code: "NETWORK_PORT_MARKER_INVALID",
        message: parsed.error,
        path: "svg"
      });
      continue;
    }

    const groupCandidate = groupMarkerCandidate(
      group,
      primitives,
      parsed.marker.networkPort
    );
    if (parsed.marker.networkPort && groupCandidate.error) {
      issues.push({
        severity: "blocking",
        code: "NETWORK_PORT_MARKER_GROUP_INVALID",
        message: groupCandidate.error,
        path: "svg"
      });
      continue;
    }

    const marker = groupCandidate.marker;
    if (!marker) {
      continue;
    }

    consumedPrimitiveStarts.add(marker.start);
    candidates.push({ marker, parsedName: parsed.marker });
  }

  for (const primitive of primitives) {
    if (consumedPrimitiveStarts.has(primitive.start)) {
      continue;
    }

    const name = getSvgElementName(primitive.attributes);
    if (!name) {
      continue;
    }

    const parsed = parseMarkerName(name);
    if (!parsed) {
      continue;
    }

    if ("error" in parsed) {
      issues.push({
        severity: "blocking",
        code: "NETWORK_PORT_MARKER_INVALID",
        message: parsed.error,
        path: "svg"
      });
      continue;
    }

    candidates.push({
      marker: {
        ...primitive,
        removalRange: parsed.marker.networkPort
          ? { start: primitive.start, end: primitive.end }
          : undefined
      },
      parsedName: parsed.marker
    });
  }

  candidates.sort((left, right) => left.marker.start - right.marker.start);

  for (const candidate of candidates) {
    const { marker, parsedName } = candidate;
    const center = markerCenter(marker);

    if (!center) {
      if (parsedName.networkPort) {
        issues.push({
          severity: "blocking",
          code: "NETWORK_PORT_MARKER_GEOMETRY_INVALID",
          message: `Network port marker "${parsedName.key}" has invalid geometry or an unsupported transform.`,
          path: "svg"
        });
      }
      continue;
    }

    const existingKind = seenKeys.get(parsedName.key);
    if (existingKind) {
      if (parsedName.networkPort || existingKind === "network_port") {
        issues.push({
          severity: "blocking",
          code: "NETWORK_PORT_MARKER_DUPLICATE",
          message: `Network port marker key "${parsedName.key}" is duplicated.`,
          path: "svg"
        });
      }
      continue;
    }

    seenKeys.set(parsedName.key, parsedName.kind);
    anchors.push({
      key: parsedName.key,
      x: center.x,
      y: center.y,
      kind: parsedName.kind
    });

    if (parsedName.networkPort && marker.removalRange) {
      removals.push(marker.removalRange);
    }
  }

  return {
    anchors,
    productionSvg: removeSvgSourceRanges(svg, removals),
    issues
  };
}

export function detectFigmaAnchors(svg: string): SymbolAnchor[] {
  return extractFigmaAnchors(svg).anchors;
}
