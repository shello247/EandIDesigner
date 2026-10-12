import type { BomQuantityRule } from "../../data/schema";

const usageRuleLabels: Record<BomQuantityRule, string> = {
  fixed_per_assembly: "Per assembly",
  per_cable_end: "Per cable end",
  per_conductor_termination: "Per conductor termination",
  per_connection: "Per connection",
  manual: "Manual"
};

export function formatItemUsageQuantity(quantity: number, rule: BomQuantityRule): string {
  return `Qty ${formatRecordedQuantity(quantity)} · ${usageRuleLabels[rule]}`;
}

export const displayItemValue = (value: string | number | null | undefined): string =>
  value == null || typeof value === "string" && !value.trim() ? "Unspecified" : String(value);

export function formatSavedUnitCost(value: number | null | undefined, currency?: string | null): string {
  if (value == null || !Number.isFinite(value)) return "Unspecified";
  return `${currency?.trim() || "Currency unspecified"} ${new Intl.NumberFormat("en-TT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`;
}
export function formatRecordedQuantity(value: number | null | undefined, suffix = ""): string {
  if (value == null || !Number.isFinite(value)) return "Unspecified";
  return String(value) + suffix;
}
export function formatItemDocumentSize(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "Unspecified";
  if (value < 1024) return value + " B";
  return value < 1024 * 1024 ? `${Number((value / 1024).toFixed(1))} KB` : `${Number((value / 1024 / 1024).toFixed(1))} MB`;
}
export function itemContactHref(kind: "website" | "email" | "phone", value?: string | null): string | null {
  const text = value?.trim();
  if (!text || /[\u0000-\u001f\u007f]/.test(text)) return null;
  if (kind === "email") return /^[\w.+-]+@[a-z\d.-]+\.[a-z]{2,}$/i.test(text) ? `mailto:${text}` : null;
  if (kind === "phone") return /^\+?[\d ()\-.]+$/.test(text) && text.replace(/\D/g, "").length >= 5 ? `tel:${text.replace(/[ ()\-.]/g, "")}` : null;
  if (/\s/.test(text) || /^[a-z][a-z\d+.-]*:/i.test(text) && !/^https?:\/\//i.test(text)) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password && url.hostname.includes(".") ? url.href : null;
  } catch { return null; }
}
