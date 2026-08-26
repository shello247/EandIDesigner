import { createDefaultDrawingModel, createDefaultDrawingSheet, drawingPackageModelSchema, stringifyDrawingModel, type DrawingModel, type DrawingPlacement } from "../../src/features/drawing_canvas/data/schema";
import { createTerminalBlockPlacement } from "../../src/features/drawing_canvas/logic/services/drawing-terminal-blocks";
import { createPanelEnclosurePlacement } from "../../src/features/drawing_canvas/logic/services/drawing-asset-containment";
import { createBackplanePlacement } from "../../src/features/drawing_canvas/logic/services/drawing-backplane-layouts";
import { getRenderableSymbolForPlacement } from "../../src/features/drawing_canvas/logic/services/drawing-generated-symbols";
import { stringifyMetadata, parseMetadataJson } from "../../src/features/symbol_registry/data/schema";
import type { ApprovedDrawingSymbol } from "../../src/features/drawing_canvas/types";
import { guard, sha, write } from "./common";

export function auditSymbol(index=0): ApprovedDrawingSymbol {
  const token=String(index).padStart(4,"0");
  const symbolKey="audit_symbol_"+token;
  const metadataJson=stringifyMetadata({
    symbolKey,displayName:"Audit Device "+token,category:"other",layoutUsage:"both",
    physicalWidthMm:30,physicalHeightMm:50,viewBox:{x:0,y:0,width:30,height:50},
    anchors:Array.from({length:10},(_,i)=>({key:"T"+(i+1),x:i<5?2:28,y:6+(i%5)*9,kind:"terminal" as const})),
    terminals:Array.from({length:10},(_,i)=>({key:"T"+(i+1),label:String(i+1),anchorKey:"T"+(i+1),panelSide:"single" as const,requiredForWiring:true})),
    panelWiring:{assetType:"breaker",tagPrefix:"MCB",schematicScale:0.5}
  });
  return {symbolId:symbolKey,symbolKey,versionId:symbolKey+"_v1",versionNumber:1,displayName:"Audit Device "+token,category:"other",svg:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 50"><rect x=".5" y=".5" width="29" height="49" fill="white" stroke="#334155"/>'+Array.from({length:10},(_,i)=>'<circle cx="'+(i<5?2:28)+'" cy="'+(6+(i%5)*9)+'" r="1.5" fill="none" stroke="#0f766e"/>').join("")+'</svg>',metadata:parseMetadataJson(metadataJson)};
}
export function mixedModel(sheetCount:number): DrawingModel {
  const base=createDefaultDrawingModel();
  base.titleBlock={...base.titleBlock,date:"2026-08-26",project:"Synthetic drawing audit",drawingNumber:"AUDIT-"+sheetCount};
  base.assets=[];base.sheets=[];
  base.panelWiring={schemaVersion:1,terminalMappings:[],internalWires:[],bridges:[],bonds:[]};
  const symbol=auditSymbol();
  for(let group=0;group<Math.ceil(sheetCount/4);group++){
    const prefix="g"+group;
    const panelId=prefix+"_panel";
    const fields=createDefaultDrawingSheet({id:prefix+"_field",name:"Field "+(group+1)});
    const layout=createDefaultDrawingSheet({id:prefix+"_layout",name:"Layout "+(group+1)});
    const detail=createDefaultDrawingSheet({id:prefix+"_detail",name:"Detail "+(group+1)});
    const schedule=createDefaultDrawingSheet({id:prefix+"_schedule",name:"Schedule "+(group+1)});
    const tb={...createTerminalBlockPlacement({model:base,activeSheet:fields,assetId:prefix+"_tb_asset",tag:"TB-"+(101+group),x:280,y:140,terminalBlock:{count:10,startNumber:1,orientation:"horizontal"}}),id:prefix+"_tb",containerAssetId:panelId};
    const devices:DrawingPlacement[]=Array.from({length:10},(_,i)=>({id:prefix+"_device_"+i,assetId:prefix+"_asset_"+i,symbolId:symbol.symbolId,versionId:symbol.versionId,role:"device",tag:"MCB-"+(101+group*10+i),title:"Audit breaker "+i,x:35+(i%5)*52,y:45+Math.floor(i/5)*65,scale:0.6,rotation:0,containerAssetId:panelId}));
    base.assets.push({id:panelId,tag:"P-"+(101+group),type:"panel",title:"Audit Panel "+group},
      {id:tb.assetId!,tag:tb.tag,type:"terminal_block",title:"Ten-way terminal block",symbolId:tb.symbolId,versionId:tb.versionId,terminalBlock:tb.terminalBlock},
      ...devices.map(device=>({id:device.assetId!,tag:device.tag,type:"breaker" as const,title:device.title!,symbolId:device.symbolId,versionId:device.versionId})));
    fields.placements=[...devices,tb];
    fields.connections=Array.from({length:5},(_,i)=>({id:prefix+"_field_wire_"+i,from:{placementId:devices[i].id,anchorKey:"T1"},to:{placementId:tb.id,anchorKey:"T"+(i+1)+"_BOTTOM"},wireId:"FIELD-"+group+"-"+i,label:"Synthetic field connection"}));
    const enclosure={...createPanelEnclosurePlacement({model:base,activeSheet:layout,assetId:panelId,tag:"P-"+(101+group),title:"Audit Panel",x:20,y:25,width:600,height:400}),id:prefix+"_enclosure"};
    const backplane=createBackplanePlacement({panelPlacement:enclosure,sheet:{...layout.page,titleBlock:base.titleBlock},id:prefix+"_backplane"});
    layout.placements=[enclosure,backplane,...[...devices,tb].map((device,i)=>({...device,id:device.id+"_layout",layoutKind:"layout_helper" as const,layoutParentId:backplane.id,layoutPosition:{xMm:25+(i%6)*65,yMm:35+Math.floor(i/6)*95},layoutDimensions:{lengthMm:30,widthMm:50}}))];
    detail.panelDrawingContext={kind:"detailed_panel_wiring",panelAssetId:panelId};
    detail.placements=[...devices,tb].map(device=>({...device,id:device.id+"_detail",connectionDisplayMode:"all_connected" as const}));
    const wires=Array.from({length:5},(_,i)=>({id:prefix+"_internal_"+i,panelAssetId:panelId,wireNumber:group*5+i+1,wireId:"TB-"+(101+group)+":"+String(i+1)+"("+String(group*5+i+1).padStart(3,"0")+")",from:{assetId:tb.assetId!,terminalKey:"T"+(i+1),side:"internal" as const},to:{assetId:devices[i+5].assetId!,terminalKey:"T2",side:"single" as const},domain:"signal" as const,origin:"engineer" as const}));
    base.panelWiring!.internalWires.push(...wires);
    detail.connections=wires.map((wire,i)=>({id:wire.id+"_route",panelConnectionId:wire.id,from:{placementId:tb.id+"_detail",anchorKey:"T"+(i+1)+"_TOP"},to:{placementId:devices[i+5].id+"_detail",anchorKey:"T2"},wireId:wire.wireId}));
    schedule.panelDrawingContext={kind:"detailed_panel_wiring",panelAssetId:panelId};
    schedule.placements=[{...tb,id:tb.id+"_schedule",x:35,y:55,connectionDisplayMode:"all_connected"}];
    schedule.annotations=[{id:prefix+"_wire_schedule",kind:"connected_wire_schedule",x:145,y:35,width:240,schedule:{assetId:tb.assetId!,sourcePlacementId:tb.id+"_schedule",scope:"all_connected"}}];
    for(const sheet of [fields,layout,detail]){
      sheet.annotations.push({id:sheet.id+"_note",kind:"note",x:25,y:210,text:"Synthetic audit fixture — no project data."});
    }
    base.sheets.push(fields,layout,detail,schedule);
  }
  base.sheets=base.sheets.slice(0,sheetCount);
  return drawingPackageModelSchema.parse(base);
}
export function denseModel():DrawingModel{
  const model=createDefaultDrawingModel(); const symbol=auditSymbol();
  model.titleBlock={...model.titleBlock,date:"2026-08-26",project:"Dense synthetic audit"};
  const sheet=createDefaultDrawingSheet({id:"dense_sheet",name:"Dense 200 devices 500 routes"});
  sheet.placements=Array.from({length:200},(_,i)=>({id:"dense_"+i,assetId:"dense_asset_"+i,symbolId:symbol.symbolId,versionId:symbol.versionId,role:"device",tag:"D-"+i,x:15+(i%20)*18,y:25+Math.floor(i/20)*21,rotation:0,scale:0.22}));
  model.assets=sheet.placements.map(p=>({id:p.assetId!,tag:p.tag,type:"breaker",title:p.tag,symbolId:p.symbolId,versionId:p.versionId}));
  sheet.connections=Array.from({length:500},(_,i)=>({id:"dense_wire_"+i,from:{placementId:"dense_"+(Math.floor(i/5)*2),anchorKey:"T"+(i%5+1)},to:{placementId:"dense_"+(Math.floor(i/5)*2+1),anchorKey:"T"+(i%5+1)},wireId:"DW-"+i}));
  model.sheets=[sheet];return drawingPackageModelSchema.parse(model);
}
export function validateFixture(model:DrawingModel){
  const occupied=new Set<string>();let routes=0;
  const symbols=[auditSymbol()];
  for(const sheet of model.sheets){
    const byId=new Map(sheet.placements.map(p=>[p.id,p]));
    if(byId.size!==sheet.placements.length) throw new Error("Duplicate occurrence identity");
    for(const wire of sheet.connections){
      for(const endpoint of [wire.from,wire.to]){
        const placement=byId.get(endpoint.placementId);
        const symbol=getRenderableSymbolForPlacement(placement,symbols,model.assets);
        if(!placement||!symbol?.metadata.anchors.some(a=>a.key===endpoint.anchorKey)) throw new Error("Unresolved fixture anchor: "+JSON.stringify(endpoint));
        if(!wire.panelConnectionId){
          const key=placement.assetId+":"+endpoint.anchorKey;
          if(occupied.has(key)) throw new Error("Repeated field landing: "+key);
          occupied.add(key);
        }
      }
      routes++;
    }
  }
  const internal=new Set<string>();
  for(const wire of model.panelWiring?.internalWires??[])for(const e of [wire.from,wire.to]){
    const key=e.assetId+":"+e.terminalKey+":"+e.side;
    if(internal.has(key))throw new Error("Repeated internal landing: "+key);
    internal.add(key);
  }
  const json=stringifyDrawingModel(model);
  return {sheets:model.sheets.length,assets:model.assets.length,placements:model.sheets.reduce((n,s)=>n+s.placements.length,0),routes,internalWires:model.panelWiring?.internalWires.length??0,bytes:Buffer.byteLength(json),sha256:sha(json)};
}
export async function setCatalogueCount(count:number){
  guard();
  const {prisma}=await import("../../src/lib/prisma");
  const category=await prisma.symbolCategory.findUniqueOrThrow({where:{normalizedName:"other"}});
  await prisma.symbol.deleteMany({where:{symbolKey:{startsWith:"audit_symbol_"},NOT:{symbolKey:{in:Array.from({length:count},(_,i)=>auditSymbol(i).symbolKey)}}}});
  for(let i=0;i<count;i++){
    const symbol=auditSymbol(i);
    await prisma.symbol.upsert({where:{id:symbol.symbolId},update:{},create:{id:symbol.symbolId,symbolKey:symbol.symbolKey,displayName:symbol.displayName,category:"other",categoryId:category.id,status:"approved",versions:{create:{id:symbol.versionId,versionNumber:1,status:"approved",svg:symbol.svg,metadataJson:stringifyMetadata(symbol.metadata)}}}});
  }
}
export async function seed(){
  guard();await setCatalogueCount(25);
  const {prisma}=await import("../../src/lib/prisma");
  const fixtures=[...([10,40,120].map(size=>({id:"audit_mixed_"+size,model:mixedModel(size)}))),{id:"audit_dense",model:denseModel()}];
  const manifest=[];
  for(const fixture of fixtures){
    const facts=validateFixture(fixture.model);
    await prisma.drawing.upsert({
      where:{id:fixture.id},
      update:{drawingKey:fixture.id,title:fixture.id,status:"needs_review",modelJson:stringifyDrawingModel(fixture.model)},
      create:{id:fixture.id,drawingKey:fixture.id,title:fixture.id,status:"needs_review",modelJson:stringifyDrawingModel(fixture.model)}
    });
    manifest.push({id:fixture.id,...facts});
    write(fixture.id+".json",fixture.model);
  }
  write("fixtures.json",manifest);console.log(JSON.stringify(manifest,null,2));await prisma.$disconnect();
}
if(process.argv[1]?.endsWith("fixtures.ts"))await seed();
