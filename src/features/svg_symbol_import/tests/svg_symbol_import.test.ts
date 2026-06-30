import { describe, expect, it } from "vitest";
import { validateSymbol } from "@/features/symbol_registry/logic/use_cases/validate-symbol";
import { buildImportedSymbolMetadata } from "../logic/use_cases/build-imported-symbol-metadata";
import { parseImportedSvg } from "../logic/use_cases/parse-imported-svg";

const sourceAsset = {
  fileName: "device.svg",
  mimeType: "image/svg+xml" as const,
  sizeBytes: 512,
  dataUrl: "data:image/svg+xml;base64,PHN2Zy8+"
};

const validSvg = `
<svg viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg">
  <rect x="10" y="10" width="100" height="50" fill="white" stroke="black"/>
  <circle id="terminal:1" cx="20" cy="40" r="2"/>
  <ellipse data-name="terminal_2" cx="60" cy="40" rx="2" ry="2"/>
  <rect id="anchor:GND" x="92" y="54" width="4" height="4"/>
</svg>`;

describe("SVG symbol import", () => {
  it("parses a valid SVG and extracts viewBox and anchors", () => {
    const result = parseImportedSvg({
      rawSvg: validSvg,
      sourceAsset
    });

    expect(result.viewBox).toEqual({ x: 0, y: 0, width: 120, height: 80 });
    expect(result.anchors.map((anchor) => anchor.key)).toEqual([
      "1",
      "2",
      "GND"
    ]);
    expect(result.terminals).toHaveLength(3);
  });

  it("sanitizes unsafe SVG before preview", () => {
    const result = parseImportedSvg({
      rawSvg:
        '<svg viewBox="0 0 100 100" onload="alert(1)"><script>alert(1)</script><circle id="terminal:1" cx="50" cy="50" r="2"/></svg>',
      sourceAsset
    });

    expect(result.svg).not.toContain("<script");
    expect(result.svg).not.toContain("onload");
    expect(result.issues.map((issue) => issue.code)).toContain("SCRIPT_DENIED");
  });

  it("blocks SVG files without a viewBox", () => {
    expect(() =>
      parseImportedSvg({
        rawSvg: '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="1" cy="1" r="1"/></svg>',
        sourceAsset
      })
    ).toThrow("SVG root must define a viewBox.");
  });

  it("builds metadata that passes registry validation", () => {
    const preview = parseImportedSvg({
      rawSvg: validSvg,
      sourceAsset
    });
    const metadata = buildImportedSymbolMetadata({
      symbolKey: "Imported Device",
      displayName: "Imported Device",
      manufacturer: "Vendor",
      model: "Model",
      category: "instrument",
      viewBox: preview.viewBox,
      anchors: preview.anchors,
      terminals: preview.terminals
    });
    const validation = validateSymbol(preview.svg, metadata);

    expect(metadata.symbolKey).toBe("imported_device");
    expect(validation.blockingIssueCount).toBe(0);
  });

  it("lets registry validation catch duplicate terminal keys", () => {
    const preview = parseImportedSvg({
      rawSvg: validSvg,
      sourceAsset
    });
    const metadata = buildImportedSymbolMetadata({
      symbolKey: "duplicate_test",
      displayName: "Duplicate Test",
      category: "instrument",
      viewBox: preview.viewBox,
      anchors: preview.anchors,
      terminals: [
        { ...preview.terminals[0], key: "1" },
        { ...preview.terminals[1], key: "1" }
      ]
    });
    const validation = validateSymbol(preview.svg, metadata);

    expect(validation.issues.map((issue) => issue.code)).toContain(
      "TERMINAL_DUPLICATE"
    );
  });
});

