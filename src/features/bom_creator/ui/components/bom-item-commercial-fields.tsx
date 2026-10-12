"use client";
import type { ItemCommercialFields } from "../../data/item-workspace";
import { bomCurrencyOptions } from "./bom-item-options";

export type CommercialSection = "pricing" | "supplier" | "notes";
export const itemCommercialFields = [
  { key: "supplierName", label: "Supplier", section: "supplier", wide: true },
  { key: "supplierSku", label: "Supplier SKU", section: "supplier" },
  { key: "unitCost", label: "Unit cost", section: "pricing", step: "0.01" },
  { key: "currency", label: "Currency", section: "pricing" },
  { key: "leadTimeDays", label: "Lead time days", section: "pricing", step: "1" },
  { key: "minimumOrderQuantity", label: "MOQ", section: "pricing", step: "0.01" },
  { key: "supplierWebsite", label: "Website", section: "supplier", wide: true },
  { key: "supplierContactName", label: "Contact", section: "supplier" },
  { key: "supplierEmail", label: "Email", section: "supplier" },
  { key: "supplierPhone", label: "Phone", section: "supplier" },
  { key: "costNotes", label: "Cost notes", section: "notes", wide: true }
] as const;
export const itemCommercialDraft = (item: ItemCommercialFields): ItemCommercialFields =>
  Object.fromEntries(itemCommercialFields.map(({ key }) => [key, item[key]]));
// Keep the creation wizard's established field identities while sharing its controls.
const fieldIds = { supplierName: "supplier-name", supplierSku: "supplier-sku", unitCost: "unit-cost", currency: "currency", leadTimeDays: "lead-time", minimumOrderQuantity: "moq", supplierWebsite: "supplier-website", supplierContactName: "supplier-contact", supplierEmail: "supplier-email", supplierPhone: "supplier-phone", costNotes: "cost-notes" } as const;

export function BomItemCommercialFields({ draft, onChange, idPrefix = "bom", section = "all" }: {
  draft: ItemCommercialFields; onChange: (patch: Partial<ItemCommercialFields>) => void; idPrefix?: string; section?: CommercialSection | "all";
}) {
  const compact = section !== "all";
  return <div className={compact ? "grid gap-3 sm:grid-cols-2" : "grid gap-4 lg:grid-cols-4"}>
    {itemCommercialFields.filter(field => section === "all" || field.section === section).map(field => {
      const id = idPrefix + "-" + fieldIds[field.key]; const numeric = "step" in field;
      return <div key={field.key} className={field.key === "costNotes" ? compact ? "sm:col-span-2" : "lg:col-span-4" : "wide" in field ? compact ? "sm:col-span-2" : "lg:col-span-2" : ""}>
        <label className={compact ? "mb-1 block text-[12px] font-bold text-slate-700" : "field-label"} htmlFor={id}>{field.label}</label>
        {field.key === "costNotes" ? <textarea id={id} className="field-input min-h-40 w-full" value={draft.costNotes ?? ""} onChange={event => onChange({ costNotes: event.target.value })} /> :
          <input id={id} className="field-input w-full" type={numeric ? "number" : "text"} min={numeric ? 0 : undefined} step={numeric ? field.step : undefined}
            list={field.key === "currency" ? idPrefix + "-currency-options" : undefined} value={draft[field.key] ?? ""}
            onChange={event => onChange({ [field.key]: numeric ? event.target.value.trim() === "" ? undefined : Number(event.target.value) : event.target.value })} />}
      </div>;
    })}
    {(section === "all" || section === "pricing") && <datalist id={idPrefix + "-currency-options"}>{bomCurrencyOptions.map(currency => <option key={currency} value={currency} />)}</datalist>}
  </div>;
}
