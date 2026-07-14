import type { PanelBondRecord } from "@/features/drawing_panel_wiring/api/public";
import type { DrawingPlacement, DrawingSheetPage } from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";

export const GENERATED_PANEL_REFERENCE_SYMBOL_ID = "__generated_panel_reference__";
export const GENERATED_PANEL_REFERENCE_VERSION_ID = "generated_panel_reference_v1";
export const GENERATED_PANEL_PATTERN_LEGEND_SYMBOL_ID = "__generated_panel_pattern_legend__";
export const GENERATED_PANEL_PATTERN_LEGEND_VERSION_ID = "generated_panel_pattern_legend_v1";
export const PANEL_REFERENCE_ANCHOR_KEY = "REFERENCE";

export type PanelReferenceKind = NonNullable<
  DrawingPlacement["panelReference"]
>["referenceKind"];

const REFERENCE_LABELS: Record<PanelReferenceKind, string> = {
  shield: "Shield",
  protective_earth: "PE",
  signal_ground: "Signal Ground"
};

function referenceSvg(kind: PanelReferenceKind): string {
  if (kind === "shield") {
    return '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M8 1v5M3 6h10M4.5 6c0 4 1.4 6.6 3.5 8 2.1-1.4 3.5-4 3.5-8" fill="none" stroke="#334155" stroke-width=".8"/><circle cx="8" cy="6" r="1" fill="#fff" stroke="#334155" stroke-width=".6"/></svg>';
  }
  if (kind === "protective_earth") {
    return '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M8 1v7M3 8h10M4.5 10h7M6 12h4M7.2 14h1.6" fill="none" stroke="#166534" stroke-width=".8"/></svg>';
  }
  return '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M8 1v7M3 8h10l-5 6z" fill="none" stroke="#475569" stroke-width=".8"/></svg>';
}

export function createGeneratedPanelReferenceSymbol(
  kind: PanelReferenceKind
): ApprovedDrawingSymbol {
  const label = REFERENCE_LABELS[kind];
  return {
    symbolId: GENERATED_PANEL_REFERENCE_SYMBOL_ID,
    symbolKey: `generated_panel_reference_${kind}`,
    displayName: label,
    category: "other",
    versionId: GENERATED_PANEL_REFERENCE_VERSION_ID,
    versionNumber: 1,
    svg: referenceSvg(kind),
    metadata: {
      symbolKey: `generated_panel_reference_${kind}`,
      displayName: label,
      category: "other",
      viewBox: { x: 0, y: 0, width: 16, height: 16 },
      anchors: [{ key: PANEL_REFERENCE_ANCHOR_KEY, x: 8, y: 8, kind: "terminal" }],
      terminals: []
    }
  };
}

export function createGeneratedPanelPatternLegendSymbol(): ApprovedDrawingSymbol {
  return {
    symbolId: GENERATED_PANEL_PATTERN_LEGEND_SYMBOL_ID,
    symbolKey: "generated_panel_pattern_legend",
    displayName: "Connection Pattern Legend",
    category: "other",
    versionId: GENERATED_PANEL_PATTERN_LEGEND_VERSION_ID,
    versionNumber: 1,
    svg: '<svg viewBox="0 0 74 42" xmlns="http://www.w3.org/2000/svg"><rect width="74" height="42" fill="none"/></svg>',
    metadata: {
      symbolKey: "generated_panel_pattern_legend",
      displayName: "Connection Pattern Legend",
      category: "other",
      viewBox: { x: 0, y: 0, width: 74, height: 42 },
      anchors: [],
      terminals: []
    }
  };
}

export function isGeneratedPanelReferencePlacement(
  placement: DrawingPlacement | undefined
): placement is DrawingPlacement & {
  panelReference: NonNullable<DrawingPlacement["panelReference"]>;
} {
  return Boolean(
    placement?.panelReference &&
      placement.symbolId === GENERATED_PANEL_REFERENCE_SYMBOL_ID &&
      placement.versionId === GENERATED_PANEL_REFERENCE_VERSION_ID
  );
}

export function isGeneratedPanelPatternLegendPlacement(
  placement: DrawingPlacement | undefined
): placement is DrawingPlacement & {
  panelPatternLegend: NonNullable<DrawingPlacement["panelPatternLegend"]>;
} {
  return Boolean(
    placement?.panelPatternLegend &&
      placement.symbolId === GENERATED_PANEL_PATTERN_LEGEND_SYMBOL_ID &&
      placement.versionId === GENERATED_PANEL_PATTERN_LEGEND_VERSION_ID
  );
}

function placementId(prefix: string): string {
  const suffix = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return `${prefix}_${suffix}`;
}

export function createPanelReferencePlacement({
  panelAssetId,
  referenceKind,
  key,
  x,
  y
}: {
  panelAssetId: string;
  referenceKind: PanelReferenceKind;
  key?: string;
  x: number;
  y: number;
}): DrawingPlacement {
  return {
    id: placementId("panel_reference"),
    symbolId: GENERATED_PANEL_REFERENCE_SYMBOL_ID,
    versionId: GENERATED_PANEL_REFERENCE_VERSION_ID,
    role: "other",
    tag: REFERENCE_LABELS[referenceKind],
    title: `${REFERENCE_LABELS[referenceKind]} reference`,
    x,
    y,
    rotation: 0,
    scale: 1,
    panelReference: { panelAssetId, referenceKind, key }
  };
}

export function createPanelPatternLegendPlacement(
  page: DrawingSheetPage
): DrawingPlacement {
  return {
    id: placementId("panel_pattern_legend"),
    symbolId: GENERATED_PANEL_PATTERN_LEGEND_SYMBOL_ID,
    versionId: GENERATED_PANEL_PATTERN_LEGEND_VERSION_ID,
    role: "other",
    tag: "Connection Pattern Legend",
    title: "Connection Pattern Legend",
    x: Math.max(12, page.width - 88),
    y: 18,
    rotation: 0,
    scale: 1,
    panelPatternLegend: { visible: true }
  };
}

export function panelReferenceKindForBond(
  bond: PanelBondRecord
): PanelReferenceKind {
  return bond.target?.kind === "panel_reference"
    ? bond.target.referenceKind
    : bond.kind;
}
