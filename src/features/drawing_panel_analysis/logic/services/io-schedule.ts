import {projectItemProfileV3,type AttributeEvidence} from "@/features/item_engineering/api/public";
import type {PanelAnalysisRuleContext} from "./panel-analysis-rule-set";
import type {IoScheduleRow} from "../../data/engineering-checks";
import {productConnectionIndex} from "./product-connections";
export function buildIoSchedule(context:PanelAnalysisRuleContext):IoScheduleRow[]{
  const rows:IoScheduleRow[]=[];const unique=new Map((context.products??[]).map(p=>[p.key,p]));
  for(const p of unique.values()){
    const revision=p.product.revision;if(!revision||!p.selection)continue;const profile=projectItemProfileV3(revision.profile);if(!profile.channels.length)continue;
    const mapped=productConnectionIndex(context.model,context.graph,p,p.product.option?.interface);
    const modes=profile.modes.map(mode=>{const choice=p.settings?.modes.find(m=>m.setId===mode.id);return `${mode.label}: ${mode.choices.find(c=>c.id===choice?.choiceId)?.label??"Needs review"}`;});
    const base={physicalKey:p.key,assetId:p.target.assetId,assetLabel:p.label,itemId:revision.itemId,revisionId:revision.id,revisionNumber:revision.revisionNumber,product:revision.identity.displayName,partNumber:revision.identity.partNumber,modes};
    const used=new Set<string>();
    for(const channel of profile.channels){
      const range=p.settings?.channelRanges.find(r=>r.channelId===channel.id);const members=channel.terminals.length?channel.terminals:[null];
      for(const member of members){const terminal=profile.terminals.find(t=>t.id===member?.terminalId);if(terminal)used.add(terminal.id);
        const connections=mapped.filter(r=>r.terminalId===terminal?.id);const definition=p.product.option?.interface.terminalMappings.find(m=>m.terminalId===terminal?.id);
        const evidence:AttributeEvidence[]=[...channel.evidence,...(terminal?.evidence??[]),...profile.entries.filter(e=>e.scope.kind==="channel"&&e.scope.id===channel.id||e.scope.kind==="terminal"&&e.scope.id===terminal?.id).flatMap(e=>e.evidence)];
        const notes:string[]=[];if(p.product.status!=="selected")notes.push(...p.product.issues);if(!terminal)notes.push("Channel terminal mapping is missing.");else if(!definition)notes.push("Symbol terminal mapping is missing.");else if(!connections.length)notes.push("No canonical wiring terminal is available in this drawing.");if(!member?.role)notes.push("Electrical role needs review.");
        rows.push({...base,id:JSON.stringify([p.key,channel.id,terminal?.id??null]),channelId:channel.id,channelNumber:channel.number,direction:channel.direction,signalType:channel.signalType,range:range?`${range.minimum} to ${range.maximum} ${range.unit}`:"Not selected",terminalId:terminal?.id??null,terminalNumber:terminal?.number??null,terminalFunction:member?.function??"Missing",terminalRole:member?.role??"Needs review",connectable:terminal?.connectable??false,isolationGroup:terminal?.isolationGroup,symbolTerminalKey:definition?.symbolTerminalKey,connections:[...new Map(connections.flatMap(c=>c.connections).map(c=>[c.id,{id:c.id,label:c.label}])).values()],evidence:[...new Map(evidence.map(e=>[JSON.stringify(e),e])).values()],notes});
      }
    }
    for(const terminal of profile.terminals.filter(t=>!used.has(t.id)))rows.push({...base,id:JSON.stringify([p.key,null,terminal.id]),channelId:null,channelNumber:null,direction:"—",signalType:"—",range:"—",terminalId:terminal.id,terminalNumber:terminal.number,terminalFunction:terminal.function,terminalRole:"—",connectable:terminal.connectable,isolationGroup:terminal.isolationGroup,connections:[],evidence:terminal.evidence,notes:[terminal.connectable?"Not assigned to a channel.":"Unused — non-connectable."]});
  }
  return rows;
}
const csvCell=(value:string)=>`"${(/^[=+@\-\t\r]/.test(value)?"'":"")+value.replaceAll('"','""')}"`;
export function ioScheduleCsv(rows:readonly IoScheduleRow[]):string{
  const headers=["Asset","Product","Part number","Item revision","Channel","Terminal","Function","Role","Signal","Direction","Selected range","Selected modes","Connectable","Symbol terminal","Isolation group","Connections","Review notes"];
  return [headers,...rows.map(r=>[r.assetLabel,r.product,r.partNumber??"",String(r.revisionNumber),r.channelNumber??"",r.terminalNumber??"",r.terminalFunction,r.terminalRole,r.signalType,r.direction,r.range,r.modes.join("; "),r.connectable?"Yes":"No",r.symbolTerminalKey??"",r.isolationGroup??"",r.connections.map(c=>c.label).join("; "),r.notes.join("; ")])].map(row=>row.map(csvCell).join(",")).join("\r\n");
}
