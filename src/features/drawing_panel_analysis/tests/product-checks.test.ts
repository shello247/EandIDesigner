import {expect,it} from "vitest";
import {panelWiringSourcePackageSchema} from "@/features/drawing_panel_wiring/api/contracts";
import {buildPackageConnectivityGraph,runPackagePanelDrawingQualityChecks} from "@/features/drawing_panel_wiring/api/public";
import {createDefaultDrawingModel} from "@/features/drawing_canvas/data/schema";
import {symbolMetadataSchema} from "@/features/symbol_registry/api/public";
import type {PanelAnalysisRuleContext} from "../logic/services/panel-analysis-rule-set";
import {checkProductDimensions,checkProductSignals,checkProductTerminals,parseConductorSize} from "../logic/services/product-engineering-checks";
import {product,specification,emptySettings} from "./product-engineering-fixtures";
import {productConnectionIndex} from "../logic/services/product-connections";
import {runPanelAnalysisRules} from "../logic/services/panel-analysis-rules";
import {focusedProductRules} from "../logic/services/product-engineering-rules";
import {buildIoSchedule,ioScheduleCsv} from "../logic/services/io-schedule";
import {itemProfileV3Schema} from "@/features/item_engineering/api/public";

export function checkFixture():PanelAnalysisRuleContext{
  const products=[product("AO1"),product("AI1")];
  for(const [i,p] of products.entries()){
    const r=p.product.revision!;if(r.profile.version!==3)throw new Error("Fixture");
    r.profile.terminals=[{id:"t1",number:"1",function:"Signal",connectable:true,shared:false,evidence:[]}];
    r.profile.channels=[{id:"ch0",number:"0",direction:i?"input":"output",signalType:"analog_current",terminals:[{terminalId:"t1",function:"Signal",role:"signal"}],ranges:[{minimum:4,maximum:20,unit:"mA"}],evidence:[{kind:"url",url:"https://example.com/synthetic",label:"Synthetic evidence"}]}];
    p.product.option={itemId:r.itemId,itemEngineeringRevisionId:r.id,usage:"both",evidence:"Synthetic mapping",interface:{terminalMappings:[{terminalId:"t1",symbolTerminalKey:"1"}]}};
    p.settings={...emptySettings,channelRanges:[{channelId:"ch0",minimum:4,maximum:20,unit:"mA"}]};
  }
  const source=panelWiringSourcePackageSchema.parse({assets:products.map(p=>({id:p.target.assetId,tag:p.label,title:p.label,type:"io_module"})),sheets:[{id:"sheet",sheetNumber:1,name:"Synthetic wiring",kind:"drawing",occurrences:products.map(p=>({sheetId:"sheet",placementId:p.label,assetId:p.target.assetId,tag:p.label,role:"device",occurrenceKind:"wiring",symbolId:"s",versionId:"v",terminalResolutionStatus:"resolved",terminals:[{terminalKey:"1",label:"1",supportedSides:["single"],anchors:[{anchorKey:"1",anchorKind:"terminal",sideHint:"single"}],status:"resolved"}]})),connections:[{id:"wire",sheetId:"sheet",from:{placementId:"AO1",anchorKey:"1"},to:{placementId:"AI1",anchorKey:"1"},wireId:"W1"}]}]});
  return {model:createDefaultDrawingModel(),source,graph:buildPackageConnectivityGraph(source),symbols:[],products,qualityReport:runPackagePanelDrawingQualityChecks(buildPackageConnectivityGraph(source))};
}
it("compares explicit channel signals on canonical paths, with range and direction failures",()=>{
  const c=checkFixture();expect(checkProductSignals(c)).toEqual({applicable:2,issues:[]});
  c.products![1].settings!.channelRanges[0].minimum=8;
  expect(checkProductSignals(c).issues[0]).toMatchObject({provisional:false,error:true,problem:expect.stringContaining("outside")});
  c.products![1].settings!.channelRanges=[];expect(checkProductSignals(c).issues.some(i=>i.provisional)).toBe(true);
});
it("does not infer signal roles or continuity from channel membership",()=>{
  const c=checkFixture();const profile=c.products![1].product.revision!.profile;if(profile.version!==3)throw new Error("Fixture");profile.channels[0].terminals[0].role="return";
  const before=c.graph.electricalNetsById.size;const result=checkProductSignals(c);expect(result.issues.some(i=>i.problem.includes("signal terminal role"))).toBe(true);expect(c.graph.electricalNetsById.size).toBe(before);
});
it("handles common unit conversion while refusing unsupported size text",()=>{
  expect(parseConductorSize("1.5 mm²")).toBe(1.5);expect(parseConductorSize("AWG 16")).toBeCloseTo(1.3087,3);expect(parseConductorSize("16 AWG")).toBeCloseTo(1.3087,3);expect(parseConductorSize("16")).toBeUndefined();expect(parseConductorSize("0 mm²")).toBeUndefined();
});
it("checks installed conductor limits without turning absent installation details into a pass",()=>{
  const c=checkFixture();const p=c.products![0];const profile=p.product.revision!.profile;if(profile.version!==3)throw new Error("Fixture");
  profile.entries=[specification("terminal_conductor_limits",0,{payload:{kind:"terminal_range",terminalKeys:["1"],conductorClass:"fine_stranded",termination:"ferruled",minimumMm2:.5,maximumMm2:2.5,maximumConductors:1}})];
  expect(checkProductTerminals(c).issues[0].provisional).toBe(true);
  p.settings!.terminalConnections=[{terminalId:"t1",connectionId:"drawing_connection:sheet:wire",size:"4 mm²",conductorClass:"fine_stranded",termination:"ferruled"}];
  const result=checkProductTerminals(c);expect(result.issues[0].problem).toContain("exceeds");expect(result.issues[0].provisional).toBe(true);
  p.settings!.terminalConnections[0].size="1.5 mm²";expect(checkProductTerminals(c).issues[0].problem).toContain("provisional");
});
it("compares native physical dimensions independently of 90-degree placement rotation",()=>{
  const c=checkFixture();const p=c.products![0];const profile=p.product.revision!.profile;if(profile.version!==3)throw new Error("Fixture");
  profile.entries=[specification("physical_width",50),specification("physical_height",100)];
  p.product.metadata=symbolMetadataSchema.parse({symbolKey:"fixture",displayName:"Synthetic Module",category:"controller",viewBox:{x:0,y:0,width:50,height:100},anchors:[],terminals:[],physicalWidthMm:50,physicalHeightMm:100,layoutUsage:"both"});
  const occurrence=c.graph.occurrencesByAssetId.get("AO1")![0];occurrence.panelLayout={layoutKind:"layout_helper",backplanePlacementId:"bp",backplaneSheetX:0,backplaneSheetY:0,xMm:0,yMm:0,widthMm:50,heightMm:100,rotationDeg:90};
  expect(checkProductDimensions(c)).toEqual({applicable:1,issues:[]});occurrence.panelLayout.widthMm=55;expect(checkProductDimensions(c).issues[0].error).toBe(true);
});
it("uses mapped product terminal identity and preserves partial rule coverage",()=>{
  const c=checkFixture();expect(productConnectionIndex(c.model,c.graph,c.products![0],c.products![0].product.option!.interface)[0]).toMatchObject({terminalId:"t1",symbolTerminalKey:"1",connections:[{id:"drawing_connection:sheet:wire",label:"W1"}]});
  const rules=focusedProductRules(c);const run=runPanelAnalysisRules({context:c,rules});expect(run.coverage.status).toBe("partial");expect(run.outcomes.every(o=>o.status!=="not_evaluated"||o.notEvaluatedReason!=="execution_failed")).toBe(true);
});
it("builds I/O rows from the same exact terminal and wire mappings as interrogation",()=>{
  const c=checkFixture();const rows=buildIoSchedule(c);expect(rows).toHaveLength(2);expect(rows[0]).toMatchObject({channelId:"ch0",channelNumber:"0",terminalId:"t1",terminalNumber:"1",symbolTerminalKey:"1",connections:[{id:"drawing_connection:sheet:wire",label:"W1"}],revisionId:"revision-AO1",range:"4 to 20 mA"});
  expect(buildIoSchedule({...c,products:[...c.products!,c.products![0]]})).toHaveLength(2);
  const run=runPanelAnalysisRules({context:c,rules:focusedProductRules(c)});expect(run.findings.flatMap(f=>f.evidence).some(e=>e.productSource?.revisionId==="revision-AO1")).toBe(true);
  rows[0].assetLabel="=FORMULA()";expect(ioScheduleCsv(rows)).toContain('"\'=FORMULA()"');
});
it("retains all GRV channel memberships and visibly excludes unused terminals 13 and 14",()=>{
  const c=checkFixture();const p=c.products![0];p.product.revision!.profile=itemProfileV3Schema.parse({version:3,deviceType:"io_module",groups:[],entries:[],modes:[],
    terminals:Array.from({length:26},(_,i)=>({id:`t${i+1}`,number:`${i+1}`,function:i===12||i===13?"Unused":"Synthetic connection",connectable:i!==12&&i!==13,shared:false,isolationGroup:i===12||i===13?undefined:`channel-${Math.floor((i>13?i-2:i)/3)}`,evidence:[]})),
    channels:Array.from({length:8},(_,i)=>({id:`ch${i}`,number:`${i}`,direction:"input",signalType:"analog_current",ranges:[{minimum:4,maximum:20,unit:"mA"}],evidence:[],terminals:Array.from({length:3},(_,j)=>({terminalId:`t${i*3+j+1+(i>=4?2:0)}`,function:`Synthetic ${j+1}`}))}))});
  const rows=buildIoSchedule({...c,products:[p]});expect(rows).toHaveLength(26);expect(rows.filter(r=>r.channelNumber==="0").map(r=>r.terminalNumber)).toEqual(["1","2","3"]);expect(rows.find(r=>r.channelNumber==="4")?.terminalNumber).toBe("15");expect(rows.filter(r=>!r.connectable).map(r=>r.terminalNumber)).toEqual(["13","14"]);expect(new Set(rows.filter(r=>r.channelNumber!==null).map(r=>r.isolationGroup)).size).toBe(8);
});
