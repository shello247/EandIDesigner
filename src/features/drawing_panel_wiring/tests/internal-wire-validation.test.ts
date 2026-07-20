import { describe, expect, it } from "vitest";
import {
  buildPackageConnectivityGraph,
  validateInternalWireEndpoints
} from "../api/public";
import {
  createGenericPanelWiringSource,
  GENERIC_PANEL_ASSET_ID,
  GENERIC_TERMINAL_ASSET_IDS
} from "./fixtures";

describe("internal wire endpoint validation", () => {
  const graph = buildPackageConnectivityGraph(createGenericPanelWiringSource());

  it("accepts free internal terminal sides", () => {
    expect(
      validateInternalWireEndpoints({
        graph,
        panelAssetId: GENERIC_PANEL_ASSET_ID,
        from: { assetId: GENERIC_TERMINAL_ASSET_IDS[0], terminalKey: "T4", side: "internal" },
        to: { assetId: GENERIC_TERMINAL_ASSET_IDS[1], terminalKey: "T4", side: "internal" }
      }).valid
    ).toBe(true);
  });

  it("rejects external, occupied, and same logical terminal endpoints", () => {
    const external = validateInternalWireEndpoints({
      graph,
      panelAssetId: GENERIC_PANEL_ASSET_ID,
      from: { assetId: GENERIC_TERMINAL_ASSET_IDS[0], terminalKey: "T1", side: "external" },
      to: { assetId: GENERIC_TERMINAL_ASSET_IDS[1], terminalKey: "T4", side: "internal" }
    });
    expect(external.findings.map((finding) => finding.code)).toContain("external_side_not_internal");
    expect(external.findings.map((finding) => finding.code)).toContain("terminal_side_occupied");

    const same = validateInternalWireEndpoints({
      graph,
      panelAssetId: GENERIC_PANEL_ASSET_ID,
      from: { assetId: GENERIC_TERMINAL_ASSET_IDS[0], terminalKey: "T4", side: "internal" },
      to: { assetId: GENERIC_TERMINAL_ASSET_IDS[0], terminalKey: "T4", side: "internal" }
    });
    expect(same.findings.map((finding) => finding.code)).toContain("same_logical_terminal");
  });
});
