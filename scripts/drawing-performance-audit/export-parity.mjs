import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {resolveAuditConfiguration} from './run-config.mjs';

const root=process.cwd();
const phase=process.env.AUDIT_PHASE;
if(path.basename(root)!=='drawing-performance-pass-1'||!/^[a-z0-9-]+$/.test(phase??''))throw new Error('Guarded candidate phase required');
const output=resolveAuditConfiguration(root,phase).output;
const baselineOutput=path.resolve(root,'../drawing-performance-audit-20260826/artifacts/drawing-performance/20260826-baseline');
if(!fs.existsSync(output)||!fs.existsSync(baselineOutput))throw new Error('Expected guarded export evidence is missing');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const results=[];
for(const size of [10,40,120]){
  const baselineHtml=fs.readFileSync(path.join(baselineOutput,`audit_mixed_${size}-print-baseline.html`));
  const candidateHtml=fs.readFileSync(path.join(output,`audit_mixed_${size}-print-${phase}.html`));
  const pages=[];
  for(const page of [1,Math.min(4,size),size]){
    const baselinePath=path.join(output,`audit_mixed_${size}-baseline-page-${page}.png`);
    const candidatePath=path.join(output,`audit_mixed_${size}-candidate-page-${page}.png`);
    const baselineImage=sharp(baselinePath);
    const candidateImage=sharp(candidatePath);
    const [baselineMetadata,candidateMetadata,baseline,candidate]=await Promise.all([
      baselineImage.metadata(),candidateImage.metadata(),baselineImage.raw().toBuffer(),candidateImage.raw().toBuffer()
    ]);
    pages.push({
      page,
      sameDimensions:baselineMetadata.width===candidateMetadata.width&&baselineMetadata.height===candidateMetadata.height&&baselineMetadata.channels===candidateMetadata.channels,
      identicalPixels:baseline.equals(candidate),
      baselineSha256:hash(baseline),
      candidateSha256:hash(candidate)
    });
  }
  results.push({
    sheets:size,
    identicalPrintHtml:baselineHtml.equals(candidateHtml),
    baselineHtmlSha256:hash(baselineHtml),
    candidateHtmlSha256:hash(candidateHtml),
    pages
  });
}
fs.writeFileSync(path.join(output,'export-parity.json'),JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify(results,null,2));
if(results.some(result=>!result.identicalPrintHtml||result.pages.some(page=>!page.sameDimensions||!page.identicalPixels)))process.exitCode=1;
