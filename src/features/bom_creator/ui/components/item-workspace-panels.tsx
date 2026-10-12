"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { Building2, CalendarClock, CircleDollarSign, FileText, ImageIcon, NotebookPen, Package, Pencil, Shapes, ShoppingCart } from "lucide-react";
import { WorkspaceCard, WorkspaceEmpty, WorkspaceHeading, WorkspaceMetric, WorkspaceValue } from "@/shared/ui/item-workspace-presentation";
import { ItemWorkspaceMessage, useItemWorkspace } from "@/features/item_engineering/ui/public";
import { getItemDeviceTypeLabel } from "@/features/item_engineering/api/public";
import type { ItemOverview } from "../../data/item-workspace";
import type { BomItemUsage } from "../../data/schema";
import { loadItemWorkspaceUsageAction } from "../../api/item-workspace-actions";
import { displayItemValue, formatItemUsageQuantity, formatRecordedQuantity, formatSavedUnitCost, itemContactHref } from "../../logic/services/item-workspace-presentation";
import { BomItemImageView } from "./bom-item-image-view";
const DetailsDialog = dynamic(() => import("./item-details-dialog").then(module => module.ItemDetailsDialog));
const ImagesDialog = dynamic(() => import("./item-images-dialog").then(module => module.ItemImagesDialog));
const PurchasingDialog = dynamic(() => import("./item-purchasing-dialog").then(module => module.ItemPurchasingDialog));

function ContactValue({ kind, value }: { kind: "website" | "email" | "phone"; value?: string }) {
  const href = itemContactHref(kind, value);
  return href ? <a href={href} target={kind === "website" ? "_blank" : undefined} rel={kind === "website" ? "noopener noreferrer" : undefined} className="text-teal-700 underline decoration-teal-200 underline-offset-4 hover:decoration-teal-700">{value}</a> : <>{displayItemValue(value)}</>;
}
export function ItemCommercialPanel({ item, onUpdated }: { item: ItemOverview; onUpdated: (item: ItemOverview) => void }) {
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { readOnly } = useItemWorkspace();
  const trigger = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);
  useEffect(() => {
    if (editing) { wasEditing.current = true; return; }
    if (!wasEditing.current) return;
    // Restore focus after the modal has left the DOM and the page is no longer inert.
    const frame = requestAnimationFrame(() => trigger.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [editing]);
  return <div className="space-y-4">
    <WorkspaceHeading title="Cost & Supplier" icon={CircleDollarSign} detail="Saved purchasing information" action={!readOnly && <button ref={trigger} className="icon-button icon-button-primary" onClick={() => { setMessage(null); setEditing(true); }}><Pencil size={14} aria-hidden="true" />Edit purchasing</button>} />
    <ItemWorkspaceMessage message={message} kind="success" />
    <div className="grid gap-3 sm:grid-cols-3">
      <WorkspaceMetric label="Saved unit cost" value={formatSavedUnitCost(item.unitCost, item.currency)} detail={item.unit?.trim() ? "per " + item.unit : "Unit unspecified"} icon={CircleDollarSign} />
      <WorkspaceMetric label="Recorded lead time" value={formatRecordedQuantity(item.leadTimeDays, " days")} detail="Saved supplier estimate" icon={CalendarClock} />
      <WorkspaceMetric label="Minimum order quantity" value={formatRecordedQuantity(item.minimumOrderQuantity)} detail={item.unit?.trim() ? item.unit : "Unit unspecified"} icon={ShoppingCart} />
    </div>
    <WorkspaceCard title="Supplier" icon={Building2}>
      <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
        <WorkspaceValue label="Supplier">{displayItemValue(item.supplierName)}</WorkspaceValue><WorkspaceValue label="Supplier SKU">{displayItemValue(item.supplierSku)}</WorkspaceValue>
        <WorkspaceValue label="Contact">{displayItemValue(item.supplierContactName)}</WorkspaceValue>
        <WorkspaceValue label="Email"><ContactValue kind="email" value={item.supplierEmail} /></WorkspaceValue>
        <WorkspaceValue label="Phone"><ContactValue kind="phone" value={item.supplierPhone} /></WorkspaceValue>
        <WorkspaceValue label="Supplier website"><ContactValue kind="website" value={item.supplierWebsite} /></WorkspaceValue>
        {item.unitCost === undefined && <WorkspaceValue label="Currency">{displayItemValue(item.currency)}</WorkspaceValue>}
      </dl>
    </WorkspaceCard>
    <WorkspaceCard title="Purchasing notes" icon={NotebookPen}><p className="whitespace-pre-wrap leading-relaxed text-slate-700">{displayItemValue(item.costNotes)}</p></WorkspaceCard>
    {editing && <PurchasingDialog item={item} onUpdated={onUpdated} onSaved={() => setMessage("Purchasing details saved.")} onClose={() => setEditing(false)} />}
  </div>;
}
export function ItemOverviewPanel({ item, onUpdated }: { item: ItemOverview; onUpdated: (item: ItemOverview) => void }) {
  const [selected, setSelected] = useState(item.images.find(image => image.isPrimary)?.id ?? item.images[0]?.id);
  const [dialog, setDialog] = useState<"details" | "images" | null>(null);
  const detailsTrigger = useRef<HTMLButtonElement>(null);
  const imagesTrigger = useRef<HTMLButtonElement>(null);
  const lastDialog = useRef<typeof dialog>(null);
  useEffect(() => {
    if (dialog) { lastDialog.current = dialog; return; }
    if (!lastDialog.current) return;
    const trigger = lastDialog.current === "details" ? detailsTrigger : imagesTrigger;
    const frame = requestAnimationFrame(() => trigger.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [dialog]);
  const { readOnly } = useItemWorkspace();
  const image = item.images.find(image => image.id === selected) ?? item.images.find(image => image.isPrimary) ?? item.images[0];
  return <div className="space-y-4">
    <WorkspaceHeading title="Overview" icon={Package} detail="Product identity and catalogue information" action={!readOnly && <button ref={detailsTrigger} className="icon-button icon-button-primary" onClick={() => setDialog("details")}><Pencil size={14} aria-hidden="true" />Edit details</button>} />
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.2fr)]">
      <WorkspaceCard title="Images" icon={ImageIcon} action={!readOnly && <button ref={imagesTrigger} className="icon-button" onClick={() => setDialog("images")}>Manage images</button>}>
        {image ? <div className="relative h-80 overflow-hidden rounded-lg border border-slate-100 bg-slate-50/60"><BomItemImageView src={image.imageUrl} mimeType={image.mimeType} alt={image.caption ?? item.displayName} sizes="(min-width: 1024px) 40vw, 90vw" className="object-contain" /></div> : <WorkspaceEmpty title="No product images." description="Add a product photograph to help identify this Item." icon={ImageIcon} />}
        {!!item.images.length && <div className="mt-3 flex flex-wrap gap-2">{item.images.map(entry => <button key={entry.id} aria-label={`Show image ${entry.fileName}`} aria-pressed={entry.id === image?.id} onClick={() => setSelected(entry.id)}
          className={`relative h-16 w-16 overflow-hidden rounded-lg border ${image?.id === entry.id ? "border-teal-600 ring-2 ring-teal-100" : "border-slate-200 hover:border-teal-300"}`}><BomItemImageView src={entry.imageUrl} mimeType={entry.mimeType} alt={entry.caption ?? entry.fileName} sizes="64px" className="object-contain" /></button>)}</div>}
      </WorkspaceCard>
      <div className="min-w-0 space-y-4">
        <WorkspaceCard title="Product identity" icon={Package}><dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <WorkspaceValue label="Manufacturer">{displayItemValue(item.manufacturer)}</WorkspaceValue><WorkspaceValue label="Part number">{displayItemValue(item.partNumber)}</WorkspaceValue>
          <WorkspaceValue label="Model">{displayItemValue(item.model)}</WorkspaceValue><WorkspaceValue label="Device Type">{getItemDeviceTypeLabel(item.deviceType)}</WorkspaceValue>
          <WorkspaceValue label="Unit">{displayItemValue(item.unit)}</WorkspaceValue><WorkspaceValue label="Product source">{item.productUrl ? <a href={item.productUrl} target="_blank" rel="noopener noreferrer" className="text-teal-700 underline decoration-teal-200 underline-offset-4">Open product source</a> : "Unspecified"}</WorkspaceValue>
        </dl></WorkspaceCard>
        <WorkspaceCard title="Description" icon={FileText}><p className="max-w-[90ch] whitespace-pre-wrap leading-relaxed text-slate-700">{displayItemValue(item.description)}</p></WorkspaceCard>
        <WorkspaceCard title="General notes" icon={NotebookPen}><p className="max-w-[90ch] whitespace-pre-wrap leading-relaxed text-slate-700">{displayItemValue(item.notes)}</p></WorkspaceCard>
      </div>
    </div>
    {dialog === "details" && <DetailsDialog item={item} onUpdated={onUpdated} onClose={() => setDialog(null)} />}
    {dialog === "images" && <ImagesDialog item={item} onUpdated={onUpdated} onClose={() => setDialog(null)} />}
  </div>;
}
export function ItemUsagePanel() {
  const { itemId } = useItemWorkspace();
  const [rows, setRows] = useState<BomItemUsage[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { let active = true; loadItemWorkspaceUsageAction(itemId).then(result => {
    if (!active) return; if (result.ok) { setRows(result.data); setMessage(null); } else setMessage(result.error);
  }).catch(() => { if (active) setMessage("Usage could not be loaded."); }); return () => { active = false; }; }, [itemId, attempt]);
  return <div className="space-y-3">
    {rows && <p className="text-[12px] text-slate-500">{rows.length} {rows.length === 1 ? "Mini BOM reference" : "Mini BOM references"}</p>}
    <ItemWorkspaceMessage message={message} kind="error" />{message && <button className="icon-button" onClick={() => setAttempt(value => value + 1)}>Retry</button>}
    {!rows && !message && <p role="status" className="rounded-lg border border-slate-200 bg-white p-4 text-[13px] text-slate-500">Loading references…</p>}
    {rows?.length === 0 && <WorkspaceEmpty title="No Mini BOM references." description="This Item is not currently included in a symbol’s Mini BOM." icon={Shapes} />}
    {!!rows?.length && <ul aria-label="Mini BOM references" className="divide-y divide-slate-100 overflow-hidden rounded-[10px] border border-slate-200 bg-white text-[13px]">
      {rows.map(row => <li key={row.lineId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 hover:bg-slate-50/60">
        <Link className="min-w-0 break-words rounded font-semibold text-teal-700 underline decoration-teal-200 underline-offset-4 outline-none hover:decoration-teal-700 focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2" href={`/symbols/${row.symbolId}`}>{row.displayName}</Link>
        <span className="rounded-md bg-slate-50 px-3 py-1.5 text-[12px] text-slate-600">{formatItemUsageQuantity(row.quantity, row.quantityRule)}</span>
      </li>)}
    </ul>}
  </div>;
}
