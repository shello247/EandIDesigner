import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();const output=path.join(root,'artifacts/drawing-performance/20260826-baseline');
const read=name=>JSON.parse(fs.readFileSync(path.join(output,name),'utf8'));
function stats(values){const sorted=[...values].sort((a,b)=>a-b);const mid=Math.floor(sorted.length/2);return {n:sorted.length,medianMs:sorted.length?(sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2):null,p95Ms:sorted.length>=30?sorted[Math.ceil(sorted.length*.95)-1]:null,minMs:sorted[0]??null,maxMs:sorted.at(-1)??null};}
const summary={at:new Date().toISOString(),baseFingerprint:read('source-manifest.json').sourceFingerprint,definition:'Medians recomputed from raw samples using the mean of the two middle values for even sample counts; p95 nearest rank, only n>=30.',cpu:[],sqlite:[],browser:{},profiles:[]};
if(fs.existsSync(path.join(output,'cpu-metrics.json')))summary.cpu=read('cpu-metrics.json').map(m=>({name:m.name,...stats(m.samplesMs)}));
if(fs.existsSync(path.join(output,'sqlite-metrics.json')))summary.sqlite=read('sqlite-metrics.json').map(m=>({name:m.name,...stats(m.samplesMs),sql:stats(m.sqlMs),queryCountRange:[Math.min(...m.queryCounts),Math.max(...m.queryCounts)],facts:m.facts,returnedJsonBytes:m.returnedJsonBytes,queryFingerprints:m.queryShapes.map(q=>({fingerprint:q.fingerprint,count:q.count}))}));
for(const filename of fs.readdirSync(output).filter(name=>/^browser-.+\.json$/.test(name)&&!/^browser-(run|errors)-/.test(name))){
  const records=read(filename);if(!Array.isArray(records))continue;
  summary.browser[filename]=records.map(record=>{
    const value=record.value;
    if(value?.timing)return {name:record.name,...stats(value.timing.samplesMs),responseBytes:value.last?.responseBytes,domNodes:value.last?.domNodes,svgNodes:value.last?.svgNodes,resourceBytes:value.last?.resources?.reduce((n,r)=>n+r.encodedBodySize,0)};
    if(Array.isArray(value)&&value[0]?.elapsedMs!==undefined){
      const counts={};for(const action of value)for(const [name,counter]of Object.entries(action.counts??{})){const total=counts[name]??={min:Infinity,max:0,total:0,totalMs:0};total.min=Math.min(total.min,counter.count);total.max=Math.max(total.max,counter.count);total.total+=counter.count;total.totalMs+=counter.totalMs;}
      for(const [name,counter]of Object.entries(counts))counter.min=Math.min(...value.map(action=>action.counts?.[name]?.count??0));
      const operations={};for(const action of value)for(const operation of action.operations??[])(operations[operation.name]??=[]).push(operation.durationMs);
      return {name:record.name,...stats(value.map(v=>v.elapsedMs)),longTasks:stats(value.flatMap(v=>(v.longTasks??[]).map(t=>t.duration))),requests:value.reduce((n,v)=>n+(v.requests?.length??0),0),counts,operations:Object.fromEntries(Object.entries(operations).map(([name,values])=>[name,stats(values)])),frameIntervals:stats(value.flatMap(v=>v.frameIntervals??[]))};
    }
    if(record.name.startsWith('memory-cycle-'))return {name:record.name,dom:value.dom,heapBytes:value.metrics.metrics.find(m=>m.name==='JSHeapUsedSize')?.value,domNodes:value.ui.domNodes};
    if(value?.samplesMs)return {name:record.name,...stats(value.samplesMs)};
    return {name:record.name,value};
  });
}
for(const filename of fs.readdirSync(output).filter(name=>name.endsWith('.cpuprofile'))){
  const profile=read(filename);const times=new Map();
  for(let i=0;i<(profile.samples?.length??0);i++){const id=profile.samples[i];times.set(id,(times.get(id)??0)+(profile.timeDeltas?.[i]??0));}
  summary.profiles.push({file:filename,topSelfTime:profile.nodes.map(node=>({name:node.callFrame.functionName,url:node.callFrame.url,line:node.callFrame.lineNumber+1,selfMs:(times.get(node.id)??0)/1000})).sort((a,b)=>b.selfMs-a.selfMs).slice(0,25)});
}
fs.writeFileSync(path.join(output,'derived-summary.json'),JSON.stringify(summary,null,2));
console.log('Wrote derived-summary.json; raw samples were not modified.');
