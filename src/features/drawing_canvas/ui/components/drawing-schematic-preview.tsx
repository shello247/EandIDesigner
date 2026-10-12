"use client";
import { useMemo } from "react";
import type { DrawingModel } from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import { buildDrawingSchematicPreview } from "../../logic/services/drawing-schematic-preview";
import { SchematicPreview } from "@/features/schematic_preview/api/public-ui";
import type { PanelWiringSourcePackage } from "@/features/drawing_panel_wiring/api/public";

export function DrawingSchematicPreview({ model, sheetId, symbols, panelSource, toolbarHost }: { model: DrawingModel; sheetId: string; symbols: ApprovedDrawingSymbol[]; panelSource?: PanelWiringSourcePackage; toolbarHost: HTMLDivElement | null }) {
  const source = useMemo(() => buildDrawingSchematicPreview(model, sheetId, symbols, panelSource), [model, sheetId, symbols, panelSource]);
  return <SchematicPreview key={sheetId} source={source} presentation={{ kind: "embedded", toolbarHost }} />;
}
