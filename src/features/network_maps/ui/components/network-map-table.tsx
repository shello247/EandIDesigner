import Link from "next/link";
import type { NetworkMapListItem } from "../../types";

const statusLabels: Record<NetworkMapListItem["status"], string> = {
  draft: "Draft",
  needs_review: "Needs review",
  approved: "Approved",
  archived: "Archived"
};

export function NetworkMapTable({
  networkMaps
}: {
  networkMaps: NetworkMapListItem[];
}) {
  if (networkMaps.length === 0) {
    return (
      <div className="tool-panel flex min-h-[220px] items-center justify-center p-8 text-center">
        <div>
          <h2 className="text-lg font-bold">No network maps yet</h2>
          <p className="mt-2 max-w-md text-sm text-slate-600">
            Create a network map package to open a blank Networking canvas.
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
            <th>Network map</th>
            <th>Status</th>
            <th>Sheets</th>
            <th>Nodes</th>
            <th>Links</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          {networkMaps.map((networkMap) => (
            <tr key={networkMap.id} className="hover:bg-slate-50">
              <td>
                <Link
                  href={`/networking/${networkMap.id}`}
                  className="font-bold text-slate-950 hover:text-teal-800"
                >
                  {networkMap.title}
                </Link>
                <div className="mt-1 text-xs text-slate-500">
                  {networkMap.mapKey}
                </div>
              </td>
              <td>{statusLabels[networkMap.status]}</td>
              <td>{networkMap.sheetCount}</td>
              <td>{networkMap.nodeCount}</td>
              <td>{networkMap.linkCount}</td>
              <td>{new Date(networkMap.updatedAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
