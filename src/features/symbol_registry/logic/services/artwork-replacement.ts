import { createHash } from "node:crypto";
import { ARTWORK_MAX_BYTES } from "../../data/artwork-schema";
import { areViewBoxesEqual, inspectSvg } from "@/shared/svg/svg-inspector";
import { sanitizeSvg } from "@/shared/svg/svg-sanitizer";
import type { SymbolMetadata } from "../../data/schema";

const tags = new Set("svg g rect circle ellipse line polyline polygon path text tspan title desc".split(" "));
const attributes = new Set(("xmlns id data-name aria-label role viewBox width height x y x1 x2 y1 y2 cx cy r rx ry d points transform fill stroke stroke-width stroke-linejoin stroke-linecap stroke-miterlimit fill-rule clip-rule font-family font-size font-weight font-style letter-spacing text-anchor dominant-baseline dx dy opacity fill-opacity stroke-opacity data-visual-standard data-projection data-line-weight-scale").split(" "));
const presentation = new Set(["fill", "stroke", "stroke-width", "data-line-weight-scale"]);
const paint = /^(?:#[a-f\d]{3}|#[a-f\d]{6}|none|white|black|gray|grey|currentColor)$/i;

// Deliberately restricted vector XML, not a general-purpose SVG parser. Fail closed
// on unsupported syntax. Only presentation attributes disappear from the signature.
function signature(svg: string): string {
  const content = svg.trim().replace(/^<\?xml\s[^?]*\?>\s*/, "").replace(/<!--[\s\S]*?-->/g, "");
  if (/<!|<\?|\burl\s*\(/i.test(content)) throw new Error("Use plain vector SVG without external resources or active content.");
  const tokens = content.match(/<[^<>]*>|[^<>]+/g) ?? [];
  if (tokens.join("") !== content) throw new Error("Malformed SVG.");
  const stack: string[] = [];
  const result: unknown[] = [];
  let roots = 0;
  for (const token of tokens) {
    if (!token.startsWith("<")) {
      if (token.trim()) {
        if (!stack.length) throw new Error("Text outside SVG.");
        result.push(["text", token]);
      }
      continue;
    }
    const close = token.match(/^<\/([a-zA-Z]+)\s*>$/);
    if (close) {
      if (stack.pop() !== close[1]) throw new Error("Unbalanced SVG elements.");
      result.push(["end", close[1]]);
      continue;
    }
    const open = token.match(/^<([a-zA-Z]+)((?:\s[\s\S]*?)?)\s*(\/?)>$/);
    if (!open || !tags.has(open[1])) throw new Error("Unsupported SVG element. Use a plain vector body.");
    const name = open[1];
    if (!stack.length && (name !== "svg" || roots++ > 0)) throw new Error("SVG must have one root.");
    if (stack.length && name === "svg") throw new Error("Nested SVG roots are not supported.");
    let remaining = open[2].trim();
    const values: Record<string, string> = {};
    while (remaining) {
      const attr = remaining.match(/^([\w:-]+)\s*=\s*(?:"([^"<>]*)"|'([^'<>]*)')(?:\s+|$)/);
      if (!attr) throw new Error("Malformed SVG attributes.");
      const key = attr[1], value = attr[2] ?? attr[3];
      if (!attributes.has(key) || key in values || /[&\x00-\x08]/.test(value)) throw new Error("Unsupported or duplicate SVG attribute.");
      if (key === "xmlns" && value !== "http://www.w3.org/2000/svg") throw new Error("Unsupported SVG namespace.");
      if ((key === "fill" || key === "stroke") && !paint.test(value)) throw new Error("Use plain hexadecimal or neutral SVG colours.");
      if ((key === "stroke-width" || key === "data-line-weight-scale") && (!/^\d*\.?\d+$/.test(value) || Number(value) <= 0 || Number(value) > 10)) throw new Error("Invalid SVG line weight.");
      values[key] = value;
      remaining = remaining.slice(attr[0].length);
    }
    result.push([name, Object.entries(values).filter(([key]) => !presentation.has(key)).sort(([a], [b]) => a.localeCompare(b))]);
    if (open[3]) result.push(["end", name]); else stack.push(name);
  }
  if (roots !== 1 || stack.length) throw new Error("Incomplete SVG.");
  return JSON.stringify(result);
}

export function prepareArtworkReplacement(original: string, incoming: string, metadata: SymbolMetadata): string {
  if (Buffer.byteLength(incoming, "utf8") > ARTWORK_MAX_BYTES) throw new Error("SVG must be 50 KB or smaller.");
  const clean = sanitizeSvg(incoming);
  if (clean.issues.length) throw new Error("Unsafe SVG content. Export a clean vector SVG and try again.");
  if (signature(original) !== signature(clean.svg)) throw new Error("Artwork geometry or labels changed. This workflow only accepts colour and line-weight changes; keep all shapes, coordinates and text unchanged.");
  const box = inspectSvg(clean.svg).viewBox;
  if (!box || !areViewBoxesEqual(box, metadata.viewBox)) throw new Error("SVG viewBox must match the existing connection coordinate system exactly.");
  if (clean.svg === original.trim()) throw new Error("This artwork is unchanged.");
  return clean.svg;
}

export function artworkToken(snapshot: unknown, svg: string, fileName: string): string {
  return createHash("sha256").update(JSON.stringify([snapshot, svg, fileName])).digest("hex");
}
