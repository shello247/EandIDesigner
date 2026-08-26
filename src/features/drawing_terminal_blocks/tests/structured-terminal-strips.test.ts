import { describe, expect, it } from "vitest";
import type { SymbolMetadata } from "@/features/symbol_registry/data/schema";
import {
  applyStructuredTerminalStripMemberOrders,
  createDefaultStructuredTerminalStrip,
  namespaceStructuredTerminalKey,
  projectStructuredTerminalStripTerminals,
  removeStructuredTerminalStripMember,
  reorderStructuredTerminalStripMember,
  type TerminalStripMemberSymbol
} from "../api/public";

function symbol({
  id,
  role,
  width,
  height,
  datum,
  isDefault = false,
  terminalKey
}: {
  id: string;
  role: "electrical" | "end_bracket" | "accessory";
  width: number;
  height: number;
  datum: number;
  isDefault?: boolean;
  terminalKey?: string;
}): TerminalStripMemberSymbol {
  const terminals: SymbolMetadata["terminals"] = terminalKey
    ? [
        {
          key: terminalKey,
          label: terminalKey,
          anchorKey: `anchor_${terminalKey}`,
          panelSide: "single",
          requiredForWiring: true
        }
      ]
    : [];
  const anchors: SymbolMetadata["anchors"] = terminalKey
    ? [
        {
          key: `anchor_${terminalKey}`,
          x: 5,
          y: 10,
          kind: "terminal"
        }
      ]
    : [];

  return {
    symbolId: id,
    versionId: `${id}_v1`,
    displayName: id,
    svg: '<svg viewBox="0 0 10 20"/>',
    metadata: {
      symbolKey: id,
      displayName: id,
      category: "terminal_block",
      layoutUsage: "panel_layout",
      physicalWidthMm: width,
      physicalHeightMm: height,
      mountingType: "din_rail",
      terminalStripCapability: {
        role,
        railDatumMm: datum,
        defaultForNewStrips: isDefault || undefined
      },
      viewBox: { x: 0, y: 0, width: 10, height: 20 },
      terminals,
      anchors
    }
  };
}

const electrical = symbol({
  id: "pt_2_5",
  role: "electrical",
  width: 5.2,
  height: 35.3,
  datum: 22,
  isDefault: true,
  terminalKey: "1"
});
const bracket = symbol({
  id: "ss2",
  role: "end_bracket",
  width: 8,
  height: 52.4,
  datum: 31,
  isDefault: true
});

describe("structured terminal strips", () => {
  it("creates two brackets and five distinct electrical members", () => {
    const strip = createDefaultStructuredTerminalStrip([electrical, bracket]);

    expect(strip.members).toHaveLength(7);
    expect(strip.members.map((member) => member.token)).toEqual([
      "M01",
      "M02",
      "M03",
      "M04",
      "M05",
      "M06",
      "M07"
    ]);
    expect(
      strip.members
        .filter((member) => member.role === "electrical")
        .map((member) => member.designation)
    ).toEqual(["1", "2", "3", "4", "5"]);
    expect(strip.nextMemberNumber).toBe(8);
  });

  it("never reuses a deleted member token", () => {
    const strip = createDefaultStructuredTerminalStrip([electrical, bracket]);
    const withoutM03 = removeStructuredTerminalStripMember(strip, "terminal_strip_member_m03");

    expect(withoutM03.nextMemberNumber).toBe(8);
    expect(withoutM03.members.some((member) => member.token === "M03")).toBe(false);
  });

  it("reorders members without changing canonical terminal keys", () => {
    const strip = createDefaultStructuredTerminalStrip([electrical, bracket]);
    const before = projectStructuredTerminalStripTerminals(strip, [electrical, bracket]);
    const reordered = reorderStructuredTerminalStripMember(
      strip,
      "terminal_strip_member_m03",
      4
    );
    const after = projectStructuredTerminalStripTerminals(reordered, [electrical, bracket]);

    expect(after.terminals.map((terminal) => terminal.key).sort()).toEqual(
      before.terminals.map((terminal) => terminal.key).sort()
    );
    expect(namespaceStructuredTerminalKey("M03", "LINE")).toBe("M03.LINE");
    expect(
      reordered.members
        .filter((member) => member.role === "electrical")
        .map((member) => [member.token, member.designation])
    ).toEqual([
      ["M02", "1"],
      ["M04", "2"],
      ["M05", "3"],
      ["M03", "4"],
      ["M06", "5"]
    ]);
  });

  it("derives electrical order without mutating legacy input", () => {
    const strip = createDefaultStructuredTerminalStrip([electrical, bracket]);
    const legacy = {
      ...strip,
      members: strip.members.map((member) =>
        member.token === "M03" ? { ...member, designation: "8" } : member
      )
    };

    const ordered = applyStructuredTerminalStripMemberOrders(legacy);

    expect(
      legacy.members.find((member) => member.token === "M03")?.designation
    ).toBe("8");
    expect(
      ordered.members.find((member) => member.token === "M03")?.designation
    ).toBe("2");
  });

  it("rejects a bracket positioned inside the strip", () => {
    const strip = createDefaultStructuredTerminalStrip([electrical, bracket]);

    expect(() =>
      reorderStructuredTerminalStripMember(strip, "terminal_strip_member_m01", 2)
    ).toThrow(/outer edges/i);
  });
});
