export type {
  BomItemDeleteResult,
  BomItemInput,
  BomItemDetail,
  BomItemImageInput,
  BomItemImageSummary,
  BomItemFormOptions,
  BomItemOption,
  BomItemOptionInput,
  BomItemStatus,
  BomItemSummary,
  BomItemUpdateInput,
  BomItemUsage,
  BomQuantityRule,
  BomQuantityStatus,
  BomTemplateLineInput,
  ConsolidatedBomLine,
  GeneratedBomAssembly,
  GeneratedBomLine,
  GeneratedBomWarning,
  GeneratedBomWarningCode,
  GeneratedDrawingBom,
  SaveSymbolBomTemplateInput,
  SymbolBomTemplateDetail,
  SymbolBomTemplateLineDetail
} from "../data/schema";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };
