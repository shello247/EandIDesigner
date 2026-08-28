import Link from "next/link";
import { redirect } from "next/navigation";
import { FilePlus2 } from "lucide-react";
import { listDrawingPage } from "@/features/drawing_canvas/data/queries";
import { parseDrawingListPage } from "@/features/drawing_canvas/data/schema";
import { DrawingTable } from "@/features/drawing_canvas/ui/components/drawing-table";

export const dynamic = "force-dynamic";

export default async function DrawingsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const requestedPage = parseDrawingListPage(params.page);
  const result = await listDrawingPage(requestedPage);

  if (result.page !== requestedPage) {
    redirect(result.page === 1 ? "/drawings" : `/drawings?page=${result.page}`);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-normal">Drawings</h1>
        <Link href="/drawings/new" className="icon-button icon-button-primary">
          <FilePlus2 aria-hidden="true" size={18} />
          New drawing
        </Link>
      </div>

      <DrawingTable result={result} />
    </div>
  );
}
