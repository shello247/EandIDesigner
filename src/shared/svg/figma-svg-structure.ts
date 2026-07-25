export type SvgParsedAttributes = Record<string, string>;

export type SvgAffineMatrix = {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
};

export type SvgSourceRange = {
  start: number;
  end: number;
};

export type SvgGroupElement = SvgSourceRange & {
  attributes: SvgParsedAttributes;
  content: string;
  contentStart: number;
  parent?: SvgGroupElement;
};

export type SvgPrimitiveElement = SvgSourceRange & {
  tagName: "circle" | "ellipse" | "rect";
  attributes: SvgParsedAttributes;
  group?: SvgGroupElement;
};

const GROUP_TOKEN_PATTERN = /<!--[\s\S]*?-->|<\/?g\b[^>]*>/gi;
const PRIMITIVE_PATTERN =
  /<(circle|ellipse|rect)\b([^>]*?)(?:\/\s*>|>\s*<\/\1\s*>)/gi;
const ATTR_PATTERN = /([:\w-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;

export const SVG_IDENTITY_MATRIX: SvgAffineMatrix = {
  a: 1,
  b: 0,
  c: 0,
  d: 1,
  e: 0,
  f: 0
};

export function parseSvgAttributes(source: string): SvgParsedAttributes {
  const attributes: SvgParsedAttributes = {};

  for (const match of source.matchAll(ATTR_PATTERN)) {
    attributes[match[1]] = match[3] ?? match[4] ?? "";
  }

  return attributes;
}

export function getSvgElementName(
  attributes?: SvgParsedAttributes
): string | undefined {
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

export function getSvgNumberAttribute(
  attributes: SvgParsedAttributes,
  key: string
): number | null {
  const value = Number(attributes[key]);
  return Number.isFinite(value) ? value : null;
}

export function parseSvgTransform(
  attributes?: SvgParsedAttributes
): SvgAffineMatrix | null {
  const transform = attributes?.transform?.trim();

  if (!transform) {
    return SVG_IDENTITY_MATRIX;
  }

  const operations = Array.from(
    transform.matchAll(/(translate|matrix|rotate|scale)\s*\(([^)]*)\)/gi)
  );
  const unmatched = transform
    .replace(/(translate|matrix|rotate|scale)\s*\(([^)]*)\)/gi, "")
    .trim();

  if (operations.length === 0 || unmatched.length > 0) {
    return null;
  }

  let result = SVG_IDENTITY_MATRIX;

  for (const operation of operations) {
    const values = operation[2]
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);

    if (values.some((value) => !Number.isFinite(value))) {
      return null;
    }

    let local: SvgAffineMatrix;
    const name = operation[1].toLowerCase();

    if (name === "translate") {
      if (values.length < 1 || values.length > 2) {
        return null;
      }
      local = {
        ...SVG_IDENTITY_MATRIX,
        e: values[0],
        f: values[1] ?? 0
      };
    } else if (name === "scale") {
      if (values.length < 1 || values.length > 2) {
        return null;
      }
      local = {
        a: values[0],
        b: 0,
        c: 0,
        d: values[1] ?? values[0],
        e: 0,
        f: 0
      };
    } else if (name === "rotate") {
      if (values.length !== 1 && values.length !== 3) {
        return null;
      }
      const radians = (values[0] * Math.PI) / 180;
      const rotation: SvgAffineMatrix = {
        a: Math.cos(radians),
        b: Math.sin(radians),
        c: -Math.sin(radians),
        d: Math.cos(radians),
        e: 0,
        f: 0
      };
      if (values.length === 1) {
        local = rotation;
      } else {
        local = multiplySvgMatrices(
          multiplySvgMatrices(
            {
              ...SVG_IDENTITY_MATRIX,
              e: values[1],
              f: values[2]
            },
            rotation
          ),
          {
            ...SVG_IDENTITY_MATRIX,
            e: -values[1],
            f: -values[2]
          }
        );
      }
    } else {
      if (values.length !== 6) {
        return null;
      }
      local = {
        a: values[0],
        b: values[1],
        c: values[2],
        d: values[3],
        e: values[4],
        f: values[5]
      };
    }

    result = multiplySvgMatrices(result, local);
  }

  return result;
}

export function multiplySvgMatrices(
  parent: SvgAffineMatrix,
  child: SvgAffineMatrix
): SvgAffineMatrix {
  return {
    a: parent.a * child.a + parent.c * child.b,
    b: parent.b * child.a + parent.d * child.b,
    c: parent.a * child.c + parent.c * child.d,
    d: parent.b * child.c + parent.d * child.d,
    e: parent.a * child.e + parent.c * child.f + parent.e,
    f: parent.b * child.e + parent.d * child.f + parent.f
  };
}

export function applySvgMatrix(
  point: { x: number; y: number },
  matrix: SvgAffineMatrix
): { x: number; y: number } {
  return {
    x: matrix.a * point.x + matrix.c * point.y + matrix.e,
    y: matrix.b * point.x + matrix.d * point.y + matrix.f
  };
}

export function collectSvgGroups(svg: string): SvgGroupElement[] {
  const groups: SvgGroupElement[] = [];
  const stack: SvgGroupElement[] = [];

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

    const group: SvgGroupElement = {
      start,
      end: start + token.length,
      attributes: parseSvgAttributes(token),
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

export function collectSvgPrimitives(
  svg: string,
  groups: SvgGroupElement[]
): SvgPrimitiveElement[] {
  return Array.from(svg.matchAll(PRIMITIVE_PATTERN), (match) => {
    const start = match.index;
    const end = start + match[0].length;
    const containingGroups = groups.filter(
      (group) => start >= group.contentStart && end <= group.end
    );
    const group = containingGroups.reduce<SvgGroupElement | undefined>(
      (nearest, candidate) =>
        !nearest || candidate.end - candidate.start < nearest.end - nearest.start
          ? candidate
          : nearest,
      undefined
    );

    return {
      start,
      end,
      tagName: match[1].toLowerCase() as SvgPrimitiveElement["tagName"],
      attributes: parseSvgAttributes(match[2]),
      group
    };
  });
}

export function getSvgAncestorMatrix(
  group?: SvgGroupElement
): SvgAffineMatrix | null {
  const ancestors: SvgGroupElement[] = [];
  let current = group;

  while (current) {
    ancestors.push(current);
    current = current.parent;
  }

  let matrix = SVG_IDENTITY_MATRIX;
  for (const ancestor of ancestors.reverse()) {
    const local = parseSvgTransform(ancestor.attributes);
    if (!local) {
      return null;
    }
    matrix = multiplySvgMatrices(matrix, local);
  }

  return matrix;
}

export function getSvgElementMatrix(
  element: SvgPrimitiveElement
): SvgAffineMatrix | null {
  const ancestor = getSvgAncestorMatrix(element.group);
  const local = parseSvgTransform(element.attributes);

  return ancestor && local ? multiplySvgMatrices(ancestor, local) : null;
}

export function removeSvgSourceRanges(
  svg: string,
  ranges: SvgSourceRange[]
): string {
  const ordered = [...ranges].sort((left, right) => right.start - left.start);

  return ordered.reduce(
    (output, range) => output.slice(0, range.start) + output.slice(range.end),
    svg
  );
}

export const SVG_PRIMITIVE_PATTERN = PRIMITIVE_PATTERN;
