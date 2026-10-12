import type {ItemEngineeringRevision} from "../../data/schema";
import {projectItemProfileV3} from "./profile-v3-adapter";
import {specificationValueLabel} from "./specification-display";
export function compareProductRevisions(before:ItemEngineeringRevision,after:ItemEngineeringRevision){
  if(before.itemId!==after.itemId)throw new Error("Compare revisions of the same Item.");
  const left=projectItemProfileV3(before.profile);const right=projectItemProfileV3(after.profile);
  const changes:Array<{label:string;before:string;after:string}>=[];
  for(const field of ["displayName","manufacturer","model","partNumber"] as const)if(before.identity[field]!==after.identity[field])changes.push({label:field,before:before.identity[field]??"Missing",after:after.identity[field]??"Missing"});
  const old=new Map(left.entries.map(e=>[e.id,e]));const current=new Map(right.entries.map(e=>[e.id,e]));
  for(const id of new Set([...old.keys(),...current.keys()])){
    const a=old.get(id);const b=current.get(id);if(JSON.stringify(a)===JSON.stringify(b))continue;
    const detail=(e:NonNullable<typeof a>)=>`${specificationValueLabel(e)} · ${e.scope.kind}${"id" in e.scope?` ${e.scope.id}`:""}${e.condition?` · ${e.condition}`:""} · ${e.modes.map(m=>`${m.setId}: ${m.choiceId}`).join(", ")||"No mode restriction"}`;
    changes.push({label:b?.title??a!.title,before:a?detail(a):"Not recorded",after:b?detail(b):"Removed"});
  }
  for(const field of ["deviceType","modes","channels","terminals"] as const)if(JSON.stringify(left[field])!==JSON.stringify(right[field]))changes.push({label:field,before:field==="deviceType"?left.deviceType:`${left[field].length} recorded`,after:field==="deviceType"?right.deviceType:`${right[field].length} recorded; definitions changed — review connections`});
  if(JSON.stringify(before.noteIds)!==JSON.stringify(after.noteIds)||JSON.stringify(before.documentIds)!==JSON.stringify(after.documentIds))changes.push({label:"Retained sources",before:`${before.noteIds.length} notes, ${before.documentIds.length} documents`,after:`${after.noteIds.length} notes, ${after.documentIds.length} documents`});
  return changes;
}
