import { describe, expect, it } from "vitest";
import type { SymbolMetadata } from "../data/schema";
import {
  buildNetworkProfileFromReviewDraft,
  createNetworkProfileReviewDraft
} from "../logic/services/network-profile-review-draft";
import {
  assertSymbolVersionEditable,
  isSymbolVersionEditable
} from "../logic/services/symbol-version-lifecycle";
import { canApproveSymbolVersion } from "../logic/use_cases/approve-symbol-version";
import { validateSymbol } from "../logic/use_cases/validate-symbol";

const validSvg =
  '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="10" width="80" height="60"/></svg>';

const validNetworkMetadata: SymbolMetadata = {
  symbolKey: "managed_switch",
  displayName: "Managed Switch",
  manufacturer: "Industrial Networks",
  model: "SW-4",
  category: "network_device",
  viewBox: { x: 0, y: 0, width: 100, height: 100 },
  terminals: [],
  anchors: [{ key: "ETH1", x: 25, y: 80, kind: "network_port" }],
  networkProfile: {
    deviceType: "switch",
    managed: true,
    ports: [
      {
        key: "ETH1",
        label: "Uplink",
        anchorKey: "ETH1",
        media: "copper",
        speedMbps: 1000,
        protocolHints: ["Ethernet"]
      }
    ]
  }
};

describe("network symbol review", () => {
  it("allows a valid network symbol to be approved", () => {
    const result = canApproveSymbolVersion(validSvg, validNetworkMetadata);

    expect(result.ok).toBe(true);
    expect(result.result.blockingIssueCount).toBe(0);
  });

  it("blocks approval when the network profile has no ports", () => {
    const result = canApproveSymbolVersion(validSvg, {
      ...validNetworkMetadata,
      networkProfile: {
        ...validNetworkMetadata.networkProfile!,
        ports: []
      }
    });

    expect(result.ok).toBe(false);
    expect(result.result.issues.map((issue) => issue.code)).toContain(
      "NETWORK_PORT_REQUIRED"
    );
  });

  it("blocks duplicate port keys and invalid anchor mappings", () => {
    const result = validateSymbol(validSvg, {
      ...validNetworkMetadata,
      anchors: [{ key: "ETH1", x: 25, y: 80, kind: "terminal" }],
      networkProfile: {
        ...validNetworkMetadata.networkProfile!,
        ports: [
          validNetworkMetadata.networkProfile!.ports[0],
          {
            ...validNetworkMetadata.networkProfile!.ports[0],
            key: "eth1",
            anchorKey: "MISSING"
          }
        ]
      }
    });

    expect(result.blockingIssueCount).toBeGreaterThan(0);
    expect(result.issues.map((issue) => issue.code)).toContain("METADATA_INVALID");
  });

  it("blocks network port anchors outside the SVG viewBox", () => {
    const result = canApproveSymbolVersion(validSvg, {
      ...validNetworkMetadata,
      anchors: [{ key: "ETH1", x: 125, y: 80, kind: "network_port" }]
    });

    expect(result.ok).toBe(false);
    expect(result.result.issues.map((issue) => issue.code)).toContain(
      "ANCHOR_OUT_OF_BOUNDS"
    );
  });

  it("normalizes review values before update validation", () => {
    const draft = createNetworkProfileReviewDraft(
      validNetworkMetadata.networkProfile
    );
    draft.ports[0] = {
      ...draft.ports[0],
      key: "eth1",
      speedMbps: "1000",
      protocolHints: "Ethernet, PROFINET, ethernet"
    };

    const profile = buildNetworkProfileFromReviewDraft(draft);

    expect(profile.ports[0]).toMatchObject({
      key: "ETH1",
      speedMbps: 1000,
      protocolHints: ["Ethernet", "PROFINET"]
    });
  });

  it("only permits draft and needs-review versions to be edited", () => {
    expect(isSymbolVersionEditable("draft")).toBe(true);
    expect(isSymbolVersionEditable("needs_review")).toBe(true);
    expect(isSymbolVersionEditable("approved")).toBe(false);
    expect(isSymbolVersionEditable("archived")).toBe(false);
    expect(() => assertSymbolVersionEditable("approved")).toThrow(
      /controlled artwork/i
    );
    expect(() => assertSymbolVersionEditable("archived")).toThrow(
      /controlled artwork/i
    );
  });
});
