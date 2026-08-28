import type {
  SymbolAnchor,
  SymbolElectricalTopology,
  SymbolTerminal
} from "@/features/symbol_registry/data/schema";
import type { StructuredTerminalStrip } from "../../data/schema";
import {
  composeTerminalStripGeometry,
  type TerminalStripCompositionGeometry
} from "./terminal-strip-composition-geometry";
import type { TerminalStripMemberSymbol } from "./terminal-strip-validation";
import { applyStructuredTerminalStripMemberOrders } from "./structured-terminal-strip";

export type StructuredTerminalStripTerminalProjection = {
  geometry: TerminalStripCompositionGeometry;
  anchors: SymbolAnchor[];
  terminals: SymbolTerminal[];
  electricalTopology?: SymbolElectricalTopology;
};

export function namespaceStructuredTerminalKey(
  token: string,
  rawKey: string
): string {
  return `${token}.${rawKey}`;
}

export function projectStructuredTerminalStripTerminals(
  strip: StructuredTerminalStrip,
  symbols: TerminalStripMemberSymbol[]
): StructuredTerminalStripTerminalProjection {
  const orderedStrip = applyStructuredTerminalStripMemberOrders(strip);
  const geometry = composeTerminalStripGeometry(orderedStrip, symbols);
  const memberById = new Map(
    orderedStrip.members.map((member) => [member.id, member])
  );
  const anchors: SymbolAnchor[] = [];
  const projectedAnchorKeys = new Set<string>();
  const terminals: SymbolTerminal[] = [];
  const permanentContinuityGroups: SymbolElectricalTopology["permanentContinuityGroups"] = [];

  geometry.members.forEach((layout) => {
    const member = memberById.get(layout.memberId);
    const symbol = layout.symbol;
    if (!member || !symbol || member.role !== "electrical") {
      return;
    }

    const viewBox = symbol.metadata.viewBox;
    const scale = Math.min(
      layout.widthMm / viewBox.width,
      layout.heightMm / viewBox.height
    );
    const renderedWidth = viewBox.width * scale;
    const renderedHeight = viewBox.height * scale;
    const offsetX = layout.xMm + (layout.widthMm - renderedWidth) / 2;
    const offsetY = layout.yMm + (layout.heightMm - renderedHeight) / 2;
    const anchorByKey = new Map(symbol.metadata.anchors.map((anchor) => [anchor.key, anchor]));

    symbol.metadata.terminals.forEach((terminal) => {
      const rawAnchor = anchorByKey.get(terminal.anchorKey);
      if (!rawAnchor) {
        return;
      }
      const key = namespaceStructuredTerminalKey(member.token, terminal.key);
      const anchorKey = namespaceStructuredTerminalKey(member.token, rawAnchor.key);
      if (!projectedAnchorKeys.has(anchorKey)) {
        projectedAnchorKeys.add(anchorKey);
        anchors.push({
          key: anchorKey,
          kind: rawAnchor.kind,
          x: Number((offsetX + (rawAnchor.x - viewBox.x) * scale).toFixed(4)),
          y: Number((offsetY + (rawAnchor.y - viewBox.y) * scale).toFixed(4))
        });
      }
      terminals.push({
        ...terminal,
        key,
        label: member.designation
          ? `${member.designation} · ${terminal.label}`
          : `${member.token} · ${terminal.label}`,
        anchorKey
      });
    });

    for (const group of
      symbol.metadata.electricalTopology?.permanentContinuityGroups ?? []) {
      permanentContinuityGroups.push({
        key: namespaceStructuredTerminalKey(member.token, group.key),
        label: group.label,
        terminalKeys: group.terminalKeys.map((terminalKey) =>
          namespaceStructuredTerminalKey(member.token, terminalKey)
        )
      });
    }
  });

  return {
    geometry,
    anchors,
    terminals,
    electricalTopology:
      permanentContinuityGroups.length > 0
        ? { version: 1, permanentContinuityGroups }
        : undefined
  };
}
