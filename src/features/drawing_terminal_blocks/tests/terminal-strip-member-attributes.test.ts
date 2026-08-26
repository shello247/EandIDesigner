import { describe, expect, it } from "vitest";
import {
  cloneStructuredTerminalStrip,
  countStructuredTerminalStripMemberAttributes,
  projectStructuredTerminalStripMemberFacts,
  resolveStructuredTerminalStripMemberForKey,
  resolveStructuredTerminalStripMemberPurpose,
  retainStructuredTerminalStripMemberPurpose,
  structuredTerminalStripSchema,
  type StructuredTerminalStrip,
  type StructuredTerminalStripMember
} from "../api/public";

const engineerSource = { kind: "engineer_entered" as const };

function member(
  overrides: Partial<StructuredTerminalStripMember> = {}
): StructuredTerminalStripMember {
  return {
    id: "member_m02",
    token: "M02",
    symbolId: "pt_2_5",
    versionId: "pt_2_5_v1",
    role: "electrical",
    designation: "1",
    ...overrides
  };
}

function stripWith(memberValue: StructuredTerminalStripMember): StructuredTerminalStrip {
  return {
    kind: "structured_terminal_strip",
    nextMemberNumber: 3,
    members: [memberValue]
  };
}

describe("terminal-strip member engineering attributes", () => {
  it("keeps legacy descriptions readable without rewriting them", () => {
    const legacy = member({ description: "Tank level alarm" });

    expect(resolveStructuredTerminalStripMemberPurpose(legacy)).toBe(
      "Tank level alarm"
    );
    expect(countStructuredTerminalStripMemberAttributes(legacy)).toBe(1);
    expect(legacy.engineeringAttributes).toBeUndefined();
  });

  it("prefers a valid Purpose attribute over the legacy description", () => {
    const attributed = member({
      description: "Legacy purpose",
      engineeringAttributes: {
        version: 1,
        values: [
          {
            definitionKey: "engineering_purpose",
            definitionVersion: 1,
            kind: "text",
            value: "Controlled purpose",
            source: engineerSource
          },
          {
            definitionKey: "nominal_voltage",
            definitionVersion: 1,
            kind: "quantity",
            value: 24,
            unit: "V",
            source: engineerSource
          }
        ]
      }
    });

    expect(resolveStructuredTerminalStripMemberPurpose(attributed)).toBe(
      "Controlled purpose"
    );
    expect(countStructuredTerminalStripMemberAttributes(attributed)).toBe(2);
    expect(retainStructuredTerminalStripMemberPurpose(attributed)?.values).toHaveLength(1);
  });

  it("resolves namespaced anchors and projects facts by permanent token", () => {
    const attributed = member({
      engineeringAttributes: {
        version: 1,
        values: [
          {
            definitionKey: "rated_current",
            definitionVersion: 1,
            kind: "quantity",
            value: 250,
            unit: "mA",
            source: engineerSource
          }
        ]
      }
    });
    const strip = stripWith(attributed);

    expect(resolveStructuredTerminalStripMemberForKey(strip, "M02.2")?.id).toBe(
      attributed.id
    );
    expect(
      projectStructuredTerminalStripMemberFacts({
        assetId: "asset_tb_104",
        strip
      })[0]
    ).toMatchObject({
      assetId: "asset_tb_104",
      memberToken: "M02",
      facts: [{ definitionKey: "rated_current", value: 0.25, unit: "A" }]
    });
  });

  it("clones technical facts while clearing Purpose and legacy descriptions", () => {
    const sourceMember = member({
      description: "Legacy purpose",
      engineeringAttributes: {
        version: 1,
        values: [
          {
            definitionKey: "engineering_purpose",
            definitionVersion: 1,
            kind: "text",
            value: "Controlled purpose",
            source: engineerSource
          },
          {
            definitionKey: "nominal_voltage",
            definitionVersion: 1,
            kind: "quantity",
            value: 24,
            unit: "V",
            source: engineerSource
          }
        ]
      }
    });

    const clone = cloneStructuredTerminalStrip(stripWith(sourceMember));
    const clonedMember = clone.members[0];

    expect(clonedMember.id).not.toBe(sourceMember.id);
    expect(clonedMember.token).toBe(sourceMember.token);
    expect(clonedMember.description).toBeUndefined();
    expect(clonedMember.engineeringAttributes?.values).toEqual([
      expect.objectContaining({ definitionKey: "nominal_voltage" })
    ]);
    expect(sourceMember.description).toBe("Legacy purpose");
  });

  it("accepts optional member attributes without normalizing legacy members", () => {
    const legacy = stripWith(member({ description: "Legacy" }));
    const parsed = structuredTerminalStripSchema.parse(legacy);

    expect(parsed).toEqual(legacy);
    expect(parsed.members[0].engineeringAttributes).toBeUndefined();
  });
});
