import Link from "next/link";
import type { DrawingListItem } from "../../types";
import { DrawingDeleteButton } from "./drawing-delete-button";

const statusLabels: Record<DrawingListItem["status"], string> = {
  draft: "Draft",
  needs_review: "Needs review",
  approved: "Approved",
  archived: "Archived"
};

export function DrawingTable({ drawings }: { drawings: DrawingListItem[] }) {
  if (drawings.length === 0) {
    return (
      <div className="tool-panel flex min-h-[260px] items-center justify-center p-8 text-center">
        <div>
          <h2 className="text-lg font-bold">No drawings yet</h2>
          <p className="mt-2 max-w-md text-sm text-slate-600">
            Create a drawing, place symbols, connect anchors, and save
            a structured engineering sheet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="tool-panel overflow-hidden">
      <table className="data-table">
        <thead>
          <tr>
            <th>Drawing</th>
            <th>Status</th>
            <th>Sheets</th>
            <th>Updated</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {drawings.map((drawing) => (
            <tr key={drawing.id} className="hover:bg-slate-50">
              <td>
                <Link
                  href={`/drawings/${drawing.id}`}
                  className="font-bold text-slate-950 hover:text-teal-800"
                >
                  {drawing.title}
                </Link>
              </td>
              <td>{statusLabels[drawing.status]}</td>
              <td>{drawing.sheetCount}</td>
              <td>{new Date(drawing.updatedAt).toLocaleString()}</td>
              <td>
                <DrawingDeleteButton
                  drawingId={drawing.id}
                  title={drawing.title}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
