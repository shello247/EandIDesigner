import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseMetadataJson } from "@/features/symbol_registry/api/public";
import { productConfigurationSchema, saveProductConfigurationSchema, type ProductConfiguration } from "./product-selection-schema";
import { getItemEngineeringRevisions } from "./queries";
import { symbolProductContract, validateProductCompatibility } from "../logic/services/item-interface";
import { hashItemEngineeringContent, ItemEngineeringError } from "../logic/services/item-engineering-revision";

const configurationInclude={options:{include:{itemEngineeringRevision:{select:{itemId:true}}}},parts:true} satisfies Prisma.SymbolItemConfigurationInclude;
type ConfigurationRow=Prisma.SymbolItemConfigurationGetPayload<{include:typeof configurationInclude}>;
function project(row:ConfigurationRow):ProductConfiguration {
  return productConfigurationSchema.parse({id:row.id,symbolVersionId:row.symbolVersionId,revisionNumber:row.revisionNumber,symbolContractHash:row.symbolContractHash,options:row.options.map(o=>({itemId:o.itemEngineeringRevision.itemId,itemEngineeringRevisionId:o.itemEngineeringRevisionId,
    usage:o.usage==="schematic"?"wiring":o.usage,evidence:o.evidence,interface:JSON.parse(o.interfaceJson)})),
    parts:row.parts.map(p=>({lineKey:p.lineKey,itemEngineeringRevisionId:p.itemEngineeringRevisionId,optionRevisionId:row.options.find(o=>o.id===p.optionId)?.itemEngineeringRevisionId??null,quantityRule:p.quantityRule,quantity:p.quantity}))});
}
export async function getProductConfigurations(ids:readonly string[],db:Prisma.TransactionClient=prisma) {
  if(ids.length>1000)throw new ItemEngineeringError("VALIDATION","At most 1000 configurations may be loaded at once.");
  if(!ids.length)return [];
  const rows=await db.symbolItemConfiguration.findMany({where:{id:{in:[...new Set(ids)]}},include:configurationInclude});
  return rows.map(project);
}
export async function getLatestProductConfiguration(symbolVersionId:string,db:Prisma.TransactionClient=prisma){
  const row=await db.symbolItemConfiguration.findFirst({where:{symbolVersionId},orderBy:{revisionNumber:"desc"},include:configurationInclude});return row?project(row):null;
}
export async function loadProductConfigurationWorkspace(symbolVersionId:string,db:Prisma.TransactionClient=prisma){
  const [symbol,configuration]=await Promise.all([
    db.symbolVersion.findUnique({where:{id:symbolVersionId},select:{metadataJson:true,symbol:{select:{id:true,status:true}}}}),
    getLatestProductConfiguration(symbolVersionId,db)
  ]);
  if(!symbol)throw new ItemEngineeringError("NOT_FOUND","Symbol version was not found.");
  const revisions=await getItemEngineeringRevisions(configuration?[...configuration.options.map(o=>o.itemEngineeringRevisionId),...configuration.parts.map(p=>p.itemEngineeringRevisionId)]:[],db);
  const metadata=parseMetadataJson(symbol.metadataJson);
  return {configuration,revisions,metadata,readOnly:symbol.symbol.status==="archived",contractChanged:!!configuration&&configuration.symbolContractHash!==hashItemEngineeringContent(symbolProductContract(metadata))};
}
export async function saveProductConfiguration(input:unknown,db:PrismaClient=prisma){
  const parsed=saveProductConfigurationSchema.parse(input);
  return db.$transaction(async tx=>{
    const [symbol,latest]=await Promise.all([
      tx.symbolVersion.findUnique({where:{id:parsed.symbolVersionId},select:{metadataJson:true,symbol:{select:{status:true}}}}),
      getLatestProductConfiguration(parsed.symbolVersionId,tx)
    ]);
    if(!symbol)throw new ItemEngineeringError("NOT_FOUND","Symbol version was not found.");
    if(symbol.symbol.status==="archived")throw new ItemEngineeringError("ARCHIVED","Archived Symbols are read-only.");
    if((latest?.id??null)!==parsed.expectedConfigurationId)throw new ItemEngineeringError("REVISION_CONFLICT","Compatible products changed. Reload and review before saving.");
    const metadata=parseMetadataJson(symbol.metadataJson);const contractHash=hashItemEngineeringContent(symbolProductContract(metadata));
    const checked=productConfigurationSchema.parse({id:"draft",symbolVersionId:parsed.symbolVersionId,revisionNumber:(latest?.revisionNumber??0)+1,symbolContractHash:contractHash,options:parsed.options,parts:parsed.parts});
    const ids=[...new Set([...checked.options.map(o=>o.itemEngineeringRevisionId),...checked.parts.map(p=>p.itemEngineeringRevisionId)])];
    const revisions=await getItemEngineeringRevisions(ids,tx);
    if(revisions.length!==ids.length)throw new ItemEngineeringError("NOT_FOUND","An exact Item revision is unavailable.");
    const items=await tx.bomItem.findMany({where:{id:{in:revisions.map(r=>r.itemId)}},select:{id:true,status:true,engineeringRevisions:{orderBy:{revisionNumber:"desc"},take:1,select:{id:true}}}});
    const retained=new Set([...(latest?.options.map(o=>o.itemEngineeringRevisionId)??[]),...(latest?.parts.map(p=>p.itemEngineeringRevisionId)??[])]);
    for(const revision of revisions){const item=items.find(i=>i.id===revision.itemId);
      if(!retained.has(revision.id)&&(item?.status!=="active"||item.engineeringRevisions[0]?.id!==revision.id))throw new ItemEngineeringError("VALIDATION","New product choices must use an active Item's current revision. Existing pinned choices may be retained.");
    }
    const warnings:string[]=[];
    for(const option of checked.options){const result=validateProductCompatibility(metadata,revisions.find(r=>r.id===option.itemEngineeringRevisionId)!,option);
      if(!result.valid)throw new ItemEngineeringError("VALIDATION",result.errors.join("\n"));warnings.push(...result.warnings);
    }
    const comparable=(c:ProductConfiguration)=>({symbolVersionId:c.symbolVersionId,symbolContractHash:c.symbolContractHash,options:c.options,parts:c.parts});
    if(latest&&hashItemEngineeringContent(comparable(latest))===hashItemEngineeringContent(comparable(checked)))return {configuration:latest,created:false,warnings};
    const row=await tx.symbolItemConfiguration.create({data:{symbolVersionId:checked.symbolVersionId,revisionNumber:checked.revisionNumber,symbolContractHash:contractHash,
      options:{create:checked.options.map(o=>({itemEngineeringRevisionId:o.itemEngineeringRevisionId,usage:o.usage,evidence:o.evidence,interfaceJson:JSON.stringify(o.interface)}))}},include:{options:true}});
    if(checked.parts.length)await tx.symbolItemConfigurationPart.createMany({data:checked.parts.map(p=>({configurationId:row.id,optionId:row.options.find(o=>o.itemEngineeringRevisionId===p.optionRevisionId)?.id??null,
      itemEngineeringRevisionId:p.itemEngineeringRevisionId,lineKey:p.lineKey,quantityRule:p.quantityRule,quantity:p.quantity}))});
    return {configuration:(await getProductConfigurations([row.id],tx))[0],created:true,warnings};
  });
}
export async function searchProductItems(query:string,db:Prisma.TransactionClient=prisma){
  const rows=await db.bomItem.findMany({where:{status:"active",engineeringRevisions:{some:{}},OR:["itemKey","displayName","manufacturer","model","partNumber"].map(field=>({[field]:{contains:query.trim().slice(0,160)}}))},
    take:30,orderBy:{displayName:"asc"},select:{id:true,displayName:true,manufacturer:true,partNumber:true,engineeringRevisions:{orderBy:{revisionNumber:"desc"},take:1,select:{id:true,revisionNumber:true}}}});
  return rows.map(r=>({itemId:r.id,name:r.displayName,manufacturer:r.manufacturer,partNumber:r.partNumber,revisionId:r.engineeringRevisions[0].id,revisionNumber:r.engineeringRevisions[0].revisionNumber}));
}
