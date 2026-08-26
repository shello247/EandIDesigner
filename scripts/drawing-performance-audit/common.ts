import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { z } from "zod";

export const runId = "20260826-baseline";
export const root = process.cwd();
export const output = path.join(root,"artifacts/drawing-performance",runId);
export const database = path.join(root,"prisma","test-drawing-performance-20260826.db");
export const metricSchema = z.object({name:z.string(),samplesMs:z.array(z.number().finite().nonnegative()),medianMs:z.number(),p95Ms:z.number().nullable(),maxMs:z.number(),iterations:z.number().int()});
export function guard() {
  if(path.basename(root)!=="drawing-performance-audit-20260826") throw new Error("Run only in the isolated audit worktree");
  const expected="file:"+database.replaceAll("\\","/");
  if(process.env.DATABASE_URL!==expected) throw new Error("Refusing non-audit database; set the exact absolute audit DATABASE_URL");
  if(!fs.existsSync(path.join(root,".git"))) throw new Error("Missing linked worktree marker");
}
export function sha(value:string|Buffer) { return createHash("sha256").update(value).digest("hex"); }
export function freshMetricFile(stem:string) {
  const suffix=process.env.AUDIT_METRIC_SUFFIX;
  if(suffix&&!/^[a-z0-9-]+$/.test(suffix))throw new Error("Invalid metric suffix");
  const name=stem+(suffix?"-"+suffix:"")+".json";
  if(fs.existsSync(path.join(output,name)))throw new Error("Evidence already exists; choose a new AUDIT_METRIC_SUFFIX: "+name);
  return name;
}
export function write(name:string,value:unknown) {
  if(!/^[a-zA-Z0-9_.-]+$/.test(name)) throw new Error("Invalid artifact filename");
  fs.mkdirSync(output,{recursive:true});
  fs.writeFileSync(path.join(output,name),JSON.stringify(value,(_key,item)=>typeof item==="bigint"?item.toString():item,2)+"\n");
}
export function summarize(name:string,samplesMs:number[]) {
  const values=[...samplesMs].sort((a,b)=>a-b);
  const middle=Math.floor(values.length/2);
  const medianMs=values.length===0?0:values.length%2?values[middle]:(values[middle-1]+values[middle])/2;
  return metricSchema.parse({name,samplesMs,medianMs,p95Ms:values.length>=30?values[Math.ceil(values.length*.95)-1]:null,maxMs:values.at(-1)??0,iterations:values.length});
}
export function measure(name:string,operation:()=>unknown,count=30) {
  for(let i=0;i<5;i++) operation();
  const samples=Array.from({length:count},()=>{const start=performance.now();operation();return performance.now()-start;});
  return summarize(name,samples);
}
export async function measureAsync(name:string,operation:()=>Promise<unknown>,count=30) {
  for(let i=0;i<5;i++) await operation();
  const samples:number[]=[];
  for(let i=0;i<count;i++){const start=performance.now();await operation();samples.push(performance.now()-start);}
  return summarize(name,samples);
}
