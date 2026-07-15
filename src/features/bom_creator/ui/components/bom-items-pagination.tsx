import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { BomItemListResult } from "../../data/schema";
import { buildBomItemListUrl } from "../../logic/services/bom-item-list-url";

function PageControl({
  children,
  disabled,
  href,
  label
}: {
  children: React.ReactNode;
  disabled: boolean;
  href: string;
  label: string;
}) {
  if (disabled) {
    return (
      <span
        aria-disabled="true"
        className="icon-button pointer-events-none opacity-45"
      >
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className="icon-button"
      aria-label={label}
      prefetch={false}
    >
      {children}
    </Link>
  );
}

export function BomItemsPagination({ result }: { result: BomItemListResult }) {
  const start = result.totalItems === 0 ? 0 : (result.page - 1) * result.pageSize + 1;
  const end = Math.min(result.page * result.pageSize, result.totalItems);

  return (
    <nav
      aria-label="Items Library pagination"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3"
    >
      <div className="text-xs font-semibold text-slate-600">
        {start}-{end} of {result.totalItems} items
      </div>
      <div className="flex items-center gap-2">
        <PageControl
          disabled={result.page <= 1}
          href={buildBomItemListUrl({
            filters: result.appliedFilters,
            page: result.page - 1,
            pageSize: result.pageSize
          })}
          label="Previous items page"
        >
          <ChevronLeft aria-hidden="true" size={14} />
          Previous
        </PageControl>
        <span className="min-w-24 text-center text-xs font-semibold text-slate-700">
          Page {result.page} of {result.totalPages}
        </span>
        <PageControl
          disabled={result.page >= result.totalPages}
          href={buildBomItemListUrl({
            filters: result.appliedFilters,
            page: result.page + 1,
            pageSize: result.pageSize
          })}
          label="Next items page"
        >
          Next
          <ChevronRight aria-hidden="true" size={14} />
        </PageControl>
      </div>
    </nav>
  );
}
