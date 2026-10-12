import type {DrawingModel} from "../../data/schema";
import type {DrawingComponentSelection} from "@/features/symbol_components/api/public";
import {drawingProductSelectionSchema,engineeringProjectSettingsSchema,type DrawingProductSelection,type EngineeringProjectSettings,type PhysicalProductTarget} from "@/features/item_engineering/api/contracts";

export type PhysicalProduct = {key:string;target:PhysicalProductTarget;label:string;symbolId?:string;versionId?:string;selection?:DrawingProductSelection;settings?:EngineeringProjectSettings};
export function physicalProductKey(target:PhysicalProductTarget){return JSON.stringify([target.assetId,target.memberId??null,target.componentPath]);}
/** One row per physical identity, independently of the number of graphical views. */
export function listPhysicalProducts(model:DrawingModel):PhysicalProduct[]{
  const products:PhysicalProduct[]=[];
  function add(row:Omit<PhysicalProduct,"key">){products.push({...row,key:physicalProductKey(row.target)});}
  function components(assetId:string,memberId:string|undefined,label:string,rows:DrawingComponentSelection[],path:string[]=[]){
    if(path.length>=16)throw new Error("Component nesting exceeds the supported depth.");
    if(new Set(rows.map(r=>r.positionKey)).size!==rows.length)throw new Error("Component position identities must be unique.");
    for(const row of rows){const componentPath=[...path,row.positionKey];const name=`${label} / ${row.positionKey}`;
      add({target:{assetId,memberId,componentPath},label:name,symbolId:row.symbolId,versionId:row.versionId,selection:row.productSelection,settings:row.engineeringSettings});
      if(row.children?.length)components(assetId,memberId,name,row.children,componentPath);
    }
  }
  for(const asset of model.assets){
    if(!asset.terminalStrip)add({target:{assetId:asset.id,componentPath:[]},label:asset.tag,symbolId:asset.symbolId,versionId:asset.versionId,selection:asset.productSelection,settings:asset.engineeringSettings});
    components(asset.id,undefined,asset.tag,asset.componentSelections??[]);
    for(const member of asset.terminalStrip?.members??[]){const label=`${asset.tag} / ${member.designation??member.token}`;
      add({target:{assetId:asset.id,memberId:member.id,componentPath:[]},label,symbolId:member.symbolId,versionId:member.versionId,selection:member.productSelection,settings:member.engineeringSettings});
      components(asset.id,member.id,label,member.componentSelections??[]);
    }
  }
  return products;
}
export function setDrawingProduct(model:DrawingModel,target:PhysicalProductTarget,selection:DrawingProductSelection,settings?:EngineeringProjectSettings):DrawingModel{
  const parsed=drawingProductSelectionSchema.parse(selection);const configured=settings?engineeringProjectSettingsSchema.parse(settings):undefined;
  const found=listPhysicalProducts(model).find(p=>p.key===physicalProductKey(target));if(!found)throw new Error("Physical product target was not found.");
  // Clone the target separately: legacy copy helpers can share nested references.
  // Cloning the whole model preserves those aliases and would update both devices.
  const result:DrawingModel={...model,version:3,assets:model.assets.map(a=>a.id===target.assetId?structuredClone(a):a)};
  const asset=result.assets.find(a=>a.id===target.assetId)!;
  const root=target.memberId?asset.terminalStrip?.members.find(m=>m.id===target.memberId):asset;
  if(!root)throw new Error("Terminal-strip member was not found.");
  let subject:{productSelection?:DrawingProductSelection;engineeringSettings?:EngineeringProjectSettings}=root;
  let children=root.componentSelections;
  for(const key of target.componentPath){const child=children?.find(c=>c.positionKey===key);if(!child)throw new Error("Component position was not found.");subject=child;children=child.children;}
  subject.productSelection=parsed;subject.engineeringSettings=configured;
  return result;
}
