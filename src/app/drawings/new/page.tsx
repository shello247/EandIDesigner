import { NewDrawingPanel } from "@/features/drawing_canvas/ui/components/new-drawing-panel";

export default function NewDrawingPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-normal">New Drawing</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Start with a blank A3 sheet or create the first NMT81 to NRF81 sample.
        </p>
      </div>

      <NewDrawingPanel />
    </div>
  );
}

