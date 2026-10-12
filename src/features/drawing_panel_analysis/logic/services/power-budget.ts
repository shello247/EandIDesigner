import type {ResolvedDrawingProduct} from "@/features/drawing_canvas/api/product-server";
import {physicalProductKey} from "@/features/drawing_canvas/api/product-contracts";
import {resolveEffectiveEngineeringFacts,findEngineeringFact,type EffectiveEngineeringFacts,type EngineeringFact} from "@/features/item_engineering/api/public";
import type {PowerAnalysis,PowerBudget} from "../../data/engineering-checks";
const capacities=[{key:"supply_output_capacity_w",unit:"W"},{key:"supply_output_capacity_va",unit:"VA"},{key:"supply_output_capacity_a",unit:"A"}] as const;
const loadKeys=["active_power_consumption","apparent_power_consumption","supply_input_current"];
function usable(f:EngineeringFact|undefined):f is EngineeringFact&{value:number}{return f?.status==="resolved"&&f.value!==undefined&&f.value>=0;}
function issue(f:EngineeringFact|undefined,label:string){return !f?`${label} is missing.`:f.status!=="resolved"?`${label}: ${f.reasons.join(" ")||f.status}.`:`${label} requires a scalar rating.`;}
export function calculatePowerBudgets(products:readonly ResolvedDrawingProduct[]):PowerAnalysis{
  const unique=[...new Map(products.map(p=>[p.key,p])).values()];const byKey=new Map(unique.map(p=>[p.key,p]));
  const resolved=new Map<string,EffectiveEngineeringFacts>();
  for(const p of unique)if(p.product.revision)resolved.set(p.key,resolveEffectiveEngineeringFacts({revision:p.product.revision,settings:p.settings}));
  const result:PowerAnalysis={budgets:[],unassigned:[]};const groups=new Map<string,{supplyKey:string;outputId:string;loads:ResolvedDrawingProduct[]}>();
  for(const load of unique){
    const assignment=load.settings?.powerAssignment;const facts=resolved.get(load.key);
    if(!assignment){
      if(load.selection?.status==="selected"&&facts?.facts.some(f=>loadKeys.includes(f.analysisKey)&&f.ratingBasis==="continuous"&&(f.status!=="resolved"||f.value!==0)))
        result.unassigned.push({key:load.key,assetId:load.target.assetId,label:load.label,reason:"Recorded load consumption has no explicit supply assignment."});
      continue;
    }
    const supplyKey=physicalProductKey(assignment.supply);const id=JSON.stringify([supplyKey,assignment.outputId]);
    const group=groups.get(id)??{supplyKey,outputId:assignment.outputId,loads:[]};group.loads.push(load);groups.set(id,group);
  }
  for(const [id,group] of groups){
    const supply=byKey.get(group.supplyKey);const source=resolved.get(group.supplyKey);const scope={kind:"supply_output" as const,id:group.outputId};
    const available=capacities.filter(c=>source&&findEngineeringFact(source,c.key,scope));
    for(const capacityType of available.length?available:[capacities[0]]){
      const cap=source?findEngineeringFact(source,capacityType.key,scope):undefined;
      const budget:PowerBudget={id:`${id}:${capacityType.unit}`,supplyKey:group.supplyKey,supplyAssetId:supply?.target.assetId??group.loads[0].settings!.powerAssignment!.supply.assetId,supplyLabel:supply?.label??"Missing supply",outputId:group.outputId,unit:capacityType.unit,knownSubtotal:0,status:"insufficient",coverage:"partial",provisional:false,reasons:[],loads:[]};
      if(supply?.product.status!=="selected")budget.reasons.push("The supply needs a valid selected product and compatible interface.");
      if(usable(cap)){budget.capacity=cap.value;budget.provisional ||=cap.provisional;}else budget.reasons.push(issue(cap,`${capacityType.unit} output capacity`));
      if(source?.assumptionConflicts.length)budget.reasons.push(...source.assumptionConflicts.map(c=>c.reason));
      const supplyNature=source?findEngineeringFact(source,"supply_nature",scope):undefined;
      const sourceVoltage=source?findEngineeringFact(source,"nominal_voltage",scope):undefined;
      const natures=new Set(group.loads.map(l=>l.settings!.powerAssignment!.supplyNature));
      let incompatible=false;
      if(natures.size>1){budget.reasons.push("Loads disagree on the supply output's AC/DC context.");incompatible=true;}
      const voltages=new Set(group.loads.map(l=>l.settings!.powerAssignment!.voltageV).filter((v):v is number=>v!==undefined));
      if(voltages.size>1){budget.reasons.push("Loads assigned to one output specify different operating voltages.");incompatible=true;}
      for(const load of group.loads){
        const assignment=load.settings!.powerAssignment!;const facts=resolved.get(load.key);const loadScope=assignment.loadInputId==="device"?{kind:"device" as const}:{kind:"supply_input" as const,id:assignment.loadInputId};
        const row:PowerBudget["loads"][number]={key:load.key,assetId:load.target.assetId,label:load.label,provisional:false,reasons:[]};budget.loads.push(row);
        if(load.product.status!=="selected"||!facts){row.reasons.push("Load product specifications are unavailable or incompatible.");continue;}
        if(assignment.supplyNature==="unknown")row.reasons.push("Supply AC/DC context needs review.");
        if(supplyNature?.status==="resolved"&&supplyNature.text!==assignment.supplyNature){row.reasons.push("Assigned supply type conflicts with the output rating.");incompatible=true;}
        const inputNature=findEngineeringFact(facts,"supply_nature",loadScope);
        if(inputNature?.status==="resolved"&&inputNature.text!==assignment.supplyNature){row.reasons.push("Load input supply type conflicts with the assigned output.");incompatible=true;}
        let voltage=usable(sourceVoltage)?sourceVoltage.value:assignment.voltageV;
        const voltageProvisional=!usable(sourceVoltage)&&voltage!==undefined||sourceVoltage?.provisional===true;
        if(usable(sourceVoltage)&&assignment.voltageV!==undefined&&Math.abs(sourceVoltage.value-assignment.voltageV)>1e-9){row.reasons.push("Assigned voltage conflicts with the supply's nominal output voltage.");incompatible=true;voltage=undefined;}
        const direct=findEngineeringFact(facts,capacityType.unit==="W"?"active_power_consumption":capacityType.unit==="VA"?"apparent_power_consumption":"supply_input_current",loadScope);
        if(usable(direct)){row.value=direct.value;row.provisional ||= direct.provisional;}
        else if(assignment.supplyNature==="dc"&&capacityType.unit!=="VA"){
          const alternate=findEngineeringFact(facts,capacityType.unit==="W"?"supply_input_current":"active_power_consumption",loadScope);
          if(usable(alternate)&&voltage!==undefined&&voltage>0){row.value=capacityType.unit==="W"?alternate.value*voltage:alternate.value/voltage;row.provisional ||= alternate.provisional||voltageProvisional;}
          else row.reasons.push(issue(direct,`${capacityType.unit} load consumption`),...(usable(alternate)?["DC conversion requires the applicable operating voltage."]:[]));
        }else row.reasons.push(issue(direct,`${capacityType.unit} load consumption`));
        // A known conflicting/conditional direct rating cannot be bypassed with another quantity.
        if(direct&&["conditional","conflict","unsupported"].includes(direct.status)){row.value=undefined;row.reasons.push(issue(direct,`${capacityType.unit} load consumption`));}
        if(facts.assumptionConflicts.length)row.reasons.push(...facts.assumptionConflicts.map(c=>c.reason));
        const loadVoltage=findEngineeringFact(facts,"supply_voltage_range",loadScope);
        if(voltage!==undefined&&loadVoltage?.status==="resolved"&&loadVoltage.minimum!==undefined&&loadVoltage.maximum!==undefined&&(voltage<loadVoltage.minimum||voltage>loadVoltage.maximum)){row.reasons.push("Operating voltage is outside the load's supported input range.");incompatible=true;}
        if(row.value!==undefined&&Number.isFinite(row.value))budget.knownSubtotal+=row.value;
        else row.value=undefined;
        budget.provisional ||=row.provisional;row.reasons=[...new Set(row.reasons)];
      }
      budget.knownSubtotal=Number(budget.knownSubtotal.toPrecision(12));
      if(budget.capacity!==undefined)budget.remainingCapacity=Number((budget.capacity-budget.knownSubtotal).toPrecision(12));
      const missing=budget.reasons.length>0||budget.loads.some(l=>l.value===undefined||l.reasons.length>0);
      budget.coverage=missing||budget.provisional?"partial":"complete";
      budget.status=budget.capacity!==undefined&&budget.knownSubtotal>budget.capacity+1e-9?"exceeded":incompatible?"incompatible":missing?"insufficient":budget.provisional?"provisional":"verified";
      result.budgets.push(budget);
    }
  }
  return result;
}
