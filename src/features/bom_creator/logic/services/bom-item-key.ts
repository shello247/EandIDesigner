export const BOM_ITEM_KEY_SCOPE = "bom_item";
export const BOM_ITEM_KEY_PREFIX = "BOM-";
export const BOM_ITEM_KEY_PADDING = 6;

const BOM_ITEM_KEY_PATTERN = /^BOM-(\d+)$/;

export function parseBomItemKeySequence(itemKey: string): number | null {
  const match = BOM_ITEM_KEY_PATTERN.exec(itemKey.trim());

  if (!match) {
    return null;
  }

  const sequence = Number(match[1]);

  return Number.isSafeInteger(sequence) && sequence > 0 ? sequence : null;
}

export function formatBomItemKey(sequence: number): string {
  if (!Number.isSafeInteger(sequence) || sequence <= 0) {
    throw new Error("BOM item sequence must be a positive safe integer.");
  }

  return `${BOM_ITEM_KEY_PREFIX}${String(sequence).padStart(
    BOM_ITEM_KEY_PADDING,
    "0"
  )}`;
}
