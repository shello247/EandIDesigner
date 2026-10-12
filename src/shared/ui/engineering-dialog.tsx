"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export function EngineeringDialog({ title, subtitle, dirty = false, busy = false, compact = false, contentSized = false, onClose, children }: {
  title: string; subtitle?: string; dirty?: boolean; busy?: boolean; compact?: boolean; contentSized?: boolean; onClose: () => void; children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const node = ref.current; const previous = document.activeElement as HTMLElement | null;
    node?.showModal();
    return () => { node?.close(); previous?.focus(); };
  }, []);
  const close = () => {
    if (busy) return;
    if (!dirty || window.confirm("Discard unsaved changes to this entry?")) onClose();
  };
  return <dialog ref={ref} aria-labelledby={id} tabIndex={-1} onCancel={event => { event.preventDefault(); close(); }}
    onKeyDown={event => {
      if (event.key !== "Tab" || event.altKey || event.ctrlKey || event.metaKey) return;
      const node = event.currentTarget;
      const focusable = Array.from(node.querySelectorAll<HTMLElement>(
        'button, a[href], input, select, textarea, summary, [tabindex], [contenteditable="true"]'
      )).filter(element => element.tabIndex >= 0 && !element.matches(":disabled") &&
        !element.closest("[inert]") && element.getClientRects().length > 0 &&
        getComputedStyle(element).visibility !== "hidden");
      const first = focusable[0]; const last = focusable.at(-1);
      // Native modal dialogs make the page inert, but some browser/platform
      // combinations still tab to browser chrome at the ends of the dialog.
      if (!first || !last) { event.preventDefault(); node.focus(); return; }
      const current = document.activeElement;
      if (!focusable.includes(current as HTMLElement)) {
        event.preventDefault(); (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && current === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault(); first.focus();
      }
    }}
    className={`w-[calc(100%-2rem)] rounded-xl border border-slate-200 bg-white p-0 text-slate-800 shadow-2xl backdrop:bg-slate-950/30 backdrop:backdrop-blur-sm ${compact ? `engineering-dialog-compact mx-auto mb-auto mt-[16px] ${contentSized ? "max-h-[min(520px,calc(100dvh-48px))]" : "h-[min(520px,calc(100dvh-48px))]"} max-w-[640px] flex-col overflow-hidden open:flex sm:mt-[24px]` : "m-auto max-h-[92dvh] max-w-[720px] overflow-auto"}`}>
    <header className={`z-10 flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-white ${compact ? "px-5 py-3" : "sticky top-0 px-6 py-4"}`}>
      <div className="min-w-0"><h2 id={id} className={`${compact ? "text-base" : "text-lg"} font-semibold`}>{title}</h2>{subtitle && <p className={`mt-1 truncate text-slate-500 ${compact ? "text-xs" : "text-sm"}`} title={subtitle}>{subtitle}</p>}</div>
      <button type="button" aria-label={"Close " + title} className="icon-button" disabled={busy} onClick={close}><X size={16} /></button>
    </header>
    <div className={compact ? "flex min-h-0 flex-1 flex-col" : "p-6"}>{children}</div>
  </dialog>;
}
