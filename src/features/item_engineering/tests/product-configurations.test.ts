import {mkdirSync,mkdtempSync} from "node:fs";
import path from "node:path";
import {PrismaClient} from "@prisma/client";
import {afterEach,expect,it} from "vitest";
import {ensureItemEngineeringStorage} from "../data/storage";
import {createItemEngineeringRevision} from "../data/mutations";
import {saveProductConfiguration,loadProductConfigurationWorkspace,getProductConfigurations} from "../data/product-configurations";
import {productConfigurationSchema} from "../data/product-selection-schema";
import {validateProductCompatibility} from "../logic/services/item-interface";
import {symbolMetadataSchema} from "@/features/symbol_registry/api/public";
import {resolveProductSelections} from "../data/selected-products";
import {createDefaultDrawingModel} from "@/features/drawing_canvas/data/schema";
import {validateDrawingProductSelections} from "@/features/drawing_canvas/data/product-selections";
import {loadSelectedProductBom} from "@/features/bom_creator/api/product-server";
import {generateDrawingBom} from "@/features/bom_creator/logic/use_cases/generate-drawing-bom";
import {generateBomFromProjection} from "@/features/bom_creator/logic/use_cases/generate-bom-from-projection";
import type {ApprovedDrawingSymbol} from "@/features/drawing_canvas/api/asset-contracts";
const clients:PrismaClient[]=[];
afterEach(async()=>{await Promise.all(clients.splice(0).map(c=>c.$disconnect()));});
async function fixture(){
  const root=path.resolve("artifacts/drawing-performance/engineering-attributes/configuration-tests");mkdirSync(root,{recursive:true});
  const db=new PrismaClient({datasourceUrl:"file:"+path.join(mkdtempSync(path.join(root,"run-")),"fixture.db").replaceAll("\\","/")});clients.push(db);
  await db.$executeRawUnsafe("PRAGMA foreign_keys=ON");
  await db.$executeRawUnsafe("CREATE TABLE BomItem(id TEXT PRIMARY KEY,itemKey TEXT NOT NULL,displayName TEXT NOT NULL,manufacturer TEXT,model TEXT,partNumber TEXT,status TEXT NOT NULL,category TEXT NOT NULL,unit TEXT NOT NULL DEFAULT 'each',updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)");
  await db.$executeRawUnsafe("CREATE TABLE Symbol(id TEXT PRIMARY KEY,status TEXT NOT NULL)");
  await db.$executeRawUnsafe("CREATE TABLE SymbolVersion(id TEXT PRIMARY KEY,symbolId TEXT NOT NULL,metadataJson TEXT NOT NULL)");
  await db.$executeRawUnsafe("CREATE TABLE BomItemDocument(id TEXT PRIMARY KEY,itemId TEXT,title TEXT,fileName TEXT,mimeType TEXT,sizeBytes INTEGER,dataUrl TEXT,createdAt DATETIME,updatedAt DATETIME)");
  await ensureItemEngineeringStorage(db);
  const metadata=symbolMetadataSchema.parse({symbolKey:"synthetic-module",displayName:"Synthetic module",category:"controller",layoutUsage:"both",physicalWidthMm:20,physicalHeightMm:100,viewBox:{x:0,y:0,width:20,height:100},terminals:[{key:"1",label:"1",anchorKey:"a1"},{key:"2",label:"2",anchorKey:"a2"}],anchors:[{key:"a1",x:0,y:10,kind:"terminal"},{key:"a2",x:0,y:20,kind:"terminal"}]});
  await db.$executeRawUnsafe("INSERT INTO Symbol VALUES('symbol','active')");await db.$executeRawUnsafe("INSERT INTO SymbolVersion VALUES('version','symbol',?)",JSON.stringify(metadata));
  const revisions=[];
  for(const id of ["item","alternative","accessory"]){
    await db.$executeRawUnsafe("INSERT INTO BomItem(id,itemKey,displayName,status,category) VALUES(?,?,?,'active','io_module')",id,id,id);
    revisions.push((await createItemEngineeringRevision({itemId:id,expectedLatestRevisionId:null,profile:{version:3,deviceType:"io_module",groups:[],modes:[],entries:[],channels:[],terminals:[1,2].map(n=>({id:`t${n}`,number:String(n),function:"Synthetic",connectable:true,shared:false,isolationGroup:`channel${n}`,evidence:[]}))},noteIds:[],documentIds:[]},db)).revision);
  }
  const options=revisions.slice(0,2).map(r=>({itemId:r.itemId,itemEngineeringRevisionId:r.id,usage:"both" as const,evidence:"Synthetic interface qualification",interface:{terminalMappings:[1,2].map(n=>({terminalId:`t${n}`,symbolTerminalKey:String(n)}))}}));
  return {db,metadata,revisions,input:{symbolVersionId:"version",expectedConfigurationId:null as string|null,options,parts:[{lineKey:"part",itemEngineeringRevisionId:revisions[2].id,optionRevisionId:null,quantityRule:"fixed_per_assembly",quantity:2}]}};
}
it("saves exact alternatives and scoped additional parts atomically, retains old configurations and detects contract drift",async()=>{
  const {db,input}=await fixture();const first=await saveProductConfiguration(input,db);
  expect(first.configuration.options).toHaveLength(2);expect(first.configuration.parts[0].quantity).toBe(2);
  expect((await saveProductConfiguration({...input,expectedConfigurationId:first.configuration.id},db)).created).toBe(false);
  await expect(saveProductConfiguration(input,db)).rejects.toMatchObject({code:"REVISION_CONFLICT"});
  const second=await saveProductConfiguration({...input,expectedConfigurationId:first.configuration.id,parts:[{...input.parts[0],quantity:3}]},db);
  expect((await getProductConfigurations([first.configuration.id],db))[0].parts[0].quantity).toBe(2);
  await expect(db.symbolItemConfiguration.update({where:{id:first.configuration.id},data:{symbolContractHash:"a".repeat(64)}})).rejects.toThrow();
  const workspace=await loadProductConfigurationWorkspace("version",db);expect(workspace.configuration?.id).toBe(second.configuration.id);expect(workspace.contractChanged).toBe(false);
  await db.symbolVersion.update({where:{id:"version"},data:{metadataJson:JSON.stringify({...workspace.metadata,physicalWidthMm:30})},select:{id:true}});
  expect((await loadProductConfigurationWorkspace("version",db)).contractChanged).toBe(true);
});
it("rejects foreign ownership, duplicate mappings, missing wiring mappings, unused terminals and bridged isolation",async()=>{
  const {db,input,metadata,revisions}=await fixture();
  await expect(saveProductConfiguration({...input,options:[{...input.options[0],itemId:"alternative"}]},db)).rejects.toMatchObject({code:"VALIDATION"});
  await expect(saveProductConfiguration({...input,options:[{...input.options[0],interface:{terminalMappings:[]}}]},db)).rejects.toMatchObject({code:"VALIDATION"});
  await expect(saveProductConfiguration({...input,options:[{...input.options[0],interface:{terminalMappings:[input.options[0].interface.terminalMappings[0],input.options[0].interface.terminalMappings[0]]}}]},db)).rejects.toThrow();
  const revision=structuredClone(revisions[0]);if(revision.profile.version!==3)throw new Error("Wrong fixture");revision.profile.terminals[0].connectable=false;
  expect(validateProductCompatibility(metadata,revision,input.options[0]).valid).toBe(false);
  const bridged={...metadata,electricalTopology:{version:1 as const,permanentContinuityGroups:[{key:"bridge",terminalKeys:["1","2"]}]}};
  expect(validateProductCompatibility(bridged,revisions[0],input.options[0]).errors.join(" ")).toContain("isolation");
  expect(await db.symbolItemConfiguration.count()).toBe(0);
});
it("does not permit the primary product to be counted again as a common additional part",()=>{
  expect(productConfigurationSchema.safeParse({id:"config",symbolVersionId:"version",revisionNumber:1,symbolContractHash:"a".repeat(64),options:[{itemId:"item",itemEngineeringRevisionId:"r",usage:"panel_layout",evidence:"Basis",interface:{terminalMappings:[]}}],parts:[{lineKey:"p",itemEngineeringRevisionId:"r",optionRevisionId:null,quantity:1,quantityRule:"fixed_per_assembly"}]}).success).toBe(false);
});
it("pins drawing facts to exact product revisions and validates ownership on the save boundary",async()=>{
  const {db,input,revisions}=await fixture();const saved=await saveProductConfiguration(input,db);const revision=revisions[0];
  const selection={version:1 as const,status:"selected" as const,configurationId:saved.configuration.id,itemId:revision.itemId,itemEngineeringRevisionId:revision.id};
  const model=createDefaultDrawingModel();model.version=3;model.assets=[{id:"asset",tag:"PLC-1",title:"PLC",type:"controller",symbolId:"symbol",versionId:"version",productSelection:selection}];
  await validateDrawingProductSelections(model,null,db);
  const newer=await createItemEngineeringRevision({itemId:revision.itemId,expectedLatestRevisionId:revision.id,profile:{...revision.profile,deviceType:"controller"},noteIds:[],documentIds:[]},db);
  const resolved=await resolveProductSelections([{key:"asset",versionId:"version",selection}],db);
  expect(resolved[0].revision?.id).toBe(revision.id);expect(resolved[0].revision?.id).not.toBe(newer.revision.id);
  expect(resolved[0].additionalRevisions.map(r=>r.id)).toEqual([revisions[2].id]);
  const forged=structuredClone(model);forged.assets[0].productSelection={...selection,itemId:"alternative"};
  await expect(validateDrawingProductSelections(forged,null,db)).rejects.toThrow("not an option");
});
it("counts selected primary products and additional parts identically in both BOM paths without repeated-view inflation",async()=>{
  const {db,input,metadata,revisions}=await fixture();const config=(await saveProductConfiguration(input,db)).configuration;
  const model=createDefaultDrawingModel();model.version=3;
  const choice=(index:number)=>({version:1 as const,status:"selected" as const,configurationId:config.id,itemId:revisions[index].itemId,itemEngineeringRevisionId:revisions[index].id});
  model.assets=[{id:"a",tag:"PLC-1",title:"Assembly",type:"controller",symbolId:"symbol",versionId:"version",productSelection:choice(0),componentSelections:[{positionKey:"slot1",componentKey:"module",symbolId:"symbol",versionId:"version",productSelection:choice(1)}]},
    {id:"b",tag:"PLC-2",title:"Other device",type:"controller",symbolId:"symbol",versionId:"version",productSelection:choice(1)},
    {id:"strip",tag:"TB-1",title:"Terminal strip",type:"terminal_block",terminalStrip:{kind:"structured_terminal_strip",nextMemberNumber:2,members:[{id:"m1",token:"M01",designation:"1",role:"electrical",symbolId:"symbol",versionId:"version",productSelection:choice(0)}]}}];
  model.sheets[0].placements=["view1","view2"].map((id,i)=>({id,assetId:"a",symbolId:"symbol",versionId:"version",tag:"PLC-1",role:"device" as const,x:20+i*50,y:20,rotation:0,scale:1}));
  const symbols:ApprovedDrawingSymbol[]=[{symbolId:"symbol",symbolKey:metadata.symbolKey,displayName:metadata.displayName,category:metadata.category,versionId:"version",versionNumber:1,metadata,svg:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 100"/>'}];
  const selectedProducts=await loadSelectedProductBom(model,symbols,db);expect(selectedProducts).toHaveLength(4);
  const first=generateDrawingBom({drawingId:"drawing",drawingTitle:"Synthetic",model,symbols,templates:[],selectedProducts});
  const second=generateBomFromProjection({drawingId:"drawing",drawingTitle:"Synthetic",symbols,templates:[],selectedProducts,assemblies:model.assets.map(a=>({assetId:a.id,assetTag:a.tag,assetType:a.type,title:a.title,symbolId:a.symbolId,versionId:a.versionId,sheetRefs:[],quantityFacts:{connectionCount:0,conductorTerminationCount:0,cableEndCount:0}}))});
  const totals=(bom:typeof first)=>bom.consolidatedLines.map(l=>({item:l.itemId,revision:l.itemEngineeringRevisionId,quantity:l.quantity})).sort((a,b)=>a.item.localeCompare(b.item));
  expect(totals(first)).toEqual(totals(second));expect(totals(first)).toEqual([{item:"accessory",revision:revisions[2].id,quantity:8},{item:"alternative",revision:revisions[1].id,quantity:2},{item:"item",revision:revisions[0].id,quantity:2}]);
  expect(first.assemblies.flatMap(a=>a.lines).filter(l=>l.physicalProductKey===selectedProducts[0].key&&l.sourceLineId.endsWith(":primary"))).toHaveLength(1);
});
