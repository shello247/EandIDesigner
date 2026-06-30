import type { SymbolMetadata, ValidationIssue } from "../../data/schema";

export function validateAnchors(metadata: SymbolMetadata): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const anchorKeys = new Set<string>();
  const terminalKeys = new Set<string>();

  for (const [index, anchor] of metadata.anchors.entries()) {
    if (anchorKeys.has(anchor.key)) {
      issues.push({
        severity: "blocking",
        code: "ANCHOR_DUPLICATE",
        message: `Anchor key "${anchor.key}" is duplicated.`,
        path: `metadata.anchors.${index}.key`
      });
    }
    anchorKeys.add(anchor.key);

    const minX = metadata.viewBox.x;
    const minY = metadata.viewBox.y;
    const maxX = metadata.viewBox.x + metadata.viewBox.width;
    const maxY = metadata.viewBox.y + metadata.viewBox.height;

    if (anchor.x < minX || anchor.x > maxX || anchor.y < minY || anchor.y > maxY) {
      issues.push({
        severity: "blocking",
        code: "ANCHOR_OUT_OF_BOUNDS",
        message: `Anchor "${anchor.key}" is outside the SVG viewBox.`,
        path: `metadata.anchors.${index}`
      });
    }
  }

  for (const [index, terminal] of metadata.terminals.entries()) {
    if (terminalKeys.has(terminal.key)) {
      issues.push({
        severity: "blocking",
        code: "TERMINAL_DUPLICATE",
        message: `Terminal key "${terminal.key}" is duplicated.`,
        path: `metadata.terminals.${index}.key`
      });
    }
    terminalKeys.add(terminal.key);

    if (terminal.requiredForWiring && !anchorKeys.has(terminal.anchorKey)) {
      issues.push({
        severity: "blocking",
        code: "TERMINAL_ANCHOR_MISSING",
        message: `Terminal "${terminal.key}" references missing anchor "${terminal.anchorKey}".`,
        path: `metadata.terminals.${index}.anchorKey`
      });
    }
  }

  return issues;
}
