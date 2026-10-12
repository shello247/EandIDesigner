import type { PreviewSource } from "@/features/schematic_preview/api/public";
import { deviceTypeFamily } from "@/shared/device-classification/device-types";
import type { PanelWiringSourcePackage } from "@/features/drawing_panel_wiring/api/public";
import { enrichPanelSchematicSource } from "./drawing-panel-schematic-source";
import type { DrawingModel } from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import { getRenderableSymbolForPlacement } from "./drawing-generated-symbols";

/** Owned by drawing_canvas: the preview receives a plain, versioned, read-only DTO. */
export function buildDrawingSchematicPreview(model: DrawingModel, sheetId: string, symbols: ApprovedDrawingSymbol[], panelSource?: PanelWiringSourcePackage): PreviewSource {
  const sheet = model.sheets.find(s => s.id === sheetId);
  const source: PreviewSource = { id: sheetId, title: sheet?.name ?? "Unavailable sheet", provenance: "drawing", revision: "Current editor state · original symbol versions retained", devices: [], wires: [], limitations: [] };
  if (!sheet || sheet.kind !== "drawing") { source.limitations.push("Select a working electrical drawing sheet to preview."); return source; }
  if (sheet.placements.some(p => p.layoutKind === "backplane")) { source.limitations.push("This is a physical mounting layout. Open an electrical overview sheet with explicit connections to preview its circuit."); return source; }
  for (const p of sheet.placements) {
    if (p.layoutKind || p.enclosure || p.panelPatternLegend) continue;
    const asset = model.assets.find(a => a.id === p.assetId);
    const symbol = getRenderableSymbolForPlacement(p, symbols, model.assets);
    if (!symbol) source.limitations.push(`${p.tag}: exact symbol version ${p.versionId} is unavailable.`);
    const type = asset?.type && asset.type !== "other" ? asset.type : symbol?.metadata.panelWiring?.assetType;
    const kind = type && deviceTypeFamily(type) === "power_supply" ? "power_supply" : type === "terminal_block" || p.role === "terminal_block" ? "terminal_block" : "generic";
    const terminals = (symbol?.metadata.terminals ?? []).flatMap(t => {
      const anchors = symbol?.metadata.anchors.filter(a => a.key === t.anchorKey) ?? [];
      if (anchors.length !== 1) { source.limitations.push(`${p.tag}:${t.label}: terminal anchor is missing or ambiguous.`); return []; }
      return [{ key: t.key, label: t.label, anchorKey: t.anchorKey, role: t.electricalRole, x: anchors[0].x, y: anchors[0].y }];
    });
    source.devices.push({ id: p.id, assetId: p.assetId, versionId: p.versionId, tag: asset?.tag ?? p.tag, title: asset?.title ?? p.title ?? symbol?.displayName ?? p.tag, kind, x: p.x, y: p.y, terminals, continuity: (symbol?.metadata.electricalTopology?.permanentContinuityGroups ?? []).map(g => ({ id: g.key, terminalKeys: [...g.terminalKeys] })) });
  }
  // Keep every overview connection, including unresolved ones, for explicit gap reporting.
  source.wires = sheet.connections.map(c => ({ id: c.id, label: c.wireId || c.label || c.id, from: { ...c.from }, to: { ...c.to } }));
  if (sheet.panelDrawingContext) return enrichPanelSchematicSource(source, model, sheet, symbols, panelSource);
  if (sheet.connections.some(c => c.panelConnectionId || c.panelPatternId)) source.integrityIssues = ["Panel route references require a Detailed Panel context to verify canonical endpoints."];
  return source;
}
