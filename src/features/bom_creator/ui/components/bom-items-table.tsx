"use client";

import Link from "next/link";
import { ImageIcon, Pencil, Trash2 } from "lucide-react";
import type { BomItemListRow } from "../../data/schema";
import { BomItemImageView } from "./bom-item-image-view";
import { categoryLabel } from "./bom-item-options";

function formatCost(item: BomItemListRow): string {
  if (item.unitCost === undefined) {
    return "-";
  }

  const currency = item.currency || "USD";
  return `${currency} ${item.unitCost.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

export function BomItemsTable({
  items,
  onEdit,
  onDelete,
  busyItemId,
  clearFiltersUrl,
  hasFilters
}: {
  items: BomItemListRow[];
  onEdit: (item: BomItemListRow) => void;
  onDelete: (item: BomItemListRow) => void;
  busyItemId?: string | null;
  clearFiltersUrl: string;
  hasFilters: boolean;
}) {
  if (items.length === 0) {
    return (
      <div className="flex min-h-[260px] items-center justify-center p-8 text-center">
        <div>
          <h2 className="text-lg font-bold">
            {hasFilters ? "No items match these filters" : "No BOM items yet"}
          </h2>
          <p className="mt-2 max-w-md text-sm text-slate-600">
            {hasFilters
              ? "Change or clear the current search and filter values."
              : "Create library items before linking mini BOMs to symbols."}
          </p>
          {hasFilters ? (
            <Link
              href={clearFiltersUrl}
              className="icon-button mt-4"
              prefetch={false}
            >
              Clear filters
            </Link>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="data-table min-w-[700px]">
        <thead>
          <tr>
            <th>Item</th>
            <th>Category</th>
            <th>Unit</th>
            <th>Cost</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-slate-50">
              <td>
                <div className="flex min-w-0 items-center gap-3">
                  <div className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                    {item.primaryImage ? (
                      <BomItemImageView
                        src={item.primaryImage.imageUrl}
                        mimeType={item.primaryImage.mimeType}
                        alt=""
                        className="h-full w-full object-contain"
                        sizes="48px"
                      />
                    ) : (
                      <ImageIcon
                        aria-hidden="true"
                        size={18}
                        className="text-slate-400"
                      />
                    )}
                  </div>
                  <div className="min-w-0">
                    <Link
                      href={`/bom/items/${item.id}`}
                      className="font-bold text-slate-950 hover:text-teal-800"
                    >
                      {item.displayName}
                    </Link>
                    <div className="mt-1 truncate text-xs text-slate-500">
                      {item.itemKey}
                      {item.partNumber ? ` / ${item.partNumber}` : ""}
                    </div>
                  </div>
                </div>
              </td>
              <td className="capitalize">{categoryLabel(item.category)}</td>
              <td>{item.unit}</td>
              <td>{formatCost(item)}</td>
              <td>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="icon-button h-8 w-8 p-0"
                    aria-label={`Edit ${item.displayName}`}
                    title="Edit item"
                    onClick={() => onEdit(item)}
                    disabled={busyItemId === item.id}
                  >
                    <Pencil aria-hidden="true" size={14} />
                  </button>
                  <button
                    type="button"
                    className="icon-button icon-button-danger h-8 w-8 p-0"
                    aria-label={`Delete ${item.displayName}`}
                    title="Delete item"
                    onClick={() => onDelete(item)}
                    disabled={busyItemId === item.id}
                  >
                    <Trash2 aria-hidden="true" size={14} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
