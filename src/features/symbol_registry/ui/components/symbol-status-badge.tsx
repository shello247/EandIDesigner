import type { SymbolStatus } from "../../data/schema";

const STATUS_STYLES: Record<SymbolStatus, string> = {
  draft: "border-slate-300 bg-slate-50 text-slate-700",
  needs_review: "border-amber-300 bg-amber-50 text-amber-800",
  approved: "border-teal-300 bg-teal-50 text-teal-800",
  archived: "border-slate-300 bg-slate-100 text-slate-500"
};

const STATUS_LABELS: Record<SymbolStatus, string> = {
  draft: "Draft",
  needs_review: "Needs review",
  approved: "Approved",
  archived: "Archived"
};

export function SymbolStatusBadge({ status }: { status: SymbolStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
