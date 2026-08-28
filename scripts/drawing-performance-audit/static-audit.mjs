import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const root=process.cwd();
if(path.basename(root)!=='drawing-performance-audit-20260826')throw new Error('Isolated audit required');
function walk(directory){return fs.readdirSync(directory,{withFileTypes:true}).flatMap(item=>item.isDirectory()?walk(path.join(directory,item.name)):/\.tsx?$/.test(item.name)?[path.join(directory,item.name)]:[]);}
const files=walk(path.join(root,'src/features')).filter(file=>/features[\\/]drawing_/.test(file)&&!/[\\/]tests[\\/]/.test(file));
const modules=[];const imports=[];
for(const filename of files){
  const text=fs.readFileSync(filename,'utf8');const relative=path.relative(root,filename).replaceAll('\\','/');const feature=relative.split('/')[2];
  modules.push({path:relative,lines:text.split('\n').length,bytes:Buffer.byteLength(text)});
  const parsed=ts.createSourceFile(filename,text,ts.ScriptTarget.Latest,true);
  for(const node of parsed.statements){
    if(!ts.isImportDeclaration(node)||!ts.isStringLiteral(node.moduleSpecifier))continue;
    const target=node.moduleSpecifier.text;const match=target.match(/^@\/features\/([^/]+)\/(.+)$/);
    if(!match||match[1]===feature)continue;
    const clause=node.importClause;const bindings=clause?.namedBindings;
    const typeOnly=Boolean(clause?.isTypeOnly||(!clause?.name&&bindings&&ts.isNamedImports(bindings)&&bindings.elements.every(e=>e.isTypeOnly)));
    imports.push({source:relative,target,typeOnly,publicBoundary:/^(api\/|ui\/public$|types(?:\/index)?$)/.test(match[2]),line:parsed.getLineAndCharacterOfPosition(node.getStart(parsed)).line+1});
  }
}
const result={at:new Date().toISOString(),drawingProductionFiles:files.length,totalLines:modules.reduce((n,m)=>n+m.lines,0),largestModules:modules.sort((a,b)=>b.lines-a.lines).slice(0,20),crossFeatureImports:imports};
fs.writeFileSync(path.join(root,'artifacts/drawing-performance/20260826-baseline/modularity.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({files:files.length,lines:result.totalLines,crossFeatureImports:imports.length,nonPublicRuntimeImports:imports.filter(i=>!i.publicBoundary&&!i.typeOnly).length}));
