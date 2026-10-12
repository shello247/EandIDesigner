import {expect,it} from "vitest";
import {calculatePowerBudgets} from "../logic/services/power-budget";
import {buildPanelAnalysisCoverage} from "../logic/services/panel-analysis-coverage";
import {product,supply,specification,assigned,emptySettings} from "./product-engineering-fixtures";
it("counts physical products once and retains known subtotal without passing missing inputs",()=>{
  const a=product("AI1",[specification("active_power_consumption",1.8)],assigned());const b=product("AI2",[],assigned());
  const result=calculatePowerBudgets([supply(),a,a,b]);expect(result.budgets[0]).toMatchObject({knownSubtotal:1.8,remainingCapacity:8.2,status:"insufficient",coverage:"partial"});expect(result.budgets[0].loads).toHaveLength(2);expect(result.budgets[0].loads[1].value).toBeUndefined();
});
it("selects alternative consumption modes without adding them together",()=>{
  const a=product("AI1",[specification("active_power_consumption",1.8,{id:"external",modes:[{setId:"loop",choiceId:"external"}]}),specification("active_power_consumption",4.5,{id:"chassis",modes:[{setId:"loop",choiceId:"chassis"}]})],assigned({modes:[{setId:"loop",choiceId:"external"}]}));
  if(a.product.revision?.profile.version!==3)throw new Error("Fixture");a.product.revision.profile.modes=[{id:"loop",label:"Loop power",choices:[{id:"external",label:"External"},{id:"chassis",label:"Chassis"}]}];
  expect(calculatePowerBudgets([supply(),a]).budgets[0]).toMatchObject({knownSubtotal:1.8,status:"verified",coverage:"complete"});
  a.settings=assigned();expect(calculatePowerBudgets([supply(),a]).budgets[0]).toMatchObject({knownSubtotal:0,status:"insufficient"});
});
it("converts DC only with applicable voltage and marks engineer-provided voltage provisional",()=>{
  const ps=supply("supply_output_capacity_a",1);const load=product("AI1",[specification("active_power_consumption",4.8)],assigned());
  expect(calculatePowerBudgets([ps,load]).budgets[0].status).toBe("insufficient");
  load.settings!.powerAssignment!.voltageV=24;expect(calculatePowerBudgets([ps,load]).budgets[0]).toMatchObject({knownSubtotal:.2,status:"provisional"});
  if(ps.product.revision?.profile.version!==3)throw new Error("Fixture");ps.product.revision.profile.entries.push(specification("nominal_voltage",24,{scope:{kind:"supply_output",id:"out"}}));
  expect(calculatePowerBudgets([ps,load]).budgets[0]).toMatchObject({knownSubtotal:.2,status:"verified"});
  load.settings!.powerAssignment!.supplyNature="ac";expect(calculatePowerBudgets([ps,load]).budgets[0].status).toBe("insufficient");
});
it("keeps W and VA separate and does not infer input current from rated current or heat loss",()=>{
  const load=product("AI1",[specification("active_power_consumption",4),specification("rated_current",2),specification("heat_loss",3)],assigned());
  expect(calculatePowerBudgets([supply("supply_output_capacity_va",10),load]).budgets[0].status).toBe("insufficient");
  expect(calculatePowerBudgets([supply("supply_output_capacity_a",10),load]).budgets[0].status).toBe("insufficient");
});
it("reports exceeded capacity even with partial coverage and preserves assumptions",()=>{
  const load=product("AI1",[specification("active_power_consumption",12)],assigned());const missing=product("AI2",[],assigned());
  expect(calculatePowerBudgets([supply(),load,missing]).budgets[0]).toMatchObject({knownSubtotal:12,remainingCapacity:-2,status:"exceeded",coverage:"partial"});
  load.product.revision!.profile={version:3,deviceType:"io_module",groups:[],modes:[],entries:[],channels:[],terminals:[]};load.settings=assigned({assumptions:[{id:"estimate",analysisKey:"active_power_consumption",value:2,unit:"W",reason:"Provisional load estimate"}]});
  expect(calculatePowerBudgets([supply(),load]).budgets[0]).toMatchObject({knownSubtotal:2,status:"provisional"});
});
it("does not bypass conflicting consumption with another quantity and exposes unassigned loads",()=>{
  const load=product("AI1",[specification("active_power_consumption",1,{id:"a"}),specification("active_power_consumption",2,{id:"b"}),specification("supply_input_current",.1)],assigned());load.settings!.powerAssignment!.voltageV=24;
  expect(calculatePowerBudgets([supply(),load]).budgets[0]).toMatchObject({knownSubtotal:0,status:"insufficient"});
  load.settings=emptySettings;expect(calculatePowerBudgets([supply(),load]).unassigned).toHaveLength(1);
});

it("keeps a partial finding from claiming complete analysis coverage",()=>{
  expect(buildPanelAnalysisCoverage([{ruleCode:"power",ruleVersion:"1",category:"power_budget",status:"finding",coverage:"partial",findingIds:["missing"]}])).toMatchObject({status:"partial",partialRules:1,applicableRules:1});
});
