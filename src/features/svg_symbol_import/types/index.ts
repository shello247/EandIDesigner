import type {
  SymbolAnchor,
  SymbolMetadata,
  SymbolTerminal,
  ValidationIssue
} from "@/features/symbol_registry/data/schema";
import type { SvgViewBox } from "@/shared/svg/svg-inspector";

export type SvgImportSourceAsset = {
  fileName: string;
  mimeType: "image/svg+xml";
  sizeBytes: number;
  dataUrl?: string;
};

export type SvgImportPreview = {
  svg: string;
  viewBox: SvgViewBox;
  anchors: SymbolAnchor[];
  terminals: SymbolTerminal[];
  issues: ValidationIssue[];
  sourceAsset: SvgImportSourceAsset;
};

export type SvgSymbolImportDraft = {
  svg: string;
  sourceAsset: SvgImportSourceAsset;
  metadata: SymbolMetadata;
};

