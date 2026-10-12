import type { AttributeEvidence, ItemProfileV3 } from "../../data/profile-v3-schema";
import { ItemEngineeringError } from "./item-engineering-error";

export function profileEvidence(profile: ItemProfileV3): AttributeEvidence[] {
  return [...profile.entries, ...profile.channels, ...profile.terminals].flatMap(row => row.evidence);
}
export function validateProfileEvidence(profile: ItemProfileV3, sources: {
  notes: Array<{ id: string; contentHash: string }>; documents: Array<{ id: string; contentHash: string }>;
}) {
  const notes = new Map(sources.notes.map(s => [s.id, s.contentHash]));
  const documents = new Map(sources.documents.map(s => [s.id, s.contentHash]));
  for (const source of profileEvidence(profile)) {
    if ((source.kind === "note" && notes.get(source.id) !== source.contentHash) ||
        (source.kind === "document" && documents.get(source.id) !== source.contentHash))
      throw new ItemEngineeringError("INVALID_GUIDANCE", "Specification evidence must reference retained content belonging to this Item revision.");
  }
}
export function evidenceLabel(source: AttributeEvidence) {
  if (source.kind === "document") return `Document${source.page ? `, p. ${source.page}` : ""}${source.section ? `, ${source.section}` : ""}`;
  if (source.kind === "note") return `Engineer note${source.section ? `, ${source.section}` : ""}`;
  return source.kind === "url" ? source.label || source.url : source.reference;
}
