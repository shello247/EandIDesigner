"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, PackageCheck, PackageX } from "lucide-react";
import { useTransition } from "react";
import type { SymbolListItem, SymbolListPage } from "../../types";
import { buildSymbolRegistryListUrl } from "../../logic/services/symbol-registry-list-url";
import { SymbolDeleteButton } from "./symbol-delete-button";
import { SymbolStatusBadge } from "./symbol-status-badge";

type SymbolTableProps = {
  categories: Array<SymbolListItem["category"]>;
  result: SymbolListPage;
};

function ItemAssociation({ count }: { count: number }) {
  if (count === 0) {
    return (
      <span
        className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-slate-500"
        title="This symbol has no Items Library records in its Mini BOM."
      >
        <PackageX aria-hidden="true" size={14} />
        Not linked
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-teal-300 bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-800"
      title={`${count} Items Library ${count === 1 ? "record" : "records"} linked through this symbol's Mini BOM.`}
    >
      <PackageCheck aria-hidden="true" size={14} />
      Linked · {count}
    </span>
  );
}

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
        className="icon-button pointer-events-none min-h-8 px-2 py-1 text-xs opacity-45"
      >
        {children}
      </span>
    );
  }

  return (
    <Link
      aria-label={label}
      className="icon-button min-h-8 px-2 py-1 text-xs"
      href={href}
      prefetch={false}
    >
      {children}
    </Link>
  );
}

export function SymbolTable({ categories, result }: SymbolTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const selectedCategoryId = result.categoryId ?? "all";

  if (result.totalCount === 0 && !result.categoryId) {
    return (
      <div className="tool-panel flex min-h-[260px] items-center justify-center p-8 text-center">
        <div>
          <h2 className="text-lg font-bold">No symbols yet</h2>
          <p className="mt-2 max-w-md text-sm text-slate-600">
            Import an approved SVG symbol, validate its terminal map, then
            approve it into the registry.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="tool-panel overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 px-3 py-2">
        <label className="grid min-w-56 gap-1 text-xs font-semibold text-slate-700">
          Category
          <select
            aria-label="Filter symbols by category"
            className="field-control h-9 py-1.5"
            disabled={isPending}
            onChange={(event) => {
              const categoryId = event.currentTarget.value;
              startTransition(() => {
                router.push(
                  buildSymbolRegistryListUrl({
                    categoryId: categoryId === "all" ? undefined : categoryId,
                    page: 1
                  })
                );
              });
            }}
            value={selectedCategoryId}
          >
            <option value="all">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <span className="pb-1 text-xs text-slate-500">
          {result.totalCount} {result.totalCount === 1 ? "symbol" : "symbols"}
        </span>
      </div>
      <table className="data-table table-fixed [&_td]:!py-1.5 [&_td]:!align-middle [&_th]:!py-1.5">
        <colgroup>
          <col className="w-[36%]" />
          <col className="w-[16%]" />
          <col className="w-[12%]" />
          <col className="w-[16%]" />
          <col className="w-[8%]" />
          <col className="w-[12%]" />
        </colgroup>
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Category</th>
            <th>Status</th>
            <th>Item association</th>
            <th>Version</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {result.items.map((symbol) => (
            <tr key={symbol.id} className="hover:bg-slate-50">
              <td>
                <Link
                  href={`/symbols/${symbol.id}`}
                  className="font-normal leading-5 text-slate-950 hover:text-teal-800"
                >
                  {symbol.displayName}
                </Link>
              </td>
              <td className="whitespace-nowrap">
                {symbol.category.name}
              </td>
              <td className="whitespace-nowrap">
                <SymbolStatusBadge status={symbol.status} />
              </td>
              <td>
                <ItemAssociation count={symbol.linkedItemCount} />
              </td>
              <td className="whitespace-nowrap">
                {symbol.latestVersionNumber ?? "-"}
              </td>
              <td className="whitespace-nowrap">
                <SymbolDeleteButton
                  displayName={symbol.displayName}
                  symbolId={symbol.id}
                  symbolKey={symbol.symbolKey}
                />
              </td>
            </tr>
          ))}
          {result.items.length === 0 ? (
            <tr>
              <td
                className="py-8 text-center text-sm text-slate-500"
                colSpan={6}
              >
                No symbols are assigned to this category.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
      <nav
        aria-label="Symbol Registry pages"
        className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600"
      >
        <span className="font-medium">
          {result.totalCount === 0
            ? "No symbols"
            : `${(result.page - 1) * result.pageSize + 1}–${Math.min(
                result.page * result.pageSize,
                result.totalCount
              )} of ${result.totalCount} symbols`}
        </span>
        <div className="flex items-center gap-2">
          <PageControl
            disabled={result.page <= 1}
            href={buildSymbolRegistryListUrl({
              categoryId: result.categoryId,
              page: result.page - 1
            })}
            label="Previous symbols page"
          >
            <ChevronLeft aria-hidden="true" size={14} />
            Previous
          </PageControl>
          <span className="min-w-24 text-center font-semibold text-slate-700">
            Page {result.page} of {result.totalPages}
          </span>
          <PageControl
            disabled={result.page >= result.totalPages}
            href={buildSymbolRegistryListUrl({
              categoryId: result.categoryId,
              page: result.page + 1
            })}
            label="Next symbols page"
          >
            Next
            <ChevronRight aria-hidden="true" size={14} />
          </PageControl>
        </div>
      </nav>
    </div>
  );
}
