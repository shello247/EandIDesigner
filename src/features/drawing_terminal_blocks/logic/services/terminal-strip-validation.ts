import type { SymbolMetadata } from "@/features/symbol_registry/data/schema";
import type { StructuredTerminalStrip } from "../../data/schema";

export type TerminalStripMemberSymbol = {
  symbolId: string;
  versionId: string;
  displayName: string;
  svg: string;
  metadata: SymbolMetadata;
  selectable?: boolean;
};

export type TerminalStripCapabilityValidation =
  | { ok: true }
  | { ok: false; error: string };

export function validateTerminalStripMemberSymbol(
  symbol: TerminalStripMemberSymbol
): TerminalStripCapabilityValidation {
  const capability = symbol.metadata.terminalStripCapability;
  if (!capability) {
    return { ok: false, error: "The symbol is not enabled for terminal strips." };
  }

  if (
    symbol.metadata.layoutUsage === "wiring" ||
    symbol.metadata.mountingType !== "din_rail" ||
    !symbol.metadata.physicalWidthMm ||
    !symbol.metadata.physicalHeightMm
  ) {
    return {
      ok: false,
      error:
        "Terminal-strip symbols require panel-layout use, physical dimensions, and DIN-rail mounting."
    };
  }

  if (
    capability.railDatumMm < 0 ||
    capability.railDatumMm > symbol.metadata.physicalHeightMm
  ) {
    return {
      ok: false,
      error: "The symbol DIN-rail datum falls outside its physical height."
    };
  }

  if (capability.role === "electrical" && symbol.metadata.terminals.length === 0) {
    return {
      ok: false,
      error: "Electrical terminal-strip members require at least one terminal."
    };
  }

  if (capability.role !== "electrical" && symbol.metadata.terminals.length > 0) {
    return {
      ok: false,
      error: "Terminal-strip accessories and end brackets cannot expose terminals."
    };
  }

  return { ok: true };
}

export function listEligibleTerminalStripSymbols(
  symbols: TerminalStripMemberSymbol[]
): TerminalStripMemberSymbol[] {
  return symbols.filter(
    (symbol) =>
      symbol.selectable !== false && validateTerminalStripMemberSymbol(symbol).ok
  );
}

export function resolveTerminalStripDefaults(
  symbols: TerminalStripMemberSymbol[]
):
  | {
      ok: true;
      electrical: TerminalStripMemberSymbol;
      endBracket: TerminalStripMemberSymbol;
    }
  | { ok: false; error: string } {
  const eligible = listEligibleTerminalStripSymbols(symbols);
  const electrical = eligible.filter(
    (symbol) =>
      symbol.metadata.terminalStripCapability?.role === "electrical" &&
      symbol.metadata.terminalStripCapability.defaultForNewStrips
  );
  const endBrackets = eligible.filter(
    (symbol) =>
      symbol.metadata.terminalStripCapability?.role === "end_bracket" &&
      symbol.metadata.terminalStripCapability.defaultForNewStrips
  );

  if (electrical.length !== 1) {
    return {
      ok: false,
      error:
        electrical.length === 0
          ? "Configure one approved electrical terminal as the default for new strips."
          : "Only one approved electrical terminal may be the default for new strips."
    };
  }

  if (endBrackets.length !== 1) {
    return {
      ok: false,
      error:
        endBrackets.length === 0
          ? "Configure one approved end bracket as the default for new strips."
          : "Only one approved end bracket may be the default for new strips."
    };
  }

  return { ok: true, electrical: electrical[0], endBracket: endBrackets[0] };
}

export function validateStructuredTerminalStripMembers(
  strip: StructuredTerminalStrip,
  symbols: TerminalStripMemberSymbol[]
): string[] {
  const symbolByVersion = new Map(
    symbols.map((symbol) => [`${symbol.symbolId}:${symbol.versionId}`, symbol])
  );
  const errors: string[] = [];

  strip.members.forEach((member) => {
    const symbol = symbolByVersion.get(`${member.symbolId}:${member.versionId}`);
    if (!symbol) {
      errors.push(`${member.token}: pinned symbol version is unavailable.`);
      return;
    }
    const validation = validateTerminalStripMemberSymbol(symbol);
    if (!validation.ok) {
      errors.push(`${member.token}: ${validation.error}`);
      return;
    }
    if (symbol.metadata.terminalStripCapability?.role !== member.role) {
      errors.push(`${member.token}: the stored role no longer matches the symbol capability.`);
    }
  });

  return errors;
}
