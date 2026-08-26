import { describe, it, expect } from "vitest";
import { mixedModel, denseModel, validateFixture, auditSymbol } from "./fixtures";
import { summarize, guard, write, sha } from "./common";
import { createPanelWiringSource } from "../../src/features/drawing_canvas/api/panel-wiring-contracts";
import { buildPackageConnectivityGraphFromValidatedSource } from "../../src/features/drawing_panel_wiring/logic/services/connectivity-graph";
import { buildPlacementWireContextDisplayIndex } from "../../src/features/drawing_panel_wiring/logic/services/placement-wire-context";
import { collectPlacementWireContextRequests } from "../../src/features/drawing_canvas/logic/services/drawing-placement-connection-display";
import { renderDrawingToSvg } from "../../src/features/drawing_canvas/logic/services/drawing-svg-renderer";
import { toSheetCanvasModel } from "../../src/features/drawing_canvas/logic/commands/drawing-sheet-commands";
import { createEmptyDrawingHistory, pushDrawingHistoryEntry, undoDrawingHistory, redoDrawingHistory } from "../../src/features/drawing_canvas/logic/services/drawing-model-history";

describe("audit fixture and measurement contracts",()=>{
  it("keeps engineering output and SVG identical with diagnostics enabled or disabled",()=>{
    const model=mixedModel(10),symbols=[auditSymbol()];
    const host=globalThis as typeof globalThis & {__EI_AUDIT_COUNTS__?:Record<string,{count:number}>};
    const previous=host.__EI_DRAWING_PERFORMANCE_ENABLED__;
    const project=(enabled:boolean)=>{
      host.__EI_DRAWING_PERFORMANCE_ENABLED__=enabled;host.__EI_AUDIT_COUNTS__={};
      const source=createPanelWiringSource(model,symbols);
      const graph=buildPackageConnectivityGraphFromValidatedSource(source);
      const context=buildPlacementWireContextDisplayIndex({graph,requests:collectPlacementWireContextRequests(model)});
      const svg=renderDrawingToSvg({model:toSheetCanvasModel(model,model.sheets[0].id),approvedSymbols:symbols,assets:model.assets,showConnections:true,showAnchors:false,sheetNumber:1,sheetCount:10,drawingTitle:"Diagnostic parity"});
      return JSON.stringify({source,graph,context,svg},(_key,value)=>value instanceof Map?[...value.entries()]:value instanceof Set?[...value.values()]:value);
    };
    try{
      const disabled=project(false),enabled=project(true);
      expect(enabled).toBe(disabled);
      write("diagnostic-parity.json",{matches:true,disabledSha256:sha(disabled),enabledSha256:sha(enabled),counts:host.__EI_AUDIT_COUNTS__});
    }finally{host.__EI_DRAWING_PERFORMANCE_ENABLED__=previous;}
  });
  it.each([10,40,120])("makes deterministic %i-sheet drawable packages",size=>{
    expect(validateFixture(mixedModel(size))).toEqual(validateFixture(mixedModel(size)));
    expect(validateFixture(mixedModel(size)).sheets).toBe(size);
  });
  it("keeps dense routes within terminal capacity",()=>{
    expect(validateFixture(denseModel())).toMatchObject({sheets:1,placements:200,routes:500});
    const invalid=denseModel();invalid.sheets[0].connections[1].from=invalid.sheets[0].connections[0].from;
    expect(()=>validateFixture(invalid)).toThrow("Repeated field landing");
  });
  it("rejects unresolved anchors",()=>{
    const invalid=mixedModel(10);invalid.sheets[0].connections[0].from.anchorKey="missing";
    expect(()=>validateFixture(invalid)).toThrow("Unresolved fixture anchor");
  });
  it("does not present five or ten observations as p95",()=>{
    expect(summarize("pdf",[1,2,3,4,5]).p95Ms).toBeNull();
    expect(summarize("cpu",Array.from({length:30},(_,i)=>i+1)).p95Ms).toBe(29);
  });
  it("fails closed for an incorrect database",()=>{
    const previous=process.env.DATABASE_URL;
    try{process.env.DATABASE_URL="file:./dev.db";expect(guard).toThrow();}
    finally{if(previous===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previous;}
  });
  it("retains the existing fifty-entry history limit and redo order",()=>{
    const model=mixedModel(10);let history=createEmptyDrawingHistory();
    for(let i=0;i<60;i++)history=pushDrawingHistoryEntry(history,{model,activeSheetId:String(i),selection:{placementIds:[],annotationIds:[]}});
    expect(history.past).toHaveLength(50);expect(history.past[0].activeSheetId).toBe("10");
    let current={model,activeSheetId:"60",selection:{placementIds:[] as string[],annotationIds:[] as string[]}};
    for(let i=0;i<50;i++){const result=undoDrawingHistory(history,current);expect(result.entry).not.toBeNull();history=result.history;current=result.entry!;}
    expect(undoDrawingHistory(history,current).entry).toBeNull();
    for(let i=0;i<50;i++){const result=redoDrawingHistory(history,current);history=result.history;current=result.entry!;}
    expect(current.activeSheetId).toBe("60");expect(history.past).toHaveLength(50);
  });
});
