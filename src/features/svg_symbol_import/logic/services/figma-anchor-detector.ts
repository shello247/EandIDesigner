import {
  networkPortKeySchema,
  type SymbolAnchor,
  type ValidationIssue
} from "@/features/symbol_registry/data/schema";

type ParsedAttributes = Record<string, string>;

type AffineMatrix = {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
};

type SourceRange = {
  start: number;
  end: number;
};

type GroupElement = SourceRange & {
  attributes: ParsedAttributes;
  content: string;
  contentStart: number;
  parent?: GroupElement;
};

type MarkerElement = SourceRange & {
  tagName: "circle" | "ellipse" | "rect";
  attributes: ParsedAttributes;
  group?: GroupElement;
  removalRange?: SourceRange;
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

const PRIMITIVE_PATTERN =
  /<(circle|ellipse|rect)\b([^>]*?)(?:\/\s*>|>\s*<\/\1\s*>)/gi;
const GROUP_TOKEN_PATTERN = /<!--[\s\S]*?-->|<\/?g\b[^>]*>/gi;
const ATTR_PATTERN = /([:\w-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
const ELECTRICAL_ANCHOR_NAME_PATTERN =
  /(?:^|[\s_-])(terminal|anchor)[:_\-\s]+([A-Za-z0-9][A-Za-z0-9_.-]*)$/i;
const NETWORK_PORT_NAME_PATTERN = /^(network_port|port)\s*:\s*(.*)$/i;
const NETWORK_PORT_PREFIX_PATTERN = /^(network_port|port)\b/i;
const IDENTITY_MATRIX: AffineMatrix = {
  a: 1,
  b: 0,
  c: 0,
  d: 1,
  e: 0,
  f: 0
};

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

function numberAttribute(attributes: ParsedAttributes, key: string): number | null {
  const value = Number(attributes[key]);
  return Number.isFinite(value) ? value : null;
}

function parseTransform(attributes?: ParsedAttributes): AffineMatrix | null {
  const transform = attributes?.transform?.trim();

  if (!transform) {
    return IDENTITY_MATRIX;
  }

  const match = transform.match(/^(translate|matrix)\(([^)]*)\)$/i);
  if (!match) {
    return null;
  }

  const values = match[2]
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number);

  if (values.some((value) => !Number.isFinite(value))) {
    return null;
  }

  if (match[1].toLowerCase() === "translate") {
    if (values.length < 1 || values.length > 2) {
      return null;
    }

    return {
      ...IDENTITY_MATRIX,
      e: values[0],
      f: values[1] ?? 0
    };
  }

  if (values.length !== 6) {
    return null;
  }

  return {
    a: values[0],
    b: values[1],
    c: values[2],
    d: values[3],
    e: values[4],
    f: values[5]
  };
}

function multiplyMatrices(
  parent: AffineMatrix,
  child: AffineMatrix
): AffineMatrix {
  return {
    a: parent.a * child.a + parent.c * child.b,
    b: parent.b * child.a + parent.d * child.b,
    c: parent.a * child.c + parent.c * child.d,
    d: parent.b * child.c + parent.d * child.d,
    e: parent.a * child.e + parent.c * child.f + parent.e,
    f: parent.b * child.e + parent.d * child.f + parent.f
  };
}

function applyMatrix(
  point: { x: number; y: number },
  matrix: AffineMatrix
): { x: number; y: number } {
  return {
    x: matrix.a * point.x + matrix.c * point.y + matrix.e,
    y: matrix.b * point.x + matrix.d * point.y + matrix.f
  };
}

function markerCenter(marker: MarkerElement): { x: number; y: number } | null {
  let center: { x: number; y: number } | null = null;

  if (marker.tagName === "circle" || marker.tagName === "ellipse") {
    const cx = numberAttribute(marker.attributes, "cx");
    const cy = numberAttribute(marker.attributes, "cy");

    if (cx !== null && cy !== null) {
      center = { x: cx, y: cy };
    }
  } else {
    const x = numberAttribute(marker.attributes, "x");
    const y = numberAttribute(marker.attributes, "y");
    const width = numberAttribute(marker.attributes, "width");
    const height = numberAttribute(marker.attributes, "height");

    if (x !== null && y !== null && width !== null && height !== null) {
      center = { x: x + width / 2, y: y + height / 2 };
    }
  }

  if (!center) {
    return null;
  }

  const elementMatrix = parseTransform(marker.attributes);
  const groupAncestors: GroupElement[] = [];
  let currentGroup = marker.group;

  while (currentGroup) {
    groupAncestors.push(currentGroup);
    currentGroup = currentGroup.parent;
  }

  let groupMatrix = IDENTITY_MATRIX;

  for (const group of groupAncestors.reverse()) {
    const localMatrix = parseTransform(group.attributes);

    if (!localMatrix) {
      return null;
    }

    groupMatrix = multiplyMatrices(groupMatrix, localMatrix);
  }

  if (!elementMatrix) {
    return null;
  }

  const transformed = applyMatrix(
    center,
    multiplyMatrices(groupMatrix, elementMatrix)
  );

  return {
    x: Number(transformed.x.toFixed(2)),
    y: Number(transformed.y.toFixed(2))
  };
}

function collectGroups(svg: string): GroupElement[] {
  const groups: GroupElement[] = [];
  const stack: GroupElement[] = [];

  for (const match of svg.matchAll(GROUP_TOKEN_PATTERN)) {
    const token = match[0];
    const start = match.index;

    if (token.startsWith("<!--")) {
      continue;
    }

    if (/^<\/g\b/i.test(token)) {
      const group = stack.pop();

      if (!group) {
        continue;
      }

      group.content = svg.slice(group.contentStart, start);
      group.end = start + token.length;
      groups.push(group);
      continue;
    }

    const group: GroupElement = {
      start,
      end: start + token.length,
      attributes: parseAttributes(token),
      content: "",
      contentStart: start + token.length,
      parent: stack.at(-1)
    };

    if (/\/\s*>$/.test(token)) {
      groups.push(group);
    } else {
      stack.push(group);
    }
  }

  return groups;
}

function collectPrimitives(svg: string, groups: GroupElement[]): MarkerElement[] {
  return Array.from(svg.matchAll(PRIMITIVE_PATTERN), (match) => {
    const start = match.index;
    const end = start + match[0].length;
    const containingGroups = groups.filter(
      (group) => start >= group.contentStart && end <= group.end
    );
    const group = containingGroups.reduce<GroupElement | undefined>(
      (smallest, candidate) =>
        !smallest || candidate.end - candidate.start < smallest.end - smallest.start
          ? candidate
          : smallest,
      undefined
    );

    return {
      start,
      end,
      tagName: match[1].toLowerCase() as MarkerElement["tagName"],
      attributes: parseAttributes(match[2]),
      group
    };
  });
}

function groupMarkerCandidate(
  group: GroupElement,
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
    .replace(PRIMITIVE_PATTERN, "")
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

function removeRanges(svg: string, ranges: SourceRange[]): string {
  const ordered = [...ranges].sort((left, right) => right.start - left.start);

  return ordered.reduce(
    (output, range) => output.slice(0, range.start) + output.slice(range.end),
    svg
  );
}

export function extractFigmaAnchors(svg: string): FigmaAnchorExtraction {
  const anchors: SymbolAnchor[] = [];
  const issues: ValidationIssue[] = [];
  const removals: SourceRange[] = [];
  const seenKeys = new Map<string, SymbolAnchor["kind"]>();
  const consumedPrimitiveStarts = new Set<number>();
  const groups = collectGroups(svg);
  const primitives = collectPrimitives(svg, groups);
  const candidates: Array<{
    marker: MarkerElement;
    parsedName: ParsedMarkerName;
  }> = [];

  for (const group of groups) {
    const name = attributeName(group.attributes);
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

    const name = attributeName(primitive.attributes);
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
    productionSvg: removeRanges(svg, removals),
    issues
  };
}

export function detectFigmaAnchors(svg: string): SymbolAnchor[] {
  return extractFigmaAnchors(svg).anchors;
}
