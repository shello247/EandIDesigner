import Link from "next/link";
import { FilePlus2 } from "lucide-react";
import { listDrawings } from "@/features/drawing_canvas/data/queries";
import { DrawingTable } from "@/features/drawing_canvas/ui/components/drawing-table";

export const dynamic = "force-dynamic";

export default async function DrawingsPage() {
  const drawings = await listDrawings();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-normal">Drawings</h1>
        <Link href="/drawings/new" className="icon-button icon-button-primary">
          <FilePlus2 aria-hidden="true" size={18} />
          New drawing
        </Link>
      </div>

      <DrawingTable drawings={drawings} />
    </div>
  );
}
