import { notFound } from "next/navigation";
import { listSymbolsForDrawing } from "@/features/symbol_registry/api/public";
import { getDrawingDetail } from "@/features/drawing_canvas/data/queries";
import { buildDrawingPdfPrintHtml } from "@/features/drawing_canvas/logic/services/drawing-pdf-export";
import { toSheetCanvasModel } from "@/features/drawing_canvas/logic/commands/drawing-sheet-commands";
import { renderDrawingToSvg } from "@/features/drawing_canvas/logic/services/drawing-svg-renderer";
import { buildDrawingSectionIndex } from "@/features/drawing_canvas/logic/services/drawing-sections";
import { createPanelWiringSource } from "@/features/drawing_canvas/api/panel-wiring-contracts";
import {
  buildPackageConnectivityGraph,
  buildPlacementWireContextDisplayIndex
} from "@/features/drawing_panel_wiring/api/public";
import {
  buildPlacementConnectionDisplayModeIndex,
  collectPlacementWireContextRequests
} from "@/features/drawing_canvas/logic/services/drawing-placement-connection-display";
import {
  parsePanelDeliverableSearchParams,
  renderPanelScheduleForPrint
} from "@/features/drawing_panel_reports/api/public";
import { buildSavedPanelDeliverables } from "@/features/drawing_panel_reports/data/queries";
import { collectDrawingSymbolVersionIds } from "@/features/drawing_canvas/logic/services/drawing-symbol-version-references";
import {
  buildConnectedWireScheduleIndex,
  isConnectedWireScheduleAnnotation
} from "@/features/drawing_connected_wire_schedule/api/public";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const drawing = await getDrawingDetail(id);

  if (!drawing) {
    notFound();
  }
  const symbols = await listSymbolsForDrawing(
    collectDrawingSymbolVersionIds(drawing.model)
  );

  const sheetCount = drawing.model.sheets.length;
  const sectionIndex = buildDrawingSectionIndex(drawing.model);
  const placementWireContextRequests = collectPlacementWireContextRequests(
    drawing.model
  );
  const placementConnectionDisplayModes =
    buildPlacementConnectionDisplayModeIndex(drawing.model);
  const connectedWireSchedulesBySheetId = new Map(
    drawing.model.sheets.map((sheet) => [
      sheet.id,
      sheet.annotations.filter(isConnectedWireScheduleAnnotation)
    ])
  );
  const hasConnectedWireSchedules = [...connectedWireSchedulesBySheetId.values()].some(
    (annotations) => annotations.length > 0
  );
  const needsConnectivityGraph =
    hasConnectedWireSchedules ||
    placementWireContextRequests.length > 0 ||
    drawing.model.sheets.some((sheet) => Boolean(sheet.panelDrawingContext));
  const connectivityGraph = needsConnectivityGraph
    ? buildPackageConnectivityGraph(
        createPanelWiringSource(drawing.model, symbols)
      )
    : undefined;
  const placementWireContextBySheetId = connectivityGraph
    ? buildPlacementWireContextDisplayIndex({
        graph: connectivityGraph,
        requests: placementWireContextRequests
      }).rowsBySheetId
    : new Map();
  const connectedWireScheduleIndex = connectivityGraph
      ? buildConnectedWireScheduleIndex({
          graph: connectivityGraph,
          schedulesBySheetId: connectedWireSchedulesBySheetId,
          displayModesBySheetPlacement: placementConnectionDisplayModes
        })
    : new Map();
  const drawingPages = drawing.model.sheets.map((sheet, index) => {
    const sheetModel = toSheetCanvasModel(drawing.model, sheet.id);
    const sectionTitle = sheet.sectionTitlePage?.title?.trim();
    const sectionMembership = sectionIndex.membershipBySheetId.get(sheet.id);

    return {
      sheet: sheetModel.sheet,
      svg: renderDrawingToSvg({
        model: sheetModel,
        approvedSymbols: symbols,
        assets: drawing.model.assets,
        showAnchors: false,
        showConnections: true,
        sheetNumber: index + 1,
        sheetCount,
        drawingTitle: drawing.title,
        sheetTitle:
          sheet.kind === "section_title" && sectionTitle
            ? sectionTitle
            : sheet.name,
        sheetKind: sheet.kind,
        sectionTitlePage: sheet.sectionTitlePage,
        derivedSectionNumber:
          sectionMembership?.kind === "section"
            ? sectionMembership.sectionNumber
            : undefined,
        panelInternalWires: drawing.model.panelWiring?.internalWires,
        panelConnectionPatterns: [
          ...(drawing.model.panelWiring?.bridges ?? []).map((record) => ({
            recordType: "bridge" as const,
            record
          })),
          ...(drawing.model.panelWiring?.bonds ?? []).map((record) => ({
            recordType: "bond" as const,
            record
          }))
        ],
        placementWireContextRows:
          placementWireContextBySheetId.get(sheet.id) ?? [],
        connectedWireScheduleProjections:
          connectedWireScheduleIndex,
        connectionVisibility: sheet.panelDrawingContext ? "panel_internal" : "field",
        measurementUnit: drawing.model.measurementUnit ?? "mm"
      })
    };
  });
  const url = new URL(request.url);
  const composition = url.searchParams.get("composition") ?? "drawings_only";
  let pages = drawingPages;

  if (composition !== "drawings_only") {
    try {
      const options = parsePanelDeliverableSearchParams(url.searchParams);
      const deliverables = await buildSavedPanelDeliverables(id, options);
      if (!deliverables) notFound();
      const schedulePages = renderPanelScheduleForPrint(
        deliverables.bundle,
        options.reports
      );
      pages = composition === "schedules_only"
        ? schedulePages
        : [...drawingPages, ...schedulePages];
    } catch (error) {
      return new Response(
        error instanceof Error ? error.message : "Unable to build panel schedules.",
        { status: 400 }
      );
    }
  }

  return new Response(
    buildDrawingPdfPrintHtml({
      title: drawing.title,
      pages,
      drawingUrl: `/drawings/${drawing.id}`
    }),
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, max-age=0, must-revalidate"
      }
    }
  );
}
