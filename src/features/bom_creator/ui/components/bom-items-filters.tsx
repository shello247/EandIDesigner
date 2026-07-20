"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useTransition } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import type {
  BomItemAppliedFilters,
  BomItemFilterOptions,
  BomItemOption
} from "../../data/schema";
import {
  buildBomItemListUrl,
  hasBomItemFilters
} from "../../logic/services/bom-item-list-url";

function includeSelected(
  options: BomItemOption[],
  selected: string | undefined
): BomItemOption[] {
  if (!selected || options.some((option) => option.value === selected)) {
    return options;
  }

  return [{ value: selected, label: selected }, ...options];
}

export function BomItemsFilters({
  filters,
  options,
  pageSize
}: {
  filters: BomItemAppliedFilters;
  options: BomItemFilterOptions;
  pageSize: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const categories = includeSelected(options.categories, filters.category);
  const manufacturers = includeSelected(
    options.manufacturers,
    filters.manufacturer
  );
  const clearUrl = buildBomItemListUrl({
    filters: {},
    page: 1,
    pageSize
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const nextFilters = {
      query: String(formData.get("q") ?? "").trim() || undefined,
      category:
        String(formData.get("category") ?? "").trim() || undefined,
      manufacturer:
        String(formData.get("manufacturer") ?? "").trim() || undefined
    };
    const requestedPageSize = Number(formData.get("pageSize"));

    startTransition(() => {
      router.push(
        buildBomItemListUrl({
          filters: nextFilters,
          page: 1,
          pageSize: [25, 50, 100].includes(requestedPageSize)
            ? requestedPageSize
            : 50
        })
      );
    });
  };

  return (
    <form
      key={`${filters.query ?? ""}|${filters.category ?? ""}|${filters.manufacturer ?? ""}|${pageSize}`}
      className="tool-panel grid gap-3 p-4 lg:grid-cols-[minmax(240px,1.5fr)_minmax(170px,1fr)_minmax(190px,1fr)_110px_auto] lg:items-end"
      method="get"
      onSubmit={submit}
    >
      <div>
        <label className="field-label" htmlFor="bom-item-search">
          Search
        </label>
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={15}
          />
          <input
            id="bom-item-search"
            name="q"
            className="field-input pl-9"
            defaultValue={filters.query ?? ""}
            maxLength={120}
            placeholder="Item key, name, part, manufacturer, supplier"
          />
        </div>
      </div>
      <div>
        <label className="field-label" htmlFor="bom-item-category-filter">
          Category
        </label>
        <select
          id="bom-item-category-filter"
          name="category"
          className="field-input"
          defaultValue={filters.category ?? ""}
        >
          <option value="">All categories</option>
          {categories.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="field-label" htmlFor="bom-item-manufacturer-filter">
          Manufacturer
        </label>
        <select
          id="bom-item-manufacturer-filter"
          name="manufacturer"
          className="field-input"
          defaultValue={filters.manufacturer ?? ""}
        >
          <option value="">All manufacturers</option>
          {manufacturers.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="field-label" htmlFor="bom-item-page-size">
          Rows
        </label>
        <select
          id="bom-item-page-size"
          name="pageSize"
          className="field-input"
          defaultValue={String(pageSize)}
        >
          <option value="25">25</option>
          <option value="50">50</option>
          <option value="100">100</option>
        </select>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          className="icon-button icon-button-primary"
          disabled={isPending}
        >
          <SlidersHorizontal aria-hidden="true" size={14} />
          {isPending ? "Applying..." : "Apply"}
        </button>
        {hasBomItemFilters(filters) ? (
          <Link href={clearUrl} className="icon-button" prefetch={false}>
            <X aria-hidden="true" size={14} />
            Clear
          </Link>
        ) : null}
      </div>
    </form>
  );
}
