import { describe, expect, it } from "vitest";
import type { SymbolMetadata } from "../data/schema";
import {
  buildNetworkProfileFromReviewDraft,
  createNetworkProfileReviewDraft
} from "../logic/services/network-profile-review-draft";
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
  it("accepts valid network symbol data", () => {
    const result = validateSymbol(validSvg, validNetworkMetadata);

    expect(result.metadata).toBeDefined();
    expect(result.blockingIssueCount).toBe(0);
  });

  it("rejects a network profile with no ports", () => {
    const result = validateSymbol(validSvg, {
      ...validNetworkMetadata,
      networkProfile: {
        ...validNetworkMetadata.networkProfile!,
        ports: []
      }
    });

    expect(result.blockingIssueCount).toBeGreaterThan(0);
    expect(result.issues.map((issue) => issue.code)).toContain(
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
    const result = validateSymbol(validSvg, {
      ...validNetworkMetadata,
      anchors: [{ key: "ETH1", x: 125, y: 80, kind: "network_port" }]
    });

    expect(result.blockingIssueCount).toBeGreaterThan(0);
    expect(result.issues.map((issue) => issue.code)).toContain(
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

});
