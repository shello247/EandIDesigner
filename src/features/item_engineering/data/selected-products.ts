import type {Prisma} from "@prisma/client";
import {prisma} from "@/lib/prisma";
import {parseMetadataJson} from "@/features/symbol_registry/api/public";
import type {SymbolMetadata} from "@/features/symbol_registry/api/public";
import type {DrawingProductSelection,CompatibleProduct,ProductConfiguration} from "./product-selection-schema";
import type {ItemEngineeringRevision} from "./schema";
import {getProductConfigurations} from "./product-configurations";
import {getItemEngineeringRevisions} from "./queries";
import {hashItemEngineeringContent} from "../logic/services/item-engineering-revision";
import {symbolProductContract,validateProductCompatibility} from "../logic/services/item-interface";
export type ProductSelectionRequest={key:string;versionId?:string;selection?:DrawingProductSelection};
export type SelectedProductResolution={key:string;status:"legacy"|"unassigned"|"selected"|"unavailable";issues:string[];
  configuration?:ProductConfiguration;revision?:ItemEngineeringRevision;option?:CompatibleProduct;metadata?:SymbolMetadata;additionalRevisions:ItemEngineeringRevision[]};
export async function resolveProductSelections(requests:readonly ProductSelectionRequest[],db:Prisma.TransactionClient=prisma):Promise<SelectedProductResolution[]>{
  const configIds=[...new Set(requests.flatMap(r=>r.selection?[r.selection.configurationId]:[]))];
  const configurations:ProductConfiguration[]=[];
  for(let i=0;i<configIds.length;i+=1000)configurations.push(...await getProductConfigurations(configIds.slice(i,i+1000),db));
  const revisionIds=[...new Set(configurations.flatMap(c=>[...c.options.map(o=>o.itemEngineeringRevisionId),...c.parts.map(p=>p.itemEngineeringRevisionId)]))];
  const revisions:ItemEngineeringRevision[]=[];
  for(let i=0;i<revisionIds.length;i+=1000)revisions.push(...await getItemEngineeringRevisions(revisionIds.slice(i,i+1000),db));
  const versionIds=[...new Set(requests.filter(r=>r.selection).flatMap(r=>r.versionId?[r.versionId]:[]))];
  const symbols=versionIds.length?await db.symbolVersion.findMany({where:{id:{in:versionIds}},select:{id:true,metadataJson:true}}):[];
  const byConfig=new Map(configurations.map(c=>[c.id,c]));const byRevision=new Map(revisions.map(r=>[r.id,r]));const byVersion=new Map(symbols.map(s=>[s.id,parseMetadataJson(s.metadataJson)]));
  return requests.map(request=>{
    const result:SelectedProductResolution={key:request.key,status:"legacy",issues:[],additionalRevisions:[]};
    const selection=request.selection;if(!selection)return result;result.status="unavailable";
    const config=byConfig.get(selection.configurationId);const metadata=request.versionId?byVersion.get(request.versionId):undefined;
    if(!config||config.symbolVersionId!==request.versionId){result.issues.push("Product configuration does not belong to this exact Symbol version.");return result;}
    result.configuration=config;result.metadata=metadata;
    if(selection.status==="unassigned"){result.status="unassigned";return result;}
    const option=config.options.find(o=>o.itemEngineeringRevisionId===selection.itemEngineeringRevisionId&&o.itemId===selection.itemId);
    const revision=byRevision.get(selection.itemEngineeringRevisionId);
    if(!option||!revision||revision.itemId!==selection.itemId){result.issues.push("Selected Item revision is not an option in this configuration.");return result;}
    result.option=option;result.revision=revision;
    result.additionalRevisions=config.parts.filter(p=>!p.optionRevisionId||p.optionRevisionId===revision.id).flatMap(p=>{const r=byRevision.get(p.itemEngineeringRevisionId);if(!r)result.issues.push("Additional part revision is unavailable.");return r?[r]:[];});
    if(!metadata||config.symbolContractHash!==hashItemEngineeringContent(symbolProductContract(metadata)))result.issues.push("The Symbol interface differs from its qualified product configuration.");
    else result.issues.push(...validateProductCompatibility(metadata,revision,option).errors);
    result.status=result.issues.length?"unavailable":"selected";return result;
  });
}
