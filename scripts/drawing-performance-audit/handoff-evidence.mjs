import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Copies evidence only; never transfers product hooks, databases or build output.
const destinationRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
if (path.basename(destinationRoot) !== 'reliability-hardening') throw new Error('Original working repository required');
const workspace = path.resolve(destinationRoot, '../../..');
if (!fs.existsSync(path.join(workspace, '.ei-workspace-root'))) throw new Error('Workspace marker required');
const auditRoot = path.join(workspace, 'Application Folders/Working Branches/drawing-performance-audit-20260826');
const relative = 'artifacts/drawing-performance/20260826-baseline';
const source = path.join(auditRoot, relative);
const destination = path.join(destinationRoot, relative);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const entries = [];
function collect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Evidence cannot contain links');
    if (entry.isDirectory()) collect(absolute);
    else if (entry.isFile()) {
      const name = path.relative(source, absolute);
      if (/(^|[\\/])(?:\.env[^\\/]*|node_modules|\.next|prisma)([\\/]|$)|\.(?:db(?:-wal|-shm|-journal)?|sqlite3?|pem|key|pfx)$/i.test(name)) throw new Error('Excluded evidence entry: ' + name);
      entries.push({ path: name.replaceAll('\\', '/'), bytes: fs.statSync(absolute).size, sha256: hash(fs.readFileSync(absolute)) });
    } else throw new Error('Unsupported evidence entry');
  }
}
collect(source);
const verify = () => execFileSync(process.execPath, [path.join(destinationRoot, 'scripts/drawing-performance-audit/snapshot.mjs'), '--verify'], { cwd: destinationRoot, encoding: 'utf8' });
verify();
for (const entry of entries) {
  const target = path.resolve(destination, entry.path);
  if (!target.startsWith(destination + path.sep)) throw new Error('Evidence target escaped');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(source, entry.path), target);
  if (hash(fs.readFileSync(target)) !== entry.sha256) throw new Error('Evidence transfer mismatch');
}
verify();
const ports = JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-Command', "$auditPorts = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -in @(3000,3100) } | Select-Object LocalPort,OwningProcess); ConvertTo-Json -InputObject $auditPorts -Compress"], { encoding: 'utf8' }));
const status = execFileSync('git', ['status', '--short', '--branch'], { cwd: destinationRoot, encoding: 'utf8' });
const result = { completedAt: new Date().toISOString(), source, destination, evidenceFiles: entries.length, evidenceBytes: entries.reduce((sum, entry) => sum + entry.bytes, 0), entries, ports, liveProcessMatchesInitial: ports.some(port => port.LocalPort === 3000 && port.OwningProcess === 31720), auditPortFree: !ports.some(port => port.LocalPort === 3100), sourceVerification: JSON.parse(fs.readFileSync(path.join(destination, 'source-verification.json'), 'utf8')), finalDirtyStatus: status };
fs.writeFileSync(path.join(destination, 'handoff-verification.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ completedAt: result.completedAt, evidenceFiles: result.evidenceFiles, evidenceBytes: result.evidenceBytes, sourceUnchanged: result.sourceVerification.matches, liveProcessMatchesInitial: result.liveProcessMatchesInitial, auditPortFree: result.auditPortFree }, null, 2));
if (!result.sourceVerification.matches || !result.liveProcessMatchesInitial || !result.auditPortFree) process.exitCode = 1;
