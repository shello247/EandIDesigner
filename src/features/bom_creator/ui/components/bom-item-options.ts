export const bomCategoryOptions = [
  "cable",
  "cable_gland",
  "sealant",
  "wire_end",
  "label",
  "terminal",
  "breaker",
  "panel",
  "accessory",
  "other"
];

export const bomUnitOptions = ["each", "m", "ft", "set", "tube", "roll", "pack"];

export const bomCurrencyOptions = ["USD", "TTD", "EUR", "GBP", "CAD"];

export function categoryLabel(value: string): string {
  return value.replace(/_/g, " ");
}
