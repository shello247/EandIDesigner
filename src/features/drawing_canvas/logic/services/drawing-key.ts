export function normalizeDrawingKey(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || "drawing";
}

export function generateUniqueDrawingKey(
  title: string,
  collisionIndex = 0
): string {
  const base = normalizeDrawingKey(title);
  return collisionIndex === 0 ? base : `${base}_${collisionIndex + 1}`;
}

