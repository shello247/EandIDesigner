import { describe, expect, it } from "vitest";
import { sanitizeSvg } from "../logic/services/svg-sanitizer";
import { normalizeTerminalMapVerificationOutput } from "../logic/services/openai-terminal-map-verifier";
import { validateSymbol } from "../logic/use_cases/validate-symbol";
import {
  isDrawingSymbolCategory,
  symbolMetadataSchema,
  type SymbolMetadata
} from "../data/schema";

const validSvg =
  '<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="10"/></svg>';

const validMetadata: SymbolMetadata = {
  symbolKey: "test_symbol",
  displayName: "Test Symbol",
  category: "instrument",
  viewBox: { x: 0, y: 0, width: 100, height: 100 },
  anchors: [{ key: "T1", x: 50, y: 50, kind: "terminal" }],
  terminals: [
    {
      key: "1",
      label: "Terminal 1",
      function: "Signal",
      anchorKey: "T1",
      requiredForWiring: true
    }
  ]
};

describe("symbol registry validation", () => {
  it("accepts a valid symbol", () => {
    const result = validateSymbol(validSvg, validMetadata);

    expect(result.blockingIssueCount).toBe(0);
    expect(result.issues).toHaveLength(0);
  });

  it("blocks unsafe SVG content", () => {
    const result = sanitizeSvg(
      '<svg viewBox="0 0 100 100" onload="alert(1)"><script>alert(1)</script><circle cx="50" cy="50" r="10"/></svg>'
    );

    expect(result.svg).not.toContain("<script");
    expect(result.svg).not.toContain("onload");
    expect(result.issues.some((issue) => issue.severity === "blocking")).toBe(
      true
    );
  });

  it("detects missing required terminal anchors", () => {
    const result = validateSymbol(validSvg, {
      ...validMetadata,
      terminals: [
        {
          key: "1",
          label: "Terminal 1",
          function: "Signal",
          anchorKey: "DOES_NOT_EXIST",
          requiredForWiring: true
        }
      ]
    });

    expect(result.issues.map((issue) => issue.code)).toContain(
      "TERMINAL_ANCHOR_MISSING"
    );
  });

  it("detects duplicate terminals and out-of-bounds anchors", () => {
    const result = validateSymbol(validSvg, {
      ...validMetadata,
      anchors: [
        { key: "T1", x: 50, y: 50, kind: "terminal" },
        { key: "T2", x: 500, y: 50, kind: "terminal" }
      ],
      terminals: [
        {
          key: "1",
          label: "Terminal 1",
          function: "Signal",
          anchorKey: "T1",
          requiredForWiring: true
        },
        {
          key: "1",
          label: "Terminal 1 duplicate",
          function: "Signal",
          anchorKey: "T2",
          requiredForWiring: true
        }
      ]
    });

    expect(result.issues.map((issue) => issue.code)).toContain(
      "TERMINAL_DUPLICATE"
    );
    expect(result.issues.map((issue) => issue.code)).toContain(
      "ANCHOR_OUT_OF_BOUNDS"
    );
  });

  it("normalizes empty AI terminal-map verification fields", () => {
    const result = normalizeTerminalMapVerificationOutput({
      confidence: "medium",
      summary: "Terminal map appears consistent with available evidence.",
      issues: [
        {
          severity: "warning",
          terminalKey: "",
          message: "Source evidence is limited.",
          evidence: "",
          suggestedFix: ""
        }
      ],
      suggestedTerminals: validMetadata.terminals,
      reviewNotes: ["Manual approval is still required."]
    });

    expect(result.issues[0].terminalKey).toBeUndefined();
    expect(result.issues[0].evidence).toBeUndefined();
    expect(result.issues[0].suggestedFix).toBeUndefined();
  });

  it("accepts network device metadata with port anchors", () => {
    const metadata = symbolMetadataSchema.parse({
      symbolKey: "industrial_switch",
      displayName: "Industrial Switch",
      category: "network_device",
      viewBox: { x: 0, y: 0, width: 120, height: 80 },
      terminals: [],
      anchors: [
        { key: "ETH1", x: 20, y: 60, kind: "network_port" },
        { key: "ETH2", x: 40, y: 60, kind: "network_port" }
      ],
      networkProfile: {
        deviceType: "switch",
        managed: true,
        ports: [
          {
            key: "ETH1",
            label: "Ethernet 1",
            anchorKey: "ETH1",
            media: "copper",
            speedMbps: 1000,
            protocolHints: ["Ethernet"]
          }
        ]
      }
    });

    expect(metadata.networkProfile?.deviceType).toBe("switch");
    expect(metadata.networkProfile?.ports[0].protocolHints).toEqual([
      "Ethernet"
    ]);
  });

  it("rejects network ports that reference missing anchors", () => {
    const result = validateSymbol(validSvg, {
      symbolKey: "industrial_switch",
      displayName: "Industrial Switch",
      category: "network_device",
      viewBox: { x: 0, y: 0, width: 100, height: 100 },
      terminals: [],
      anchors: [{ key: "ETH1", x: 20, y: 60, kind: "network_port" }],
      networkProfile: {
        deviceType: "switch",
        ports: [
          {
            key: "ETH2",
            label: "Ethernet 2",
            anchorKey: "ETH2",
            media: "copper"
          }
        ]
      }
    });

    expect(result.blockingIssueCount).toBeGreaterThan(0);
    expect(result.issues.map((issue) => issue.code)).toContain(
      "METADATA_INVALID"
    );
  });

  it("rejects network ports that reference non-network anchors", () => {
    const result = validateSymbol(validSvg, {
      symbolKey: "industrial_switch",
      displayName: "Industrial Switch",
      category: "network_device",
      viewBox: { x: 0, y: 0, width: 100, height: 100 },
      terminals: [],
      anchors: [{ key: "ETH1", x: 20, y: 60, kind: "terminal" }],
      networkProfile: {
        deviceType: "switch",
        ports: [
          {
            key: "ETH1",
            label: "Ethernet 1",
            anchorKey: "ETH1",
            media: "copper"
          }
        ]
      }
    });

    expect(result.blockingIssueCount).toBeGreaterThan(0);
    expect(result.issues.map((issue) => issue.code)).toContain(
      "METADATA_INVALID"
    );
  });

  it("keeps network devices out of the drawing symbol category set", () => {
    expect(isDrawingSymbolCategory("instrument")).toBe(true);
    expect(isDrawingSymbolCategory("network_device")).toBe(false);
  });
});
