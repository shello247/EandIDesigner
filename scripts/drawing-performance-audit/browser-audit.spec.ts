import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { guard, output, summarize, write } from "./common";
import { seed } from "./fixtures";
import { createDrawingActionMeasurement } from "./browser-metrics";
guard();
const phase=process.env.AUDIT_PHASE??"baseline";
const diagnostic=phase.startsWith("diagnostic");
type BrowserGlobal=typeof globalThis & {__EI_DRAWING_PERFORMANCE_ENABLED__?:boolean;__EI_DRAWING_PERFORMANCE_SAMPLES__?:{name:string;durationMs:number;attributes?:{actionId?:string}}[];__EI_DRAWING_PERFORMANCE_COUNTS__?:Record<string,{count:number;totalMs:number;maxMs:number}>;__EI_DRAWING_PERFORMANCE_CONTEXT__?:{actionId?:string;revision?:string};__EI_AUDIT_COUNTS__?:Record<string,{count:number;totalMs:number;maxMs:number}>;__auditLongTasks?:{start:number;duration:number}[];__auditClickTime?:number;__auditStartListener?:()=>void;__auditFrames?:number[];__auditRaf?:number};
test.beforeEach(async()=>{await seed();});
async function setup(page:Page){
  await page.addInitScript((enabled)=>{
    const w=globalThis as BrowserGlobal;
    w.__EI_DRAWING_PERFORMANCE_ENABLED__=enabled;w.__auditLongTasks=[];
    new PerformanceObserver(list=>{for(const e of list.getEntries()){w.__auditLongTasks!.push({start:e.startTime,duration:e.duration});if(w.__auditLongTasks!.length>2000)w.__auditLongTasks!.shift();}}).observe({type:"longtask",buffered:true});
  },diagnostic);
  page.on("pageerror",error=>{const filename="browser-errors-"+phase+".json";const records=fs.existsSync(path.join(output,filename))?JSON.parse(fs.readFileSync(path.join(output,filename),"utf8")):[];records.push({url:page.url(),message:error.message});write(filename,records);});
}
async function paint(page:Page){await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));}
async function ready(page:Page){
  await expect(page.getByTestId("drawing-canvas-viewport")).toBeVisible({timeout:60000});
  await expect(page.getByRole("button",{name:"Open sheet loader"})).toBeEnabled();
  await page.waitForFunction(()=>{const node=document.querySelector('[data-testid="drawing-canvas-viewport"]');return node&&Object.keys(node).some(key=>key.startsWith("__reactProps$"));});
  await paint(page);
  await expect(page.getByRole("status").filter({hasText:/^Loading /})).toHaveCount(0);
  await paint(page);
}
async function sample(page:Page){
  return page.evaluate(()=>{
    const w=globalThis as BrowserGlobal;
    return {operations:w.__EI_DRAWING_PERFORMANCE_SAMPLES__??[],counts:w.__EI_DRAWING_PERFORMANCE_COUNTS__??w.__EI_AUDIT_COUNTS__??{},longTasks:w.__auditLongTasks??[],domNodes:document.getElementsByTagName("*").length,svgNodes:document.querySelectorAll("svg").length,mountedPreviewPages:document.querySelectorAll('[data-preview-svg-mounted="true"]').length,resources:performance.getEntriesByType("resource").map(entry=>{const r=entry as PerformanceResourceTiming;return {name:new URL(r.name).pathname,initiatorType:r.initiatorType,transferSize:r.transferSize,encodedBodySize:r.encodedBodySize,decodedBodySize:r.decodedBodySize,duration:r.duration};})};
  });
}
function persist(name:string,value:unknown){const filename="browser-"+phase+".json";const records=fs.existsSync(path.join(output,filename))?JSON.parse(fs.readFileSync(path.join(output,filename),"utf8")):[];records.push({name,value});write(filename,records);}
async function prepareSheet(page:Page,name:string){
  await page.getByRole("button",{name:"Open sheet loader"}).click();
  const dialog=page.getByRole("dialog",{name:"Sheet Loader"});
  const expand=dialog.getByRole("button",{name:/^Expand /}).first();
  if(await expand.count())await expand.click();
  const row=dialog.getByRole("cell",{name,exact:true}).locator("..");
  return row.getByRole("button",{name:"Load",exact:true});
}
async function activate(page:Page,name:string){
  await (await prepareSheet(page,name)).click();
  await expect(page.getByTestId("active-sheet-readout")).toContainText(name);
  await paint(page);
}
async function action(page:Page,name:string,operation:()=>Promise<void>){
  const requests:{method:string;url:string}[]=[];
  const handler=(request:import("@playwright/test").Request)=>requests.push({method:request.method(),url:new URL(request.url()).pathname});
  page.on("request",handler);
  const actionId=`${name}:${Date.now()}:${Math.random().toString(36).slice(2,8)}`;
  await page.evaluate(({trackFrames,actionId})=>{
    const w=globalThis as BrowserGlobal;w.__EI_DRAWING_PERFORMANCE_SAMPLES__=[];w.__EI_DRAWING_PERFORMANCE_COUNTS__={};w.__EI_AUDIT_COUNTS__={};w.__EI_DRAWING_PERFORMANCE_CONTEXT__={...w.__EI_DRAWING_PERFORMANCE_CONTEXT__,actionId};w.__auditLongTasks=[];w.__auditClickTime=undefined;
    if(w.__auditStartListener){document.removeEventListener("pointerdown",w.__auditStartListener,true);document.removeEventListener("keydown",w.__auditStartListener,true);}
    const start=()=>{if(w.__auditClickTime===undefined)w.__auditClickTime=performance.now();};w.__auditStartListener=start;
    document.addEventListener("pointerdown",start,{capture:true,once:true});
    document.addEventListener("keydown",start,{capture:true,once:true});
    w.__auditFrames=[];let previous:number|undefined;
    if(trackFrames){const tick=(time:number)=>{if(previous!==undefined&&w.__auditFrames!.length<2000)w.__auditFrames!.push(time-previous);previous=time;w.__auditRaf=requestAnimationFrame(tick);};w.__auditRaf=requestAnimationFrame(tick);}
  },{trackFrames:diagnostic,actionId});
  const started=performance.now();
  try{await operation();await paint(page);}
  finally{page.off("request",handler);await page.evaluate(()=>{const w=globalThis as BrowserGlobal;if(w.__auditStartListener){document.removeEventListener("pointerdown",w.__auditStartListener,true);document.removeEventListener("keydown",w.__auditStartListener,true);w.__auditStartListener=undefined;}if(w.__auditRaf!==undefined)cancelAnimationFrame(w.__auditRaf);});}
  const elapsed=await page.evaluate(()=>{const start=(globalThis as BrowserGlobal).__auditClickTime;return start===undefined?null:performance.now()-start;});
  const settledInteractionMs=elapsed??performance.now()-started;
  const snapshot=await sample(page);
  const value={...createDrawingActionMeasurement({actionId,settledInteractionMs,automationWallMs:performance.now()-started,snapshot}),requests,frameIntervals:await page.evaluate(()=>(globalThis as BrowserGlobal).__auditFrames??[])};
  await page.evaluate(()=>{
    const w=globalThis as BrowserGlobal;
    w.__EI_DRAWING_PERFORMANCE_CONTEXT__=w.__EI_DRAWING_PERFORMANCE_CONTEXT__?.revision
      ? {revision:w.__EI_DRAWING_PERFORMANCE_CONTEXT__.revision}
      : undefined;
  });
  return {name,...value};
}
test("navigation",async({browser})=>{
  for(const id of ["audit_mixed_10","audit_mixed_40","audit_mixed_120","audit_dense"]){
    const cold=[];let last:unknown;
    for(let i=0;i<10;i++){
      const context=await browser.newContext({baseURL:"http://127.0.0.1:3100",viewport:{width:1440,height:900}});const page=await context.newPage();await setup(page);
      const started=performance.now();const response=await page.goto("/drawings/"+id,{waitUntil:"domcontentloaded"});await ready(page);
      cold.push(performance.now()-started);
      last={responseBytes:Buffer.byteLength(await response!.body()),navigation:await page.evaluate(()=>window.performance.getEntriesByType("navigation").map(e=>e.toJSON())),...await sample(page)};
      if(i===0)await page.screenshot({path:path.join(output,id+"-"+phase+".png"),fullPage:false});
      await context.close();
    }
    persist(id+".fresh-browser",{timing:summarize(id+".fresh-browser",cold),last,browser:browser.version()});
    const context=await browser.newContext({baseURL:"http://127.0.0.1:3100",viewport:{width:1440,height:900}});const page=await context.newPage();await setup(page);
    for(let i=0;i<5;i++){await page.goto("/drawings/"+id);await ready(page);}
    const warm=[];
    for(let i=0;i<30;i++){const started=performance.now();await page.reload({waitUntil:"domcontentloaded"});await ready(page);warm.push(performance.now()-started);}
    persist(id+".warm-reload",{timing:summarize(id+".warm-reload",warm),last:await sample(page)});
    await context.close();
  }
});
test("interactions",async({page})=>{
  await setup(page);await page.goto("/drawings/audit_mixed_40");await ready(page);
  const steps:unknown[]=[];
  const select=(index:number)=>page.locator('svg[aria-label="Interactive drawing overlay"] rect[data-placement-id="g0_device_'+index+'"]').click({force:true,position:{x:2,y:2}});
  for(let i=0;i<35;i++){const value=await action(page,"select",async()=>{await select(i%2);await expect(page.getByRole("button",{name:/Asset Identity/})).toBeVisible();});if(i>=5)steps.push(value);}
  persist("selection",steps);steps.length=0;
  for(let i=0;i<35;i++){const name=i%2===0?"Detail 1":"Field 1";const button=await prepareSheet(page,name);const value=await action(page,"sheet-switch",async()=>{await button.click();await expect(page.getByTestId("active-sheet-readout")).toContainText(name);});if(i>=5)steps.push(value);}
  persist("sheet-switch",steps);steps.length=0;
  await activate(page,"Field 1");await select(0);
  for(let i=0;i<35;i++){const value=await action(page,"properties",async()=>{await page.getByRole("button",{name:/Asset Identity/}).click();});if(i>=5)steps.push(value);}
  persist("properties",steps);steps.length=0;
  for(let i=0;i<35;i++){const value=await action(page,"nudge",async()=>{await page.getByTestId("drawing-canvas-viewport").focus();await page.keyboard.press(i%2?"ArrowLeft":"ArrowRight");});if(i>=5)steps.push(value);}
  persist("nudge",steps);steps.length=0;
  for(let i=0;i<35;i++){
    await page.getByTestId("drawing-canvas-viewport").focus();await page.keyboard.press(i%2?"ArrowLeft":"ArrowRight");
    const value=await action(page,"save",async()=>{await page.getByRole("button",{name:"Save",exact:true}).click();await expect(page.getByText("Saved",{exact:true})).toBeVisible({timeout:60000});});
    if(i>=5)steps.push(value);
  }
  persist("save",steps);
  await page.getByTestId("drawing-canvas-viewport").focus();await page.keyboard.press("Control+z");await page.keyboard.press("Control+y");await paint(page);
  persist("undo-redo",await sample(page));
  await activate(page,"Schedule 1");await page.getByTestId("connected-wire-schedule-hit").click();
  await page.getByRole("button",{name:/^Connected Wire Schedule/}).click();
  steps.length=0;
  for(let i=0;i<35;i++){
    const mode=["internal_connected","external_connected","all_connected","sheet_only"][i%4];
    const value=await action(page,"connection-display-"+mode,async()=>{await page.getByLabel("Connection display").selectOption(mode);});
    const internal=await page.locator('[data-placement-wire-context][data-panel-wire-id]').count();
    const external=await page.locator('[data-placement-wire-context][data-field-connection-key]').count();
    expect(internal).toBe(mode==="internal_connected"||mode==="all_connected"?5:0);
    expect(external).toBe(mode==="external_connected"||mode==="all_connected"?5:0);
    if(i>=5)steps.push({...value,internal,external});
  }
  persist("connection-display",steps);
});

test("diagnostic CPU profile",async({page,context})=>{
  test.skip(!diagnostic,"Separate diagnostic run only");
  await setup(page);await page.goto("/drawings/audit_mixed_40");await ready(page);
  const cdp=await context.newCDPSession(page);await cdp.send("Profiler.enable");await cdp.send("Profiler.start");
  for(let i=0;i<20;i++)await page.locator('svg[aria-label="Interactive drawing overlay"] rect[data-placement-id="g0_device_'+i%2+'"]').click({force:true});
  const profile=await cdp.send("Profiler.stop");write("browser-selection-"+phase+".cpuprofile",profile.profile);await cdp.detach();
});

test("instrumentation overhead",async({page})=>{
  test.skip(!diagnostic,"Separate diagnostic run only");
  await setup(page);await page.goto("/drawings/audit_mixed_40");await ready(page);
  for(const [block,enabled] of [false,true,true,false].entries()){
    await page.evaluate(enabled=>{(globalThis as BrowserGlobal).__EI_DRAWING_PERFORMANCE_ENABLED__=enabled;},enabled);
    const values=[];
    for(let i=0;i<35;i++){
      const value=await action(page,"overhead-selection",()=>page.locator('svg[aria-label="Interactive drawing overlay"] rect[data-placement-id="g0_device_'+i%2+'"]').click({force:true}));
      if(i>=5)values.push(value);
    }
    for(const value of values){
      expect(Object.keys(value.counts).length).toBeLessThanOrEqual(14);
      if(enabled){
        expect(value.calculationStages.length).toBeGreaterThan(0);
        expect(value.calculationStages.every(sample=>
          typeof sample.attributes?.actionId==="string" &&
          /^edit:\d+$/.test(String(sample.attributes?.revision))
        )).toBe(true);
      }else{
        expect(value.calculationStages).toHaveLength(0);
        expect(Object.keys(value.counts)).toHaveLength(0);
      }
    }
    persist("overhead-"+block+"-"+(enabled?"enabled":"disabled"),values);
  }
});
test("engineering snapshot reuse and mutation invalidation",async({page})=>{
  test.skip(!diagnostic,"Structural counter run only");
  await setup(page);await page.goto("/drawings/audit_mixed_40");await ready(page);
  const placement=(index:number)=>page.locator('svg[aria-label="Interactive drawing overlay"] rect[data-placement-id*="_device_'+index+'"]');
  // Warm the lazy graph once. It must then survive presentation-only changes.
  await placement(0).click({force:true});await paint(page);
  const selection=await action(page,"snapshot-selection",async()=>{
    await placement(1).click({force:true});await expect(page.getByRole("button",{name:/Asset Identity/})).toBeVisible();
  });
  expect(selection.counts["panel.source"]?.count??0).toBe(0);
  expect(selection.counts["panel.graph"]?.count??0).toBe(0);
  expect(selection.counts["panel.placement-wire-context"]?.count??0).toBe(0);
  expect(selection.counts["panel.connected-wire-schedule"]?.count??0).toBe(0);
  const sheetButton=await prepareSheet(page,"Detail 1");
  const sheet=await action(page,"snapshot-sheet",async()=>{
    await sheetButton.click();await expect(page.getByTestId("active-sheet-readout")).toContainText("Detail 1");
  });
  expect(sheet.counts["panel.source"]?.count??0).toBe(0);
  expect(sheet.counts["panel.graph"]?.count??0).toBe(0);
  const preview=await action(page,"snapshot-preview",async()=>{
    await page.getByRole("button",{name:"Preview",exact:true}).click();
    await page.getByRole("menuitem",{name:/Package Preview/}).click();
    await expect(page.getByTestId("drawing-package-preview")).toBeVisible();
  });
  expect(preview.counts["panel.source"]?.count??0).toBe(0);
  expect(preview.counts["panel.graph"]?.count??0).toBe(0);
  await page.getByRole("button",{name:"Exit preview"}).first().click();await ready(page);
  await placement(0).click({force:true});
  const mutation=await action(page,"snapshot-mutation",async()=>{
    await page.getByTestId("drawing-canvas-viewport").focus();await page.keyboard.press("ArrowRight");
  });
  expect(mutation.counts["canvas.history-commit"]?.count).toBe(1);
  expect(mutation.counts["panel.source"]?.count).toBe(1);
  expect(mutation.counts["panel.graph"]?.count).toBe(1);
  expect(mutation.requests).toHaveLength(0);
  const save=await action(page,"snapshot-save",async()=>{
    await page.getByRole("button",{name:"Save",exact:true}).click();
    await expect(page.getByText("Saved",{exact:true})).toBeVisible();
  });
  expect(save.counts["canvas.normalize"]?.count??0).toBe(0);
  expect(save.counts["panel.source"]?.count??0).toBe(0);
  expect(save.counts["panel.graph"]?.count??0).toBe(0);
  persist("snapshot-reuse",{selection,sheet,preview,mutation,save});
});

test("geometry and identity",async({page})=>{
  await setup(page);await page.goto("/drawings/audit_mixed_40");await ready(page);
  const placement=page.locator('svg[aria-label="Interactive drawing overlay"] rect[data-placement-id="g0_device_1"]');
  await placement.click({force:true});
  for(const kind of ["move","resize","rotate"]){
    const values=[];
    for(let i=0;i<35;i++){
      const target=kind==="move"?placement:kind==="resize"?page.locator('[data-resize-handle]').last():page.getByTestId("canvas-placement-rotate-handle");
      const box=await target.boundingBox();if(!box)throw new Error("Missing "+kind+" target");
      const value=await action(page,kind,async()=>{
        await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
        await page.mouse.move(box.x+box.width/2+16,box.y+box.height/2+(kind==="rotate"?12:5),{steps:8});await page.mouse.up();
      });
      expect(value.requests).toHaveLength(0);
      if(diagnostic)expect(value.counts["canvas.history-commit"]?.count).toBe(1);
      if(i>=5)values.push(value);
      await page.getByTestId("drawing-canvas-viewport").focus();await page.keyboard.press("Control+z");await paint(page);
    }
    persist(kind,values);
  }
  const identity=page.getByRole("button",{name:/Asset Identity/});if(await identity.getAttribute("aria-expanded")!=="true")await identity.click();
  const values=[];
  for(let i=0;i<35;i++){
    if(await identity.getAttribute("aria-expanded")!=="true")await identity.click();
    const value=await action(page,"title-edit",async()=>{await page.getByLabel("Title",{exact:true}).fill("Audit breaker "+i);await page.getByLabel("Title",{exact:true}).press("Enter");});
    if(i>=5)values.push(value);
  }
  persist("title-edit",values);
});
test("memory",async({page,context})=>{
  await setup(page);await page.goto("/drawings/audit_mixed_40");await ready(page);
  const cdp=await context.newCDPSession(page);await cdp.send("Performance.enable");
  const cycles:unknown[]=[];
  for(let cycle=0;cycle<=20;cycle++){
    if(cycle){
      await activate(page,cycle%2?"Detail 1":"Field 1");
      await page.getByRole("button",{name:"Asset Manager",exact:true}).click();
      await expect(page.getByRole("dialog",{name:"Asset Manager"})).toBeVisible();
      await page.getByRole("button",{name:"Close asset manager"}).click();
      await page.getByRole("button",{name:"Preview",exact:true}).click();await page.getByRole("menuitem",{name:/Package Preview/}).click();
      await expect(page.getByTestId("drawing-package-preview")).toBeVisible();await paint(page);
      const mounted=await page.locator('[data-preview-svg-mounted="true"]').count();
      expect(mounted).toBeLessThanOrEqual(12);
      await page.getByRole("button",{name:"Exit preview"}).first().click();await ready(page);
    }
    if(cycle%5===0){
      await cdp.send("HeapProfiler.collectGarbage");await paint(page);
      cycles.push({cycle,dom:await cdp.send("Memory.getDOMCounters"),metrics:await cdp.send("Performance.getMetrics"),ui:await sample(page)});
      persist("memory-cycle-"+cycle,cycles.at(-1));
    }
  }
  await cdp.detach();
});

test("history limit and memory",async({page,context})=>{
  await setup(page);await page.goto("/drawings/audit_mixed_40");await ready(page);
  await page.locator('svg[aria-label="Interactive drawing overlay"] rect[data-placement-id="g0_device_0"]').click({force:true});
  const identity=page.getByRole("button",{name:/Asset Identity/});
  const cdp=await context.newCDPSession(page);await cdp.send("Performance.enable");
  for(let i=0;i<60;i++){
    // Different asset keys prevent the existing 900 ms same-field coalescing.
    await page.locator('svg[aria-label="Interactive drawing overlay"] rect[data-placement-id="g0_device_'+i%2+'"]').click({force:true});
    if(await identity.getAttribute("aria-expanded")!=="true")await identity.click();
    await page.getByLabel("Title",{exact:true}).fill("History audit "+i);await page.getByLabel("Title",{exact:true}).press("Enter");await paint(page);
    if([9,49,59].includes(i)){await cdp.send("HeapProfiler.collectGarbage");persist("history-after-"+(i+1),{metrics:await cdp.send("Performance.getMetrics"),dom:await cdp.send("Memory.getDOMCounters")});}
  }
  await page.getByTestId("drawing-canvas-viewport").focus();
  for(let i=0;i<50;i++){await page.keyboard.press("Control+z");await paint(page);}
  await page.locator('svg[aria-label="Interactive drawing overlay"] rect[data-placement-id="g0_device_1"]').click({force:true});
  if(await identity.getAttribute("aria-expanded")!=="true")await identity.click();
  await expect(page.getByLabel("Title",{exact:true})).toHaveValue("History audit 9");
  await page.getByTestId("drawing-canvas-viewport").focus();await page.keyboard.press("Control+z");await paint(page);
  await expect(page.getByLabel("Title",{exact:true})).toHaveValue("History audit 9");
  await page.getByTestId("drawing-canvas-viewport").focus();
  for(let i=0;i<50;i++){await page.keyboard.press("Control+y");await paint(page);}
  await page.locator('svg[aria-label="Interactive drawing overlay"] rect[data-placement-id="g0_device_1"]').click({force:true});
  if(await identity.getAttribute("aria-expanded")!=="true")await identity.click();
  await expect(page.getByLabel("Title",{exact:true})).toHaveValue("History audit 59");
  persist("history-limit",{edits:60,undo:50,extraUndoChanged:false,redo:50});await cdp.detach();
});
test("exports",async({page,request})=>{
  await setup(page);
  for(const id of ["audit_mixed_10","audit_mixed_40","audit_mixed_120"]){
    await page.goto("/drawings/"+id);await ready(page);
    const preview=await action(page,"preview",async()=>{await page.getByRole("button",{name:"Preview",exact:true}).click();await page.getByRole("menuitem",{name:/Package Preview/}).click();await expect(page.getByTestId("drawing-package-preview")).toBeVisible();});
    persist(id+".preview",preview);
    expect(await page.locator('[data-preview-svg-mounted="true"]').count()).toBeLessThanOrEqual(12);
    await page.screenshot({path:path.join(output,id+"-preview-"+phase+".png")});
    await page.getByRole("button",{name:"Exit preview"}).first().click();
    const printStart=performance.now();const print=await request.get("/drawings/"+id+"/print",{timeout:120000});const html=await print.text();
    persist(id+".print",{elapsedMs:performance.now()-printStart,status:print.status(),bytes:Buffer.byteLength(html),sheetSvgCount:(html.match(/<svg\b/g)??[]).length});
    fs.writeFileSync(path.join(output,id+"-print-"+phase+".html"),html);
    const exports=[];
    for(let i=0;i<5;i++){
      const started=performance.now();const response=await request.get("/drawings/"+id+"/pdf",{timeout:120000});const body=await response.body();
      const item={iteration:i,elapsedMs:performance.now()-started,status:response.status(),bytes:body.length,pdf:body.subarray(0,4).toString()==="%PDF"};
      exports.push(item);persist(id+".pdf."+i,item);
      if(i===0)fs.writeFileSync(path.join(output,id+"-"+phase+".pdf"),body);
    }
    persist(id+".pdf-summary",summarize(id+".pdf",exports.map(e=>e.elapsedMs)));
  }
});

test("save response payload",async({page})=>{
  await setup(page);await page.goto("/drawings/audit_mixed_40");await ready(page);
  await page.locator('svg[aria-label="Interactive drawing overlay"] rect[data-placement-id="g0_device_0"]').click({force:true});
  for(let i=0;i<5;i++){
    await page.waitForLoadState("networkidle");
    const identity=page.getByRole("button",{name:/Asset Identity/});
    if(await identity.getAttribute("aria-expanded")!=="true")await identity.click();
    await page.getByLabel("Title",{exact:true}).fill("Payload audit "+i);await page.getByLabel("Title",{exact:true}).press("Enter");
    const responsePromise=page.waitForResponse(response=>response.request().method()==="POST"&&new URL(response.url()).pathname==="/drawings/audit_mixed_40");
    const value=await action(page,"save-payload",async()=>{await page.getByRole("button",{name:"Save",exact:true}).click();await expect(page.getByText("Saved",{exact:true})).toBeVisible();});
    const response=await responsePromise;
    persist("save-response-payload-"+i,{...value,status:response.status(),requestBytes:response.request().postDataBuffer()?.length,responseBytes:(await response.body()).length,contentType:response.headers()["content-type"]});
  }
});
