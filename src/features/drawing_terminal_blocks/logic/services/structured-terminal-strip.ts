import { structuredTerminalStripSchema } from "../../data/schema";
import type {
  StructuredTerminalStrip,
  StructuredTerminalStripMember,
  StructuredTerminalStripMemberRole
} from "../../data/schema";
import {
  resolveTerminalStripDefaults,
  type TerminalStripMemberSymbol
} from "./terminal-strip-validation";
import { cloneStructuredTerminalStripMemberAttributes } from "./terminal-strip-member-attributes";

export const DEFAULT_STRUCTURED_TERMINAL_COUNT = 5;

function copiedMemberId(memberId: string, index: number): string {
  const suffix = `_copy_${String(index + 1).padStart(2, "0")}`;
  return `${memberId.slice(0, Math.max(1, 120 - suffix.length))}${suffix}`;
}

/**
 * Creates an independent composition while retaining the permanent engineering
 * tokens used to namespace terminal identities inside the new asset.
 */
export function cloneStructuredTerminalStrip(
  source: StructuredTerminalStrip
): StructuredTerminalStrip {
  return structuredTerminalStripSchema.parse({
    ...source,
    members: source.members.map((member, index) => ({
      ...member,
      id: copiedMemberId(member.id, index),
      description: undefined,
      engineeringAttributes:
        cloneStructuredTerminalStripMemberAttributes(member),
      componentSelections: member.componentSelections
        ? structuredClone(member.componentSelections)
        : undefined
    }))
  });
}

export function deriveStructuredTerminalStripMemberOrders(
  strip: StructuredTerminalStrip
): Map<string, number> {
  const orders = new Map<string, number>();
  let order = 0;

  for (const member of strip.members) {
    if (member.role !== "electrical") continue;
    order += 1;
    orders.set(member.id, order);
  }

  return orders;
}

export function applyStructuredTerminalStripMemberOrders(
  strip: StructuredTerminalStrip
): StructuredTerminalStrip {
  const orders = deriveStructuredTerminalStripMemberOrders(strip);

  return {
    ...strip,
    members: strip.members.map((member) => {
      const order = orders.get(member.id);
      if (order !== undefined) {
        const designation = String(order);
        return member.designation === designation
          ? member
          : { ...member, designation };
      }
      if (member.designation === undefined) return member;
      const withoutDesignation = { ...member };
      delete withoutDesignation.designation;
      return withoutDesignation;
    })
  };
}

function formatMemberToken(value: number): string {
  return `M${String(value).padStart(2, "0")}`;
}

function defaultMemberId(token: string): string {
  return `terminal_strip_member_${token.toLowerCase()}`;
}

export function allocateStructuredTerminalStripMember(
  strip: StructuredTerminalStrip,
  symbol: TerminalStripMemberSymbol,
  overrides: Partial<
    Pick<StructuredTerminalStripMember, "engineeringAttributes">
  > = {}
): { strip: StructuredTerminalStrip; member: StructuredTerminalStripMember } {
  const capability = symbol.metadata.terminalStripCapability;
  if (!capability) {
    throw new Error("The selected symbol is not enabled for terminal strips.");
  }

  const token = formatMemberToken(strip.nextMemberNumber);
  const member: StructuredTerminalStripMember = {
    id: defaultMemberId(token),
    token,
    symbolId: symbol.symbolId,
    versionId: symbol.versionId,
    role: capability.role,
    ...overrides
  };

  const nextStrip = applyStructuredTerminalStripMemberOrders({
    ...strip,
    nextMemberNumber: strip.nextMemberNumber + 1,
    members: [...strip.members, member]
  });

  return {
    strip: nextStrip,
    member
  };
}

export function createDefaultStructuredTerminalStrip(
  symbols: TerminalStripMemberSymbol[],
  electricalCount = DEFAULT_STRUCTURED_TERMINAL_COUNT
): StructuredTerminalStrip {
  if (!Number.isInteger(electricalCount) || electricalCount < 1 || electricalCount > 80) {
    throw new Error("Terminal count must be a whole number from 1 to 80.");
  }

  const defaults = resolveTerminalStripDefaults(symbols);
  if (!defaults.ok) {
    throw new Error(defaults.error);
  }

  let strip: StructuredTerminalStrip = {
    kind: "structured_terminal_strip",
    nextMemberNumber: 1,
    members: []
  };

  strip = allocateStructuredTerminalStripMember(strip, defaults.endBracket).strip;
  for (let index = 0; index < electricalCount; index += 1) {
    strip = allocateStructuredTerminalStripMember(strip, defaults.electrical).strip;
  }
  strip = allocateStructuredTerminalStripMember(strip, defaults.endBracket).strip;

  return structuredTerminalStripSchema.parse(strip);
}

export function insertStructuredTerminalStripMember({
  strip,
  symbol,
  index
}: {
  strip: StructuredTerminalStrip;
  symbol: TerminalStripMemberSymbol;
  index: number;
}): StructuredTerminalStrip {
  const allocated = allocateStructuredTerminalStripMember(strip, symbol);
  const withoutAppended = allocated.strip.members.slice(0, -1);
  const boundedIndex = Math.max(0, Math.min(index, withoutAppended.length));
  const members = [
    ...withoutAppended.slice(0, boundedIndex),
    allocated.member,
    ...withoutAppended.slice(boundedIndex)
  ];
  return structuredTerminalStripSchema.parse(
    applyStructuredTerminalStripMemberOrders({ ...allocated.strip, members })
  );
}

export function removeStructuredTerminalStripMember(
  strip: StructuredTerminalStrip,
  memberId: string
): StructuredTerminalStrip {
  return structuredTerminalStripSchema.parse(
    applyStructuredTerminalStripMemberOrders({
      ...strip,
      members: strip.members.filter((member) => member.id !== memberId)
    })
  );
}

export function reorderStructuredTerminalStripMember(
  strip: StructuredTerminalStrip,
  memberId: string,
  targetIndex: number
): StructuredTerminalStrip {
  const currentIndex = strip.members.findIndex((member) => member.id === memberId);
  if (currentIndex < 0) {
    return strip;
  }
  const members = [...strip.members];
  const [member] = members.splice(currentIndex, 1);
  members.splice(Math.max(0, Math.min(targetIndex, members.length)), 0, member);
  return structuredTerminalStripSchema.parse(
    applyStructuredTerminalStripMemberOrders({ ...strip, members })
  );
}

export function isStructuredTerminalStripRoleElectrical(
  role: StructuredTerminalStripMemberRole
): boolean {
  return role === "electrical";
}
