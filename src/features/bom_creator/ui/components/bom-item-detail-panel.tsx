"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  ExternalLink,
  ImageIcon,
  Pencil,
  Star
} from "lucide-react";
import type { BomItemDetail, BomItemFormOptions } from "../../data/schema";
import { BomItemWizardDialog } from "./bom-item-wizard-dialog";
import { categoryLabel } from "./bom-item-options";

function valueOrDash(value: string | number | undefined): string {
  return value === undefined || value === "" ? "-" : String(value);
}

function formatCost(item: BomItemDetail): string {
  if (item.unitCost === undefined) {
    return "-";
  }

  return `${item.currency || "USD"} ${item.unitCost.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function websiteHref(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function DetailField({
  label,
  value
}: {
  label: string;
  value: string | number | undefined;
}) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-sm text-slate-950">{valueOrDash(value)}</div>
    </div>
  );
}

export function BomItemDetailPanel({
  formOptions,
  item
}: {
  formOptions: BomItemFormOptions;
  item: BomItemDetail;
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const primaryImage = item.images.find((image) => image.isPrimary) ?? item.images[0];
  const supplierWebsite = websiteHref(item.supplierWebsite);

  const handleSaved = () => {
    setMessage("BOM item saved.");
    router.refresh();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href="/bom/items"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-teal-800"
          >
            <ArrowLeft aria-hidden="true" size={14} />
            Items Library
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-normal text-slate-950">
              {item.displayName}
            </h1>
            <span
              className={[
                "rounded-full px-2 py-1 text-[11px] font-semibold",
                item.status === "active"
                  ? "bg-teal-50 text-teal-800"
                  : "bg-slate-100 text-slate-600"
              ].join(" ")}
            >
              {item.status}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {item.itemKey} / {categoryLabel(item.category)} / {item.unit}
          </p>
        </div>
        <button
          type="button"
          className="icon-button icon-button-primary"
          onClick={() => setIsEditing(true)}
        >
          <Pencil aria-hidden="true" size={14} />
          Edit item
        </button>
      </div>

      {message ? (
        <div className="rounded-md border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-700">
          {message}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className="tool-panel overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2>Images</h2>
          </div>
          <div className="p-4">
            <div className="grid aspect-[4/3] place-items-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
              {primaryImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={primaryImage.dataUrl}
                  alt={primaryImage.caption || primaryImage.fileName}
                  className="h-full w-full object-contain"
                />
              ) : (
                <ImageIcon aria-hidden="true" size={28} className="text-slate-400" />
              )}
            </div>
            {primaryImage?.caption ? (
              <div className="mt-2 text-xs text-slate-600">{primaryImage.caption}</div>
            ) : null}
            {item.images.length > 0 ? (
              <div className="mt-4 grid grid-cols-4 gap-2">
                {item.images.map((image) => (
                  <div
                    key={image.id}
                    className="relative aspect-square overflow-hidden rounded-md border border-slate-200 bg-slate-50"
                    title={image.caption || image.fileName}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={image.dataUrl}
                      alt=""
                      className="h-full w-full object-contain"
                    />
                    {image.isPrimary ? (
                      <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-teal-600 text-white">
                        <Star aria-hidden="true" size={11} fill="currentColor" />
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid gap-5">
          <div className="tool-panel overflow-hidden">
            <div className="border-b border-slate-200 px-4 py-3">
              <h2>General Information</h2>
            </div>
            <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
              <DetailField label="Manufacturer" value={item.manufacturer} />
              <DetailField label="Part number" value={item.partNumber} />
              <DetailField label="Model" value={item.model} />
              <div className="md:col-span-2 xl:col-span-3">
                <DetailField label="Description" value={item.description} />
              </div>
              <div className="md:col-span-2 xl:col-span-3">
                <DetailField label="Notes" value={item.notes} />
              </div>
            </div>
          </div>

          <div className="tool-panel overflow-hidden">
            <div className="border-b border-slate-200 px-4 py-3">
              <h2>Cost & Supplier</h2>
            </div>
            <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
              <DetailField label="Supplier" value={item.supplierName} />
              <DetailField label="Supplier SKU" value={item.supplierSku} />
              <DetailField label="Unit cost" value={formatCost(item)} />
              <DetailField label="Lead time days" value={item.leadTimeDays} />
              <DetailField label="MOQ" value={item.minimumOrderQuantity} />
              <DetailField label="Contact" value={item.supplierContactName} />
              <DetailField label="Email" value={item.supplierEmail} />
              <DetailField label="Phone" value={item.supplierPhone} />
              <div>
                <div className="text-[11px] font-semibold uppercase text-slate-500">
                  Website
                </div>
                {supplierWebsite ? (
                  <a
                    href={supplierWebsite}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-teal-800 hover:text-teal-900"
                  >
                    {item.supplierWebsite}
                    <ExternalLink aria-hidden="true" size={13} />
                  </a>
                ) : (
                  <div className="mt-1 text-sm text-slate-950">-</div>
                )}
              </div>
              <div className="md:col-span-2 xl:col-span-3">
                <DetailField label="Cost notes" value={item.costNotes} />
              </div>
            </div>
          </div>

          <div className="tool-panel overflow-hidden">
            <div className="border-b border-slate-200 px-4 py-3">
              <h2>Mini BOM Usage</h2>
            </div>
            {item.usage.length === 0 ? (
              <div className="p-4 text-sm text-slate-600">
                This item is not referenced by a symbol mini BOM.
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Rule</th>
                    <th>Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {item.usage.map((usage) => (
                    <tr key={usage.lineId} className="hover:bg-slate-50">
                      <td>
                        <Link
                          href={`/symbols/${usage.symbolId}`}
                          className="font-bold text-slate-950 hover:text-teal-800"
                        >
                          {usage.displayName}
                        </Link>
                        <div className="mt-1 text-xs text-slate-500">
                          {usage.symbolKey}
                        </div>
                      </td>
                      <td>{usage.quantityRule.replace(/_/g, " ")}</td>
                      <td>{usage.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {isEditing ? (
        <BomItemWizardDialog
          key={item.id}
          formOptions={formOptions}
          mode="edit"
          item={item}
          onClose={() => setIsEditing(false)}
          onSaved={handleSaved}
        />
      ) : null}
    </div>
  );
}
