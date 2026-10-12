import { redirect } from "next/navigation";
import { parseDrawingListPage } from "@/features/drawing_canvas/api/report-contracts";
import { listPanelAnalysisDrawingPage } from "@/features/drawing_panel_analysis/api/server";
import { PanelAnalysisDrawingTable } from "@/features/drawing_panel_analysis/ui/components/panel-analysis-drawing-table";

export const dynamic = "force-dynamic";

export default async function PanelAnalysisPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const requestedPage = parseDrawingListPage(params.page);
  const result = await listPanelAnalysisDrawingPage(requestedPage);

  if (result.page !== requestedPage) {
    redirect(
      result.page === 1
        ? "/panel-analysis"
        : `/panel-analysis?page=${result.page}`
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-normal">Panel Analysis</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Select one saved drawing package to evaluate engineering errors, warnings, and data gaps.
        </p>
      </div>
      <PanelAnalysisDrawingTable result={result} />
    </div>
  );
}
