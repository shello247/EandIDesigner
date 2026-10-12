import { describe, expect, it } from "vitest";
import { createDefaultDrawingModel } from "../data/schema";
import { buildDrawingSchematicPreview } from "../logic/services/drawing-schematic-preview";
import { createPowerSupplyExample, projectSchematic } from "@/features/schematic_preview/api/public";
import type { ApprovedDrawingSymbol } from "../types";
import { compareConnectivity } from "@/features/schematic_preview/api/public";

function fixture() {
  const example = createPowerSupplyExample(), model = createDefaultDrawingModel();
  const symbols: ApprovedDrawingSymbol[] = example.devices.map(d => ({ symbolId: d.id, symbolKey: d.id, versionId: d.versionId, versionNumber: 1, displayName: d.title, category: "other", svg: '<svg/>', metadata: { symbolKey: d.id, displayName: d.title, category: "other", viewBox: { x: 0, y: 0, width: 60, height: 100 }, anchors: d.terminals.map(t => ({ key: t.anchorKey, x: t.x, y: t.y, kind: "terminal" })), terminals: d.terminals.map(t => ({ key: t.key, label: t.label, anchorKey: t.anchorKey })), electricalTopology: { version: 1, permanentContinuityGroups: d.continuity.map(g => ({ key: g.id, terminalKeys: [...g.terminalKeys] })) } } }));
  model.assets = example.devices.map(d => ({ id: d.assetId!, tag: d.tag, title: d.title, type: d.kind === "generic" ? "other" : d.kind, symbolId: d.id, versionId: d.versionId }));
  model.sheets[0].placements = example.devices.map(d => ({ id: d.id, assetId: d.assetId, symbolId: d.id, versionId: d.versionId, tag: d.tag, role: "device", x: d.x, y: d.y, rotation: 0, scale: 1 }));
  model.sheets[0].connections = structuredClone(example.wires);
  return { model, symbols, sheetId: model.sheets[0].id };
}
describe("overview source adapter", () => {
  it("retains pinned symbol versions, terminal keys, wire IDs and all original editor state", () => {
    const { model, symbols, sheetId } = fixture(), before = structuredClone(model);
    const source = buildDrawingSchematicPreview(model, sheetId, symbols);
    expect(source.provenance).toBe("drawing"); expect(source.wires).toHaveLength(5);
    expect(projectSchematic(source).connectivityPreserved).toBe(true); expect(model).toEqual(before);
    expect(source.devices[0].continuity[0].terminalKeys).toEqual(["T1", "T2", "T3", "T4"]);
  });
  it("never substitutes the newest symbol when a pinned version is unavailable", () => {
    const { model, symbols, sheetId } = fixture(); symbols[0].versionId = "newer-version";
    const source = buildDrawingSchematicPreview(model, sheetId, symbols);
    expect(source.devices[0].terminals).toHaveLength(0); expect(source.limitations.join(" ")).toContain("exact symbol version");
    expect(projectSchematic(source).connectivityPreserved).toBe(false);
  });
  it("explains missing panel mappings and mounting layout scope without inventing a circuit", () => {
    const { model, symbols, sheetId } = fixture(); model.sheets[0].panelDrawingContext = { kind: "detailed_panel_wiring", panelAssetId: "panel" };
    expect(buildDrawingSchematicPreview(model, sheetId, symbols).integrityIssues?.join(" ")).toContain("terminal-side mapping");
    delete model.sheets[0].panelDrawingContext; model.sheets[0].placements[0].layoutKind = "backplane";
    const source = buildDrawingSchematicPreview(model, sheetId, symbols); expect(source.wires).toEqual([]); expect(source.limitations.join(" ")).toContain("physical mounting layout");
  });
});

function panelFixture() {
  const result = fixture(), { model, symbols } = result, sheet = model.sheets[0];
  model.assets.push({ id: "panel", tag: "PDP-101", title: "Panel", type: "panel" });
  sheet.panelDrawingContext = { kind: "detailed_panel_wiring", panelAssetId: "panel" };
  sheet.placements.forEach(p => { p.containerAssetId = "panel"; });
  const terminal = (e: typeof sheet.connections[number]["from"]) => {
    const p = sheet.placements.find(p => p.id === e.placementId)!;
    const t = symbols.find(s => s.symbolId === p.symbolId && s.versionId === p.versionId)!.metadata.terminals.find(t => t.anchorKey === e.anchorKey)!;
    return { assetId: p.assetId!, terminalKey: t.key, side: "single" as const };
  };
  model.panelWiring = { schemaVersion: 1, terminalMappings: [], bridges: [], bonds: [], internalWires: sheet.connections.map((c, i) => {
    c.panelConnectionId = `canonical-${i}`;
    return { id: c.panelConnectionId, panelAssetId: "panel", wireId: `WIRE-${i + 7}`, from: terminal(c.from), to: terminal(c.to), origin: "engineer" as const };
  }) };
  return result;
}

describe("Detailed Panel source adapter", () => {
  it("uses the approved symbol classification when the asset type is Other, preserving source-relative layout", () => {
    const { model, symbols, sheetId } = panelFixture();
    const ps = model.assets.find(a => a.tag === "PS-101")!;
    ps.type = "other";
    symbols.find(s => s.symbolId === ps.symbolId)!.metadata.panelWiring = { assetType: "power_supply", tagPrefix: "PS" };
    // Unequal spacing in the original outline must not put the output block in the supply column.
    model.sheets[0].placements.find(p => p.tag === "PDB-104")!.x = 270;
    const source = buildDrawingSchematicPreview(model, sheetId, symbols), projection = projectSchematic(source);
    expect(source.devices.find(d => d.tag === "PS-101")!.kind).toBe("power_supply");
    expect(projection.nodes.find(n => n.device.tag === "PDB-104")!.x).toBeGreaterThan(projection.nodes.find(n => n.device.tag === "PS-101")!.x);
    expect(projection.connectivityPreserved).toBe(true);
  });
  it("projects actual canonical wires, exact symbol versions and all terminal identities without changing the drawing", () => {
    const { model, symbols, sheetId } = panelFixture(), before = structuredClone(model);
    const source = buildDrawingSchematicPreview(model, sheetId, symbols), projected = projectSchematic(source);
    expect(source.integrityIssues).toEqual([]); expect(projected.connectivityPreserved).toBe(true);
    expect(source.wires).toHaveLength(5); expect(source.wires[0].canonicalWireId).toBe("canonical-0");
    expect(source.wires[0].label).toBe("WIRE-7");
    expect(source.wires[0].from.canonical).toEqual(model.panelWiring!.internalWires[0].from);
    expect(projected.nodes.flatMap(n => n.ports).every(t => t.canonical?.side === "single")).toBe(true);
    expect(model).toEqual(before);
  });
  it("accepts reversed graphical orientation while preserving the canonical pair", () => {
    const { model, symbols, sheetId } = panelFixture(), route = model.sheets[0].connections[0];
    [route.from, route.to] = [route.to, route.from];
    const source = buildDrawingSchematicPreview(model, sheetId, symbols);
    expect(projectSchematic(source).connectivityPreserved).toBe(true);
    expect(source.wires[0].from.canonical).toEqual(model.panelWiring!.internalWires[0].to);
  });
  it("does not pass a matching visible line whose canonical endpoint or side differs", () => {
    const { model, symbols, sheetId } = panelFixture();
    model.panelWiring!.internalWires[0].from.side = "external";
    const source = buildDrawingSchematicPreview(model, sheetId, symbols), projected = projectSchematic(source);
    expect(projected.connectivityPreserved).toBe(false); expect(projected.wires).toHaveLength(4);
    expect(source.wires[0].validationIssue).toContain("side pair");
  });
  it("reports a missing record and a missing on-sheet route separately", () => {
    const { model, symbols, sheetId } = panelFixture();
    model.sheets[0].connections[0].panelConnectionId = "missing";
    const source = buildDrawingSchematicPreview(model, sheetId, symbols);
    expect(source.wires[0].validationIssue).toContain("No unique");
    expect(source.integrityIssues?.join(" ")).toContain("no displayed route");
    expect(projectSchematic(source).connectivityPreserved).toBe(false);
  });
  it("keeps off-sheet wires explicit in scope without adding fictional devices", () => {
    const { model, symbols, sheetId } = panelFixture();
    model.panelWiring!.internalWires.push({ ...model.panelWiring!.internalWires[0], id: "offsheet", wireId: "004", to: { assetId: "outside", terminalKey: "L", side: "single" } });
    const source = buildDrawingSchematicPreview(model, sheetId, symbols);
    expect(source.devices).toHaveLength(6); expect(source.wires).toHaveLength(5);
    expect(source.scopeNotes?.join(" ")).toContain("1 additional");
    expect(projectSchematic(source).connectivityPreserved).toBe(true);
  });
  it("preserves separate internal and external sides of a logical terminal", () => {
    const { model, symbols, sheetId } = panelFixture(), symbol = symbols[0], t = symbol.metadata.terminals[0];
    t.panelSide = "internal";
    symbol.metadata.terminals.push({ ...t, anchorKey: "external-anchor", panelSide: "external" });
    symbol.metadata.anchors.push({ key: "external-anchor", x: 0, y: 0, kind: "terminal" });
    model.panelWiring!.internalWires[0].from.side = "internal";
    const source = buildDrawingSchematicPreview(model, sheetId, symbols);
    expect(projectSchematic(source).connectivityPreserved).toBe(true);
    expect(source.devices[0].terminals.filter(p => p.canonical?.terminalKey === t.key).map(p => p.canonical!.side).sort()).toEqual(["external", "internal"]);
  });
  it("includes canonical identity in equivalence checks and validates projection port correspondence", () => {
    const { model, symbols, sheetId } = panelFixture(), source = buildDrawingSchematicPreview(model, sheetId, symbols);
    const changed = structuredClone(source.wires); changed[0].from.canonical!.side = "external";
    expect(compareConnectivity(source.wires, changed)).toBe(false);
    source.wires = changed;
    expect(projectSchematic(source).connectivityPreserved).toBe(false);
  });
});
