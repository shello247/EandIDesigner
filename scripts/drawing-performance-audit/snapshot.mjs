import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const workspace = path.resolve(source, '../../..');
const target = path.join(workspace, 'Application Folders/Working Branches/drawing-performance-audit-20260826');
const admin = path.join(workspace, 'Application Folders/Main Application/EI_Designer');
const runId = '20260826-baseline';
const git = (cwd, args) => execFileSync('git', ['-C', cwd, ...args], {encoding:'utf8', maxBuffer:32*1024*1024});
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
function inside(root, relative) {
  const result = path.resolve(root, relative);
  if (!result.startsWith(path.resolve(root)+path.sep)) throw new Error('Path escaped audit root');
  return result;
}
function eligible(file) {
  return !/(^|\/)(\.env[^/]*|node_modules|\.next[^/]*|artifacts|delivery|coverage|test-results|playwright-report)(\/|$)/i.test(file)
    && !/\.(db(?:-(?:wal|shm|journal))?|sqlite3?|log|tsbuildinfo|pem|key|pfx)$/i.test(file)
    && !file.startsWith('scripts/drawing-performance-audit/')
    && file !== 'next-env.d.ts';
}
function manifest(root, files) {
  return files.filter(eligible).sort().flatMap(file => {
    const absolute=inside(root,file);
    if (!fs.existsSync(absolute)) return [];
    const info=fs.lstatSync(absolute);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Unsupported source entry: ${file}`);
    const bytes=fs.readFileSync(absolute);
    return [{path:file,bytes:bytes.length,sha256:hash(bytes)}];
  });
}
if (!fs.existsSync(path.join(workspace,'.ei-workspace-root'))) throw new Error('Missing workspace marker');
if (JSON.parse(fs.readFileSync(path.join(source,'package.json'),'utf8')).name!=='ei-designer') throw new Error('Wrong application');
const files=[...new Set(git(source,['ls-files','-c','-o','--exclude-standard','-z']).split('\0').filter(Boolean))];
const entries=manifest(source,files);
const fingerprint=hash(JSON.stringify(entries));
if (process.argv.includes('--verify')) {
  const previous=JSON.parse(fs.readFileSync(path.join(source,'artifacts/drawing-performance',runId,'source-manifest.json'),'utf8'));
  const changed=entries.filter(entry=>previous.files.find(old=>old.path===entry.path)?.sha256!==entry.sha256).map(entry=>entry.path);
  const removed=previous.files.filter(entry=>!entries.some(now=>now.path===entry.path)).map(entry=>entry.path);
  const verification={at:new Date().toISOString(),matches:previous.sourceFingerprint===fingerprint,fingerprint,changed,removed};
  fs.writeFileSync(path.join(source,'artifacts/drawing-performance',runId,'source-verification.json'),JSON.stringify(verification,null,2)+'\n');
  console.log(JSON.stringify(verification,null,2));
  if(previous.sourceFingerprint!==fingerprint) process.exitCode=1;
} else {
  if (fs.existsSync(target)) throw new Error('Audit target already exists; refusing overwrite');
  const head=git(source,['rev-parse','HEAD']).trim();
  git(admin,['worktree','add','--detach',target,head]);
  for (const file of git(target,['ls-files','-z']).split('\0').filter(Boolean)) {
    if (!eligible(file)) continue;
    const to=inside(target,file);
    if (!fs.existsSync(inside(source,file)) && fs.existsSync(to)) fs.unlinkSync(to);
  }
  for (const entry of entries) {
    const to=inside(target,entry.path);
    fs.mkdirSync(path.dirname(to),{recursive:true});
    fs.copyFileSync(inside(source,entry.path),to);
  }
  const copy=manifest(target,entries.map(entry=>entry.path));
  if(hash(JSON.stringify(copy))!==fingerprint) throw new Error('Snapshot verification failed');
  const result={runId,capturedAt:new Date().toISOString(),timezone:'America/Port_of_Spain',head,branch:git(source,['branch','--show-current']).trim(),source,target,sourceFingerprint:fingerprint,dirtyStatus:git(source,['status','--porcelain=v1']),files:entries,environment:{platform:os.platform(),release:os.release(),arch:os.arch(),node:process.version,cpus:os.cpus().length,cpuModel:os.cpus()[0]?.model,totalMemoryBytes:os.totalmem(),viewport:{width:1440,height:900}}};
  for(const root of [source,target]) {
    const output=path.join(root,'artifacts/drawing-performance',runId);
    fs.mkdirSync(output,{recursive:true});
    fs.writeFileSync(path.join(root,'artifacts/drawing-performance/.gitignore'),'*\n!.gitignore\n');
    fs.writeFileSync(path.join(output,'source-manifest.json'),JSON.stringify(result,null,2)+'\n');
  }
  console.log(JSON.stringify({runId,target,head,sourceFingerprint:fingerprint,files:entries.length},null,2));
}
