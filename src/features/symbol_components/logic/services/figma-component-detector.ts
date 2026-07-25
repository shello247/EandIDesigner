import type { ValidationIssue } from "@/features/symbol_registry/data/schema";
import type { SvgViewBox } from "@/shared/svg/svg-inspector";
import {
  applySvgMatrix,
  collectSvgGroups,
  collectSvgPrimitives,
  getSvgElementMatrix,
  getSvgElementName,
  getSvgNumberAttribute,
  removeSvgSourceRanges,
  type SvgAffineMatrix,
  type SvgGroupElement,
  type SvgPrimitiveElement
} from "@/shared/svg/figma-svg-structure";
import {
  symbolComponentPositionsSchema,
  type SymbolComponentBox,
  type SymbolComponentPosition
} from "../../data/schema";

export type FigmaComponentExtraction = {
  componentPositions: SymbolComponentPosition[];
  productionSvg: string;
  issues: ValidationIssue[];
};

const POSITION_NAME_PATTERN = /^Position(?:\s+|:\s*)(.+)$/i;
const COMPONENT_NAME_PATTERN = /^Component\s*:\s*(.+)$/i;
const ORTHOGONAL_TOLERANCE = 1e-6;

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function directChildGroups(
  groups: SvgGroupElement[],
  parent: SvgGroupElement
): SvgGroupElement[] {
  return groups
    .filter((group) => group.parent?.start === parent.start)
    .sort((left, right) => left.start - right.start);
}

function directPrimitives(
  primitives: SvgPrimitiveElement[],
  parent: SvgGroupElement
): SvgPrimitiveElement[] {
  return primitives
    .filter((primitive) => primitive.group?.start === parent.start)
    .sort((left, right) => left.start - right.start);
}

function roundGeometry(value: number): number {
  return Number(value.toFixed(2));
}

function normalizeRotation(value: number): number {
  let normalized = value % 360;
  if (normalized > 180) {
    normalized -= 360;
  } else if (normalized <= -180) {
    normalized += 360;
  }
  return roundGeometry(normalized);
}

function rectangleBox(
  primitive: SvgPrimitiveElement,
  matrix: SvgAffineMatrix
): SymbolComponentBox | null {
  const x = getSvgNumberAttribute(primitive.attributes, "x");
  const y = getSvgNumberAttribute(primitive.attributes, "y");
  const width = getSvgNumberAttribute(primitive.attributes, "width");
  const height = getSvgNumberAttribute(primitive.attributes, "height");

  if (
    x === null ||
    y === null ||
    width === null ||
    height === null ||
    width <= 0 ||
    height <= 0
  ) {
    return null;
  }

  const scaleX = Math.hypot(matrix.a, matrix.b);
  const scaleY = Math.hypot(matrix.c, matrix.d);
  const determinant = matrix.a * matrix.d - matrix.b * matrix.c;
  const dot = matrix.a * matrix.c + matrix.b * matrix.d;

  if (
    scaleX <= Number.EPSILON ||
    scaleY <= Number.EPSILON ||
    determinant <= 0 ||
    Math.abs(dot) > ORTHOGONAL_TOLERANCE * scaleX * scaleY
  ) {
    return null;
  }

  const center = applySvgMatrix(
    { x: x + width / 2, y: y + height / 2 },
    matrix
  );

  return {
    centerX: roundGeometry(center.x),
    centerY: roundGeometry(center.y),
    width: roundGeometry(width * scaleX),
    height: roundGeometry(height * scaleY),
    rotationDeg: normalizeRotation((Math.atan2(matrix.b, matrix.a) * 180) / Math.PI)
  };
}

function boxCorners(box: SymbolComponentBox): Array<{ x: number; y: number }> {
  const radians = (box.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  return [
    [-box.width / 2, -box.height / 2],
    [box.width / 2, -box.height / 2],
    [box.width / 2, box.height / 2],
    [-box.width / 2, box.height / 2]
  ].map(([x, y]) => ({
    x: box.centerX + x * cos - y * sin,
    y: box.centerY + x * sin + y * cos
  }));
}

function boundsIssue(
  box: SymbolComponentBox,
  viewBox: SvgViewBox,
  path: string
): ValidationIssue | null {
  const corners = boxCorners(box);
  const minX = Math.min(...corners.map((corner) => corner.x));
  const maxX = Math.max(...corners.map((corner) => corner.x));
  const minY = Math.min(...corners.map((corner) => corner.y));
  const maxY = Math.max(...corners.map((corner) => corner.y));
  const viewMaxX = viewBox.x + viewBox.width;
  const viewMaxY = viewBox.y + viewBox.height;
  const intersects =
    maxX >= viewBox.x &&
    minX <= viewMaxX &&
    maxY >= viewBox.y &&
    minY <= viewMaxY;
  const contained =
    minX >= viewBox.x &&
    maxX <= viewMaxX &&
    minY >= viewBox.y &&
    maxY <= viewMaxY;

  if (!intersects) {
    return {
      severity: "blocking",
      code: "COMPONENT_POSITION_OUTSIDE_VIEWBOX",
      message: "Component Position Box is completely outside the SVG viewBox.",
      path
    };
  }

  return contained
    ? null
    : {
        severity: "warning",
        code: "COMPONENT_POSITION_PARTIAL_VIEWBOX",
        message: "Component Position Box extends partially outside the SVG viewBox.",
        path
      };
}

function blockingIssue(
  code: string,
  message: string,
  path: string
): ValidationIssue {
  return { severity: "blocking", code, message, path };
}

export function extractFigmaComponents(
  svg: string,
  viewBox: SvgViewBox
): FigmaComponentExtraction {
  const groups = collectSvgGroups(svg);
  const primitives = collectSvgPrimitives(svg, groups);
  const issues: ValidationIssue[] = [];
  const positions: SymbolComponentPosition[] = [];
  const componentRoots = groups
    .filter(
      (group) =>
        getSvgElementName(group.attributes)?.trim().toLowerCase() === "components"
    )
    .sort((left, right) => left.start - right.start);

  if (componentRoots.length === 0) {
    return { componentPositions: [], productionSvg: svg, issues: [] };
  }

  if (componentRoots.length > 1) {
    return {
      componentPositions: [],
      productionSvg: svg,
      issues: [
        blockingIssue(
          "COMPONENT_ROOT_DUPLICATE",
          'SVG must contain at most one group named "Components".',
          "svg"
        )
      ]
    };
  }

  const root = componentRoots[0];
  const seenPositionKeys = new Set<string>();
  const positionGroups = directChildGroups(groups, root).filter((group) =>
    POSITION_NAME_PATTERN.test(getSvgElementName(group.attributes)?.trim() ?? "")
  );

  if (positionGroups.length === 0) {
    issues.push(
      blockingIssue(
        "COMPONENT_POSITION_MISSING",
        'The "Components" group must contain at least one direct Position group.',
        "svg"
      )
    );
  }

  for (const [positionIndex, positionGroup] of positionGroups.entries()) {
    const positionName = getSvgElementName(positionGroup.attributes)?.trim() ?? "";
    const positionMatch = positionName.match(POSITION_NAME_PATTERN);
    const positionSuffix = positionMatch?.[1]?.trim() ?? "";
    const positionKey = normalizeKey(positionSuffix);
    const positionPath = `componentPositions.${positionIndex}`;

    if (!positionKey) {
      issues.push(
        blockingIssue(
          "COMPONENT_POSITION_KEY_INVALID",
          `Component position "${positionName}" does not contain a usable key.`,
          positionPath
        )
      );
      continue;
    }

    if (seenPositionKeys.has(positionKey)) {
      issues.push(
        blockingIssue(
          "COMPONENT_POSITION_DUPLICATE",
          `Component position key "${positionKey}" is duplicated.`,
          positionPath
        )
      );
      continue;
    }
    seenPositionKeys.add(positionKey);

    const componentGroups = directChildGroups(groups, positionGroup).filter(
      (group) =>
        COMPONENT_NAME_PATTERN.test(
          getSvgElementName(group.attributes)?.trim() ?? ""
        )
    );
    const seenComponentKeys = new Set<string>();
    const components: SymbolComponentPosition["components"] = [];

    if (componentGroups.length === 0) {
      issues.push(
        blockingIssue(
          "COMPONENT_DEFINITION_MISSING",
          `Component position "${positionName}" must contain at least one direct "Component: …" group.`,
          positionPath
        )
      );
    }

    for (const [componentIndex, componentGroup] of componentGroups.entries()) {
      const componentName =
        getSvgElementName(componentGroup.attributes)?.trim() ?? "";
      const componentMatch = componentName.match(COMPONENT_NAME_PATTERN);
      const componentLabel = componentMatch?.[1]?.trim() ?? "";
      const componentKey = normalizeKey(componentLabel);
      const componentPath = `${positionPath}.components.${componentIndex}`;

      if (!componentKey) {
        issues.push(
          blockingIssue(
            "COMPONENT_KEY_INVALID",
            `Component group "${componentName}" does not contain a usable key.`,
            componentPath
          )
        );
        continue;
      }

      if (seenComponentKeys.has(componentKey)) {
        issues.push(
          blockingIssue(
            "COMPONENT_KEY_DUPLICATE",
            `Component key "${componentKey}" is duplicated in "${positionName}".`,
            componentPath
          )
        );
        continue;
      }
      seenComponentKeys.add(componentKey);

      const positionBoxes = directPrimitives(primitives, componentGroup).filter(
        (primitive) =>
          primitive.tagName === "rect" &&
          getSvgElementName(primitive.attributes)?.trim().toLowerCase() ===
            "position box"
      );

      if (positionBoxes.length !== 1) {
        issues.push(
          blockingIssue(
            "COMPONENT_POSITION_BOX_INVALID",
            `Component "${componentLabel}" must contain exactly one direct rectangle named "Position Box".`,
            componentPath
          )
        );
        continue;
      }

      const matrix = getSvgElementMatrix(positionBoxes[0]);
      const box = matrix ? rectangleBox(positionBoxes[0], matrix) : null;
      if (!box) {
        issues.push(
          blockingIssue(
            "COMPONENT_POSITION_BOX_GEOMETRY_INVALID",
            `Component "${componentLabel}" Position Box is degenerate, reflected, skewed, or uses an unsupported transform.`,
            `${componentPath}.box`
          )
        );
        continue;
      }

      const issue = boundsIssue(box, viewBox, `${componentPath}.box`);
      if (issue) {
        issues.push(issue);
      }

      components.push({
        key: componentKey,
        label: componentLabel,
        box,
        allowedSymbolIds: []
      });
    }

    if (components.length > 0) {
      positions.push({
        key: positionKey,
        label: positionName,
        required: false,
        components
      });
    }
  }

  const hasBlockingIssue = issues.some((issue) => issue.severity === "blocking");
  const parsedPositions = symbolComponentPositionsSchema.safeParse(positions);

  if (!parsedPositions.success) {
    issues.push(
      blockingIssue(
        "COMPONENT_DEFINITION_INVALID",
        parsedPositions.error.issues[0]?.message ??
          "Component position metadata is invalid.",
        "componentPositions"
      )
    );
  }

  return {
    componentPositions: parsedPositions.success ? parsedPositions.data : [],
    productionSvg: hasBlockingIssue
      ? svg
      : removeSvgSourceRanges(svg, [{ start: root.start, end: root.end }]),
    issues
  };
}
