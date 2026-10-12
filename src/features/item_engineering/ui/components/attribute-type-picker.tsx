"use client";
import { useEffect, useState } from "react";
import { EngineeringDialog } from "@/shared/ui/engineering-dialog";
import { listAttributeTypesAction } from "@/features/engineering_attributes/api/actions";
import { attributeApplicability, type AttributeTypeSnapshot } from "@/features/engineering_attributes/api/public";
export function AttributeTypePicker({ deviceType, onSelect, onClose }: { deviceType: string; onSelect: (type: AttributeTypeSnapshot) => void; onClose: () => void }) {
  const [search,setSearch] = useState(""); const [page,setPage] = useState(1); const [error,setError] = useState("");
  const [result,setResult] = useState<Extract<Awaited<ReturnType<typeof listAttributeTypesAction>>,{ok:true}>["data"] | null>(null);
  useEffect(() => { let active = true; const timer = setTimeout(() => { listAttributeTypesAction({ search,page,deviceType }).then(reply => {
    if (!active) return; if (reply.ok) { setResult(reply.data); setError(""); } else setError(reply.error);
  }).catch(() => { if (active) setError("Types could not be loaded."); }); },150); return () => { active = false; clearTimeout(timer); }; },[search,page,deviceType]);
  return <EngineeringDialog title="Add specification" subtitle="Suggested types first; all available types remain accessible." onClose={onClose}>
    <input className="field-input w-full" autoFocus aria-label="Search specification types" placeholder="Search names and descriptions" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
    {error && <p role="alert">{error}</p>}
    <div className="mt-3 max-h-[50vh] space-y-1 overflow-auto">{result?.items.map(type => <button key={type.typeId} className="block w-full rounded-lg border p-3 text-left hover:bg-teal-50" onClick={() => {
      onSelect({ typeId: type.typeId,revisionId: type.revisionId,revisionNumber: type.revisionNumber,analysisKey: type.analysisKey,definition: type.definition }); onClose();
    }}><span className="font-semibold">{type.definition.label}</span>{attributeApplicability(type,deviceType).recommended && <span className="ml-2 text-xs text-teal-700">Suggested</span>}<span className="block text-xs text-slate-500">{type.definition.description}</span></button>)}</div>
    <div className="mt-3 flex items-center justify-between"><button className="icon-button" disabled={page === 1} onClick={() => setPage(page-1)}>Previous</button><span>Page {result?.page ?? page} of {result?.pages ?? 1}</span><button className="icon-button" disabled={!result || page >= result.pages} onClick={() => setPage(page+1)}>Next</button></div>
  </EngineeringDialog>;
}
