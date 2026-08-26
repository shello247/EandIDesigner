import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const root=process.cwd();if(path.basename(root)!=='drawing-performance-audit-20260826')throw new Error('Isolated audit required');
const output=path.join(root,'artifacts/drawing-performance/20260826-baseline');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const results=[];
for(const size of [10,40,120]){
  const baselineHtml=fs.readFileSync(path.join(output,`audit_mixed_${size}-print-baseline.html`));
  const diagnosticHtml=fs.readFileSync(path.join(output,`audit_mixed_${size}-print-diagnostic.html`));
  const pages=[];
  for(const page of [1,4,size]){
    const baseline=await sharp(path.join(output,`audit_mixed_${size}-baseline-page-${page}.png`)).raw().toBuffer();
    const diagnostic=await sharp(path.join(output,`audit_mixed_${size}-diagnostic-page-${page}.png`)).raw().toBuffer();
    pages.push({page,identicalPixels:baseline.equals(diagnostic),baselineSha256:hash(baseline),diagnosticSha256:hash(diagnostic)});
  }
  results.push({sheets:size,identicalPrintHtml:baselineHtml.equals(diagnosticHtml),baselineHtmlSha256:hash(baselineHtml),diagnosticHtmlSha256:hash(diagnosticHtml),pages});
}
fs.writeFileSync(path.join(output,'export-parity.json'),JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));
