import Link from "next/link";
import { AlertTriangle } from "lucide-react";
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
            Create a drawing, place approved symbols, connect anchors, and save
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
            <th>Placements</th>
            <th>Connections</th>
            <th>Issues</th>
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
                <div className="mt-1 text-xs text-slate-500">
                  {drawing.drawingKey}
                </div>
              </td>
              <td>{statusLabels[drawing.status]}</td>
              <td>{drawing.placementCount}</td>
              <td>{drawing.connectionCount}</td>
              <td>
                {drawing.blockingIssueCount > 0 ? (
                  <span className="inline-flex items-center gap-1 font-bold text-red-700">
                    <AlertTriangle aria-hidden="true" size={15} />
                    {drawing.blockingIssueCount}
                  </span>
                ) : (
                  <span className="text-slate-500">0</span>
                )}
              </td>
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
