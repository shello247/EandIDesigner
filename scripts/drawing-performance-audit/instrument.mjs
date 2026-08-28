// Audit-only mechanical instrumentation. Never run in the working application.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {createHash} from 'node:crypto';
const root=process.cwd();
const expected='file:'+path.join(root,'prisma/test-drawing-performance-20260826.db').replaceAll('\\','/');
if(path.basename(root)!=='drawing-performance-audit-20260826'||process.env.DATABASE_URL!==expected)throw new Error('Refusing instrumentation outside isolated audit');
const output=path.join(root,'artifacts/drawing-performance/20260826-baseline');
const hash=value=>createHash('sha256').update(value).digest('hex');
const targets={
  'src/features/drawing_panel_wiring/logic/services/electrical-network-index.ts':['buildElectricalNetworkIndex'],
  'src/features/drawing_panel_wiring/logic/services/connectivity-graph.ts':['buildPackageConnectivityGraphFromValidatedSource'],
  'src/features/drawing_panel_wiring/logic/services/placement-wire-context.ts':['buildPlacementWireContextDisplayIndex'],
  'src/features/drawing_connected_wire_schedule/logic/services/connected-wire-schedule-projection.ts':['buildConnectedWireScheduleIndex'],
  'src/features/drawing_canvas/logic/services/drawing-panel-wiring-source.ts':['buildDrawingPanelWiringSource'],
  'src/features/drawing_canvas/logic/services/drawing-generated-symbols.ts':['getRenderableSymbolForPlacement','buildRenderableDrawingSymbols'],
  'src/features/drawing_canvas/logic/services/drawing-svg-renderer.ts':['renderDrawingToSvg'],
  'src/features/drawing_canvas/data/schema.ts':['parseDrawingModelJson','stringifyDrawingModel'],
  'src/features/drawing_canvas/logic/services/drawing-model-history.ts':['pushDrawingHistoryEntry']
  ,'src/features/drawing_canvas/ui/components/drawing-canvas-shell.tsx':['normalizeCanvasModel']
};
const manifest=JSON.parse(fs.readFileSync(path.join(output,'source-manifest.json'),'utf8'));
const changes=[];
for(const [relative,names] of Object.entries(targets)){
  const filename=path.join(root,relative);const original=fs.readFileSync(filename,'utf8');
  if(hash(original)!==manifest.files.find(file=>file.path===relative)?.sha256)throw new Error('Source drift or already instrumented: '+relative);
  const parsed=ts.createSourceFile(filename,original,ts.ScriptTarget.Latest,true);const edits=[];const found=[];
  function visit(node){
    if(ts.isFunctionDeclaration(node)&&node.name&&names.includes(node.name.text)&&node.body){
      const name=node.name.text;found.push(name);
      edits.push({at:node.body.getStart(parsed)+1,text:'\nconst __auditEnabled=globalThis.__EI_DRAWING_PERFORMANCE_ENABLED__===true; const __auditStarted=__auditEnabled?performance.now():0; try {\n'});
      edits.push({at:node.body.end-1,text:`\n} finally { if(__auditEnabled){const host=globalThis as unknown as {__EI_AUDIT_COUNTS__?:Record<string,{count:number,totalMs:number,maxMs:number}>}; const counts=host.__EI_AUDIT_COUNTS__??={};const value=counts[${JSON.stringify(name)}]??={count:0,totalMs:0,maxMs:0};const elapsed=performance.now()-__auditStarted;value.count++;value.totalMs+=elapsed;value.maxMs=Math.max(value.maxMs,elapsed);}}\n`});
    }
    ts.forEachChild(node,visit);
  }
  visit(parsed);
  if(found.length!==names.length)throw new Error('Missing instrumentation target: '+relative);
  let modified=original;for(const edit of edits.sort((a,b)=>b.at-a.at))modified=modified.slice(0,edit.at)+edit.text+modified.slice(edit.at);
  changes.push({path:relative,before:hash(original),after:hash(modified),functions:found});
  fs.writeFileSync(filename,modified);
}
fs.writeFileSync(path.join(output,'instrumentation-manifest.json'),JSON.stringify({at:new Date().toISOString(),baseFingerprint:manifest.sourceFingerprint,changes},null,2));
console.log(JSON.stringify(changes));
