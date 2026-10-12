import { describe, expect, it } from "vitest";
import { prepareArtworkReplacement, artworkToken } from "../logic/services/artwork-replacement";
import type { SymbolMetadata } from "../data/schema";
import { artworkInputSchema } from "../data/artwork-schema";

const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80"><g id="body" fill="#eeeeee" stroke="#555555" stroke-width="0.6"><rect x="1" y="1" width="98" height="78"/><text x="20" y="20">UPS</text></g></svg>';
const next = svg.replace('#eeeeee', '#ffffff').replace('#555555', '#222222');
const metadata = { viewBox: { x: 0, y: 0, width: 100, height: 80 } } as SymbolMetadata;
describe("artwork-only replacement", () => {
  it("allows colour and weight changes, XML prolog and self-closing whitespace", () => {
    expect(prepareArtworkReplacement(svg, '<?xml version="1.0"?>'+next.replace('0.6','0.66').replace('/>', ' />'), metadata)).toContain('#222222');
  });
  it.each([
    next.replace('x="1"', 'x="2"'), next.replace('UPS', 'Other'), next.replace('body', 'new-body'),
    next.replace('100 80', '200 80'), next.replace('<rect', '<rect transform="translate(1 0)"'),
    next.replace('width="98"', 'width="99"')
  ])("rejects geometry, identity or text drift", incoming => {
    expect(() => prepareArtworkReplacement(svg, incoming, metadata)).toThrow(/geometry|labels/);
  });
  it.each([
    next.replace('</svg>', '<script>alert(1)</script></svg>'),
    next.replace('<rect', '<rect onload="alert(1)"'),
    next.replace('<rect', '<rect style="fill:red"'),
    next.replace('</svg>', '<image href="https://example.com/a"/></svg>'),
    next.replace('</svg>', '<animate attributeName="x"/></svg>'),
    next.replace('#ffffff', 'url(#x)'), next.replace('stroke-width="0.6"','stroke-width="0"'),
    next.replace('</g>', ''), next+'<svg/>', next.replace('x="1"','x="1" x="2"'),
    '<!DOCTYPE svg>'+next, next.replace('#ffffff','&#35;ffffff')
  ])("rejects unsupported or unsafe XML", incoming => {
    expect(() => prepareArtworkReplacement(svg, incoming, metadata)).toThrow();
  });
  it("rejects no-op, oversized and metadata/viewBox mismatch", () => {
    expect(() => prepareArtworkReplacement(svg, svg, metadata)).toThrow('unchanged');
    expect(() => prepareArtworkReplacement(svg, next+' '.repeat(52000), metadata)).toThrow('50 KB');
    expect(() => prepareArtworkReplacement(svg, next, { ...metadata, viewBox: {...metadata.viewBox, x: 1} })).toThrow('coordinate');
  });
  it("binds token to source state, candidate and filename", () => {
    const token = artworkToken({ metadata: 'a' }, next, 'a.svg');
    expect(token).not.toBe(artworkToken({ metadata: 'b' }, next, 'a.svg'));
    expect(token).not.toBe(artworkToken({ metadata: 'a' }, svg, 'a.svg'));
    expect(token).not.toBe(artworkToken({ metadata: 'a' }, next, 'b.svg'));
  });
  it("rejects extra metadata payloads and unsafe filenames", () => {
    const input = { symbolId:'a', versionId:'b', fileName:'a.svg', svg };
    expect(artworkInputSchema.safeParse({...input, metadata:{}}).success).toBe(false);
    expect(artworkInputSchema.safeParse({...input, fileName:'../a.svg'}).success).toBe(false);
  });
});
