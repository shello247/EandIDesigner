export const DRAWING_PROJECT_NUMBER_SCOPE = "drawing-project";
export const DRAWING_PROJECT_NUMBER_PREFIX = "PRJ-";

export function normalizeDrawingProjectNumber(
  value: string | null | undefined
): string | undefined {
  const normalized = value?.trim().toLocaleLowerCase("en-US");
  return normalized || undefined;
}

export function formatDrawingProjectNumber(sequence: number): string {
  if (!Number.isSafeInteger(sequence) || sequence < 1) {
    throw new Error("Project number sequence must be a positive integer.");
  }
  return `${DRAWING_PROJECT_NUMBER_PREFIX}${String(sequence).padStart(6, "0")}`;
}

export function parseDrawingProjectNumberSequence(
  value: string | null | undefined
): number | null {
  const match = /^PRJ-(\d+)$/i.exec(value?.trim() ?? "");
  if (!match) return null;
  const sequence = Number.parseInt(match[1], 10);
  return Number.isSafeInteger(sequence) && sequence > 0 ? sequence : null;
}
