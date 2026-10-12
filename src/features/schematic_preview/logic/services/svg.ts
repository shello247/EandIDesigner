import type { SchematicProjection } from "../../types";
export const escapeXml = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);
const short = (s: string, n = 34) => s.length > n ? s.slice(0, n - 1) + "…" : s;
const text = (x: number, y: number, s: string, attributes = "") => `<text x="${x}" y="${y}" ${attributes}>${escapeXml(s)}</text>`;

/** Only original programmatic artwork and escaped text; never inserts source SVG/HTML. */
export function renderPreviewSvg(p: SchematicProjection, view: "outline" | "schematic", selectedWireId?: string): string {
  const markup: string[] = [];
  markup.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${p.width} ${p.height}" role="img" aria-label="${escapeXml(p.source.title)} — ${view === "outline" ? "illustrative outline" : "schematic preview"}"><title>${escapeXml(p.source.title)} — Not standards-verified</title><desc>Read-only projection. Wire endpoints are preserved where resolved. Crossings without junction dots are not connections. Cross-sheet connections are outside this sheet projection. Example outlines are illustrative, not manufacturer artwork.</desc><rect width="100%" height="100%" fill="white"/><g font-family="Arial, sans-serif" font-size="13" fill="#172534"><rect x="18" y="18" width="${p.width - 36}" height="${p.height - 36}" fill="none" stroke="#8091a1"/>`);
  markup.push(text(45, 52, p.source.title, 'font-size="22" font-weight="700"'));
  markup.push(text(45, 77, view === "outline" ? "OUTLINE VIEW · ILLUSTRATIVE EXAMPLE" : "SCHEMATIC PREVIEW · GENERAL ENGINEERING CONVENTIONS", 'font-size="12" fill="#526477"'));
  markup.push(text(p.width - 45, 52, "NOT STANDARDS-VERIFIED", 'text-anchor="end" font-size="12" font-weight="700" fill="#9a580c"'));
  for (const wire of p.wires) {
    const selected = wire.id === selectedWireId;
    const color = selected ? "#c26106" : view === "outline" ? "#2563a0" : "#142b3d";
    markup.push(`<g data-wire-id="${escapeXml(wire.id)}"${wire.canonicalWireId ? ` data-canonical-wire-id="${escapeXml(wire.canonicalWireId)}"` : ""}><title>${escapeXml(`${wire.label}: ${wire.fromLabel} → ${wire.toLabel}`)}</title><path d="${wire.path}" fill="none" stroke="${color}" stroke-width="${selected ? 4 : 1.8}" stroke-linejoin="round"/>${text(wire.labelX, wire.labelY, short(wire.label, 22), `text-anchor="middle" fill="${color}" stroke="white" stroke-width="5" paint-order="stroke"`)}</g>`);
  }
  for (const n of p.nodes) {
    const d = n.device;
    const isOutline = view === "outline";
    markup.push(`<g data-placement-id="${escapeXml(d.id)}"><title>${escapeXml(`${d.tag} — ${d.title} — ${d.versionId}`)}</title>`);
    markup.push(text(n.x, n.y - 30, short(d.tag, 26), 'font-size="17" font-weight="700"'));
    markup.push(text(n.x, n.y - 11, short(d.title), 'font-size="11" fill="#526477"'));
    markup.push(`<rect x="${n.x}" y="${n.y}" width="${n.width}" height="${n.height}" rx="${isOutline ? 6 : 0}" fill="${isOutline ? "#e7edf0" : "white"}" stroke="#263c49" stroke-width="1.5" ${!isOutline && d.kind === "terminal_block" ? 'stroke-dasharray="5 4"' : ""}/>`);
    if (isOutline) {
      markup.push(`<rect x="${n.x + 9}" y="${n.y + 9}" width="${n.width - 18}" height="15" fill="#577e99"/>`);
      if (d.kind === "power_supply") {
        for (let i = 0; i < 6; i++) markup.push(`<path d="M ${n.x + 90} ${n.y + 40 + i * 8} h 40" stroke="#9cabb2" stroke-width="3"/>`);
        markup.push(`<circle cx="${n.x + 110}" cy="${n.y + n.height - 30}" r="11" fill="#8d9ca3" stroke="#456"/>`);
      }
    } else if (d.kind === "power_supply") {
      markup.push(`<path d="M ${n.x + 88} ${n.y + n.height - 22} L ${n.x + 133} ${n.y + 27}" fill="none" stroke="#263c49" stroke-width="1.5"/>`);
      markup.push(text(n.x + 84, n.y + 55, d.terminals.some(t => t.role === "power_line") ? "~" : "IN", 'font-size="24" text-anchor="middle"'));
      markup.push(text(n.x + 138, n.y + n.height - 32, d.terminals.some(t => t.role === "dc_positive") ? "⎓" : "OUT", 'font-size="22" text-anchor="middle"'));
    } else if (d.kind === "generic") {
      markup.push(text(n.x + 110, n.y + 28, "FUNCTIONAL BLOCK", 'text-anchor="middle" font-size="10" fill="#9a580c"'));
    }
    // Continuity is drawn only for explicit, valid metadata groups, never inferred.
    if (!isOutline) d.continuity.forEach((g, index) => {
      const ports = g.terminalKeys.map(k => n.ports.find(t => t.key === k));
      if (ports.some(t => !t) || new Set(g.terminalKeys).size !== g.terminalKeys.length) return;
      const busX = n.x + 102 + index * 10;
      const valid = ports.filter(t => t !== undefined);
      markup.push(`<g data-continuity-id="${escapeXml(g.id)}"><path d="M ${busX} ${Math.min(...valid.map(t => t.y))} V ${Math.max(...valid.map(t => t.y))}" stroke="#142b3d" fill="none"/>`);
      for (const t of valid) markup.push(`<path d="M ${t.x} ${t.y} H ${busX}" stroke="#142b3d"/><circle cx="${busX}" cy="${t.y}" r="2.5" fill="#142b3d"/>`);
      markup.push("</g>");
    });
    for (const t of n.ports) {
      const left = t.side === "left";
      markup.push(`<g data-terminal-key="${escapeXml(t.key)}"${t.canonical ? ` data-asset-id="${escapeXml(t.canonical.assetId)}" data-canonical-terminal="${escapeXml(t.canonical.terminalKey)}" data-terminal-side="${escapeXml(t.canonical.side)}"` : ""}><title>${escapeXml(`${d.tag}:${t.label} | ${t.key} | ${t.anchorKey}`)}</title><circle cx="${t.x}" cy="${t.y}" r="${isOutline ? 6 : 4}" fill="white" stroke="#263c49" stroke-width="1.5"/>`);
      if (isOutline) markup.push(`<path d="M ${t.x - 3} ${t.y + 3} l 6 -6" stroke="#506874"/>`);
      markup.push(text(t.x + (left ? 11 : -11), t.y - 8, short(t.label, 14), `text-anchor="${left ? "start" : "end"}" font-size="12" stroke="${isOutline ? "#e7edf0" : "white"}" stroke-width="4" paint-order="stroke"`));
      markup.push("</g>");
    }
    markup.push("</g>");
  }
  const bottom = p.height - 85;
  markup.push(`<path d="M 18 ${bottom - 17} H ${p.width - 18}" stroke="#8091a1"/>`);
  markup.push(text(45, bottom + 6, `${p.source.provenance === "example" ? "SYNTHETIC EXAMPLE" : "CURRENT DRAWING PROJECTION"} · ${short(p.source.revision, 65)} · ${p.representationRevision}`, 'font-size="12"'));
  markup.push(text(45, bottom + 28, `${p.nodes.length} devices · ${p.terminalCount} terminals · ${p.wires.length}/${p.source.wires.length} wires resolved · ${p.issues.length} open projection issues`, 'font-size="12"'));
  markup.push(`<metadata>${escapeXml(JSON.stringify({ scope: p.source.scopeNotes ?? [], integrityIssues: p.source.integrityIssues ?? [], wireEndpoints: p.source.wires }))}</metadata>`);
  markup.push(text(45, bottom + 48, "Not for construction. Symbol selection, presentation and engineering suitability require review. Crossings without dots are not junctions.", 'font-size="11" fill="#9a580c"'));
  markup.push("</g></svg>");
  return markup.join("");
}
