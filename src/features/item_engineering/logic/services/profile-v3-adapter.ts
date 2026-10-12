import type { ItemEngineeringProfile } from "../../data/schema";
import { itemProfileV3Schema, type ItemProfileV3 } from "../../data/profile-v3-schema";
import { projectItemAttributeProfile } from "./item-attribute-profile";

/** Explicit edit projection; never writes the source revision or reinterprets groups as modes. */
export function projectItemProfileV3(input: ItemEngineeringProfile | ItemProfileV3 | null): ItemProfileV3 {
  if (input?.version === 3) return structuredClone(input);
  const legacy = projectItemAttributeProfile(input);
  return itemProfileV3Schema.parse({ ...legacy, version: 3, modes: [], terminals: [], channels: [],
    entries: legacy.entries.map(entry => {
      const group = legacy.groups.find(g => g.key === entry.groupKey)!;
      return { ...entry, scope: group.context === "device" ? { kind: "device" } : { kind: group.context, id: group.key },
        condition: "", modes: [], ratingBasis: "unspecified", evidence: [] };
    })
  });
}
