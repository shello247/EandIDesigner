import { describe, expect, it } from "vitest";
import type { ApprovedDrawingSymbol } from "../types";
import {
  getSymbolLibraryContextForSheetKind,
  getSymbolsForLibraryContext,
  groupSymbolsForLibrary,
  hasPanelLayoutPhysicalDimensions
} from "../logic/services/symbol-library-context";
import {
  GENERATED_BACKPLANE_SYMBOL_ID,
  GENERATED_BACKPLANE_SYMBOL_KEY
} from "../logic/services/drawing-backplane-layouts";
import {
  GENERATED_WIRE_TRAY_SYMBOL_ID,
  GENERATED_WIRE_TRAY_SYMBOL_KEY
} from "../logic/services/drawing-wire-tray-layouts";
import {
  GENERATED_HORIZONTAL_DIMENSION_SYMBOL_KEY,
  GENERATED_VERTICAL_DIMENSION_SYMBOL_KEY
} from "../logic/services/drawing-layout-dimensions";
import { GENERATED_TERMINAL_BLOCK_GROUP_LIBRARY_SYMBOL_KEY } from "../logic/services/drawing-terminal-block-groups";

function approvedSymbol(input: {
  key: string;
  name: string;
  category: ApprovedDrawingSymbol["category"];
  layoutUsage?: ApprovedDrawingSymbol["metadata"]["layoutUsage"];
  panelCategory?: ApprovedDrawingSymbol["metadata"]["panelCategory"];
  physicalWidthMm?: number;
  physicalHeightMm?: number;
  mountingType?: ApprovedDrawingSymbol["metadata"]["mountingType"];
  panelWiring?: ApprovedDrawingSymbol["metadata"]["panelWiring"];
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
      panelWiring: input.panelWiring,
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
    physicalWidthMm: 5.2,
    physicalHeightMm: 50,
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
      GENERATED_BACKPLANE_SYMBOL_KEY,
      GENERATED_WIRE_TRAY_SYMBOL_KEY,
      GENERATED_TERMINAL_BLOCK_GROUP_LIBRARY_SYMBOL_KEY,
      GENERATED_HORIZONTAL_DIMENSION_SYMBOL_KEY,
      GENERATED_VERTICAL_DIMENSION_SYMBOL_KEY
    ]);
  });

  it("requires physical dimensions for panel layout symbols", () => {
    expect(hasPanelLayoutPhysicalDimensions(sharedTerminal)).toBe(true);
    expect(hasPanelLayoutPhysicalDimensions(incompletePanelSymbol)).toBe(false);
    expect(
      getSymbolsForLibraryContext(symbols, "wiring").map(
        (symbol) => symbol.symbolKey
      )
    ).not.toContain("layout_symbol_without_size");
  });

  it("exposes a dimensioned I/O module in the panel layout library", () => {
    const ioModule = approvedSymbol({
      key: "allen_bradley_2085_if4",
      name: "2085-IF4 4-Channel Analog Input Module",
      category: "other",
      layoutUsage: "both",
      panelCategory: "controller",
      physicalWidthMm: 28,
      physicalHeightMm: 90,
      mountingType: "din_rail",
      panelWiring: {
        assetType: "io_module",
        tagPrefix: "AI",
        schematicScale: 90 / 511
      }
    });
    const available = getSymbolsForLibraryContext([ioModule], "wiring");
    const groups = groupSymbolsForLibrary([ioModule], "wiring");

    expect(available).toContainEqual(ioModule);
    expect(
      groups.find((group) => group.key === "panel_layout")?.symbols
    ).toContainEqual(ioModule);
  });

  it("groups wiring symbols by engineering library category", () => {
    const groups = groupSymbolsForLibrary(symbols, "wiring");

    expect(groups.map((group) => group.label)).toEqual([
      "Cable Assemblies",
      "Instrumentation",
      "Controllers",
      "Circuit Protection",
      "Panel Layout"
    ]);
    expect(
      groups.find((group) => group.key === "circuit_protection")?.symbols[0]
        .symbolKey
    ).toBe("miniature_circuit_breaker_3_pole");
    expect(
      groups
        .find((group) => group.key === "panel_layout")
        ?.symbols.map((symbol) => symbol.symbolKey)
    ).toEqual([
      GENERATED_BACKPLANE_SYMBOL_KEY,
      GENERATED_HORIZONTAL_DIMENSION_SYMBOL_KEY,
      "standard_th35_din_rail",
      GENERATED_TERMINAL_BLOCK_GROUP_LIBRARY_SYMBOL_KEY,
      GENERATED_VERTICAL_DIMENSION_SYMBOL_KEY,
      GENERATED_WIRE_TRAY_SYMBOL_KEY
    ]);
    expect(
      groups
        .find((group) => group.key === "panel_layout")
        ?.symbols.map((symbol) => symbol.symbolId)
    ).toContain(GENERATED_BACKPLANE_SYMBOL_ID);
    expect(
      groups
        .find((group) => group.key === "panel_layout")
        ?.symbols.map((symbol) => symbol.symbolId)
    ).toContain(GENERATED_WIRE_TRAY_SYMBOL_ID);
  });
});
