"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useState, type KeyboardEvent } from "react";
import { ArrowLeft, LayoutDashboard, SlidersHorizontal, NotebookPen, Files, CircleDollarSign, Shapes } from "lucide-react";
import { ItemWorkspaceProvider, useItemWorkspace } from "@/features/item_engineering/ui/public";
import type { ItemOverview } from "../../data/item-workspace";
import { ItemOverviewPanel, ItemCommercialPanel, ItemUsagePanel } from "./item-workspace-panels";
const Engineering = dynamic(() => import("@/features/item_engineering/ui/public").then(module => module.ItemEngineeringPanel), { loading: () => <p role="status">Loading engineering workspace…</p> });
const Notes = dynamic(() => import("@/features/item_engineering/ui/public").then(module => module.ItemEngineerNotesPanel), { loading: () => <p role="status">Loading notes…</p> });
const Documents = dynamic(() => import("./item-workspace-documents").then(module => module.ItemWorkspaceDocuments), { loading: () => <p role="status">Loading documents…</p> });
const tabs = [
  { id: "overview", label: "Overview", Icon: LayoutDashboard },
  { id: "engineering", label: "Engineering Attributes", Icon: SlidersHorizontal },
  { id: "documents", label: "Documents", Icon: Files },
  { id: "notes", label: "Engineer Notes", Icon: NotebookPen },
  { id: "commercial", label: "Cost & Supplier", Icon: CircleDollarSign },
  { id: "usage", label: "Symbols & Usage", Icon: Shapes }
] as const;
type Tab = typeof tabs[number]["id"];
export function BomItemWorkspace({ item }: { item: ItemOverview }) {
  return <ItemWorkspaceProvider key={item.id} itemId={item.id} revisionId={item.revisionId} readOnly={item.status !== "active"}>
    <Workspace initial={item} />
  </ItemWorkspaceProvider>;
}
function Workspace({ initial }: { initial: ItemOverview }) {
  const [item, setItem] = useState(initial);
  const [active, setActive] = useState<Tab>("overview");
  const [visited, setVisited] = useState<Set<Tab>>(() => new Set(["overview"]));
  const { dirty } = useItemWorkspace();
  const select = (tab: Tab) => { setActive(tab); setVisited(current => new Set([...current, tab])); };
  const keyboard = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 :
      event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : -1;
    if (next < 0) return;
    event.preventDefault(); select(tabs[next].id);
    document.getElementById(`item-tab-${tabs[next].id}`)?.focus();
  };
  return <div className="space-y-4">
    <header className="space-y-2">
      <Link href="/bom/items" className="inline-flex items-center gap-2 text-sm"><ArrowLeft size={16} />Items Library</Link>
      <div className="flex flex-wrap items-center gap-3"><h1 className="min-w-0 max-w-full break-words text-xl font-semibold">{item.displayName}</h1>
        <span className="rounded-full bg-teal-50 px-2 py-1 text-xs capitalize text-teal-800">{item.status}</span></div>
      <p className="break-words text-sm text-slate-500">{[item.itemKey, item.manufacturer, item.partNumber].filter(Boolean).join(" / ")}</p>
      <Link className="inline-block text-xs text-teal-700 underline" href={`/bom/items/${item.id}/history`}>Engineering revision history</Link>
      {item.status !== "active" && <p className="text-sm">Archived Item — existing records remain readable. Editing is unavailable.</p>}
    </header>
    <div role="tablist" aria-label="Item workspace" className="flex gap-1 overflow-x-auto border-b border-slate-200">
      {tabs.map(({ id, label, Icon }, index) => <button key={id} id={`item-tab-${id}`} role="tab" aria-label={label} aria-describedby={dirty[id] || id === "overview" && dirty.images || id === "notes" && dirty["note-edit"] ? `item-dirty-${id}` : undefined} aria-selected={active === id}
        aria-controls={`item-panel-${id}`} tabIndex={active === id ? 0 : -1} onKeyDown={event => keyboard(event, index)}
        style={{ fontWeight: active === id ? 700 : 500 }} onClick={() => select(id)} className={`relative inline-flex shrink-0 items-center gap-2 rounded-t-lg border-b-2 px-4 py-3 text-[13px] focus-visible:outline-2 focus-visible:outline-teal-600 ${active === id ? "border-teal-600 bg-teal-50/70 text-teal-700" : "border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}>
        <Icon size={16} />{label}{(dirty[id] || id === "overview" && dirty.images || id === "notes" && dirty["note-edit"]) && <><span aria-hidden="true" className="text-amber-700">●</span><span id={`item-dirty-${id}`} className="sr-only">Unsaved changes</span></>}
      </button>)}
    </div>
    {tabs.map(({ id }) => <section key={id} id={`item-panel-${id}`} role="tabpanel" aria-labelledby={`item-tab-${id}`} hidden={id !== active} tabIndex={0}>
      {visited.has(id) && (id === "overview" ? <ItemOverviewPanel item={item} onUpdated={setItem} /> :
        id === "commercial" ? <ItemCommercialPanel item={item} onUpdated={setItem} /> :
        id === "engineering" ? <Engineering /> : id === "notes" ? <Notes /> :
        id === "documents" ? <Documents /> : <ItemUsagePanel />)}
    </section>)}
  </div>;
}
