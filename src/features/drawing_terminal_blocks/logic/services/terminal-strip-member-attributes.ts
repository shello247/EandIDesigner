import {
  cloneEngineeringAttributesForNewTerminalStripMember,
  resolveEngineeringFacts,
  type EngineeringAttributeContainer,
  type EngineeringAttributeValue,
  type EngineeringFact,
  type EngineeringFactDiagnostic,
  type EngineeringAttributeSubject
} from "@/features/engineering_attributes/api/public";
import type {
  StructuredTerminalStrip,
  StructuredTerminalStripMember
} from "../../data/schema";

export type StructuredTerminalStripMemberFactProjection = {
  assetId: string;
  memberToken: string;
  memberId: string;
  role: StructuredTerminalStripMember["role"];
  facts: EngineeringFact[];
  diagnostics: EngineeringFactDiagnostic[];
};

export function structuredTerminalStripMemberAttributeSubject(
  member: Pick<StructuredTerminalStripMember, "role">
): EngineeringAttributeSubject {
  return {
    kind: "structured_terminal_strip_member",
    role: member.role
  };
}

export function resolveStructuredTerminalStripMemberFacts(
  member: StructuredTerminalStripMember
) {
  return resolveEngineeringFacts({
    container: member.engineeringAttributes,
    subject: structuredTerminalStripMemberAttributeSubject(member)
  });
}

export function resolveStructuredTerminalStripMemberPurpose(
  member: StructuredTerminalStripMember
): string | undefined {
  const purpose = resolveStructuredTerminalStripMemberFacts(member).facts.find(
    (fact) => fact.definitionKey === "engineering_purpose"
  );
  if (purpose?.kind === "text" && typeof purpose.value === "string") {
    return purpose.value.trim() || undefined;
  }
  return member.description?.trim() || undefined;
}

export function resolveStructuredTerminalStripMemberForKey(
  strip: StructuredTerminalStrip,
  namespacedKey: string
): StructuredTerminalStripMember | undefined {
  const separatorIndex = namespacedKey.indexOf(".");
  const memberToken =
    separatorIndex >= 0 ? namespacedKey.slice(0, separatorIndex) : namespacedKey;
  return strip.members.find((member) => member.token === memberToken);
}

export function countStructuredTerminalStripMemberAttributes(
  member: StructuredTerminalStripMember
): number {
  const values = member.engineeringAttributes?.values ?? [];
  const hasPurposeAttribute = values.some(
    (value) => value.definitionKey === "engineering_purpose"
  );
  return values.length + (hasPurposeAttribute || !member.description?.trim() ? 0 : 1);
}

export function retainStructuredTerminalStripMemberPurpose(
  member: StructuredTerminalStripMember
): EngineeringAttributeContainer | undefined {
  const purpose = member.engineeringAttributes?.values.find(
    (value) => value.definitionKey === "engineering_purpose"
  );
  return purpose
    ? {
        version: 1,
        values: [
          {
            ...purpose,
            source: { ...purpose.source }
          } as EngineeringAttributeValue
        ]
      }
    : undefined;
}

export function cloneStructuredTerminalStripMemberAttributes(
  member: StructuredTerminalStripMember
): EngineeringAttributeContainer | undefined {
  return cloneEngineeringAttributesForNewTerminalStripMember({
    container: member.engineeringAttributes,
    role: member.role
  });
}

export function projectStructuredTerminalStripMemberFacts(input: {
  assetId: string;
  strip: StructuredTerminalStrip;
}): StructuredTerminalStripMemberFactProjection[] {
  return input.strip.members.map((member) => {
    const projection = resolveStructuredTerminalStripMemberFacts(member);
    return {
      assetId: input.assetId,
      memberToken: member.token,
      memberId: member.id,
      role: member.role,
      facts: projection.facts,
      diagnostics: projection.diagnostics
    };
  });
}
