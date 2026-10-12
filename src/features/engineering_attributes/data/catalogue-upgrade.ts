import type {Prisma,PrismaClient} from "@prisma/client";
import {ATTRIBUTE_TYPE_SEEDS} from "./type-seeds";
import {ENGINEERING_UNITS} from "./unit-catalog";
import {attributeTypeDefinitionSchema,type AttributeTypeDefinition} from "./type-schema";
import {hashAttributeDefinition} from "./type-storage";
type Proposal={typeId:string;analysisKey:string;expectedRevision:number|null;definition:AttributeTypeDefinition;reason:string};
export async function previewEngineeringCatalogueUpgrade(db:Prisma.TransactionClient){
  const rows=await db.engineeringAttributeType.findMany({include:{revisions:{orderBy:{revisionNumber:"desc"},take:1}}});
  const byId=new Map(rows.map(r=>[r.id,r]));const proposals:Proposal[]=[];const needsReview:Array<{typeId:string;reason:string}>=[];
  for(const seed of ATTRIBUTE_TYPE_SEEDS){
    const current=byId.get(seed.typeId);
    if(!current){
      if(rows.some(r=>r.normalizedName===seed.definition.label.toLowerCase()||r.analysisKey===seed.analysisKey)){needsReview.push({typeId:seed.typeId,reason:"Existing catalogue identity or name conflicts with the proposed standard definition; no type will be replaced."});continue;}
      const definition=seed.definition.payloadKind==="scalar"&&seed.definition.engineeringDimension&&seed.definition.allowedUnits
        ? attributeTypeDefinitionSchema.parse({...seed.definition,allowedUnits:[...new Set([...seed.definition.allowedUnits,...Object.keys(ENGINEERING_UNITS[seed.definition.engineeringDimension]??{})])]}) : seed.definition;
      proposals.push({typeId:seed.typeId,analysisKey:seed.analysisKey!,expectedRevision:null,definition,reason:"Add a new standard definition; preserve all existing identities."});continue;
    }
    const revision=current.revisions[0];if(!revision||hashAttributeDefinition(revision.definitionJson)!==revision.contentHash)throw new Error("Attribute catalogue integrity check failed.");
    if(current.status!=="active")continue;
    const definition=attributeTypeDefinitionSchema.parse(JSON.parse(revision.definitionJson));
    if(current.analysisKey!==seed.analysisKey||definition.valueKind!==seed.definition.valueKind||definition.engineeringDimension!==seed.definition.engineeringDimension||definition.payloadKind!==seed.definition.payloadKind){needsReview.push({typeId:current.id,reason:"Standard type meaning differs from the supported definition. Preserve it for explicit review."});continue;}
    if(definition.payloadKind!=="scalar"||!definition.engineeringDimension||!definition.allowedUnits)continue;
    const units=Object.keys(ENGINEERING_UNITS[definition.engineeringDimension]??{});
    const additions=units.filter(u=>!definition.allowedUnits!.includes(u));if(!additions.length)continue;
    proposals.push({typeId:current.id,analysisKey:seed.analysisKey!,expectedRevision:current.currentRevision,definition:attributeTypeDefinitionSchema.parse({...definition,allowedUnits:[...definition.allowedUnits,...additions]}),reason:`Add compatible units: ${additions.join(", ")}. Old type revisions remain unchanged.`});
  }
  const fingerprint=hashAttributeDefinition(JSON.stringify({proposals,needsReview}));return {fingerprint,proposals,needsReview};
}
export async function applyEngineeringCatalogueUpgrade(db:PrismaClient,expectedFingerprint:string){
  return db.$transaction(async tx=>{
    const plan=await previewEngineeringCatalogueUpgrade(tx);if(plan.fingerprint!==expectedFingerprint)throw new Error("Catalogue changed after preview; review a fresh preview.");
    for(const proposal of plan.proposals){
      const definitionJson=JSON.stringify(proposal.definition);const revisionNumber=(proposal.expectedRevision??0)+1;
      if(proposal.expectedRevision===null)await tx.engineeringAttributeType.create({data:{id:proposal.typeId,name:proposal.definition.label,normalizedName:proposal.definition.label.toLowerCase(),analysisKey:proposal.analysisKey,currentRevision:1}});
      else {const changed=await tx.engineeringAttributeType.updateMany({where:{id:proposal.typeId,currentRevision:proposal.expectedRevision,status:"active"},data:{currentRevision:revisionNumber}});if(changed.count!==1)throw new Error("Catalogue revision conflict.");}
      await tx.engineeringAttributeTypeRevision.create({data:{id:`${proposal.typeId}_v${revisionNumber}`,typeId:proposal.typeId,revisionNumber,definitionJson,contentHash:hashAttributeDefinition(definitionJson)}});
    }
    return {created:plan.proposals.filter(p=>p.expectedRevision===null).length,revised:plan.proposals.filter(p=>p.expectedRevision!==null).length,needsReview:plan.needsReview};
  });
}
