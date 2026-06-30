import type { SymbolTerminal, ValidationIssue } from "@/features/symbol_registry/data/schema";
import { inspectSvg } from "@/shared/svg/svg-inspector";
import { sanitizeSvg } from "@/shared/svg/svg-sanitizer";
import type { SvgImportPreview, SvgImportSourceAsset } from "../../types";
import { detectFigmaAnchors } from "../services/figma-anchor-detector";

function terminalsFromAnchors(
  anchors: SvgImportPreview["anchors"]
): SymbolTerminal[] {
  return anchors.map((anchor) => ({
    key: anchor.key,
    label: anchor.key,
    function: "",
    anchorKey: anchor.key,
    requiredForWiring: anchor.kind === "terminal"
  }));
}

export function parseImportedSvg(params: {
  rawSvg: string;
  sourceAsset: SvgImportSourceAsset;
}): SvgImportPreview {
  const sanitization = sanitizeSvg(params.rawSvg);
  const inspection = inspectSvg(sanitization.svg);
  const issues: ValidationIssue[] = [
    ...sanitization.issues,
    ...inspection.issues
  ];

  if (!inspection.viewBox) {
    throw new Error(
      issues.find((issue) => issue.severity === "blocking")?.message ??
        "SVG could not be imported."
    );
  }

  const anchors = detectFigmaAnchors(sanitization.svg);

  return {
    svg: sanitization.svg,
    viewBox: inspection.viewBox,
    anchors,
    terminals: terminalsFromAnchors(anchors),
    issues,
    sourceAsset: params.sourceAsset
  };
}

