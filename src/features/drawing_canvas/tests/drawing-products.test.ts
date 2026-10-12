import {expect,it} from "vitest";
import {createDefaultDrawingModel,parseDrawingModelJson,stringifyDrawingModel,drawingPackageModelSchema} from "../data/schema";
import {listPhysicalProducts,setDrawingProduct} from "../logic/services/drawing-products";
import {createEmptyDrawingHistory,pushDrawingHistoryEntry,undoDrawingHistory,redoDrawingHistory} from "../logic/services/drawing-model-history";
import {createNewAssetFromPlacement} from "../logic/services/drawing-asset-resolution";
import {createDrawingModelPreparationCache} from "../logic/services/drawing-model-preparation";
const selection={version:1 as const,status:"selected" as const,configurationId:"config",itemId:"item",itemEngineeringRevisionId:"r1"};
it("preserves panel label appearance when a drawing adopts version 3 product selection",()=>{
  const original=fixture();
  original.sheets[0].placements[0].layoutLabel={visible:true,size:"large",rotation:270,leader:true};
  original.sheets[0].placements[0].labelPosition={x:42,y:67};
  const selected=setDrawingProduct(original,{assetId:"asset",componentPath:[]},selection);
  const reloaded=parseDrawingModelJson(stringifyDrawingModel(selected));
  expect(reloaded.version).toBe(3);
  expect(reloaded.sheets[0].placements[0]).toEqual(original.sheets[0].placements[0]);
  expect(reloaded.assets[0].productSelection).toEqual(selection);
});
it("retains selected revisions and project modes through the editor normalization and save path",()=>{
  const original=fixture();const settings={modes:[{setId:"loop",choiceId:"external"}],assumptions:[],channelRanges:[],confirmedConditions:[]};
  const selected=setDrawingProduct(original,{assetId:"asset",componentPath:[]},selection,settings);
  const prepared=createDrawingModelPreparationCache({symbols:[]}).prepare(selected).model;
  const reloaded=parseDrawingModelJson(stringifyDrawingModel(prepared));
  expect(reloaded.assets.find(a=>a.id==="asset")?.productSelection).toEqual(selection);
  expect(reloaded.assets.find(a=>a.id==="asset")?.engineeringSettings?.modes).toEqual(settings.modes);
  expect(reloaded.sheets).toEqual(original.sheets);
});
function fixture(){const model=createDefaultDrawingModel();model.assets=[{id:"asset",tag:"PLC-1",title:"PLC",type:"controller",symbolId:"symbol",versionId:"version",componentSelections:[{positionKey:"slot1",componentKey:"io",symbolId:"symbol",versionId:"version",children:[{positionKey:"accessory",componentKey:"part",symbolId:"symbol",versionId:"version"}]}]}];
  model.sheets[0].placements=["p1","p2"].map((id,i)=>({id,assetId:"asset",symbolId:"symbol",versionId:"version",role:"device" as const,tag:"PLC-1",x:10+i*100,y:20,rotation:0,scale:1}));return model;}
it("upgrades only on explicit selection and saves one physical identity across repeated views",()=>{
  const original=fixture();const json=stringifyDrawingModel(original);expect(parseDrawingModelJson(json).version).toBe(2);
  const changed=setDrawingProduct(original,{assetId:"asset",componentPath:[]},selection);
  expect(original.version).toBe(2);expect(changed.version).toBe(3);expect(changed.sheets).toEqual(original.sheets);
  const loaded=parseDrawingModelJson(stringifyDrawingModel(changed));expect(loaded.assets[0].productSelection).toEqual(selection);
  expect(listPhysicalProducts(loaded).filter(p=>p.selection)).toHaveLength(1);
  expect(drawingPackageModelSchema.safeParse({...changed,version:2}).success).toBe(false);
  const current={model:changed,activeSheetId:changed.sheets[0].id,selection:{placementIds:["p1"],annotationIds:[]}};
  const before={...current,model:original};const history=pushDrawingHistoryEntry(createEmptyDrawingHistory(),before);
  const undo=undoDrawingHistory(history,current);expect(undo.entry?.model.version).toBe(2);
  expect(redoDrawingHistory(undo.history,before).entry?.model.assets[0].productSelection).toEqual(selection);
});
it("isolates nested positions and strip members, preserves product data on copies and reuses one choice per identity",()=>{
  let model=fixture();model=setDrawingProduct(model,{assetId:"asset",componentPath:["slot1","accessory"]},selection);
  model.assets.push({id:"strip",tag:"TB-1",title:"Strip",type:"terminal_block",terminalStrip:{kind:"structured_terminal_strip",nextMemberNumber:3,members:[1,2].map(n=>({id:`m${n}`,token:`M0${n}`,designation:String(n),role:"electrical",symbolId:"symbol",versionId:"version"}))}});
  model=setDrawingProduct(model,{assetId:"strip",memberId:"m1",componentPath:[]},selection);
  const loaded=parseDrawingModelJson(stringifyDrawingModel(model));
  expect(listPhysicalProducts(loaded).filter(p=>p.selection)).toHaveLength(2);expect(loaded.assets.find(a=>a.id==="strip")!.terminalStrip!.members[1].productSelection).toBeUndefined();
  const copied=createNewAssetFromPlacement(model,"p2",{symbols:[],tag:"PLC-2"});
  expect(copied.assets.filter(a=>a.componentSelections?.[0].children?.[0].productSelection)).toHaveLength(2);
  const copy=copied.assets.find(a=>a.tag==="PLC-2")!;
  const changed=setDrawingProduct(copied,{assetId:copy.id,componentPath:["slot1","accessory"]},{...selection,itemEngineeringRevisionId:"r2"});
  expect(changed.assets.find(a=>a.id==="asset")!.componentSelections![0].children![0].productSelection).toEqual(selection);
});
