import type { StructuredTerminalStrip } from "../../data/schema";
import type { TerminalStripMemberSymbol } from "./terminal-strip-validation";

export type TerminalStripMemberGeometry = {
  memberId: string;
  token: string;
  symbol?: TerminalStripMemberSymbol;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  railDatumMm: number;
  missing: boolean;
};

export type TerminalStripCompositionGeometry = {
  widthMm: number;
  heightMm: number;
  railDatumMm: number;
  members: TerminalStripMemberGeometry[];
  missingMemberTokens: string[];
};

function round(value: number): number {
  return Number(value.toFixed(2));
}

export function composeTerminalStripGeometry(
  strip: StructuredTerminalStrip,
  symbols: TerminalStripMemberSymbol[]
): TerminalStripCompositionGeometry {
  const symbolByVersion = new Map(
    symbols.map((symbol) => [`${symbol.symbolId}:${symbol.versionId}`, symbol])
  );
  const resolved = strip.members.map((member) => {
    const symbol = symbolByVersion.get(`${member.symbolId}:${member.versionId}`);
    const capability = symbol?.metadata.terminalStripCapability;
    return {
      member,
      symbol,
      widthMm: symbol?.metadata.physicalWidthMm ?? 8,
      heightMm: symbol?.metadata.physicalHeightMm ?? 20,
      datumMm: capability?.railDatumMm ?? 10,
      missing: !symbol || !capability
    };
  });
  const railDatumMm = Math.max(0, ...resolved.map((item) => item.datumMm));
  const belowRailMm = Math.max(
    0,
    ...resolved.map((item) => item.heightMm - item.datumMm)
  );
  let xMm = 0;
  const members = resolved.map((item) => {
    const geometry: TerminalStripMemberGeometry = {
      memberId: item.member.id,
      token: item.member.token,
      symbol: item.symbol,
      xMm: round(xMm),
      yMm: round(railDatumMm - item.datumMm),
      widthMm: round(item.widthMm),
      heightMm: round(item.heightMm),
      railDatumMm: round(item.datumMm),
      missing: item.missing
    };
    xMm += item.widthMm;
    return geometry;
  });

  return {
    widthMm: round(xMm),
    heightMm: round(railDatumMm + belowRailMm),
    railDatumMm: round(railDatumMm),
    members,
    missingMemberTokens: members
      .filter((member) => member.missing)
      .map((member) => member.token)
  };
}
