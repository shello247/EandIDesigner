import {
  resolveEngineeringFacts,
  ENGINEERING_ATTRIBUTE_DEFINITION_BY_KEY,
  type EngineeringAttributeValue,
  type EngineeringFactProjection
} from "@/features/engineering_attributes/api/public";
import {
  itemEngineeringProfileSchema,
  type ItemEngineeringProfile,
  type ItemSpecificationContext
} from "../../data/schema";

export type ItemEngineeringProfileResolution =
  | { ok: false; issues: Array<{ path: string; message: string }> }
  | {
      ok: true;
      profile: ItemEngineeringProfile;
      groups: Array<EngineeringFactProjection & {
        key: string;
        label: string;
        context: ItemSpecificationContext;
      }>;
    };

/** Preserve context and provenance; never flatten PSU input and output facts. */
export function resolveItemEngineeringProfile(
  input: unknown
): ItemEngineeringProfileResolution {
  const parsed = itemEngineeringProfileSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message
      }))
    };
  }
  const profile = parsed.data;
  // V3 scopes and modes require the effective-fact resolver; never flatten them.
  if (profile.version === 3) return { ok: true, profile, groups: [] };
  return {
    ok: true,
    profile,
    groups: profile.groups.map((group) => ({
      key: group.key,
      label: group.label,
      context: group.context,
      ...resolveEngineeringFacts({
        container: profile.version === 1 ? profile.groups.find(candidate => candidate.key === group.key)!.attributes : {
          version: 1, values: profile.entries.filter(entry => entry.groupKey === group.key).flatMap(entry => {
            const key = entry.type.analysisKey;
            if (!key || !ENGINEERING_ATTRIBUTE_DEFINITION_BY_KEY.has(key) ||
                ["range", "short_circuit", "terminal_range"].includes(entry.payload.kind)) return [];
            return [{ definitionKey: key, definitionVersion: 1, ...entry.payload, source: entry.source } as EngineeringAttributeValue];
          })
        },
        subject: { kind: "item", typeToken: profile.deviceType }
      })
    }))
  };
}
