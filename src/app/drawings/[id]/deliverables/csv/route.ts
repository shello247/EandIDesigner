import { buildPanelScheduleCsv } from "@/features/drawing_panel_reports/api/public";
import { buildSavedPanelDeliverables } from "@/features/drawing_panel_reports/data/queries";
import { parsePanelDeliverableSearchParams } from "@/features/drawing_panel_reports/api/public";
import type { PanelReportKind } from "@/features/drawing_panel_reports/api/public";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const reportKinds = new Set<PanelReportKind>([
  "terminal_schedule",
  "internal_wire_schedule",
  "panel_asset_schedule",
  "bom"
]);

function safeName(value: string) {
  return value.trim().replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "drawing";
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const report = url.searchParams.get("report") as PanelReportKind | null;
    if (!report || !reportKinds.has(report)) {
      return new Response("A valid report query parameter is required.", { status: 400 });
    }
    url.searchParams.set("reports", report);
    const options = parsePanelDeliverableSearchParams(url.searchParams);
    const result = await buildSavedPanelDeliverables(id, options);
    if (!result) return new Response("Drawing not found.", { status: 404 });
    const prefix = options.issueMode === "draft" ? "DRAFT_" : "";
    const fileName = `${prefix}${safeName(result.drawing.drawingKey)}_${report}.csv`;
    return new Response(buildPanelScheduleCsv(result.bundle, report), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "private, max-age=0, must-revalidate"
      }
    });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Unable to export CSV.", { status: 400 });
  }
}
