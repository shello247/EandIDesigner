/* eslint-disable @typescript-eslint/no-require-imports -- Explicit Node.js CommonJS preload, outside product code. */
// Loaded explicitly by the isolated diagnostic server only. No product import.
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {performance}=require('node:perf_hooks');
const {createHash}=require('node:crypto');
const {AsyncLocalStorage}=require('node:async_hooks');
const root=process.cwd();
if(path.basename(root)!=='drawing-performance-audit-20260826'||process.env.DATABASE_URL!=='file:'+path.join(root,'prisma/test-drawing-performance-20260826.db').replaceAll('\\','/'))throw new Error('Invalid diagnostic server target');
const phase=process.env.AUDIT_SERVER_PHASE;
if(phase&&!/^[a-z0-9-]+$/.test(phase))throw new Error('Invalid server evidence phase');
const file=path.join(root,'artifacts/drawing-performance/20260826-baseline/server-diagnostics'+(phase?'-'+phase:'')+'.jsonl');
const context=new AsyncLocalStorage();let sequence=0;
const fallback={counts:{},operations:[]};
for(const [property,key]of [['__EI_AUDIT_COUNTS__','counts'],['__EI_DRAWING_PERFORMANCE_SAMPLES__','operations']])Object.defineProperty(globalThis,property,{configurable:true,get:()=>(context.getStore()??fallback)[key],set:value=>{(context.getStore()??fallback)[key]=value;}});
let count=0;
function record(value){if(count++<50000)fs.appendFileSync(file,JSON.stringify({at:new Date().toISOString(),pid:process.pid,requestId:context.getStore()?.id??null,...value})+'\n');}
globalThis.__EI_DRAWING_PERFORMANCE_ENABLED__=true;
const {PrismaClient}=require('@prisma/client');
globalThis.prisma=new PrismaClient({log:[{level:'query',emit:'event'}]});
globalThis.prisma.$on('query',event=>record({kind:'sql',fingerprint:createHash('sha256').update(event.query.replace(/\s+/g,' ')).digest('hex'),sql:event.query,durationMs:event.duration}));
const emit=http.Server.prototype.emit;
http.Server.prototype.emit=function(event,...args){
  if(event==='request'){
    const [request,response]=args;const pathname=new URL(request.url,'http://audit.local').pathname;
    if(!pathname.startsWith('/_next/')&&pathname!=='/favicon.ico'){
      const started=performance.now();const memoryBefore=process.memoryUsage();
      const state={id:'request-'+(++sequence),counts:{},operations:[]};
      record({kind:'request-start',requestId:state.id,method:request.method,pathname,memory:memoryBefore});
      response.once('finish',()=>record({kind:'request-end',requestId:state.id,method:request.method,pathname,status:response.statusCode,durationMs:performance.now()-started,memory:process.memoryUsage(),counts:state.counts,operations:state.operations}));
      return context.run(state,()=>emit.call(this,event,...args));
    }
  }
  return emit.call(this,event,...args);
};
const {chromium}=require('playwright');
const launch=chromium.launch.bind(chromium);
chromium.launch=async(...args)=>{
  const started=performance.now();const browser=await launch(...args);record({kind:'chromium-launch',durationMs:performance.now()-started});
  const newPage=browser.newPage.bind(browser);browser.newPage=async(...args)=>{
    const page=await newPage(...args);
    for(const name of ['setContent','pdf']){const operation=page[name].bind(page);page[name]=async(...args)=>{const started=performance.now();try{return await operation(...args);}finally{record({kind:'chromium-'+name,durationMs:performance.now()-started,memory:process.memoryUsage()});}};}
    return page;
  };
  const close=browser.close.bind(browser);browser.close=async(...args)=>{const started=performance.now();try{return await close(...args);}finally{record({kind:'chromium-close',durationMs:performance.now()-started});}};
  return browser;
};
record({kind:'server-start',node:process.version,memory:process.memoryUsage()});
