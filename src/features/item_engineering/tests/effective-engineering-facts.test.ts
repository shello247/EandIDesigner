import {expect,it} from "vitest";
import {ATTRIBUTE_TYPE_SEEDS} from "@/features/engineering_attributes/api/public";
import type {ItemEngineeringRevision,SpecificationEntry,EngineeringProjectSettings} from "../api/public";
import {findEngineeringFact,resolveEffectiveEngineeringFacts,validateProjectEngineeringSettings} from "../logic/services/effective-engineering-facts";
const settings:EngineeringProjectSettings={modes:[],assumptions:[],channelRanges:[]};
function entry(id:string,value:number,patch:Partial<SpecificationEntry>={}):SpecificationEntry{return {id,groupKey:"device",title:"Power",description:"",type:ATTRIBUTE_TYPE_SEEDS.find(t=>t.analysisKey==="active_power_consumption")!,payload:{kind:"quantity",value,unit:"W"},scope:{kind:"device"},modes:[],condition:"",ratingBasis:"continuous",evidence:[],source:{kind:"manufacturer",reference:"Synthetic datasheet"},...patch};}
function revision(entries:SpecificationEntry[]):ItemEngineeringRevision{return {id:"r1",itemId:"item",revisionNumber:1,identity:{itemKey:"item",displayName:"Module",manufacturer:null,model:null,partNumber:null},profile:{version:3,deviceType:"io_module",groups:[{key:"device",label:"Device",context:"device"}],modes:[{id:"loop",label:"Loop power",choices:[{id:"external",label:"External"},{id:"chassis",label:"Chassis"}]}],entries,channels:[],terminals:[]},noteIds:[],documentIds:[],contentHash:"a".repeat(64),createdAt:"2026-09-18T00:00:00.000Z"};}
it("selects one operating mode and never sums competing, conditional, transient or test ratings",()=>{
  const r=revision([entry("external",1.8,{modes:[{setId:"loop",choiceId:"external"}]}),entry("chassis",4.5,{modes:[{setId:"loop",choiceId:"chassis"}]}),entry("test",100,{ratingBasis:"test"})]);
  expect(findEngineeringFact(resolveEffectiveEngineeringFacts({revision:r}),"active_power_consumption")?.status).toBe("conditional");
  const resolved=resolveEffectiveEngineeringFacts({revision:r,settings:{...settings,modes:[{setId:"loop",choiceId:"external"}]}});
  expect(findEngineeringFact(resolved,"active_power_consumption")).toMatchObject({status:"resolved",value:1.8,provisional:false});
  expect(resolveEffectiveEngineeringFacts({revision:revision([entry("a",1),entry("b",2)])}).facts[0]).toMatchObject({status:"conflict"});
});
it("normalizes original units, keeps scopes distinct, and preserves unknown values without zero",()=>{
  const result=resolveEffectiveEngineeringFacts({revision:revision([entry("a",1,{payload:{kind:"quantity",value:.001,unit:"kW"}}),entry("b",2,{scope:{kind:"supply_input",id:"aux"}}),entry("c",0,{scope:{kind:"channel",id:"ch0"},payload:{kind:"unresolved",status:"missing",reason:"No rating"}})])});
  expect(result.facts).toHaveLength(3);expect(findEngineeringFact(result,"active_power_consumption")?.value).toBe(1);expect(result.facts[2]).toMatchObject({status:"missing"});expect(result.facts[2].value).toBeUndefined();expect(result.profile.entries[0].payload).toEqual({kind:"quantity",value:.001,unit:"kW"});
});
it("does not give custom or semantically changed types a calculation meaning",()=>{
  const a=entry("a",3);a.type={...a.type,typeId:"custom"};const b=entry("b",3);b.type={...b.type,definition:{...b.type.definition,engineeringDimension:"current"}};
  const result=resolveEffectiveEngineeringFacts({revision:revision([a,b])});expect(result.facts).toEqual([]);expect(result.unsupportedEntries).toHaveLength(2);
});
it("uses assumptions only for missing data, makes them provisional and excludes competing assumptions",()=>{
  const assumption={id:"estimate",analysisKey:"active_power_consumption",value:2,unit:"W",reason:"Provisional engineering estimate"};
  const result=resolveEffectiveEngineeringFacts({revision:revision([]),settings:{...settings,assumptions:[assumption]}});expect(result.facts[0]).toMatchObject({status:"resolved",value:2,provisional:true});
  const conflict=resolveEffectiveEngineeringFacts({revision:revision([entry("mfr",4.5)]),settings:{...settings,assumptions:[assumption]}});expect(conflict.facts[0].value).toBe(4.5);expect(conflict.assumptionConflicts).toHaveLength(1);
  const competing=resolveEffectiveEngineeringFacts({revision:revision([]),settings:{...settings,assumptions:[assumption,{...assumption,id:"other",value:3}]}});expect(competing.facts[0]).toMatchObject({status:"conflict"});
});
it("requires explicit condition review and validates project settings independently of inherited ratings",()=>{
  const r=revision([entry("conditional",2,{condition:"At full load"})]);const unresolved=resolveEffectiveEngineeringFacts({revision:r});expect(unresolved.facts[0].status).toBe("conditional");
  expect(resolveEffectiveEngineeringFacts({revision:r,settings:{...settings,confirmedConditions:["conditional"]}}).facts[0]).toMatchObject({status:"resolved",provisional:true});
  if(r.profile.version!==3)throw new Error("Fixture");expect(validateProjectEngineeringSettings(r.profile,{...settings,modes:[{setId:"loop",choiceId:"invented"}],confirmedConditions:["missing"]})).toHaveLength(2);
});
