import type { SymbolTerminal, ValidationIssue } from "@/features/symbol_registry/data/schema";
import { inspectSvg } from "@/shared/svg/svg-inspector";
import { sanitizeSvg } from "@/shared/svg/svg-sanitizer";
import type { SvgImportPreview, SvgImportSourceAsset } from "../../types";
import { extractFigmaAnchors } from "../services/figma-anchor-detector";
import { createNetworkPortDrafts } from "../services/network-profile-draft";

function terminalsFromAnchors(
  anchors: SvgImportPreview["anchors"]
): SymbolTerminal[] {
  return anchors.flatMap((anchor) =>
    anchor.kind === "network_port"
      ? []
      : [
          {
            key: anchor.key,
            label: anchor.key,
            function: "",
            anchorKey: anchor.key,
            requiredForWiring: anchor.kind === "terminal"
          }
        ]
  );
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

  const extraction = extractFigmaAnchors(sanitization.svg);
  const markerContractIssue = extraction.issues.find(
    (issue) => issue.severity === "blocking"
  );

  if (markerContractIssue) {
    throw new Error(markerContractIssue.message);
  }

  issues.push(...extraction.issues);
  const anchors = extraction.anchors;

  return {
    svg: extraction.productionSvg,
    viewBox: inspection.viewBox,
    anchors,
    terminals: terminalsFromAnchors(anchors),
    networkPorts: createNetworkPortDrafts(anchors),
    issues,
    sourceAsset: params.sourceAsset
  };
}
