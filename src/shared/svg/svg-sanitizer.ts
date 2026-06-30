import type { SvgValidationIssue } from "./types";

export type SvgSanitizationResult = {
  svg: string;
  issues: SvgValidationIssue[];
};

const SCRIPT_PATTERN = /<script\b[\s\S]*?<\/script>/gi;
const FOREIGN_OBJECT_PATTERN = /<foreignObject\b[\s\S]*?<\/foreignObject>/gi;
const EVENT_HANDLER_PATTERN = /\s+on[a-z]+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi;
const URL_ATTR_PATTERN =
  /\s(?:href|xlink:href|src)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi;

function isUnsafeUrl(value: string): boolean {
  const normalized = value.trim().toLowerCase();

  if (normalized.startsWith("#")) {
    return false;
  }

  if (
    normalized.startsWith("data:image/png") ||
    normalized.startsWith("data:image/jpeg") ||
    normalized.startsWith("data:image/jpg") ||
    normalized.startsWith("data:image/webp") ||
    normalized.startsWith("data:image/gif")
  ) {
    return false;
  }

  return (
    normalized.startsWith("http://") ||
    normalized.startsWith("https://") ||
    normalized.startsWith("//") ||
    normalized.startsWith("javascript:") ||
    normalized.startsWith("data:image/svg+xml")
  );
}

export function sanitizeSvg(svg: string): SvgSanitizationResult {
  let sanitized = svg.trim();
  const issues: SvgValidationIssue[] = [];

  if (/<!doctype/i.test(sanitized)) {
    issues.push({
      severity: "blocking",
      code: "DOCTYPE_DENIED",
      message: "SVG doctype declarations are not allowed.",
      path: "svg"
    });
    sanitized = sanitized.replace(/<!doctype[\s\S]*?>/gi, "");
  }

  if (SCRIPT_PATTERN.test(sanitized)) {
    issues.push({
      severity: "blocking",
      code: "SCRIPT_DENIED",
      message: "SVG scripts are not allowed and were removed.",
      path: "svg"
    });
    sanitized = sanitized.replace(SCRIPT_PATTERN, "");
  }

  if (FOREIGN_OBJECT_PATTERN.test(sanitized)) {
    issues.push({
      severity: "blocking",
      code: "FOREIGN_OBJECT_DENIED",
      message: "SVG foreignObject elements are not allowed and were removed.",
      path: "svg"
    });
    sanitized = sanitized.replace(FOREIGN_OBJECT_PATTERN, "");
  }

  if (EVENT_HANDLER_PATTERN.test(sanitized)) {
    issues.push({
      severity: "blocking",
      code: "EVENT_HANDLER_DENIED",
      message: "Inline SVG event handlers are not allowed and were removed.",
      path: "svg"
    });
    sanitized = sanitized.replace(EVENT_HANDLER_PATTERN, "");
  }

  sanitized = sanitized.replace(
    URL_ATTR_PATTERN,
    (match, _quoted, doubleQuoted, singleQuoted, bare) => {
      const value = String(doubleQuoted ?? singleQuoted ?? bare ?? "");
      if (!isUnsafeUrl(value)) {
        return match;
      }

      issues.push({
        severity: "blocking",
        code: "EXTERNAL_REFERENCE_DENIED",
        message: `External or unsafe SVG reference was removed: ${value}`,
        path: "svg"
      });
      return "";
    }
  );

  return { svg: sanitized, issues };
}

