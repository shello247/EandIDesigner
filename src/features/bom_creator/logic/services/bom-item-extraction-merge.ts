import type { BomItemExtractedValues } from "../../data/schema";

export function mergeBomItemExtractionIntoBlankFields<
  T extends Record<string, unknown>
>(draft: T, values: BomItemExtractedValues): T {
  const next = { ...draft };

  for (const [key, value] of Object.entries(values)) {
    if (value === null) {
      continue;
    }

    const current = next[key];
    const isBlank =
      current === undefined ||
      current === null ||
      (typeof current === "string" && current.trim().length === 0);

    if (isBlank) {
      next[key as keyof T] = value as T[keyof T];
    }
  }

  return next;
}
