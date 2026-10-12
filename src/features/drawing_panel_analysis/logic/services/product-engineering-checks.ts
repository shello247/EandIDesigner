import {convertEngineeringUnit,awgToSquareMillimetres} from "@/features/engineering_attributes/api/public";
import {resolveEffectiveEngineeringFacts,findEngineeringFact,systemAttributeMeaning,type ProductChannel,type EngineeringFact} from "@/features/item_engineering/api/public";
import type {PanelAnalysisRuleContext} from "./panel-analysis-rule-set";
import {productConnectionIndex} from "./product-connections";
export type ProductCheck={key:string;assetIds:string[];title:string;problem:string;action:string;provisional:boolean;error:boolean;category:"signal_compatibility"|"terminal_occupancy"|"dimension_consistency"|"engineering_metadata"};
type CheckResult={applicable:number;issues:ProductCheck[]};
export function checkRequiredProductInformation(context:PanelAnalysisRuleContext):CheckResult{
  const result:CheckResult={applicable:0,issues:[]};
  for(const p of context.products??[]){if(!p.selection)continue;result.applicable++;
    const problems:string[]=[];const revision=p.product.revision;
    if(p.product.status!=="selected"||!revision)problems.push(...(p.product.issues.length?p.product.issues:["Choose a qualified product before running product engineering checks."]));
    else {
      const facts=resolveEffectiveEngineeringFacts({revision,settings:p.settings});
      const wired=(context.graph.occurrencesByAssetId.get(p.target.assetId)??[]).some(o=>o.occurrenceKind==="wiring");
      if(wired&&p.product.option?.usage==="panel_layout")problems.push("This product option is qualified only for panel layout; qualify its wiring interface before checking connections.");
      if(wired&&facts.profile.deviceType==="io_module"&&!facts.profile.channels.length)problems.push("Channel definitions and terminal memberships are required to check this I/O module's wiring.");
      const rows=productConnectionIndex(context.model,context.graph,p,p.product.option?.interface);
      if(p.settings?.terminalConnections?.some(t=>!rows.some(r=>r.terminalId===t.terminalId&&r.connections.some(c=>c.id===t.connectionId))))problems.push("Some installation details refer to landings no longer present in the canonical wiring.");
      if(wired&&p.target.componentPath.length&&facts.profile.terminals.some(t=>t.connectable))problems.push("Nested artwork has no canonical terminal projection. Interrogate the product definitions, but qualify a wiring representation before connection checks.");
    }
    if(problems.length)result.issues.push({key:`required:${p.key}`,assetIds:[p.target.assetId],category:"engineering_metadata",title:`${p.label}: required engineering information`,problem:problems.join(" "),action:"Complete the specific product selection, channel or installation evidence identified here. Attribute counts do not establish readiness.",provisional:true,error:false});
  }
  return result;
}
export function parseConductorSize(text:string|undefined):number|undefined{
  if(!text)return undefined;const mm=/^\s*(\d+(?:\.\d+)?)\s*(?:mm²|mm2|mm\^2)\s*$/i.exec(text);
  if(mm)return Number(mm[1])>0?Number(mm[1]):undefined;
  const gauge=/^\s*(?:(?:AWG\s*)?(\d{1,2}|[1-4]\/0)\s*AWG|AWG\s*(\d{1,2}|[1-4]\/0))\s*$/i.exec(text);
  if(!gauge)return undefined;const result=awgToSquareMillimetres(gauge[1]??gauge[2]);return result.ok?result.value:undefined;
}
function scalar(f:EngineeringFact|undefined){return f?.status==="resolved"&&f.value!==undefined?f.value:undefined;}
export function checkProductDimensions(context:PanelAnalysisRuleContext):CheckResult{
  const result:CheckResult={applicable:0,issues:[]};
  for(const p of context.products??[]){
    if(!p.selection||p.product.option?.usage==="wiring")continue;
    const occurrences=context.graph.occurrencesByAssetId.get(p.target.assetId)??[];
    const layouts=occurrences.filter(o=>o.panelLayout);if(!layouts.length)continue;result.applicable++;
    const fact=p.product.revision?resolveEffectiveEngineeringFacts({revision:p.product.revision,settings:p.settings}):undefined;
    const width=fact?findEngineeringFact(fact,"physical_width"):undefined;const height=fact?findEngineeringFact(fact,"physical_height"):undefined;
    const w=scalar(width),h=scalar(height);const metadata=p.product.metadata;
    const problems:string[]=[];let missing=false;
    if(p.product.status!=="selected"||!metadata||w===undefined||h===undefined){problems.push("Exact product width, height or qualified representation is missing or unresolved.");missing=true;}
    else{
      if(metadata.physicalWidthMm===undefined||metadata.physicalHeightMm===undefined){problems.push("Qualified Symbol physical dimensions are missing.");missing=true;}
      else if(Math.abs(w-metadata.physicalWidthMm)>.1||Math.abs(h-metadata.physicalHeightMm)>.1)problems.push(`Product ${w} × ${h} mm differs from the Symbol's ${metadata.physicalWidthMm} × ${metadata.physicalHeightMm} mm front dimensions.`);
      if(!p.target.componentPath.length&&!p.target.memberId)for(const occurrence of layouts){const box=occurrence.panelLayout!;
        // Physical geometry records native width/height and rotation separately.
        if(Math.abs(box.widthMm-w)>.1||Math.abs(box.heightMm-h)>.1)problems.push(`Placed physical dimensions ${box.widthMm} × ${box.heightMm} mm at ${box.rotationDeg}° differ from the selected product.`);
      }
    }
    const provisional=missing||width?.provisional===true||height?.provisional===true;
    if(provisional&&!problems.length)problems.push("Dimensions rely on an engineering assumption or unverified source.");
    if(problems.length)result.issues.push({key:`dimensions:${p.key}`,assetIds:[p.target.assetId],category:"dimension_consistency",title:`${p.label}: ${missing?"physical dimensions need review":"dimension consistency"}`,problem:problems.join(" "),action:"Review the selected Item dimensions, qualified representation and placement orientation. Artwork has not been resized.",provisional,error:!provisional});
  }
  return result;
}
export function checkProductTerminals(context:PanelAnalysisRuleContext):CheckResult{
  const result:CheckResult={applicable:0,issues:[]};
  for(const p of context.products??[]){if(!p.selection)continue;
    const facts=p.product.revision?resolveEffectiveEngineeringFacts({revision:p.product.revision,settings:p.settings}):undefined;
    if(!facts)continue;const rows=productConnectionIndex(context.model,context.graph,p,p.product.option?.interface);
    for(const row of rows){if(!row.connections.length)continue;result.applicable++;
      const terminal=facts.profile.terminals.find(t=>t.id===row.terminalId);if(!terminal)continue;
      const candidates=facts.profile.entries.filter(e=>systemAttributeMeaning(e.type)?.analysisKey==="terminal_conductor_limits"&&e.payload.kind==="terminal_range"&&(e.scope.kind==="terminal"?e.scope.id===terminal.id:e.scope.kind==="device"&&e.payload.terminalKeys.includes(terminal.number)));
      const applicable=candidates.filter(e=>e.ratingBasis!=="test"&&e.ratingBasis!=="transient"&&!e.modes.some(m=>p.settings?.modes.find(s=>s.setId===m.setId)?.choiceId!==m.choiceId)&&(!e.condition||p.settings?.confirmedConditions?.includes(e.id)));
      const problems:string[]=[];let missing=false,invalid=false,provisional=false;
      if(!applicable.length){problems.push("Applicable terminal conductor limits are missing or conditional.");missing=true;}
      for(const connection of row.connections){const installed=p.settings?.terminalConnections?.find(i=>i.terminalId===terminal.id&&i.connectionId===connection.id);
        const sourceSize=parseConductorSize(connection.size);const configuredSize=parseConductorSize(installed?.size);const size=sourceSize??configuredSize;
        if(sourceSize!==undefined&&configuredSize!==undefined&&Math.abs(sourceSize-configuredSize)>1e-8){problems.push(`${connection.label}: project conductor size conflicts with the saved wire specification.`);invalid=true;}
        if(sourceSize===undefined&&configuredSize!==undefined)provisional=true;
        if(size===undefined||!installed?.conductorClass||!installed.termination){problems.push(`${connection.label}: record conductor size, class and termination.`);missing=true;continue;}
        const matched=applicable.filter(e=>e.payload.kind==="terminal_range"&&e.payload.conductorClass===installed.conductorClass&&e.payload.termination===installed.termination);
        if(!matched.length){problems.push(`${connection.label}: no source-backed limit covers this conductor class and termination.`);missing=true;continue;}
        const distinct=new Set(matched.map(e=>JSON.stringify(e.payload)));
        if(distinct.size>1){problems.push(`${connection.label}: competing terminal limits require review.`);missing=true;continue;}
        const e=matched[0];if(e.payload.kind!=="terminal_range")continue;const limits=e.payload;
        provisional ||=e.source.kind!=="manufacturer"||(!e.source.reference&&!e.evidence.length)||Boolean(e.condition);
        if(size<limits.minimumMm2-1e-8||size>limits.maximumMm2+1e-8||row.connections.length>limits.maximumConductors){problems.push(`${connection.label}: ${size.toPrecision(5)} mm² / ${row.connections.length} conductors exceeds the ${limits.minimumMm2}–${limits.maximumMm2} mm² / ${limits.maximumConductors} conductor limit.`);invalid=true;}
      }
      if(provisional&&!problems.length)problems.push("Conductor compatibility relies on provisional installation data or ratings.");
      if(problems.length)result.issues.push({key:`terminal:${p.key}:${row.nodeId}`,assetIds:[p.target.assetId],category:"terminal_occupancy",title:`${p.label} terminal ${terminal.number}: ${invalid?"conductor incompatibility":"installation evidence incomplete"}`,problem:problems.join(" "),action:"Review the landed conductor and applicable terminal limits. Existing occupancy checks remain active.",provisional:missing||provisional,error:invalid});
    }
  }
  return result;
}
type ChannelState={key:string;assetId:string;label:string;channel:ProductChannel;nets:string[];range?:{minimum:number;maximum:number;unit:string};provisional:boolean;issues:string[]};
function normalizedChannelRange(channel:ProductChannel,range:{minimum:number;maximum:number;unit:string}){
  const dimension=channel.signalType==="analog_current"?"current":"voltage";const unit=dimension==="current"?"mA":"V";
  const min=convertEngineeringUnit(range.minimum,dimension,range.unit,unit);const max=convertEngineeringUnit(range.maximum,dimension,range.unit,unit);
  return min.ok&&max.ok?{minimum:min.value,maximum:max.value,unit}:undefined;
}
export function checkProductSignals(context:PanelAnalysisRuleContext):CheckResult{
  const result:CheckResult={applicable:0,issues:[]};const channels:ChannelState[]=[];
  for(const p of context.products??[]){if(!p.selection||!p.product.revision)continue;
    const facts=resolveEffectiveEngineeringFacts({revision:p.product.revision,settings:p.settings});const rows=productConnectionIndex(context.model,context.graph,p,p.product.option?.interface);
    for(const channel of facts.profile.channels){result.applicable++;const problems:string[]=[];
      if(p.product.status!=="selected")problems.push("The selected product interface is unavailable.");
      const signalTerminals=channel.terminals.filter(t=>t.role==="signal");
      if(!signalTerminals.length)problems.push("Identify the channel's signal terminal role; membership alone does not identify a signal path.");
      const nets=[...new Set(rows.filter(r=>signalTerminals.some(t=>t.terminalId===r.terminalId)&&r.connections.length).flatMap(r=>r.netId?[r.netId]:[]))];
      if(!nets.length)problems.push("No established wiring path was found at a mapped signal terminal.");
      if(channel.direction==="unknown"||channel.signalType==="unknown"||channel.signalType==="other")problems.push("Signal direction or type needs review.");
      const analog=channel.signalType==="analog_current"||channel.signalType==="analog_voltage";const selected=p.settings?.channelRanges.find(r=>r.channelId===channel.id);const range=analog&&selected?normalizedChannelRange(channel,selected):undefined;
      if(analog&&!range)problems.push("Select an applicable analog operating range.");
      if(range&&!channel.ranges.some(r=>{const valid=normalizedChannelRange(channel,r);return valid&&range.minimum>=valid.minimum&&range.maximum<=valid.maximum;}))problems.push("Selected operating range is not supported by this channel's recorded ranges.");
      const state:ChannelState={key:`${p.key}:${channel.id}`,assetId:p.target.assetId,label:`${p.label} channel ${channel.number}`,channel,nets,range,provisional:!channel.evidence.length,issues:problems};channels.push(state);
    }
  }
  const peers=new Set<string>();
  for(let i=0;i<channels.length;i++)for(let j=i+1;j<channels.length;j++){const a=channels[i],b=channels[j];if(!a.nets.some(n=>b.nets.includes(n)))continue;peers.add(a.key);peers.add(b.key);
    if(a.issues.length||b.issues.length)continue;const issues:string[]=[];
    if(a.channel.signalType!==b.channel.signalType)issues.push("Mapped signal types differ.");
    if(a.channel.direction===b.channel.direction&&a.channel.direction!=="bidirectional")issues.push(`Both connected channels are ${a.channel.direction}s.`);
    const output=a.channel.direction==="output"?a:b.channel.direction==="output"?b:undefined;const input=a.channel.direction==="input"?a:b.channel.direction==="input"?b:undefined;
    if(output?.range&&input?.range&&(output.range.minimum<input.range.minimum||output.range.maximum>input.range.maximum))issues.push("The source operating range extends outside the receiving channel's selected range.");
    if(!issues.length&&(a.provisional||b.provisional))issues.push("Channel compatibility lacks direct channel evidence and remains provisional.");
    if(issues.length)result.issues.push({key:`signal:${a.key}:${b.key}`,assetIds:[a.assetId,b.assetId],category:"signal_compatibility",title:`${a.label} / ${b.label}: signal compatibility`,problem:issues.join(" "),action:"Review channel direction, type, selected ranges and their supporting sources.",provisional:a.provisional||b.provisional,error:!(a.provisional||b.provisional)});
  }
  for(const c of channels){if(!peers.has(c.key)&&c.nets.length)c.issues.push("The wiring path has no other mapped product channel endpoint.");if(c.issues.length)result.issues.push({key:`signal-data:${c.key}`,assetIds:[c.assetId],category:"signal_compatibility",title:`${c.label}: signal check needs information`,problem:c.issues.join(" "),action:"Complete product channel roles, supported ranges, operating selection and endpoint mappings.",provisional:true,error:false});}
  return result;
}
