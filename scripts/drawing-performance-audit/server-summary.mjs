import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();if(path.basename(root)!=='drawing-performance-audit-20260826')throw new Error('Isolated audit required');
const output=path.join(root,'artifacts/drawing-performance/20260826-baseline');
const read=name=>fs.readFileSync(path.join(output,name),'utf8').trim().split('\n').map(line=>JSON.parse(line));
function stats(values){const sorted=[...values].sort((a,b)=>a-b);return {n:sorted.length,median:sorted.length%2?sorted[Math.floor(sorted.length/2)]:(sorted[sorted.length/2-1]+sorted[sorted.length/2])/2,min:sorted[0],max:sorted.at(-1)};}
const original=read('server-diagnostics.jsonl'),correlated=read('server-diagnostics-correlated.jsonl');
const pdf=[];
for(const end of original.filter(row=>row.kind==='request-end'&&row.pathname.endsWith('/pdf'))){
  const start=original.filter(row=>row.kind==='request-start'&&row.pathname===end.pathname&&row.at<=end.at).at(-1);
  const stages=original.filter(row=>row.at>=start.at&&row.at<=end.at&&row.kind.startsWith('chromium-'));
  pdf.push({pathname:end.pathname,at:end.at,totalMs:end.durationMs,stages:Object.fromEntries(stages.map(row=>[row.kind,row.durationMs])),counts:end.counts,serverRssBytes:end.memory.rss,serverHeapBytes:end.memory.heapUsed});
}
const pdfSummary=[10,40,120].map(size=>{const rows=pdf.filter(row=>row.pathname.includes('audit_mixed_'+size+'/'));return {sheets:size,totalMs:stats(rows.map(row=>row.totalMs)),stages:Object.fromEntries(['chromium-launch','chromium-setContent','chromium-pdf','chromium-close'].map(stage=>[stage,stats(rows.map(row=>row.stages[stage]))])),serverRssBytes:stats(rows.map(row=>row.serverRssBytes)),serverHeapBytes:stats(rows.map(row=>row.serverHeapBytes))};});
const saves=correlated.filter(row=>row.kind==='request-end'&&row.method==='POST').map(row=>({requestId:row.requestId,pathname:row.pathname,durationMs:row.durationMs,counts:row.counts,sql:correlated.filter(event=>event.kind==='sql'&&event.requestId===row.requestId).map(event=>({fingerprint:event.fingerprint,durationMs:event.durationMs}))}));
const result={at:new Date().toISOString(),pdf,pdfSummary,chromium:{launches:original.filter(row=>row.kind==='chromium-launch').length,closes:original.filter(row=>row.kind==='chromium-close').length},saves,correlatedSqlEvents:correlated.filter(row=>row.kind==='sql'&&row.requestId).length,unassignedSqlEvents:correlated.filter(row=>row.kind==='sql'&&!row.requestId).length,requestRoutes:correlated.filter(row=>row.kind==='request-end').reduce((map,row)=>{const key=row.method+' '+row.pathname;map[key]=(map[key]??0)+1;return map;},{})};
fs.writeFileSync(path.join(output,'derived-server-summary.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({pdfSummary,chromium:result.chromium,saveDurationsMs:saves.map(row=>row.durationMs),correlatedSqlEvents:result.correlatedSqlEvents,unassignedSqlEvents:result.unassignedSqlEvents},null,2));
