import type {Prisma} from "@prisma/client";
import {prisma} from "@/lib/prisma";
import {resolveProductSelections} from "@/features/item_engineering/api/server";
import {projectItemProfileV3,validateProjectEngineeringSettings} from "@/features/item_engineering/api/public";
import type {DrawingModel} from "./schema";
import {listPhysicalProducts,physicalProductKey} from "../logic/services/drawing-products";
export async function loadDrawingProducts(model:DrawingModel,db:Prisma.TransactionClient=prisma){
  const products=listPhysicalProducts(model);const resolved=await resolveProductSelections(products,db);
  return products.map((product,index)=>({...product,product:resolved[index]}));
}
export async function validateDrawingProductSelections(model:DrawingModel,previous:DrawingModel|null,db:Prisma.TransactionClient=prisma){
  const products=await loadDrawingProducts(model,db);const before=new Map(previous?listPhysicalProducts(previous).map(p=>[p.key,p]):[]);
  const newItemIds=[...new Set(products.filter(p=>p.selection?.status==="selected"&&(JSON.stringify(before.get(p.key)?.selection)!==JSON.stringify(p.selection)||before.get(p.key)?.versionId!==p.versionId)).flatMap(p=>p.selection?.status==="selected"?[p.selection.itemId]:[]))];
  const activeItems=new Set((newItemIds.length?await db.bomItem.findMany({where:{id:{in:newItemIds},status:"active"},select:{id:true}}):[]).map(i=>i.id));
  for(const subject of products){
    const unchanged=JSON.stringify(before.get(subject.key)?.selection)===JSON.stringify(subject.selection)&&before.get(subject.key)?.versionId===subject.versionId;
    if(!unchanged&&subject.selection?.status==="selected"&&!activeItems.has(subject.selection.itemId))throw new Error(`${subject.label}: an archived Item cannot be newly selected.`);
    if(subject.selection&&!unchanged&&subject.product.status==="unavailable")throw new Error(`${subject.label}: ${subject.product.issues.join(" ")}`);
    if(!subject.settings)continue;
    if(subject.product.status!=="selected"&&JSON.stringify(before.get(subject.key)?.settings)!==JSON.stringify(subject.settings))throw new Error(`${subject.label}: select a compatible product before configuring project settings.`);
    const revision=subject.product.revision;if(!revision)continue;const profile=projectItemProfileV3(revision.profile);
    const errors=validateProjectEngineeringSettings(profile,subject.settings);if(errors.length)throw new Error(`${subject.label}: ${errors.join(" ")}`);
    const assignment=subject.settings.powerAssignment;
    if(assignment&&(!products.some(p=>p.key===physicalProductKey(assignment.supply))||subject.key===physicalProductKey(assignment.supply)))throw new Error(`${subject.label}: supply assignment must reference another physical product.`);
  }
}
