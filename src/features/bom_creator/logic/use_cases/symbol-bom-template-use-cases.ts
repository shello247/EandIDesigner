import {
  saveSymbolBomTemplateInputSchema,
  type BomItemSummary,
  type SaveSymbolBomTemplateInput
} from "../../data/schema";

export function validateSymbolBomTemplateInput(
  input: SaveSymbolBomTemplateInput,
  items: BomItemSummary[]
): SaveSymbolBomTemplateInput {
  const parsed = saveSymbolBomTemplateInputSchema.parse(input);
  const itemIds = new Set(items.map((item) => item.id));
  const missingLine = parsed.lines.find((line) => !itemIds.has(line.itemId));

  if (missingLine) {
    throw new Error("Symbol BOM template references an item outside the library.");
  }

  return parsed;
}
