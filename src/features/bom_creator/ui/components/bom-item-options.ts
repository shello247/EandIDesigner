import {
  BOM_ITEM_CATEGORY_OPTIONS,
  BOM_ITEM_CURRENCY_OPTIONS,
  BOM_ITEM_UNIT_OPTIONS
} from "../../logic/services/bom-item-options";
import { getItemDeviceTypeLabel, itemEngineeringDeviceTypeSchema } from "@/features/item_engineering/api/public";

export const bomCategoryOptions = [...BOM_ITEM_CATEGORY_OPTIONS];
export const bomUnitOptions = [...BOM_ITEM_UNIT_OPTIONS];
export const bomCurrencyOptions = [...BOM_ITEM_CURRENCY_OPTIONS];

export function categoryLabel(value: string): string {
  const type = itemEngineeringDeviceTypeSchema.safeParse(value);
  return getItemDeviceTypeLabel(type.success ? type.data : null);
}
