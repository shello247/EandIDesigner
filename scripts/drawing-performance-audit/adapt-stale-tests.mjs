// Preserve original failures; adapt navigation locators in the audit copy only.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=process.cwd();if(path.basename(root)!=='drawing-performance-audit-20260826')throw new Error('Isolated audit required');
const output=path.join(root,'artifacts/drawing-performance/20260826-baseline');
const baseline=JSON.parse(fs.readFileSync(path.join(output,'source-manifest.json'),'utf8'));
const hash=text=>createHash('sha256').update(text).digest('hex');
const changes=[];
const refine=process.argv.includes('--refine');
const previousPath=path.join(output,'test-adapter-manifest.json');
const previous=fs.existsSync(previousPath)?JSON.parse(fs.readFileSync(previousPath,'utf8')):null;
if(refine&&previous)fs.copyFileSync(previousPath,path.join(output,'test-adapter-manifest-v1.json'));
for(const file of ['drawing-panel-connection-patterns.spec.ts','drawing-panel-terminal-mapping.spec.ts','drawing-terminal-block-group.spec.ts','drawing-terminal-strip-destination-copy.spec.ts']){
  const relative='tests/e2e/'+file;const filename=path.join(root,relative);const current=fs.readFileSync(filename,'utf8');
  if(refine&&hash(current)!==previous?.changes.find(change=>change.path===relative)?.after)throw new Error('Unexpected adapted test drift: '+relative);
  const original=refine?fs.readFileSync(path.join(baseline.source,relative),'utf8'):current;
  if(hash(original)!==baseline.files.find(entry=>entry.path===relative)?.sha256)throw new Error('Unexpected test drift: '+relative);
  let modified=original;
  if(file.includes('connection-patterns')||file.includes('terminal-mapping')){
    const line='await page.getByRole("button", { name: "Open sheet loader" }).click();';
    modified=modified.replaceAll(line,line+'\n    await page.getByRole("dialog", { name: "Sheet Loader" }).getByRole("button", { name: /^Expand / }).first().click();');
  }else{
    modified=modified.replace(/await assetManager\s*\.getByRole\("button", \{ name: (?:"Terminal Blocks 1"|\/Terminal Blocks 2\/) \}\)\s*\.click\(\);/g,'const terminalCategory=assetManager.getByRole("button",{name:/Terminal Blocks, [12] assets?/});\n    if(await terminalCategory.getAttribute("aria-expanded")!=="true")await terminalCategory.click();');
    if(file.includes('terminal-block-group'))modified=modified.replace('await assetManager.getByRole("button", { name: /TB-101/ }).click();','await assetManager.getByRole("button", { name: /TB-101/ }).click();\n    await assetManager.getByRole("button",{name:/^1 Identity/}).click();');
    else for(const tag of ['TB-102','TB-101'])modified=modified.replace('await assetManager.getByRole("button", { name: /'+tag+'/ }).click();','await assetManager.getByRole("button", { name: /'+tag+'/ }).click();\n    await assetManager.getByRole("button",{name:/^3 Sheet Associations/}).click();');
  }
  if(modified===original)throw new Error('Adapter did not match '+relative);
  fs.writeFileSync(filename,modified);changes.push({path:relative,before:hash(original),after:hash(modified)});
}
fs.writeFileSync(path.join(output,'test-adapter-manifest.json'),JSON.stringify({at:new Date().toISOString(),changes},null,2));
console.log(JSON.stringify(changes));
