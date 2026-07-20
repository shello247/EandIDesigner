"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  ArrowLeft,
  Download,
  ExternalLink,
  FileText,
  ImageIcon,
  Pencil,
  Star
} from "lucide-react";
import { getBomItemFormOptionsAction } from "../../api/actions";
import type { BomItemDetail, BomItemFormOptions } from "../../data/schema";
import { BomItemImageView } from "./bom-item-image-view";
import { categoryLabel } from "./bom-item-options";

const loadWizardModule = () => import("./bom-item-wizard-dialog");
const BomItemWizardDialog = dynamic(
  () => loadWizardModule().then((module) => module.BomItemWizardDialog),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4">
        <div
          className="rounded-md border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-700 shadow-xl"
          role="status"
        >
          Loading item editor...
        </div>
      </div>
    )
  }
);

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

function formatDate(value: string | undefined): string {
  return value ? new Date(value).toLocaleString() : "-";
}

function formatBytes(value: number): string {
  if (value >= 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(value / 1024))} KB`;
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
  item
}: {
  item: BomItemDetail;
}) {
  const router = useRouter();
  const [formOptions, setFormOptions] = useState<BomItemFormOptions | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoadingEditor, startEditorTransition] = useTransition();
  const primaryImage = item.images.find((image) => image.isPrimary) ?? item.images[0];
  const supplierWebsite = websiteHref(item.supplierWebsite);

  const handleSaved = () => {
    setFormOptions(null);
    setMessage("BOM item saved.");
    router.refresh();
  };

  const handlePersisted = () => {
    router.refresh();
  };

  const openEditor = () => {
    setMessage(null);
    startEditorTransition(async () => {
      const [optionsResult] = await Promise.all([
        getBomItemFormOptionsAction(),
        loadWizardModule()
      ]);

      if (!optionsResult.ok) {
        setMessage(optionsResult.error);
        return;
      }

      setFormOptions(optionsResult.data);
    });
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
          onClick={openEditor}
          disabled={isLoadingEditor}
        >
          <Pencil aria-hidden="true" size={14} />
          {isLoadingEditor ? "Loading..." : "Edit item"}
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
            <div className="relative grid aspect-[4/3] place-items-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
              {primaryImage ? (
                <BomItemImageView
                  src={primaryImage.imageUrl}
                  mimeType={primaryImage.mimeType}
                  alt={primaryImage.caption || primaryImage.fileName}
                  className="h-full w-full object-contain"
                  loading="eager"
                  sizes="(min-width: 1280px) 420px, 100vw"
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
                    <BomItemImageView
                      src={image.imageUrl}
                      mimeType={image.mimeType}
                      alt=""
                      className="h-full w-full object-contain"
                      sizes="96px"
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
              <div className="md:col-span-2 xl:col-span-3">
                <div className="text-[11px] font-semibold uppercase text-slate-500">
                  Product source
                </div>
                {item.productUrl ? (
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <a
                      href={item.productUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-w-0 items-center gap-1 font-semibold text-teal-800 hover:text-teal-900"
                    >
                      <span className="truncate">{item.productUrl}</span>
                      <ExternalLink aria-hidden="true" size={13} className="shrink-0" />
                    </a>
                    <span className="text-xs text-slate-500">
                      Extracted {formatDate(item.productUrlExtractedAt)}
                    </span>
                  </div>
                ) : (
                  <div className="mt-1 text-sm text-slate-950">-</div>
                )}
              </div>
            </div>
          </div>

          <div className="tool-panel overflow-hidden">
            <div className="border-b border-slate-200 px-4 py-3">
              <h2>Documents</h2>
            </div>
            {item.documents.length === 0 ? (
              <div className="p-4 text-sm text-slate-600">
                No product documents attached.
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {item.documents.map((document) => (
                  <div
                    key={document.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-slate-500">
                        <FileText aria-hidden="true" size={16} />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-950">
                          {document.title}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {document.fileName} / {formatBytes(document.sizeBytes)} /{" "}
                          {formatDate(document.createdAt)}
                        </div>
                      </div>
                    </div>
                    <a
                      className="icon-button"
                      href={document.documentUrl}
                      download={document.fileName}
                    >
                      <Download aria-hidden="true" size={14} />
                      Download
                    </a>
                  </div>
                ))}
              </div>
            )}
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

      {formOptions ? (
        <BomItemWizardDialog
          key={item.id}
          formOptions={formOptions}
          mode="edit"
          item={item}
          onClose={() => setFormOptions(null)}
          onPersisted={handlePersisted}
          onSaved={handleSaved}
        />
      ) : null}
    </div>
  );
}
