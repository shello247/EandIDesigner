import {
  bomItemExtractionInputSchema,
  type BomItemExtractionInput
} from "../../data/schema";
import { listBomItemFormOptions } from "../../data/queries";
import { extractBomItemWithAi } from "../services/bom-item-ai-extraction";
import { BOM_ITEM_UNIT_OPTIONS } from "../services/bom-item-options";

export async function extractBomItemFromUrl(input: BomItemExtractionInput) {
  const parsed = bomItemExtractionInputSchema.parse(input);
  const options = await listBomItemFormOptions();

  return extractBomItemWithAi({
    productUrl: parsed.productUrl,
    categories: options.categories.map((option) => option.value),
    units: BOM_ITEM_UNIT_OPTIONS
  });
}
