"use client";
import { useRef, type ReactNode } from "react";
import { Info, type LucideIcon } from "lucide-react";

export function WorkspaceHeading({ title, icon: Icon, detail, action }: { title: string; icon: LucideIcon; detail?: ReactNode; action?: ReactNode }) {
  return <div className="flex flex-wrap items-center justify-between gap-3">
    <div className="flex min-w-0 items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-teal-100 bg-teal-50 text-teal-700"><Icon size={18} aria-hidden="true" /></span>
      <div className="min-w-0"><h2 className="text-[16px] font-semibold text-slate-900">{title}</h2>{detail && <div className="mt-0.5 text-[12px] text-slate-500">{detail}</div>}</div>
    </div>{action}
  </div>;
}
export function WorkspaceCard({ title, icon: Icon, action, children, className = "" }: { title: string; icon: LucideIcon; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`min-w-0 overflow-hidden rounded-[10px] border border-slate-200 bg-white ${className}`}>
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-3">
      <h3 className="flex items-center gap-2 text-[16px] font-semibold text-slate-800"><Icon size={16} className="shrink-0 text-teal-700" aria-hidden="true" />{title}</h3>{action}
    </header><div className="p-4 text-[13px]">{children}</div>
  </section>;
}
export function WorkspaceValue({ label, children }: { label: string; children: ReactNode }) {
  return <div className="min-w-0"><dt className="text-[12px] font-bold text-slate-600">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-slate-900">{children}</dd></div>;
}
export function WorkspaceMetric({ label, value, detail, icon: Icon }: { label: string; value: string; detail?: string; icon: LucideIcon }) {
  return <div className="min-w-0 rounded-[10px] border border-teal-100 bg-gradient-to-br from-teal-50/70 to-white p-4">
    <div className="flex items-center justify-between gap-2"><p className="text-[12px] font-bold text-slate-600">{label}</p><Icon size={17} className="shrink-0 text-teal-700" aria-hidden="true" /></div>
    <p className="mt-3 break-words text-[22px] font-semibold leading-tight text-slate-900">{value}</p>{detail && <p className="mt-1.5 text-[12px] text-slate-500">{detail}</p>}
  </div>;
}
export function WorkspaceEmpty({ title, description, icon: Icon, action }: { title: string; description?: string; icon: LucideIcon; action?: ReactNode }) {
  return <div className="flex flex-col items-center rounded-[10px] border border-dashed border-slate-200 bg-white px-5 py-8 text-center">
    <span className="mb-3 rounded-xl bg-slate-50 p-3 text-teal-700"><Icon size={24} aria-hidden="true" /></span><p className="text-[13px] font-semibold text-slate-800">{title}</p>
    {description && <p className="mt-1 max-w-md text-[12px] leading-relaxed text-slate-500">{description}</p>}{action && <div className="mt-4">{action}</div>}
  </div>;
}
export function WorkspaceHelp({ title, children }: { title: string; children: ReactNode }) {
  return <details className="rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-3 text-[12px] text-slate-600"><summary className="cursor-pointer font-semibold"><Info size={14} className="mr-2 inline text-slate-500" aria-hidden="true" />{title}</summary><div className="mt-2 leading-relaxed">{children}</div></details>;
}
export function WorkspaceDialogTabs<T extends string>({ id, label, tabs, selected, onSelect }: {
  id: string; label: string; tabs: readonly { id: T; label: string; icon: LucideIcon }[]; selected: T; onSelect: (id: T) => void;
}) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  return <div role="tablist" aria-label={label} className="flex shrink-0 gap-1 overflow-x-auto border-b border-slate-200 px-3">
    {tabs.map((tab, index) => <button key={tab.id} ref={node => { buttons.current[index] = node; }} type="button" role="tab" id={`${id}-tab-${tab.id}`} aria-controls={`${id}-panel-${tab.id}`} aria-selected={selected === tab.id} tabIndex={selected === tab.id ? 0 : -1}
      style={{ fontWeight: 700 }} className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-[12px] outline-offset-[-3px] focus-visible:outline-2 focus-visible:outline-teal-600 ${selected === tab.id ? "border-teal-600 bg-teal-50/50 text-teal-700" : "border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}
      onClick={() => onSelect(tab.id)} onKeyDown={event => {
        const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : -1;
        if (next < 0) return; event.preventDefault(); onSelect(tabs[next].id); buttons.current[next]?.focus(); buttons.current[next]?.scrollIntoView({ block: "nearest", inline: "nearest" });
      }}><tab.icon size={14} aria-hidden="true" />{tab.label}</button>)}
  </div>;
}
