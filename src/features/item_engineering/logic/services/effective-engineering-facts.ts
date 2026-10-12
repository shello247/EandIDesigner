import {ATTRIBUTE_TYPE_SEEDS,normalizeEngineeringValue,type AttributeTypeSnapshot} from "@/features/engineering_attributes/api/public";
import type {ItemEngineeringRevision} from "../../data/schema";
import type {SpecificationEntry,ItemProfileV3} from "../../data/profile-v3-schema";
import type {EngineeringProjectSettings} from "../../data/product-selection-schema";
import {projectItemProfileV3} from "./profile-v3-adapter";

export type EngineeringFact={key:string;analysisKey:string;scope:SpecificationEntry["scope"];ratingBasis:SpecificationEntry["ratingBasis"];
  status:"resolved"|"missing"|"conditional"|"conflict"|"unsupported";value?:number;minimum?:number;maximum?:number;unit?:string;text?:string;
  entries:SpecificationEntry[];reasons:string[];provisional:boolean;assumptionIds:string[]};
export type EffectiveEngineeringFacts={revisionId:string;profile:ItemProfileV3;facts:EngineeringFact[];unsupportedEntries:SpecificationEntry[];assumptionConflicts:Array<{id:string;reason:string}>};
export function systemAttributeMeaning(type:AttributeTypeSnapshot){
  const seed=ATTRIBUTE_TYPE_SEEDS.find(s=>s.typeId===type.typeId&&s.analysisKey===type.analysisKey);
  if(!seed||seed.definition.engineeringDimension!==type.definition.engineeringDimension||seed.definition.valueKind!==type.definition.valueKind||seed.definition.payloadKind!==type.definition.payloadKind)return null;
  return seed;
}
export function engineeringFactKey(analysisKey:string,scope:SpecificationEntry["scope"],ratingBasis:SpecificationEntry["ratingBasis"]="continuous"){
  return JSON.stringify([analysisKey,scope.kind,"id" in scope?scope.id:null,ratingBasis==="unspecified"?"continuous":ratingBasis]);
}
export function resolveEffectiveEngineeringFacts({revision,settings}:{revision:ItemEngineeringRevision;settings?:EngineeringProjectSettings}):EffectiveEngineeringFacts{
  const profile=projectItemProfileV3(revision.profile);const grouped=new Map<string,EngineeringFact>();const unsupportedEntries:SpecificationEntry[]=[];
  for(const entry of profile.entries){
    const meaning=systemAttributeMeaning(entry.type);if(!meaning?.analysisKey){unsupportedEntries.push(entry);continue;}
    const applicable=entry.modes.map(mode=>{const selected=settings?.modes.find(m=>m.setId===mode.setId);return !selected?"unknown":selected.choiceId===mode.choiceId?"yes":"no";});
    if(applicable.includes("no"))continue;
    const key=engineeringFactKey(meaning.analysisKey,entry.scope,entry.ratingBasis);
    const fact=grouped.get(key)??{key,analysisKey:meaning.analysisKey,scope:entry.scope,ratingBasis:entry.ratingBasis==="unspecified"?"continuous":entry.ratingBasis,status:"resolved",entries:[],reasons:[],provisional:false,assumptionIds:[]} as EngineeringFact;
    grouped.set(key,fact);fact.entries.push(entry);
    if(applicable.includes("unknown")){fact.status="conditional";fact.reasons.push("Select the applicable operating mode.");}
    if(entry.condition&&!settings?.confirmedConditions?.includes(entry.id)){fact.status="conditional";fact.reasons.push(`Confirm the applicable condition: ${entry.condition}`);}
    if(entry.condition&&settings?.confirmedConditions?.includes(entry.id))fact.provisional=true;
    if(entry.source.kind!=="manufacturer"||!entry.source.reference&&!entry.evidence.length)fact.provisional=true;
  }
  for(const fact of grouped.values()){
    const values:Array<{value?:number;minimum?:number;maximum?:number;unit?:string;text?:string}>=[];
    for(const entry of fact.entries){
      const p=entry.payload;const meaning=systemAttributeMeaning(entry.type)!;
      if(p.kind==="unresolved"){fact.reasons.push(p.reason||"Required value is missing.");if(fact.status!=="conditional")fact.status="missing";continue;}
      if(p.kind==="text"||p.kind==="choice"){values.push({text:p.value});continue;}
      if(p.kind==="terminal_range"||p.kind==="short_circuit"){values.push({text:JSON.stringify(p)});continue;}
      const normalized=normalizeEngineeringValue({value:p,dimension:meaning.definition.engineeringDimension,canonicalUnit:meaning.definition.canonicalUnit});
      if(!normalized.ok){fact.status="unsupported";fact.reasons.push(normalized.message);continue;}
      values.push({value:normalized.value,minimum:normalized.minimum,maximum:normalized.maximum,unit:normalized.unit});
    }
    const distinct=new Map(values.map(v=>[JSON.stringify(v),v]));
    if(distinct.size>1&&fact.status!=="conditional"){fact.status="conflict";fact.reasons.push("Competing applicable values require engineering review.");}
    if(fact.status==="resolved"&&distinct.size===1)Object.assign(fact,[...distinct.values()][0]);
    else if(!values.length&&fact.status==="resolved")fact.status="missing";
    fact.reasons=[...new Set(fact.reasons)];
  }
  const assumptionConflicts:EffectiveEngineeringFacts["assumptionConflicts"]=[];
  for(const assumption of settings?.assumptions??[]){
    const meaning=ATTRIBUTE_TYPE_SEEDS.find(s=>s.analysisKey===assumption.analysisKey);
    if(!meaning||meaning.definition.valueKind!=="quantity"){assumptionConflicts.push({id:assumption.id,reason:"Assumption has no supported scalar engineering meaning."});continue;}
    const scope=assumption.scope??{kind:"device" as const};const key=engineeringFactKey(assumption.analysisKey,scope);
    const normalized=normalizeEngineeringValue({value:{kind:"quantity",value:assumption.value,unit:assumption.unit},dimension:meaning.definition.engineeringDimension,canonicalUnit:meaning.definition.canonicalUnit});
    if(!normalized.ok){assumptionConflicts.push({id:assumption.id,reason:normalized.message});continue;}
    if(normalized.value===undefined || meaning.definition.minimum!==undefined&&(meaning.definition.minimumExclusive?normalized.value<=meaning.definition.minimum:normalized.value<meaning.definition.minimum)||meaning.definition.maximum!==undefined&&normalized.value>meaning.definition.maximum){assumptionConflicts.push({id:assumption.id,reason:"Assumption is outside the valid engineering range."});continue;}
    const existing=grouped.get(key);
    if(existing&&existing.status!=="missing"){
      if(existing.status!=="resolved"||existing.value!==normalized.value){assumptionConflicts.push({id:assumption.id,reason:"Project assumption conflicts with manufacturer data or unresolved conditions; it has not replaced that data."});}
      if(existing.assumptionIds.length&&existing.value!==normalized.value){existing.status="conflict";existing.value=undefined;existing.assumptionIds.push(assumption.id);existing.reasons.push("Competing project assumptions require review.");}
      continue;
    }
    grouped.set(key,{key,analysisKey:assumption.analysisKey,scope,ratingBasis:"continuous",status:"resolved",value:normalized.value,unit:normalized.unit,entries:existing?.entries??[],reasons:[assumption.reason],provisional:true,assumptionIds:[assumption.id]});
  }
  return {revisionId:revision.id,profile,facts:[...grouped.values()],unsupportedEntries,assumptionConflicts};
}
export function validateProjectEngineeringSettings(profile:ItemProfileV3,settings:EngineeringProjectSettings){
  const issues:string[]=[];
  if(settings.terminalConnections?.some(c=>!profile.terminals.some(t=>t.id===c.terminalId&&t.connectable)))issues.push("Installation details must refer to a connectable product terminal.");
  if(settings.modes.some(m=>!profile.modes.find(s=>s.id===m.setId)?.choices.some(c=>c.id===m.choiceId)))issues.push("Operating mode does not exist in the selected Item revision.");
  if(settings.confirmedConditions?.some(id=>!profile.entries.some(e=>e.id===id&&e.condition)))issues.push("Condition confirmation does not reference a recorded condition.");
  if(new Set(settings.assumptions.map(a=>a.id)).size!==settings.assumptions.length)issues.push("Assumption identities must be unique.");
  for(const assumption of settings.assumptions){
    const meaning=ATTRIBUTE_TYPE_SEEDS.find(s=>s.analysisKey===assumption.analysisKey);
    if(!meaning||meaning.definition.valueKind!=="quantity"){issues.push("Choose a supported scalar engineering meaning for the assumption.");continue;}
    const n=normalizeEngineeringValue({value:{kind:"quantity",value:assumption.value,unit:assumption.unit},dimension:meaning.definition.engineeringDimension,canonicalUnit:meaning.definition.canonicalUnit});
    if(!n.ok)issues.push(n.message);
    else if(n.value!==undefined&&(meaning.definition.minimum!==undefined&&(meaning.definition.minimumExclusive?n.value<=meaning.definition.minimum:n.value<meaning.definition.minimum)||meaning.definition.maximum!==undefined&&n.value>meaning.definition.maximum))issues.push("Assumption is outside the valid engineering range.");
    const scope=assumption.scope;
    if(scope?.kind==="channel"&&!profile.channels.some(c=>c.id===scope.id))issues.push("Assumption channel was not found.");
    if(scope?.kind==="terminal"&&!profile.terminals.some(t=>t.id===scope.id))issues.push("Assumption terminal was not found.");
  }
  for(const range of settings.channelRanges){const channel=profile.channels.find(c=>c.id===range.channelId);if(!channel){issues.push("Selected channel was not found.");continue;}
    const dimension=channel.signalType==="analog_current"?"current":channel.signalType==="analog_voltage"?"voltage":undefined;
    if(!dimension)issues.push("Numeric channel ranges require an analog current or voltage channel.");
    else{const n=normalizeEngineeringValue({value:{kind:"range",minimum:range.minimum,maximum:range.maximum,unit:range.unit},dimension});if(!n.ok)issues.push(n.message);}
  }
  return [...new Set(issues)];
}
export function findEngineeringFact(resolved:EffectiveEngineeringFacts,analysisKey:string,scope:SpecificationEntry["scope"]={kind:"device"}){
  return resolved.facts.find(f=>f.key===engineeringFactKey(analysisKey,scope));
}
