import type {
  SymbolAnchor,
  SymbolMetadata,
  SymbolTerminal,
  ValidationIssue
} from "@/features/symbol_registry/data/schema";
import type { SvgViewBox } from "@/shared/svg/svg-inspector";
import type { SvgImportNetworkPortDraft } from "../data/schema";
import type { SymbolComponentPosition } from "@/features/symbol_components/api/public";

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
  networkPorts: SvgImportNetworkPortDraft[];
  componentPositions: SymbolComponentPosition[];
  issues: ValidationIssue[];
  sourceAsset: SvgImportSourceAsset;
};

export type SvgSymbolImportDraft = {
  svg: string;
  sourceAsset: SvgImportSourceAsset;
  metadata: SymbolMetadata;
};
