"use client";
import { useEffect,useState } from "react";
import { loadSpecificationWorkspaceAction } from "../../api/batch-actions";
import { useItemWorkspace } from "./item-workspace-context";
import { ItemAttributesTable,type SpecificationWorkspace } from "./item-attributes-table";
export function ItemEngineeringPanel() {
  const { itemId,revisionId } = useItemWorkspace(); const [workspace,setWorkspace] = useState<SpecificationWorkspace | null>(null);
  const [error,setError] = useState(""); const [retry,setRetry] = useState(0);
  useEffect(() => { let active = true; loadSpecificationWorkspaceAction({ itemId }).then(result => {
    if (!active) return; if (result.ok) { setWorkspace(result.data); setError(""); } else setError(result.error);
  }).catch(() => { if (active) setError("Specifications could not be loaded. Your draft is retained."); }); return () => { active = false; }; },[itemId,revisionId,retry]);
  return <>{error && <p role="alert" className="mb-3 rounded-lg bg-rose-50 p-3 text-sm">{error}<button className="icon-button ml-2" onClick={() => setRetry(n => n+1)}>Retry</button></p>}
    {workspace ? <ItemAttributesTable workspace={workspace} onSaved={setWorkspace} /> : <p role="status">Loading specifications…</p>}</>;
}
