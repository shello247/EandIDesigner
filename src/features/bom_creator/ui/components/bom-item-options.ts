import {
  BOM_ITEM_CATEGORY_OPTIONS,
  BOM_ITEM_CURRENCY_OPTIONS,
  BOM_ITEM_UNIT_OPTIONS
} from "../../logic/services/bom-item-options";

export const bomCategoryOptions = [...BOM_ITEM_CATEGORY_OPTIONS];
export const bomUnitOptions = [...BOM_ITEM_UNIT_OPTIONS];
export const bomCurrencyOptions = [...BOM_ITEM_CURRENCY_OPTIONS];

export function categoryLabel(value: string): string {
  return value.replace(/_/g, " ");
}
