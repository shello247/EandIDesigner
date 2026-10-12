import { useRef, type ComponentType } from "react";

export function AttributeTypeTabs<T extends string>({ id, label, tabs, selected, onSelect, disabled = false }: {
  id: string; label: string; tabs: readonly { id: T; label: string; icon: ComponentType<{ size: number; "aria-hidden": boolean }> }[];
  selected: T; onSelect: (value: T) => void; disabled?: boolean;
}) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  return <div role="tablist" aria-label={label} className="flex shrink-0 gap-1 overflow-x-auto border-b border-slate-200 px-3">
    {tabs.map((tab, index) => <button key={tab.id} ref={node => { buttons.current[index] = node; }} type="button" role="tab"
      id={`${id}-tab-${tab.id}`} aria-controls={`${id}-panel-${tab.id}`} aria-selected={selected === tab.id}
      tabIndex={selected === tab.id ? 0 : -1} disabled={disabled}
      className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-bold outline-offset-[-3px] focus-visible:outline-2 focus-visible:outline-teal-600 ${selected === tab.id ? "border-teal-600 text-teal-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
      onClick={() => onSelect(tab.id)} onKeyDown={event => {
        const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 :
          event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : -1;
        if (next < 0) return;
        event.preventDefault(); onSelect(tabs[next].id); buttons.current[next]?.focus();
        buttons.current[next]?.scrollIntoView({ block: "nearest", inline: "nearest" });
      }}><tab.icon size={14} aria-hidden={true} />{tab.label}</button>)}
  </div>;
}
