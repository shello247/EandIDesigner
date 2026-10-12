import { previewSourceSchema, type PreviewSource, type PreviewEndpoint } from "../../data/schema";
import type { PreviewWire, PreviewNode, SchematicProjection } from "../../types";

const endpointKey = (e: PreviewEndpoint) => JSON.stringify([e.placementId, e.anchorKey]);
const canonicalKey = (ref: PreviewEndpoint["canonical"]) => ref ? JSON.stringify([ref.assetId, ref.terminalKey, ref.side]) : undefined;
const wireIdentity = (w: PreviewWire) => JSON.stringify([w.id, w.label, w.canonicalWireId, w.from.placementId, w.from.anchorKey, canonicalKey(w.from.canonical), w.to.placementId, w.to.anchorKey, canonicalKey(w.to.canonical)]);
export function compareConnectivity(source: PreviewWire[], projected: PreviewWire[]): boolean {
  if (!source.length || source.length !== projected.length) return false;
  return JSON.stringify(source.map(wireIdentity).sort()) === JSON.stringify(projected.map(wireIdentity).sort());
}

/** A view projection only: no rewiring, inferred nets, writes, or standard-conformance claim. */
export function projectSchematic(input: PreviewSource): SchematicProjection {
  const source = previewSourceSchema.parse(input);
  const issues = [...source.limitations, ...(source.integrityIssues ?? [])];
  const deviceIndex = new Map(source.devices.map(d => [d.id, d]));
  if (deviceIndex.size !== source.devices.length) issues.push("Duplicate placement identities: the projection is ambiguous.");
  if (new Set(source.wires.map(w => w.id)).size !== source.wires.length) issues.push("Duplicate wire identities: the projection is ambiguous.");
  if (!source.wires.length) issues.push("No explicit wires on this sheet. Equipment placement alone does not define a circuit.");
  for (const d of source.devices) {
    if (!d.terminals.length) issues.push(`${d.tag}: no terminal definitions available.`);
    if (d.kind === "generic") issues.push(`${d.tag}: a generic functional block is used; its schematic representation needs review.`);
    if (new Set(d.terminals.map(t => t.anchorKey)).size !== d.terminals.length || new Set(d.terminals.map(t => t.key)).size !== d.terminals.length) issues.push(`${d.tag}: ambiguous terminal mapping.`);
    for (const g of d.continuity) {
      if (g.terminalKeys.some(k => d.terminals.filter(t => t.key === k).length !== 1) || new Set(g.terminalKeys).size !== g.terminalKeys.length) issues.push(`${d.tag}: continuity group ${g.id} has invalid terminal references.`);
    }
  }
  // Group by source position only. Column position does not assign electrical direction.
  const minX = source.devices.length ? Math.min(...source.devices.map(d => d.x)) : 0;
  const maxX = Math.max(minX + 1, ...source.devices.map(d => d.x));
  const columns: PreviewNode[][] = [[], [], []];
  const supplies = source.devices.filter(d => d.kind === "power_supply");
  const pivot = supplies.length === 1 ? supplies[0] : undefined;
  for (const device of source.devices) {
    // For one supply, retain source-relative left/right arrangement around it.
    // This chooses presentation columns only; it does not infer circuit direction.
    const column = pivot ? device.id === pivot.id ? 1 : device.x < pivot.x ? 0 : device.x > pivot.x ? 2 : 1 : Math.min(2, Math.max(0, Math.round(2 * (device.x - minX) / (maxX - minX))));
    const sides = device.terminals.map(t => {
      const neighbours = source.wires.flatMap(w => endpointKey(w.from) === endpointKey({ placementId: device.id, anchorKey: t.anchorKey }) ? [deviceIndex.get(w.to.placementId)] : endpointKey(w.to) === endpointKey({ placementId: device.id, anchorKey: t.anchorKey }) ? [deviceIndex.get(w.from.placementId)] : []).filter(d => d !== undefined);
      if (neighbours.length) return neighbours.reduce((sum, d) => sum + d.x, 0) / neighbours.length < device.x ? "left" as const : "right" as const;
      if (device.kind === "power_supply") return t.role === "dc_positive" || t.role === "dc_return" ? "right" as const : "left" as const;
      return t.x <= Math.max(...device.terminals.map(port => port.x), 1) / 2 ? "left" as const : "right" as const;
    });
    const left = sides.filter(s => s === "left").length;
    const height = Math.max(140, 68 + Math.max(left, sides.length - left) * 30);
    const x = 100 + column * 440;
    let l = 0, r = 0;
    columns[column].push({ device, x, y: 0, width: 220, height, ports: device.terminals.map((t, i) => ({ ...t, side: sides[i], x: x + (sides[i] === "left" ? 0 : 220), y: 48 + 30 * (sides[i] === "left" ? l++ : r++) })) });
  }
  const columnHeights = columns.map(c => c.reduce((h, n) => h + n.height + 95, 0));
  const contentHeight = Math.max(600, ...columnHeights);
  for (let c = 0; c < columns.length; c++) {
    // Stagger adjacent columns so an incoming route does not coincide with an
    // unrelated device's outgoing horizontal segment at the same row.
    let y = 125 + (contentHeight - columnHeights[c]) / 2 + c * 13;
    columns[c].sort((a, b) => a.device.y - b.device.y || a.device.id.localeCompare(b.device.id)).forEach(n => {
      n.y = y;
      n.ports.forEach(p => { p.y += y; });
      y += n.height + 95;
    });
  }
  const nodes = columns.flat();
  const endpoints = new Map<string, Array<{ node: PreviewNode; port: PreviewNode["ports"][number] }>>();
  for (const node of nodes) for (const port of node.ports) {
    const key = endpointKey({ placementId: node.device.id, anchorKey: port.anchorKey });
    endpoints.set(key, [...(endpoints.get(key) ?? []), { node, port }]);
  }
  const wires: SchematicProjection["wires"] = [];
  source.wires.forEach((w, i) => {
    if (w.validationIssue) { issues.push(`${w.label || w.id}: ${w.validationIssue}`); return; }
    const from = endpoints.get(endpointKey(w.from));
    const to = endpoints.get(endpointKey(w.to));
    if (from?.length !== 1 || to?.length !== 1) { issues.push(`${w.label || w.id}: missing or ambiguous endpoint; wire remains unresolved.`); return; }
    const a = from[0].port, b = to[0].port;
    if (w.canonicalWireId && (!w.from.canonical || !w.to.canonical || canonicalKey(w.from.canonical) !== canonicalKey(a.canonical) || canonicalKey(w.to.canonical) !== canonicalKey(b.canonical))) { issues.push(`${w.label || w.id}: canonical terminal-side correspondence is incomplete.`); return; }
    const fromLabel = `${from[0].node.device.tag}:${a.label}`;
    const toLabel = `${to[0].node.device.tag}:${b.label}`;
    const facing = a.side !== b.side && ((a.side === "right" && a.x < b.x) || (a.side === "left" && a.x > b.x));
    const lane = (i % 7 - 3) * 12;
    const middleX = (a.x + b.x) / 2 + lane;
    const exitA = a.x + (a.side === "left" ? -1 : 1) * (34 + i % 5 * 9);
    const exitB = b.x + (b.side === "left" ? -1 : 1) * (34 + i % 5 * 9);
    const top = Math.min(from[0].node.y, to[0].node.y) - 48 - i % 3 * 12;
    const points = facing ? [{ x: a.x, y: a.y }, { x: middleX, y: a.y }, { x: middleX, y: b.y }, { x: b.x, y: b.y }] : [{ x: a.x, y: a.y }, { x: exitA, y: a.y }, { x: exitA, y: top }, { x: exitB, y: top }, { x: exitB, y: b.y }, { x: b.x, y: b.y }];
    const path = points.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ");
    wires.push({ ...w, path, points, labelX: facing ? (a.x + middleX) / 2 : (exitA + exitB) / 2, labelY: facing ? a.y - 9 : top - 8, fromLabel, toLabel });
  });
  const overlap = (a: number, b: number, c: number, d: number) => Math.min(Math.max(a, b), Math.max(c, d)) > Math.max(Math.min(a, b), Math.min(c, d));
  for (let i = 0; i < wires.length; i++) for (let j = i + 1; j < wires.length; j++) {
    const a = wires[i], b = wires[j];
    const overlaps = a.points.slice(1).some((end, k) => b.points.slice(1).some((otherEnd, m) => {
      const start = a.points[k], otherStart = b.points[m];
      return (start.y === end.y && otherStart.y === otherEnd.y && start.y === otherStart.y && overlap(start.x, end.x, otherStart.x, otherEnd.x)) || (start.x === end.x && otherStart.x === otherEnd.x && start.x === otherStart.x && overlap(start.y, end.y, otherStart.y, otherEnd.y));
    }));
    if (overlaps) issues.push(`${a.label || a.id} / ${b.label || b.id}: overlapping wire segments require routing review.`);
  }
  const mappingAmbiguous = Boolean(source.integrityIssues?.length) || issues.some(i => /ambiguous|Duplicate/.test(i));
  return { source, nodes, wires, issues, width: 1300, height: contentHeight + 240, terminalCount: source.devices.reduce((n, d) => n + d.terminals.length, 0), connectivityPreserved: !mappingAmbiguous && compareConnectivity(source.wires, wires), representationRevision: "general-conventions-v1" };
}
