import { describe, expect, it } from "vitest";
import { createPowerSupplyExample } from "../logic/services/example";
import { compareConnectivity, projectSchematic } from "../logic/services/projection";
import { renderPreviewSvg } from "../logic/services/svg";

describe("schematic preview engineering identity", () => {
  it("preserves all explicit endpoints, device versions and declared continuity without mutating the input", () => {
    const source = createPowerSupplyExample(), before = structuredClone(source);
    const p = projectSchematic(source);
    expect(source).toEqual(before);
    expect(p.connectivityPreserved).toBe(true);
    expect(p.wires).toHaveLength(5);
    expect(p.terminalCount).toBe(25);
    for (const d of source.devices) expect(p.nodes.find(n => n.device.id === d.id)?.device).toEqual(d);
    expect(p.issues).toEqual([]);
    expect(projectSchematic(source)).toEqual(p);
  });
  it("reports missing endpoints and retains the unresolved source wire", () => {
    const source = createPowerSupplyExample(); source.wires[0].to.anchorKey = "missing";
    const p = projectSchematic(source);
    expect(p.connectivityPreserved).toBe(false); expect(p.wires).toHaveLength(4); expect(p.source.wires).toHaveLength(5);
    expect(p.issues.join(" ")).toContain("007: missing or ambiguous endpoint");
  });
  it("fails equivalence if a terminal or a wire identity changes, even when counts match", () => {
    const source = createPowerSupplyExample(); const changed = structuredClone(source.wires);
    changed[0].to.anchorKey = "N";
    expect(compareConnectivity(source.wires, changed)).toBe(false);
    changed[0] = { ...source.wires[0], id: "renumbered" };
    expect(compareConnectivity(source.wires, changed)).toBe(false);
  });
  it("does not claim equivalence for an empty sheet", () => {
    const source = createPowerSupplyExample(); source.devices = []; source.wires = [];
    const p = projectSchematic(source); expect(p.connectivityPreserved).toBe(false); expect(p.width).toBeGreaterThan(0);
    expect(p.issues.join(" ")).toContain("No explicit wires");
  });
  it("rejects duplicate wire identities and ambiguous terminal anchors", () => {
    const source = createPowerSupplyExample(); source.wires[1].id = source.wires[0].id;
    expect(projectSchematic(source).connectivityPreserved).toBe(false);
    source.devices[0].terminals.push({ ...source.devices[0].terminals[0], key: "other" });
    const p = projectSchematic(source); expect(p.wires).toHaveLength(4); expect(p.issues.join(" ")).toContain("ambiguous terminal mapping");
  });
  it("does not infer continuity or treat unknown devices as reviewed symbols", () => {
    const source = createPowerSupplyExample(); source.devices[0].continuity = []; source.devices[0].kind = "generic";
    const p = projectSchematic(source);
    expect(p.nodes.find(n => n.device.id === "PDB-101")?.device.continuity).toEqual([]);
    expect(p.issues.join(" ")).toContain("generic functional block");
    expect(p.connectivityPreserved).toBe(true); // endpoint preservation is distinct from symbol coverage
  });
  it("rejects invalid continuity references and never draws a fabricated bus", () => {
    const source = createPowerSupplyExample(); source.devices[0].continuity = [{ id: "invalid-bus", terminalKeys: ["T1", "missing"] }];
    const p = projectSchematic(source); expect(p.issues.join(" ")).toContain("invalid terminal references");
    expect(renderPreviewSvg(p, "schematic")).not.toContain('data-continuity-id="invalid-bus"');
  });
  it("escapes hostile strings in visible content, attributes and exported source descriptions", () => {
    const source = createPowerSupplyExample(); source.title = '<script>alert("x")</script>'; source.devices[0].id = 'x" onload="alert(1)';
    const svg = renderPreviewSvg(projectSchematic(source), "schematic");
    expect(svg).not.toContain("<script>"); expect(svg).not.toContain(' onload="'); expect(svg).toContain("&lt;script&gt;");
  });
  it("retains provisional status and provenance in both representations and exports", () => {
    const p = projectSchematic(createPowerSupplyExample());
    for (const mode of ["outline", "schematic"] as const) {
      const svg = renderPreviewSvg(p, mode); expect(svg).toContain("NOT STANDARDS-VERIFIED"); expect(svg).toContain("SYNTHETIC EXAMPLE"); expect(svg).toContain("Not for construction");
      expect(svg.match(/data-wire-id=/g)).toHaveLength(5); expect(svg.match(/data-terminal-key=/g)).toHaveLength(25);
    }
  });
  it("bounds oversized or malformed inputs instead of silently dropping records", () => {
    const source = createPowerSupplyExample(); source.wires = Array.from({ length: 601 }, () => source.wires[0]);
    expect(() => projectSchematic(source)).toThrow();
    source.wires = []; source.devices[0].x = Infinity; expect(() => projectSchematic(source)).toThrow();
  });
  it("flags geometric overlap separately from unchanged electrical endpoints", () => {
    const source = createPowerSupplyExample();
    source.wires.push({ ...structuredClone(source.wires[0]), id: "parallel-route", label: "Parallel" });
    const p = projectSchematic(source);
    expect(p.connectivityPreserved).toBe(true);
    expect(p.issues.join(" ")).toContain("overlapping wire segments require routing review");
  });
});
