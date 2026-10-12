import { createHash } from "node:crypto";
import type { ItemEngineeringRevision } from "../../data/schema";

// Stable object-key ordering; array order remains meaningful unless explicitly sorted below.
function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  return "{" + Object.entries(value).filter(([,entry]) => entry !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key, entry]) => JSON.stringify(key) + ":" + canonical(entry)).join(",") + "}";
}

export function hashItemEngineeringContent(value: unknown): string {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

export function hashItemDocumentContent(document: {
  title: string; fileName: string; mimeType: string; sizeBytes: number; dataUrl: string;
}) {
  const { title, fileName, mimeType, sizeBytes, dataUrl } = document;
  return hashItemEngineeringContent({ title, fileName, mimeType, sizeBytes, dataUrl });
}

export function hashItemRevision(input: {
  identity: ItemEngineeringRevision["identity"];
  profile: ItemEngineeringRevision["profile"];
  notes: Array<{ id: string; contentHash: string }>;
  documents: Array<{ id: string; contentHash: string }>;
}) {
  const sorted = (entries: Array<{ id: string; contentHash: string }>) =>
    entries.map(({ id, contentHash }) => ({ id, contentHash }))
      .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return hashItemEngineeringContent({ identity: input.identity, profile: input.profile,
    notes: sorted(input.notes), documents: sorted(input.documents) });
}

export { ItemEngineeringError } from "./item-engineering-error";
