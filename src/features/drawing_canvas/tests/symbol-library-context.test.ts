import { describe, expect, it } from "vitest";
import type { ApprovedDrawingSymbol } from "../types";
import {
  getSymbolLibraryContextForSheetKind,
  getSymbolsForLibraryContext,
  groupSymbolsForLibrary
} from "../logic/services/symbol-library-context";
import {
  GENERATED_BACKPLANE_SYMBOL_ID,
  GENERATED_BACKPLANE_SYMBOL_KEY
} from "../logic/services/drawing-backplane-layouts";

function approvedSymbol(input: {
  key: string;
  name: string;
  category: ApprovedDrawingSymbol["category"];
  layoutUsage?: ApprovedDrawingSymbol["metadata"]["layoutUsage"];
  panelCategory?: ApprovedDrawingSymbol["metadata"]["panelCategory"];
  physicalWidthMm?: number;
  physicalHeightMm?: number;
  mountingType?: ApprovedDrawingSymbol["metadata"]["mountingType"];
}): ApprovedDrawingSymbol {
  return {
    symbolId: `symbol_${input.key}`,
    symbolKey: input.key,
    displayName: input.name,
    category: input.category,
    versionId: `version_${input.key}`,
    versionNumber: 1,
    svg: '<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg" />',
    metadata: {
      symbolKey: input.key,
      displayName: input.name,
      category: input.category,
      layoutUsage: input.layoutUsage,
      panelCategory: input.panelCategory,
      physicalWidthMm: input.physicalWidthMm,
      physicalHeightMm: input.physicalHeightMm,
      mountingType: input.mountingType,
      resizable: input.panelCategory === "rail",
      viewBox: { x: 0, y: 0, width: 10, height: 10 },
      anchors: [],
      terminals: []
    }
  };
}

describe("symbol library context", () => {
  const wiringInstrument = approvedSymbol({
    key: "nmt81",
    name: "NMT81 Average Temperature Probe",
    category: "instrument"
  });
  const cableAssembly = approvedSymbol({
    key: "clx_cable_1_pair",
    name: "CLX Cable 1 Pair",
    category: "cable_assembly"
  });
  const controller = approvedSymbol({
    key: "nrf81_tank_side_monitor",
    name: "NRF81 Tank Side Monitor",
    category: "monitor"
  });
  const circuitBreaker = approvedSymbol({
    key: "miniature_circuit_breaker_3_pole",
    name: "Miniature Circuit Breaker 3 Pole",
    category: "terminal_block"
  });
  const panelRail = approvedSymbol({
    key: "standard_th35_din_rail",
    name: "Standard TH35 DIN Rail",
    category: "terminal_block",
    layoutUsage: "panel_layout",
    panelCategory: "rail",
    physicalWidthMm: 300,
    physicalHeightMm: 35,
    mountingType: "backplate"
  });
  const sharedTerminal = approvedSymbol({
    key: "terminal_block_single_scaled",
    name: "Terminal Block Single Scaled",
    category: "terminal_block",
    layoutUsage: "both",
    panelCategory: "termination",
    physicalWidthMm: 20,
    physicalHeightMm: 78,
    mountingType: "din_rail"
  });
  const incompletePanelSymbol = approvedSymbol({
    key: "layout_symbol_without_size",
    name: "Layout Symbol Without Size",
    category: "terminal_block",
    layoutUsage: "panel_layout",
    panelCategory: "termination"
  });
  const symbols = [
    cableAssembly,
    wiringInstrument,
    controller,
    circuitBreaker,
    panelRail,
    sharedTerminal,
    incompletePanelSymbol
  ];

  it("maps sheet kinds to the right symbol library context", () => {
    expect(getSymbolLibraryContextForSheetKind("drawing")).toBe("wiring");
    expect(getSymbolLibraryContextForSheetKind("section_title")).toBe("none");
  });

  it("filters wiring symbols without showing panel-layout-only symbols", () => {
    expect(
      getSymbolsForLibraryContext(symbols, "wiring").map(
        (symbol) => symbol.symbolKey
      )
    ).toEqual([
      "clx_cable_1_pair",
      "nmt81",
      "nrf81_tank_side_monitor",
      "miniature_circuit_breaker_3_pole",
      "standard_th35_din_rail",
      "terminal_block_single_scaled",
      GENERATED_BACKPLANE_SYMBOL_KEY
    ]);
  });

  it("groups wiring symbols by engineering library category", () => {
    const groups = groupSymbolsForLibrary(symbols, "wiring");

    expect(groups.map((group) => group.label)).toEqual([
      "Cable Assemblies",
      "Instrumentation",
      "Controllers",
      "Circuit Protection",
      "Terminal Block",
      "Panel Layout"
    ]);
    expect(
      groups.find((group) => group.key === "circuit_protection")?.symbols[0]
        .symbolKey
    ).toBe("miniature_circuit_breaker_3_pole");
    expect(
      groups.find((group) => group.key === "terminal_block")?.symbols[0]
        .symbolKey
    ).toBe("terminal_block_single_scaled");
    expect(
      groups.find((group) => group.key === "panel_layout")?.symbols[0]
        .symbolKey
    ).toBe(GENERATED_BACKPLANE_SYMBOL_KEY);
    expect(
      groups
        .find((group) => group.key === "panel_layout")
        ?.symbols.map((symbol) => symbol.symbolId)
    ).toContain(GENERATED_BACKPLANE_SYMBOL_ID);
  });
});
