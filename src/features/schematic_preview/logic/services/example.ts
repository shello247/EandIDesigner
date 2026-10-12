import type { PreviewSource } from "../../data/schema";

/** Original synthetic fixture, not manufacturer evidence or a modified project drawing. */
export function createPowerSupplyExample(): PreviewSource {
  const blocks = [
    { tag: "PDB-101", title: "AC line distribution", x: 0, y: 0 },
    { tag: "PDB-102", title: "AC neutral distribution", x: 0, y: 180 },
    { tag: "PDB-103", title: "Protective earth distribution", x: 0, y: 360 },
    { tag: "PDB-104", title: "+24 VDC distribution", x: 400, y: 60 },
    { tag: "PDB-105", title: "0 VDC distribution", x: 400, y: 240 }
  ];
  const devices: PreviewSource["devices"] = blocks.map(d => ({ ...d, id: d.tag, assetId: `example-${d.tag}`, versionId: "example-v1", kind: "terminal_block", terminals: [1, 2, 3, 4].map(n => ({ key: `T${n}`, anchorKey: `T${n}`, label: `${n}`, x: n % 2 ? 0 : 40, y: n * 15 })), continuity: [{ id: "declared-example-bus", terminalKeys: ["T1", "T2", "T3", "T4"] }] }));
  devices.push({ id: "PS-101", assetId: "example-PS-101", versionId: "example-v1", tag: "PS-101", title: "24 VDC power supply — example", kind: "power_supply", x: 200, y: 100, terminals: [
    { key: "L", anchorKey: "L", label: "L", role: "power_line", x: 0, y: 20 },
    { key: "N", anchorKey: "N", label: "N", role: "power_neutral", x: 0, y: 50 },
    { key: "PE", anchorKey: "PE", label: "PE", role: "protective_earth", x: 0, y: 80 },
    { key: "+", anchorKey: "+", label: "+V", role: "dc_positive", x: 40, y: 20 },
    { key: "-", anchorKey: "-", label: "0V", role: "dc_return", x: 40, y: 50 }
  ], continuity: [] });
  return { id: "example-24v-v1", title: "24 VDC Power Supply", provenance: "example", revision: "Synthetic example v1", limitations: [], devices, wires: [
    { id: "wire-007", label: "007", from: { placementId: "PDB-101", anchorKey: "T1" }, to: { placementId: "PS-101", anchorKey: "L" } },
    { id: "wire-008", label: "008", from: { placementId: "PDB-102", anchorKey: "T1" }, to: { placementId: "PS-101", anchorKey: "N" } },
    { id: "wire-009", label: "009", from: { placementId: "PDB-103", anchorKey: "T1" }, to: { placementId: "PS-101", anchorKey: "PE" } },
    { id: "wire-010", label: "010", from: { placementId: "PS-101", anchorKey: "+" }, to: { placementId: "PDB-104", anchorKey: "T1" } },
    { id: "wire-011", label: "011", from: { placementId: "PS-101", anchorKey: "-" }, to: { placementId: "PDB-105", anchorKey: "T1" } }
  ] };
}
