import { Suspense } from "react";
import { notFound } from "next/navigation";
import {
  getPanelAnalysisDrawingSource,
  getSavedPanelAnalysis
} from "@/features/drawing_panel_analysis/api/server";
import { PanelAnalysisWorkspace } from "@/features/drawing_panel_analysis/ui/components/panel-analysis-workspace";

export const dynamic = "force-dynamic";

async function SavedPanelAnalysis({ drawingId }: { drawingId: string }) {
  const analysis = await getSavedPanelAnalysis(drawingId);
  if (!analysis) notFound();
  return <PanelAnalysisWorkspace analysis={analysis} />;
}

function SavedPanelAnalysisLoading() {
  return (
    <div className="space-y-4" aria-label="Analyzing saved drawing">
      <div className="tool-panel h-40 animate-pulse bg-slate-100" />
      <div className="tool-panel h-80 animate-pulse bg-slate-100" />
    </div>
  );
}

export default async function SavedPanelAnalysisPage({
  params
}: {
  params: Promise<{ drawingId: string }>;
}) {
  const { drawingId } = await params;
  const drawing = await getPanelAnalysisDrawingSource(drawingId);
  if (!drawing) notFound();

  return (
    <Suspense fallback={<SavedPanelAnalysisLoading />}>
      <SavedPanelAnalysis drawingId={drawingId} />
    </Suspense>
  );
}
