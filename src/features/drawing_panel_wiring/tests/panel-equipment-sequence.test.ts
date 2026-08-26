import { describe, expect, it } from "vitest";
import {
  buildPackageConnectivityGraph,
  buildPanelDiscoveryIndex,
  derivePanelEquipmentSequence
} from "../api/public";
import {
  createGenericPanelWiringSource,
  GENERIC_PANEL_ASSET_ID,
  GENERIC_TERMINAL_ASSET_IDS
} from "./fixtures";

function positionedPanelSource() {
  const source = createGenericPanelWiringSource();
  const positions = [
    { xMm: 80, yMm: 20 },
    { xMm: 20, yMm: 20 },
    { xMm: 30, yMm: 100 },
    { xMm: 90, yMm: 100 }
  ];

  return {
    ...source,
    sheets: source.sheets.map((sheet) =>
      sheet.id !== "sheet_layout"
        ? sheet
        : (() => {
            const occurrences = sheet.occurrences.map((occurrence) => {
              if (occurrence.placementId === "layout_rail") {
                return {
                  ...occurrence,
                  panelLayout: {
                    layoutKind: "layout_helper" as const,
                    backplanePlacementId: "layout_backplane",
                    backplaneSheetX: 20,
                    backplaneSheetY: 20,
                    xMm: 10,
                    yMm: 30,
                    widthMm: 200,
                    heightMm: 35,
                    rotationDeg: 0,
                    mountingType: "backplate",
                    technicalKind: "rail"
                  }
                };
              }

              const assetIndex = occurrence.assetId
                ? GENERIC_TERMINAL_ASSET_IDS.indexOf(occurrence.assetId)
                : -1;
              if (assetIndex < 0) return occurrence;
              const position = positions[assetIndex];

              return {
                ...occurrence,
                panelLayout: {
                  layoutKind: "layout_helper" as const,
                  backplanePlacementId: "layout_backplane",
                  backplaneSheetX: 20,
                  backplaneSheetY: 20,
                  xMm: position.xMm,
                  yMm: position.yMm,
                  widthMm: 5.2,
                  heightMm: 50,
                  rotationDeg: 0,
                  mountingType: "din_rail",
                  technicalKind: "terminal_block"
                }
              };
            });
            const firstRail = occurrences.find(
              (occurrence) => occurrence.placementId === "layout_rail"
            )!;

            return {
              ...sheet,
              occurrences: [
                ...occurrences,
                {
                  ...firstRail,
                  placementId: "layout_rail_2",
                  panelLayout: {
                    ...firstRail.panelLayout!,
                    yMm: 105
                  }
                }
              ]
            };
          })()
    )
  };
}

function sequenceFor(source = positionedPanelSource()) {
  const graph = buildPackageConnectivityGraph(source);
  return derivePanelEquipmentSequence({
    graph,
    panelAssetId: GENERIC_PANEL_ASSET_ID,
    detailedSheetId: "sheet_detail",
    representedPlacementIdsByAssetId: new Map()
  });
}

describe("physical panel equipment sequencing", () => {
  it("orders rail rows top-to-bottom and equipment left-to-right", () => {
    const source = positionedPanelSource();
    const result = sequenceFor(source);

    expect(
      GENERIC_TERMINAL_ASSET_IDS.map((assetId) =>
        result.sequenceByAssetId.get(assetId)
      )
    ).toEqual([
      expect.objectContaining({ position: 2, row: 1, column: 2 }),
      expect.objectContaining({ position: 1, row: 1, column: 1 }),
      expect.objectContaining({ position: 3, row: 2, column: 1 }),
      expect.objectContaining({ position: 4, row: 2, column: 2 })
    ]);

    const graph = buildPackageConnectivityGraph(source);
    const index = buildPanelDiscoveryIndex({
      graph,
      panelAssetId: GENERIC_PANEL_ASSET_ID,
      detailedSheetId: "sheet_detail"
    });
    expect([...index.assetsById.keys()]).toEqual([
      GENERIC_TERMINAL_ASSET_IDS[1],
      GENERIC_TERMINAL_ASSET_IDS[0],
      GENERIC_TERMINAL_ASSET_IDS[2],
      GENERIC_TERMINAL_ASSET_IDS[3]
    ]);
  });

  it("recalculates from moved geometry without mutating the source", () => {
    const source = positionedPanelSource();
    const before = structuredClone(source);
    const layoutSheet = source.sheets.find(
      (sheet) => sheet.id === "sheet_layout"
    )!;
    const first = layoutSheet.occurrences.find(
      (occurrence) => occurrence.assetId === GENERIC_TERMINAL_ASSET_IDS[0]
    )!;
    first.panelLayout = { ...first.panelLayout!, xMm: 5 };

    const result = sequenceFor(source);

    expect(
      result.sequenceByAssetId.get(GENERIC_TERMINAL_ASSET_IDS[0])
    ).toMatchObject({ position: 1, row: 1, column: 1 });
    expect(before.sheets[0]).toEqual(source.sheets[0]);
  });

  it("clusters free equipment, accounts for rotation, and uses deterministic ties", () => {
    const source = positionedPanelSource();
    const layoutSheet = source.sheets.find(
      (sheet) => sheet.id === "sheet_layout"
    )!;
    layoutSheet.occurrences = layoutSheet.occurrences
      .filter((occurrence) => occurrence.placementId !== "layout_rail")
      .map((occurrence) => {
        if (!occurrence.panelLayout) return occurrence;
        const index = GENERIC_TERMINAL_ASSET_IDS.indexOf(
          occurrence.assetId ?? ""
        );
        return {
          ...occurrence,
          panelLayout: {
            ...occurrence.panelLayout,
            xMm: index === 0 ? 35 : index === 1 ? 20 : 40 + index,
            yMm: index < 2 ? 50 : 90,
            rotationDeg: index === 0 ? 90 : 0,
            mountingType: "free"
          }
        };
      });

    const result = sequenceFor(source);

    expect(
      result.sequenceByAssetId.get(GENERIC_TERMINAL_ASSET_IDS[0])
    ).toMatchObject({ position: 1, row: 1, column: 1 });
    expect(
      result.sequenceByAssetId.get(GENERIC_TERMINAL_ASSET_IDS[1])
    ).toMatchObject({ position: 2, row: 1, column: 2 });
    expect(
      result.sequenceByAssetId.get(GENERIC_TERMINAL_ASSET_IDS[2])
    ).toMatchObject({ position: 3, row: 2, column: 1 });
  });

  it("lists unpositioned equipment last and warns about duplicate physical occurrences", () => {
    const source = positionedPanelSource();
    const layoutSheet = source.sheets.find(
      (sheet) => sheet.id === "sheet_layout"
    )!;
    const duplicate = layoutSheet.occurrences.find(
      (occurrence) => occurrence.assetId === GENERIC_TERMINAL_ASSET_IDS[0]
    )!;
    const unpositioned = layoutSheet.occurrences.find(
      (occurrence) => occurrence.assetId === GENERIC_TERMINAL_ASSET_IDS[3]
    )!;
    delete unpositioned.panelLayout;
    layoutSheet.occurrences.push({
      ...duplicate,
      placementId: "layout_strip_1_duplicate",
      panelLayout: { ...duplicate.panelLayout!, xMm: 160 }
    });
    const graph = buildPackageConnectivityGraph(source);
    const index = buildPanelDiscoveryIndex({
      graph,
      panelAssetId: GENERIC_PANEL_ASSET_ID,
      detailedSheetId: "sheet_detail"
    });
    const rows = [...index.assetsById.values()];

    expect(rows.at(-1)?.assetId).toBe(GENERIC_TERMINAL_ASSET_IDS[3]);
    expect(rows.at(-1)?.panelSequence).toBeUndefined();
    expect(
      index.assetsById.get(GENERIC_TERMINAL_ASSET_IDS[0])
        ?.panelSequenceWarning
    ).toMatch(/Multiple physical panel-layout occurrences/);
    expect(index.warnings).toContainEqual(
      expect.objectContaining({
        code: "duplicate_physical_panel_layout_occurrence",
        severity: "warning"
      })
    );
  });
});
