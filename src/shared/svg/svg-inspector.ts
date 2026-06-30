import type { SvgValidationIssue } from "./types";

export type SvgViewBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SvgInspection = {
  hasSvgRoot: boolean;
  viewBox?: SvgViewBox;
  issues: SvgValidationIssue[];
};

const SVG_OPEN_TAG_PATTERN = /<svg\b([^>]*)>/i;
const VIEW_BOX_PATTERN = /\bviewBox\s*=\s*["']([^"']+)["']/i;

export function inspectSvg(svg: string): SvgInspection {
  const issues: SvgValidationIssue[] = [];
  const openTagMatch = svg.match(SVG_OPEN_TAG_PATTERN);

  if (!openTagMatch) {
    issues.push({
      severity: "blocking",
      code: "SVG_ROOT_MISSING",
      message: "SVG must contain a root <svg> element.",
      path: "svg"
    });
    return { hasSvgRoot: false, issues };
  }

  const viewBoxMatch = openTagMatch[1]?.match(VIEW_BOX_PATTERN);

  if (!viewBoxMatch) {
    issues.push({
      severity: "blocking",
      code: "VIEWBOX_MISSING",
      message: "SVG root must define a viewBox.",
      path: "svg.viewBox"
    });
    return { hasSvgRoot: true, issues };
  }

  const values = viewBoxMatch[1]
    .trim()
    .split(/[\s,]+/)
    .map((value) => Number(value));

  if (values.length !== 4 || values.some((value) => !Number.isFinite(value))) {
    issues.push({
      severity: "blocking",
      code: "VIEWBOX_INVALID",
      message: "SVG viewBox must contain four finite numeric values.",
      path: "svg.viewBox"
    });
    return { hasSvgRoot: true, issues };
  }

  const [x, y, width, height] = values;
  if (width <= 0 || height <= 0) {
    issues.push({
      severity: "blocking",
      code: "VIEWBOX_DIMENSIONS_INVALID",
      message: "SVG viewBox width and height must be positive.",
      path: "svg.viewBox"
    });
  }

  return {
    hasSvgRoot: true,
    viewBox: { x, y, width, height },
    issues
  };
}

export function areViewBoxesEqual(a: SvgViewBox, b: SvgViewBox): boolean {
  return (
    a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height
  );
}

