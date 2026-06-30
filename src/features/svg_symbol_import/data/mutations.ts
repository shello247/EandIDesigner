import { saveSymbolDraftToRegistry } from "@/features/symbol_registry/api/public";
import type { SymbolDetail } from "@/features/symbol_registry/types";
import { parseImportedSvg } from "../logic/use_cases/parse-imported-svg";
import { svgSymbolImportDraftSchema, type SvgSymbolImportDraftInput } from "./schema";

export async function saveImportedSvgSymbolDraft(
  input: SvgSymbolImportDraftInput
): Promise<SymbolDetail | null> {
  const parsed = svgSymbolImportDraftSchema.parse(input);
  const preview = parseImportedSvg({
    rawSvg: parsed.svg,
    sourceAsset: parsed.sourceAsset
  });

  return saveSymbolDraftToRegistry({
    svg: preview.svg,
    metadata: parsed.metadata,
    sourceInputSummary: [
      `Imported SVG: ${parsed.sourceAsset.fileName}`,
      preview.issues.length > 0
        ? `Import sanitizer notes: ${preview.issues
            .map((issue) => issue.message)
            .join(" ")}`
        : ""
    ]
      .filter(Boolean)
      .join("\n"),
    sourceAsset: parsed.sourceAsset
  });
}

