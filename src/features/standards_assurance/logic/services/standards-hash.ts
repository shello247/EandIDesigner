import { createHash } from "node:crypto";
export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(stableJson).join(",") + "]";
  if (value && typeof value === "object") return "{" + Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => JSON.stringify(k) + ":" + stableJson(v)).join(",") + "}";
  return JSON.stringify(value) ?? "null";
}
export function contentHash(value: unknown) { return createHash("sha256").update(stableJson(value)).digest("hex"); }

