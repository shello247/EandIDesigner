import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
if(path.basename(root)!=='drawing-performance-audit-20260826')throw new Error('Isolated audit required');
const output=path.join(root,'artifacts/drawing-performance/20260826-baseline');
const summary=JSON.parse(fs.readFileSync(path.join(output,'derived-summary.json'),'utf8'));
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const pieces=['<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000"><rect width="1000" height="1000" fill="#f8fafc"/><g font-family="Arial,sans-serif" fill="#0f172a"><text x="35" y="43" font-size="24" font-weight="bold">Drawing performance — measured scaling</text><text x="35" y="69" font-size="13" fill="#475569">Synthetic fixtures • local production browser / isolated SQLite • 26 August 2026</text>'];
function panel(y,title,subtitle,rows,unit,max){
  pieces.push(`<rect x="25" y="${y}" width="950" height="260" rx="12" fill="white" stroke="#cbd5e1"/><text x="45" y="${y+32}" font-size="18" font-weight="bold">${escape(title)}</text><text x="45" y="${y+55}" font-size="13" fill="#475569">${escape(subtitle)}</text>`);
  for(const [i,row]of rows.entries()){
    const top=y+81+i*43,width=row.value/max*610;
    pieces.push(`<text x="45" y="${top+17}" font-size="14">${escape(row.label)}</text><rect x="210" y="${top}" width="${width}" height="23" rx="3" fill="#0f766e"/><text x="${220+width}" y="${top+17}" font-size="13">${row.value.toFixed(row.decimals??0)} ${escape(unit)}</text>`);
    if(row.sql!==undefined)pieces.push(`<rect x="210" y="${top+24}" width="${row.sql/max*610}" height="5" fill="#f59e0b"/>`);
  }
}
const list=[10,100,500].map(count=>{const metric=summary.sqlite.find(item=>item.name==='drawings-list-'+count);return {label:count+' packages',value:metric.medianMs,sql:metric.sql.medianMs};});
panel(95,'Drawing list: total operation time','Median of 30 samples; amber line = SQL time. Each package contains 10 sheets.',list,'ms',Math.max(...list.map(row=>row.value))*1.08);
const catalogue=[25,250,1000].map(count=>{const metric=summary.sqlite.find(item=>item.name==='symbols-catalogue-'+count);return {label:count+' added symbols',value:metric.returnedJsonBytes/1e6,decimals:2};});
panel(375,'Approved-symbol catalogue: returned JSON','One referenced version throughout; synthetic catalogue plus unchanged seeded symbols.',catalogue,'MB',3.3);
const browser=summary.browser['browser-baseline-v2.json'];
const loading=['audit_mixed_10','audit_mixed_40','audit_mixed_120','audit_dense'].map((id,index)=>({label:['10 sheets','40 sheets','120 sheets','Dense single sheet'][index],value:browser.find(item=>item.name===id+'.fresh-browser').medianMs}));
panel(655,'Package opening: fresh browser context','Median of 10 observations. Not a cold OS or database-cache test; no p95 for this sample.',loading,'ms',3500);
pieces.push('<text x="35" y="950" font-size="12" fill="#475569">All original samples and outliers retained. No optimization changes are represented in these charts.</text></g></svg>');
const filename=path.join(output,'scaling-charts.svg');fs.writeFileSync(filename,pieces.join('\n'));
const {default:sharp}=await import('sharp');await sharp(filename).png().toFile(path.join(output,'scaling-charts.png'));
console.log('Wrote scaling-charts.svg and scaling-charts.png using installed Next.js image tooling.');
