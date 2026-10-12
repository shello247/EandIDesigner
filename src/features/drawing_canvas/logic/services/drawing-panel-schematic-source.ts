import type { PreviewSource, PreviewEndpoint } from "@/features/schematic_preview/api/public";
import type { PanelWiringSourcePackage, PanelTerminalSideRef } from "@/features/drawing_panel_wiring/api/public";
import type { DrawingModel } from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import { createPanelWiringSource } from "../../api/panel-wiring-contracts";

const identity = (ref: PanelTerminalSideRef | undefined) => ref ? JSON.stringify([ref.assetId, ref.terminalKey, ref.side]) : undefined;

/** Enrich the new preview DTO, never the editor model or canonical wire records. */
export function enrichPanelSchematicSource(source: PreviewSource, model: DrawingModel, sheet: DrawingModel["sheets"][number], symbols: ApprovedDrawingSymbol[], preparedSource?: PanelWiringSourcePackage): PreviewSource {
  const panelId = sheet.panelDrawingContext!.panelAssetId;
  const panel = preparedSource ?? createPanelWiringSource(model, symbols);
  const panelSheet = panel.sheets.find(s => s.id === sheet.id);
  source.integrityIssues = [];
  source.scopeNotes = ["Current sheet only. Outline View is the original approved-symbol canvas. The schematic uses its pinned symbols and canonical panel-wire endpoints."];
  if (panelSheet?.panelDrawingContext?.panelAssetId !== panelId) source.integrityIssues.push("The prepared panel context does not match this sheet.");
  for (const device of source.devices) {
    const occurrence = panelSheet?.occurrences.find(o => o.placementId === device.id);
    const valid = occurrence?.assetId === device.assetId && occurrence?.versionId === device.versionId && occurrence?.containerAssetId === panelId && occurrence?.occurrenceKind === "wiring";
    for (const terminal of device.terminals) {
      const matches = valid ? occurrence!.terminals.flatMap(t => t.status === "resolved" ? t.anchors.filter(a => a.anchorKey === terminal.anchorKey && a.sideHint && t.terminalKey === terminal.key).map(a => ({ assetId: device.assetId!, terminalKey: t.terminalKey, side: a.sideHint! })) : []) : [];
      if (matches.length !== 1) source.integrityIssues.push(`${device.tag}:${terminal.label}: canonical terminal-side mapping is missing or ambiguous.`);
      else terminal.canonical = matches[0];
    }
    // Distinct sides of one logical terminal remain distinct projection ports.
    const repeated = new Set(device.terminals.filter(t => device.terminals.filter(o => o.key === t.key).length > 1).map(t => t.key));
    for (const terminal of device.terminals) if (repeated.has(terminal.key) && terminal.canonical) {
      terminal.key = `${terminal.key}/${terminal.canonical.side}`;
      terminal.label = `${terminal.label}/${terminal.canonical.side}`;
    }
    device.continuity = device.continuity.map(g => ({ ...g, terminalKeys: g.terminalKeys.flatMap(k => {
      const matches = device.terminals.filter(t => (t.canonical?.terminalKey ?? t.key) === k);
      return matches.length ? matches.map(t => t.key) : [k];
    }) }));
  }
  const endpoint = (e: PreviewEndpoint): PreviewEndpoint => {
    const matches = source.devices.filter(d => d.id === e.placementId).flatMap(d => d.terminals.filter(t => t.anchorKey === e.anchorKey));
    return { ...e, canonical: matches.length === 1 ? matches[0].canonical : undefined };
  };
  const wires = panel.panelWiring?.internalWires ?? [];
  const represented = new Set<string>();
  source.wires = sheet.connections.map(route => {
    const from = endpoint(route.from), to = endpoint(route.to);
    const matches = wires.filter(w => w.id === route.panelConnectionId && w.panelAssetId === panelId);
    const wire = matches.length === 1 ? matches[0] : undefined;
    let validationIssue: string | undefined;
    if (!wire) validationIssue = "No unique canonical panel wire record matches this route; structural/pattern-only routes require another representation.";
    else {
      const pair = [identity(from.canonical), identity(to.canonical)].sort();
      const expected = [identity(wire.from), identity(wire.to)].sort();
      if (pair.some(k => !k) || JSON.stringify(pair) !== JSON.stringify(expected)) validationIssue = "The displayed route endpoints do not match the canonical asset, terminal and side pair.";
      if (represented.has(wire.id)) source.integrityIssues!.push(`${wire.wireId}: multiple route occurrences on this sheet require review.`);
      represented.add(wire.id);
    }
    return { id: route.id, label: wire?.wireId ?? route.wireId ?? route.label ?? route.id, canonicalWireId: wire?.id, from, to, validationIssue };
  });
  const visible = new Set(source.devices.map(d => d.assetId));
  const relevant = wires.filter(w => w.panelAssetId === panelId && (visible.has(w.from.assetId) || visible.has(w.to.assetId)));
  const offSheet = relevant.filter(w => !visible.has(w.from.assetId) || !visible.has(w.to.assetId));
  if (offSheet.length) source.scopeNotes.push(`${offSheet.length} additional panel wire(s) connect to equipment outside this sheet. Cross-sheet references are not rendered in this preview.`);
  for (const wire of relevant) if (visible.has(wire.from.assetId) && visible.has(wire.to.assetId) && !represented.has(wire.id)) source.integrityIssues.push(`${wire.wireId}: canonical wire joins visible equipment but has no displayed route on this sheet.`);
  if ([...(panel.panelWiring?.bridges ?? []), ...(panel.panelWiring?.bonds ?? [])].some(p => p.panelAssetId === panelId)) source.scopeNotes.push("Panel bridge/bond patterns are not assessed here; the preview checks displayed wire endpoints and symbol-declared permanent continuity only.");
  return source;
}
