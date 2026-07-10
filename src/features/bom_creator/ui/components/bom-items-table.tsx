"use client";

import Link from "next/link";
import { ImageIcon, Pencil, Trash2 } from "lucide-react";
import type { BomItemSummary } from "../../data/schema";
import { categoryLabel } from "./bom-item-options";

function formatCost(item: BomItemSummary): string {
  if (item.unitCost === undefined) {
    return "-";
  }

  const currency = item.currency || "USD";
  return `${currency} ${item.unitCost.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function supplierSummary(item: BomItemSummary): string {
  const parts = [item.supplierName, item.supplierSku].filter(Boolean);

  if (parts.length > 0) {
    return parts.join(" / ");
  }

  return item.manufacturer ?? item.partNumber ?? "-";
}

export function BomItemsTable({
  items,
  onEdit,
  onDelete,
  busyItemId
}: {
  items: BomItemSummary[];
  onEdit: (item: BomItemSummary) => void;
  onDelete: (item: BomItemSummary) => void;
  busyItemId?: string | null;
}) {
  if (items.length === 0) {
    return (
      <div className="tool-panel flex min-h-[260px] items-center justify-center p-8 text-center">
        <div>
          <h2 className="text-lg font-bold">No BOM items yet</h2>
          <p className="mt-2 max-w-md text-sm text-slate-600">
            Create library items before linking mini BOMs to symbols.
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
            <th>Item</th>
            <th>Category</th>
            <th>Unit</th>
            <th>Supplier / Part</th>
            <th>Cost</th>
            <th>Usage</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-slate-50">
              <td>
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                    {item.primaryImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.primaryImage.dataUrl}
                        alt=""
                        className="h-full w-full object-contain"
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
              <td>{supplierSummary(item)}</td>
              <td>{formatCost(item)}</td>
              <td>
                {item.templateLineCount > 0 ? (
                  <span className="inline-flex rounded-full bg-teal-50 px-2 py-1 text-[11px] font-semibold text-teal-800">
                    {item.templateLineCount} mini BOM{" "}
                    {item.templateLineCount === 1 ? "line" : "lines"}
                  </span>
                ) : (
                  <span className="text-slate-500">Unused</span>
                )}
              </td>
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
