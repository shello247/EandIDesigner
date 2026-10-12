import type { ItemOverview } from "../../data/item-workspace";

export const itemDetailsFields = [
  ["displayName", "Item name"], ["manufacturer", "Manufacturer"], ["partNumber", "Part number"],
  ["model", "Model"], ["unit", "Unit"],
  ["description", "Description"], ["notes", "General notes"], ["productUrl", "Product source"]
] as const;
export const itemDetailsDraft = (item: ItemOverview) => ({
  fields: Object.fromEntries(itemDetailsFields.map(([key]) => [key, item[key] ?? ""])) as Record<typeof itemDetailsFields[number][0], string>,
  deviceType: item.deviceType
});
