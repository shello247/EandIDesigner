import {
  buildPanelScheduleWorkbook,
  parsePanelDeliverableSearchParams
} from "@/features/drawing_panel_reports/api/public";
import { buildSavedPanelDeliverables } from "@/features/drawing_panel_reports/data/queries";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function safeName(value: string) {
  return value.trim().replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "drawing";
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const options = parsePanelDeliverableSearchParams(new URL(request.url).searchParams);
    const result = await buildSavedPanelDeliverables(id, options);
    if (!result) return new Response("Drawing not found.", { status: 404 });
    const bytes = await buildPanelScheduleWorkbook(result.bundle, options.reports);
    const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const prefix = options.issueMode === "draft" ? "DRAFT_" : "";
    const fileName = `${prefix}${safeName(result.drawing.drawingKey)}_panel_deliverables.xlsx`;
    return new Response(body, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "private, max-age=0, must-revalidate"
      }
    });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Unable to export workbook.", { status: 400 });
  }
}
