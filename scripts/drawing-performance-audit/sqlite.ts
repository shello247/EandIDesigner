import { performance } from "node:perf_hooks";
import { guard, sha, summarize, write, freshMetricFile } from "./common";
guard();
const metricFile=freshMetricFile("sqlite-metrics");
const plansFile=freshMetricFile("sqlite-query-plans");
const {PrismaClient}=await import("@prisma/client");
const client=new PrismaClient({log:[{level:"query",emit:"event"}]});
(globalThis as unknown as {prisma:typeof client}).prisma=client;
const {mixedModel,setCatalogueCount}=await import("./fixtures");
const {stringifyDrawingModel}=await import("../../src/features/drawing_canvas/data/schema");
let queries:{fingerprint:string;sql:string;durationMs:number}[]=[];
client.$on("query",event=>{if(queries.length<10000)queries.push({fingerprint:sha(event.query.replace(/\s+/g," ")),sql:event.query,durationMs:event.duration});});
const {listDrawingPage,getDrawingDetail}=await import("../../src/features/drawing_canvas/data/queries");
const {
  listDrawingRenderSymbols,
  listDrawingSymbolCatalogSummaries,
  listSymbolsForDrawing
}=await import("../../src/features/symbol_registry/api/public");
const {saveDrawing}=await import("../../src/features/drawing_canvas/data/mutations");
const results:unknown[]=[];
async function run(name:string,operation:()=>Promise<unknown>,facts:Record<string,unknown>={}){
  for(let i=0;i<5;i++)await operation();
  const samples:number[]=[];const queryCounts:number[]=[];const sqlMs:number[]=[];let last:unknown;
  const shapes=new Map<string,{fingerprint:string;sql:string;count:number}>();
  for(let i=0;i<30;i++){
    queries=[];const start=performance.now();last=await operation();samples.push(performance.now()-start);
    if(queries.length===0)throw new Error("Audit query capture did not observe this database operation");
    queryCounts.push(queries.length);sqlMs.push(queries.reduce((n,q)=>n+q.durationMs,0));
    for(const q of queries){const existing=shapes.get(q.fingerprint);shapes.set(q.fingerprint,{fingerprint:q.fingerprint,sql:q.sql,count:(existing?.count??0)+1});}
  }
  const value={...summarize(name,samples),facts,queryCounts,sqlMs,returnedJsonBytes:Buffer.byteLength(JSON.stringify(last)),queryShapes:[...shapes.values()]};
  results.push(value);write(metricFile,results);
  console.log(JSON.stringify({...value,samplesMs:undefined,queryShapes:undefined,queryCounts:[Math.min(...queryCounts),Math.max(...queryCounts)],sqlMs:summarize("sql",sqlMs)}));
}
try{
  const json=stringifyDrawingModel(mixedModel(10));
  const created:string[]=[];
  const existingRows=await client.drawing.findMany({select:{id:true,status:true}});
  await client.drawing.updateMany({data:{status:"archived"}});
  try{
  for(const count of [10,100,500]){
    const existing=await client.drawing.count({where:{status:{not:"archived"}}});
    for(let i=existing;i<count;i++){const id="audit_list_"+i;await client.drawing.create({data:{id,drawingKey:id,title:id,status:"needs_review",modelJson:json}});created.push(id);}
    const aggregate=await client.drawing.findMany({where:{status:{not:"archived"}},select:{modelJson:true}});
    await run("drawings-list-"+count,()=>listDrawingPage(1),{actualPackages:aggregate.length,storedJsonBytes:aggregate.reduce((n,r)=>n+Buffer.byteLength(r.modelJson),0)});
  }
  }finally{
  await client.drawing.deleteMany({where:{id:{in:created}}});
  for(const row of existingRows)await client.drawing.update({where:{id:row.id},data:{status:row.status}});
  }
  for(const count of [25,250,1000]){
    await setCatalogueCount(count);
    await run("symbols-catalogue-"+count,()=>listSymbolsForDrawing(["audit_symbol_0000_v1"]),{syntheticSymbols:count,referencedVersions:1});
    await run("symbols-render-bundle-"+count,()=>listDrawingRenderSymbols(["audit_symbol_0000_v1"]),{syntheticSymbols:count,referencedVersions:1});
    await run("symbols-catalogue-summaries-"+count,()=>listDrawingSymbolCatalogSummaries(),{syntheticSymbols:count});
  }
  await setCatalogueCount(25);
  for(const id of ["audit_mixed_10","audit_mixed_40","audit_mixed_120","audit_dense"]){
    await run("drawing-detail-"+id,()=>getDrawingDetail(id));
  }
  let drawing=await getDrawingDetail("audit_mixed_40");
  if(!drawing)throw new Error("Missing save fixture");
  await run("save-mutation-mixed40",async()=>{
    const result=await saveDrawing({drawingId:drawing!.id,title:drawing!.title,model:drawing!.model,expectedUpdatedAt:drawing!.updatedAt});
    drawing={...drawing!,updatedAt:result.updatedAt};return result;
  });
  const plans={
    list:await client.$queryRawUnsafe('EXPLAIN QUERY PLAN SELECT id,title,status,modelJson,updatedAt FROM Drawing WHERE NOT status = ? ORDER BY updatedAt DESC, id ASC LIMIT 25 OFFSET 0',"archived"),
    detail:await client.$queryRawUnsafe('EXPLAIN QUERY PLAN SELECT * FROM Drawing WHERE id = ?', "audit_mixed_40"),
    revisionUpdate:await client.$queryRawUnsafe('EXPLAIN QUERY PLAN UPDATE Drawing SET title = ? WHERE id = ? AND updatedAt = ?', "Synthetic","audit_mixed_40",drawing.updatedAt)
  };
  write(plansFile,plans);
}finally{try{await setCatalogueCount(25);}finally{await client.$disconnect();}}
