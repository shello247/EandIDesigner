"use client";
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { acknowledgeSectionSave, ItemWorkspaceMutationQueue, sectionIsDirty } from "../../logic/services/item-workspace-state";

type Context = {
  itemId: string; revisionId: string | null; readOnly: boolean; dirty: Record<string, boolean>; busy: boolean;
  setDirty: (section: string, value: boolean) => void;
  reviewRevision: (revisionId: string | null) => Promise<void>;
  mutate: <T>(operation: (revisionId: string | null) => Promise<{ value: T; revisionId: string | null }>) => Promise<T>;
};
const WorkspaceContext = createContext<Context | null>(null);
export function ItemWorkspaceProvider({ itemId, revisionId, readOnly, children }: {
  itemId: string; revisionId: string | null; readOnly: boolean; children: ReactNode;
}) {
  const [queue] = useState(() => new ItemWorkspaceMutationQueue(revisionId));
  const [committedRevisionId, setCommittedRevisionId] = useState(revisionId);
  const [dirty, setDirtyState] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState(0);
  const setDirty = useCallback((section: string, value: boolean) => setDirtyState(current =>
    current[section] === value ? current : { ...current, [section]: value }), []);
  const mutate = useCallback(async <T,>(operation: (revisionId: string | null) => Promise<{ value: T; revisionId: string | null }>) => {
    if (readOnly) throw new Error("Archived Items are read-only.");
    setPending(count => count + 1);
    try { const value = await queue.run(operation); setCommittedRevisionId(queue.revisionId); return value; } finally { setPending(count => count - 1); }
  }, [queue, readOnly]);
  const reviewRevision = useCallback(async (revisionId: string | null) => { await queue.run(async () => ({ value: undefined, revisionId })); setCommittedRevisionId(queue.revisionId); }, [queue]);
  useEffect(() => () => queue.invalidate(), [queue]);
  const hasDirty = Object.values(dirty).some(Boolean);
  useEffect(() => {
    if (!hasDirty && !pending) return;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const navigation = (window as Window & { navigation?: EventTarget }).navigation;
    const traverse = (event: Event) => {
      const detail = event as Event & { canIntercept?: boolean; navigationType?: string; destination?: { url: string } };
      // The Navigation API can cancel same-document Back/Forward in browsers
      // that support it. Do not manipulate Next's private history state.
      if (detail.navigationType !== "traverse" || !detail.canIntercept || !detail.destination ||
        new URL(detail.destination.url).pathname === window.location.pathname) return;
      if (!window.confirm("This Item has unsaved changes. Leave without saving?")) event.preventDefault();
    };
    const navigate = (event: MouseEvent) => {
      const link = (event.target as Element).closest?.("a[href]");
      if (!link || link.getAttribute("target") === "_blank" || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (!window.confirm("This Item has unsaved changes. Leave without saving?")) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener("beforeunload", unload);
    navigation?.addEventListener("navigate", traverse);
    document.addEventListener("click", navigate, true);
    return () => { window.removeEventListener("beforeunload", unload); document.removeEventListener("click", navigate, true); navigation?.removeEventListener("navigate", traverse); };
  }, [hasDirty, pending]);
  return <WorkspaceContext.Provider value={{ itemId, revisionId: committedRevisionId, readOnly, dirty, busy: pending > 0, setDirty, mutate, reviewRevision }}>{children}</WorkspaceContext.Provider>;
}
export function useItemWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("Item workspace provider is required.");
  return context;
}
export function useItemSectionDraft<T>(section: string, initial: T) {
  const { setDirty } = useItemWorkspace();
  const [state, setState] = useState({ saved: initial, draft: initial });
  const current = useRef(state);
  useLayoutEffect(() => { current.current = state; }, [state]);
  const dirty = sectionIsDirty(state);
  useEffect(() => { setDirty(section, dirty); }, [section, dirty, setDirty]);
  useEffect(() => () => setDirty(section, false), [section, setDirty]);
  return {
    ...state, dirty,
    change: (draft: T) => setState(value => ({ ...value, draft })),
    cancel: () => setState(value => ({ ...value, draft: value.saved })),
    load: (saved: T) => setState(value => sectionIsDirty(value) ? { ...value, saved } : { saved, draft: saved }),
    acknowledge: (submitted: T, saved: T) => setState(value => acknowledgeSectionSave(value, submitted, saved)),
    snapshot: () => current.current.draft
  };
}
export function ItemWorkspaceMessage({ message, kind = "info" }: { message: string | null; kind?: "success" | "info" | "error" }) {
  const color = kind === "success" ? "border-teal-200 bg-teal-50 text-teal-950" : kind === "error" ? "border-amber-200 bg-amber-50 text-amber-950" : "border-slate-200 bg-slate-50 text-slate-700";
  return message ? <p role={kind === "error" ? "alert" : "status"} className={`rounded-lg border p-3 text-[13px] ${color}`}>{message}</p> : null;
}
export const itemWorkspaceDate = (value: string) => new Intl.DateTimeFormat("en-TT", {
  timeZone: "America/Port_of_Spain", dateStyle: "medium", timeStyle: "short"
}).format(new Date(value));
export function readItemImage(file: File): Promise<{ fileName: string; mimeType: "image/png" | "image/jpeg" | "image/webp"; sizeBytes: number; dataUrl: string }> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024 || !file.size) {
    return Promise.reject(new Error("Choose a PNG, JPEG or WebP image, up to 10 MB."));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The image could not be read. Please retry."));
    reader.onload = () => resolve({ fileName: file.name, mimeType: file.type as "image/png" | "image/jpeg" | "image/webp", sizeBytes: file.size, dataUrl: String(reader.result) });
    reader.readAsDataURL(file);
  });
}
