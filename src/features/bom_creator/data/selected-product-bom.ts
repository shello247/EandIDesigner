import type {Prisma} from "@prisma/client";
import {prisma} from "@/lib/prisma";
import type {DrawingModel,ApprovedDrawingSymbol} from "@/features/drawing_canvas/api/asset-contracts";
import {loadDrawingProducts} from "@/features/drawing_canvas/api/product-server";
import {createPanelWiringSource} from "@/features/drawing_canvas/api/panel-wiring-contracts";
import {buildPackageConnectivityGraph} from "@/features/drawing_panel_wiring/api/public";
import {namespaceStructuredTerminalKey} from "@/features/drawing_terminal_blocks/api/public";
import type {SelectedProductBomOverride} from "../logic/services/selected-product-bom";
import {calculateProjectedBomQuantity} from "../logic/services/bom-quantity-rules";
import type {BomQuantityRule,GeneratedBomLine} from "./schema";
import type {ItemEngineeringRevision,PhysicalProductTarget} from "@/features/item_engineering/api/public";
function legacyPath(model:DrawingModel,target:PhysicalProductTarget){
  const asset=model.assets.find(a=>a.id===target.assetId)!;const member=target.memberId?asset.terminalStrip?.members.find(m=>m.id===target.memberId):undefined;
  const path=member?[member.token,...(member.designation?[member.designation]:[])]:[];let children=member?member.componentSelections:asset.componentSelections;
  for(const key of target.componentPath){const child=children?.find(c=>c.positionKey===key);if(!child)throw new Error("Product component position is unavailable.");path.push(child.positionKey,child.componentKey);children=child.children;}
  return path;
}
/** Both BOM paths use these exact revisions and canonical conductor quantities. */
export async function loadSelectedProductBom(model:DrawingModel,symbols:ApprovedDrawingSymbol[],db:Prisma.TransactionClient=prisma):Promise<SelectedProductBomOverride[]>{
  const products=(await loadDrawingProducts(model,db)).filter(p=>p.selection);if(!products.length)return [];
  const ids=[...new Set(products.flatMap(p=>[...(p.product.revision?[p.product.revision.itemId]:[]),...p.product.additionalRevisions.map(r=>r.itemId)]))];
  const items=await db.bomItem.findMany({where:{id:{in:ids}},select:{id:true,unit:true,status:true}});const byItem=new Map(items.map(i=>[i.id,i]));
  const graph=buildPackageConnectivityGraph(createPanelWiringSource(model,symbols));
  return products.map(subject=>{
    const path=legacyPath(model,subject.target);const result:SelectedProductBomOverride={key:subject.key,assetId:subject.target.assetId,componentPath:path,lines:[],warnings:[]};
    const warn=(message:string)=>result.warnings.push({code:"product_selection",assetId:subject.target.assetId,componentPath:path.length?path:undefined,message:`${subject.label}: ${message}`});
    const {revision,configuration,option}=subject.product;
    subject.product.issues.forEach(warn);
    if(!revision||!configuration||!option){warn(subject.selection?.status==="unassigned"?"No primary product selected; no legacy product has been inferred.":"Exact selected product is unavailable.");return result;}
    const member=subject.target.memberId?model.assets.find(a=>a.id===subject.target.assetId)?.terminalStrip?.members.find(m=>m.id===subject.target.memberId):undefined;
    const keys=new Set(subject.target.componentPath.length?[]:option.interface.terminalMappings.map(m=>member?namespaceStructuredTerminalKey(member.token,m.symbolTerminalKey):m.symbolTerminalKey));
    const terminalNodes=[...graph.electricalNodesById.values()].filter(n=>n.kind==="terminal_side"&&n.terminal.assetId===subject.target.assetId&&keys.has(n.terminal.terminalKey));
    const nodeIds=new Set(terminalNodes.map(n=>n.id));const relations=[...graph.conductiveRelationshipsById.values()].filter(r=>["internal_wire","drawing_connection"].includes(r.kind)&&r.nodeIds.some(id=>nodeIds.has(id)));
    const facts={cableEndCount:revision.profile.deviceType==="cable"?2:0,conductorTerminationCount:relations.reduce((sum,r)=>sum+r.nodeIds.filter(id=>nodeIds.has(id)).length,0),connectionCount:relations.length};
    const hasResolvedInterface=keys.size>0&&[...keys].every(key=>terminalNodes.some(n=>n.kind==="terminal_side"&&n.terminal.terminalKey===key));
    function line(rev:ItemEngineeringRevision,lineKey:string,quantity:number,rule:BomQuantityRule){
      const item=byItem.get(rev.itemId);if(!item){warn("Commercial Item metadata is unavailable.");return;}
      const dynamic=!["fixed_per_assembly","manual"].includes(rule);
      const quantityResult=dynamic&&(!hasResolvedInterface||rule==="per_cable_end"&&revision!.profile.deviceType!=="cable")?{status:"unavailable" as const}:calculateProjectedBomQuantity(rule,quantity,facts);
      if(quantityResult.status!=="calculated")warn(`${rev.identity.displayName}: ${quantityResult.status==="manual_required"?"manual quantity required":"quantity requires a resolved physical wiring interface"}.`);
      if(item.status==="archived")warn(`${rev.identity.displayName} is archived; the saved product identity is retained.`);
      result.lines.push({id:`${subject.key}:${lineKey}`,itemId:rev.itemId,itemEngineeringRevisionId:rev.id,physicalProductKey:subject.key,itemKey:rev.identity.itemKey,displayName:rev.identity.displayName,category:rev.profile.deviceType,unit:item.unit,manufacturer:rev.identity.manufacturer??undefined,partNumber:rev.identity.partNumber??undefined,
        quantity:quantityResult.quantity,quantityStatus:quantityResult.status,quantityRule:rule,sourceLineId:`${configuration!.id}:${lineKey}`,sourceAssetId:subject.target.assetId,componentPath:path.length?path:undefined} satisfies GeneratedBomLine);
    }
    line(revision,"primary",1,"fixed_per_assembly");
    for(const part of configuration.parts.filter(p=>!p.optionRevisionId||p.optionRevisionId===revision.id)){
      const rev=subject.product.additionalRevisions.find(r=>r.id===part.itemEngineeringRevisionId);if(rev)line(rev,part.lineKey,part.quantity,part.quantityRule);else warn("Additional part revision is unavailable.");
    }
    return result;
  });
}
