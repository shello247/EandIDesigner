import type { DrawingPackageSheet } from "../../data/schema";

export type DrawingWorkspaceContext =
  | "field_drawing"
  | "section_title"
  | "detailed_panel";

export type DrawingSheetPresentation = {
  workspaceContext: DrawingWorkspaceContext;
  typeLabel: "Drawing" | "Section Title" | "Detailed Panel";
  heading: "Drawing Sheet" | "Section Title Page" | "Detailed Panel Drawing";
};

export function getDrawingSheetPresentation(
  sheet: DrawingPackageSheet
): DrawingSheetPresentation {
  if (sheet.panelDrawingContext?.kind === "detailed_panel_wiring") {
    return {
      workspaceContext: "detailed_panel",
      typeLabel: "Detailed Panel",
      heading: "Detailed Panel Drawing"
    };
  }

  if (sheet.kind === "section_title") {
    return {
      workspaceContext: "section_title",
      typeLabel: "Section Title",
      heading: "Section Title Page"
    };
  }

  return {
    workspaceContext: "field_drawing",
    typeLabel: "Drawing",
    heading: "Drawing Sheet"
  };
}
