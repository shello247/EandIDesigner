import type { PanelDiscoveryStatus } from "../../api/public";

const STATUS_STYLES: Record<PanelDiscoveryStatus, string> = {
  available: "border-sky-200 bg-sky-50 text-sky-800",
  represented: "border-emerald-200 bg-emerald-50 text-emerald-800",
  missing: "border-rose-200 bg-rose-50 text-rose-800",
  conflicting: "border-amber-200 bg-amber-50 text-amber-900",
  unsupported: "border-slate-200 bg-slate-100 text-slate-700"
};

export function panelDiscoveryStatusLabel(status: PanelDiscoveryStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function PanelDiscoveryStatusBadge({
  status
}: {
  status: PanelDiscoveryStatus;
}) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLES[status]}`}
    >
      {panelDiscoveryStatusLabel(status)}
    </span>
  );
}
