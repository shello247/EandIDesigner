import { describe, expect, it } from "vitest";
import {
  buildPackageConnectivityGraph,
  createShieldTermination,
  createTerminalJumper
} from "../api/public";
import {
  createGenericPanelWiringSource,
  GENERIC_PANEL_ASSET_ID,
  GENERIC_TERMINAL_ASSET_IDS
} from "./fixtures";

const terminal = (assetId: string, number: number) => ({
  assetId,
  terminalKey: `T${number}`,
  side: "internal" as const
});

describe("panel pattern validation", () => {
  it("blocks duplicate structural membership", () => {
    const source = createGenericPanelWiringSource();
    const first = createTerminalJumper(source, {
      panelAssetId: GENERIC_PANEL_ASSET_ID,
      topology: "terminal_jumper",
      domain: "signal",
      members: [
        terminal(GENERIC_TERMINAL_ASSET_IDS[0], 4),
        terminal(GENERIC_TERMINAL_ASSET_IDS[0], 5)
      ]
    });
    const bridge = first.pattern?.recordType === "bridge" ? first.pattern.record : undefined;
    const next = {
      ...source,
      panelWiring: {
        schemaVersion: 1 as const,
        terminalMappings: [],
        internalWires: [],
        bridges: bridge ? [bridge] : [],
        bonds: [],
        patternSettings: first.settings ? [first.settings] : []
      }
    };
    const duplicate = createTerminalJumper(next, {
      panelAssetId: GENERIC_PANEL_ASSET_ID,
      topology: "bridge_bar",
      domain: "signal",
      members: [
        terminal(GENERIC_TERMINAL_ASSET_IDS[0], 4),
        terminal(GENERIC_TERMINAL_ASSET_IDS[1], 4)
      ]
    });

    expect(duplicate.mutations).toEqual([]);
    expect(duplicate.warnings.some((finding) => finding.code === "duplicate_structural_membership")).toBe(true);
  });

  it("reports unknown terminal constraints as warnings, not guessed compatibility", () => {
    const source = createGenericPanelWiringSource();
    const result = createTerminalJumper(source, {
      panelAssetId: GENERIC_PANEL_ASSET_ID,
      topology: "terminal_jumper",
      domain: "power",
      members: [
        terminal(GENERIC_TERMINAL_ASSET_IDS[0], 4),
        terminal(GENERIC_TERMINAL_ASSET_IDS[0], 5)
      ]
    });

    expect(result.mutations.length).toBeGreaterThan(0);
    expect(result.warnings.some((finding) => finding.code === "terminal_domain_unverified")).toBe(true);
  });

  it("persists an explicit cross-domain shield warning", () => {
    const source = createGenericPanelWiringSource();
    const result = createShieldTermination(source, {
      panelAssetId: GENERIC_PANEL_ASSET_ID,
      source: terminal(GENERIC_TERMINAL_ASSET_IDS[0], 5),
      target: {
        kind: "panel_reference",
        panelAssetId: GENERIC_PANEL_ASSET_ID,
        referenceKind: "protective_earth"
      },
      targetDomain: "protective_earth"
    });

    expect(result.mutations.length).toBeGreaterThan(0);
    expect(result.warnings.some((finding) => finding.code === "cross_domain_shield_bond")).toBe(true);
  });

  it("keeps legacy bridge records loadable with a review finding", () => {
    const source = createGenericPanelWiringSource();
    const legacy = {
      id: "legacy-bridge",
      panelAssetId: GENERIC_PANEL_ASSET_ID,
      kind: "bridge" as const,
      members: [
        terminal(GENERIC_TERMINAL_ASSET_IDS[0], 4),
        terminal(GENERIC_TERMINAL_ASSET_IDS[0], 5)
      ],
      origin: "imported" as const
    };
    const graph = buildPackageConnectivityGraph({
      ...source,
      panelWiring: {
        schemaVersion: 1,
        terminalMappings: [],
        internalWires: [],
        bridges: [legacy],
        bonds: []
      }
    });

    expect(graph.bridgesById.has(legacy.id)).toBe(true);
    expect(graph.findings.some((finding) => finding.code === "legacy_pattern_definition")).toBe(true);
  });
});
