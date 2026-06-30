import {
  symbolMetadataSchema,
  type SymbolMetadata,
  type ValidationIssue
} from "../../data/schema";
import { validateAnchors } from "../services/anchor-validator";
import { areViewBoxesEqual, inspectSvg } from "@/shared/svg/svg-inspector";
import { sanitizeSvg } from "@/shared/svg/svg-sanitizer";

export type SymbolValidationResult = {
  sanitizedSvg: string;
  metadata?: SymbolMetadata;
  issues: ValidationIssue[];
  blockingIssueCount: number;
};

export function validateSymbol(
  svg: string,
  metadataInput: unknown
): SymbolValidationResult {
  const sanitization = sanitizeSvg(svg);
  const inspection = inspectSvg(sanitization.svg);
  const issues: ValidationIssue[] = [
    ...sanitization.issues,
    ...inspection.issues
  ];

  const metadataResult = symbolMetadataSchema.safeParse(metadataInput);

  if (!metadataResult.success) {
    for (const issue of metadataResult.error.issues) {
      issues.push({
        severity: "blocking",
        code: "METADATA_INVALID",
        message: issue.message,
        path: issue.path.length > 0 ? `metadata.${issue.path.join(".")}` : "metadata"
      });
    }

    return {
      sanitizedSvg: sanitization.svg,
      issues,
      blockingIssueCount: issues.filter((issue) => issue.severity === "blocking")
        .length
    };
  }

  const metadata = metadataResult.data;
  issues.push(...validateAnchors(metadata));

  if (inspection.viewBox && !areViewBoxesEqual(inspection.viewBox, metadata.viewBox)) {
    issues.push({
      severity: "warning",
      code: "VIEWBOX_METADATA_MISMATCH",
      message: "Metadata viewBox does not match the SVG root viewBox.",
      path: "metadata.viewBox"
    });
  }

  return {
    sanitizedSvg: sanitization.svg,
    metadata,
    issues,
    blockingIssueCount: issues.filter((issue) => issue.severity === "blocking")
      .length
  };
}
