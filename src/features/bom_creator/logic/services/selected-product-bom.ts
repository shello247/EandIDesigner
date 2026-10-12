import type {GeneratedBomAssembly,GeneratedBomLine,GeneratedBomWarning,ConsolidatedBomLine} from "../../data/schema";
export type SelectedProductBomOverride={key:string;assetId:string;componentPath:string[];lines:GeneratedBomLine[];warnings:GeneratedBomWarning[]};
function samePath(a:string[]|undefined,b:string[]){return JSON.stringify(a??[])===JSON.stringify(b);}
export function applySelectedProductBom(assemblies:GeneratedBomAssembly[],overrides:readonly SelectedProductBomOverride[]){
  const seen=new Set<string>();
  for(const replacement of overrides){
    if(seen.has(replacement.key))continue;seen.add(replacement.key);
    const assembly=assemblies.find(a=>a.assetId===replacement.assetId);if(!assembly)continue;
    assembly.lines=assembly.lines.filter(line=>!samePath(line.componentPath,replacement.componentPath));
    assembly.warnings=assembly.warnings.filter(w=>!samePath(w.componentPath,replacement.componentPath)||!["missing_template","missing_item","archived_item","manual_quantity_required","generated_symbol"].includes(w.code));
    assembly.lines.push(...replacement.lines);assembly.warnings.push(...replacement.warnings);
  }
  return assemblies;
}
export function consolidateBomAssemblies(assemblies:GeneratedBomAssembly[]):ConsolidatedBomLine[]{
  const groups=new Map<string,ConsolidatedBomLine>();
  for(const assembly of assemblies)for(const line of assembly.lines){
    const key=JSON.stringify([line.itemId,line.itemEngineeringRevisionId??null]);const prior=groups.get(key);
    if(!prior){groups.set(key,{...line,id:`consolidated-${key}`,sourceAssetId:undefined,physicalProductKey:undefined,quantity:line.quantityStatus==="calculated"?line.quantity:undefined,sourceAssetTags:[assembly.assetTag]});continue;}
    if(!prior.sourceAssetTags.includes(assembly.assetTag))prior.sourceAssetTags.push(assembly.assetTag);
    if(prior.quantityStatus==="calculated"&&line.quantityStatus==="calculated")prior.quantity=(prior.quantity??0)+(line.quantity??0);
    else{prior.quantity=undefined;prior.quantityStatus=prior.quantityStatus==="manual_required"||line.quantityStatus==="manual_required"?"manual_required":"unavailable";}
  }
  return [...groups.values()].sort((a,b)=>a.displayName.localeCompare(b.displayName,undefined,{numeric:true}));
}
