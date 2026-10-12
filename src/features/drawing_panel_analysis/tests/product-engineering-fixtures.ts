import {ATTRIBUTE_TYPE_SEEDS} from "@/features/engineering_attributes/api/public";
import type {ItemEngineeringRevision,SpecificationEntry,EngineeringProjectSettings} from "@/features/item_engineering/api/public";
import type {ResolvedDrawingProduct} from "@/features/drawing_canvas/api/product-server";
import {physicalProductKey} from "@/features/drawing_canvas/api/product-contracts";
export const emptySettings:EngineeringProjectSettings={modes:[],assumptions:[],channelRanges:[]};
export function specification(key:string,value:number,patch:Partial<SpecificationEntry>={}):SpecificationEntry{
  const type=ATTRIBUTE_TYPE_SEEDS.find(t=>t.analysisKey===key);if(!type)throw new Error(`No type: ${key}`);
  return {id:key,groupKey:"device",title:type.definition.label,description:"",type,payload:{kind:"quantity",value,unit:type.definition.canonicalUnit!},scope:{kind:"device"},modes:[],condition:"",ratingBasis:"continuous",evidence:[],source:{kind:"manufacturer",reference:"Synthetic qualification datasheet"},...patch};
}
export function product(assetId:string,entries:SpecificationEntry[]=[],settings?:EngineeringProjectSettings):ResolvedDrawingProduct{
  const target={assetId,componentPath:[]};const key=physicalProductKey(target);
  const revision:ItemEngineeringRevision={id:`revision-${assetId}`,itemId:`item-${assetId}`,revisionNumber:1,identity:{itemKey:assetId,displayName:assetId,manufacturer:"Fixture",model:assetId,partNumber:assetId},profile:{version:3,deviceType:"io_module",groups:[{key:"device",label:"Device",context:"device"}],modes:[],entries,channels:[],terminals:[]},noteIds:[],documentIds:[],contentHash:"a".repeat(64),createdAt:"2026-09-18T00:00:00.000Z"};
  const selection={version:1 as const,status:"selected" as const,configurationId:`config-${assetId}`,itemId:revision.itemId,itemEngineeringRevisionId:revision.id};
  return {key,target,label:assetId,selection,settings,product:{key,status:"selected",issues:[],additionalRevisions:[],revision}};
}
export function assigned(settings:Partial<EngineeringProjectSettings>={}):EngineeringProjectSettings{return {...emptySettings,powerAssignment:{supply:{assetId:"PS1",componentPath:[]},outputId:"out",loadInputId:"device",supplyNature:"dc"},...settings};}
export function supply(key="supply_output_capacity_w",value=10){return product("PS1",[specification(key,value,{scope:{kind:"supply_output",id:"out"}})]);}
