import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const target = process.cwd();
if (path.basename(target) !== 'drawing-performance-pass-1') throw new Error('Implementation worktree required');
const workspace = path.resolve(target, '../../..');
if (!fs.existsSync(path.join(workspace, '.ei-workspace-root'))) throw new Error('Workspace marker missing');
const source = path.join(workspace, 'Application Folders/Working Branches/reliability-hardening');
const git = (root, args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
const hash = data => createHash('sha256').update(data).digest('hex');
const output = path.join(target, 'artifacts/drawing-performance/pass-1');
const manifestPath = path.join(output, 'recovery-source.json');
const baseline = JSON.parse(fs.readFileSync(path.join(source, 'artifacts/drawing-performance/20260826-baseline/source-manifest.json'), 'utf8'));
const safePath = (root, name) => {
  const result = path.resolve(root, name);
  if (!result.startsWith(path.resolve(root) + path.sep)) throw new Error('Path escaped root');
  return result;
};
const eligible = name => !/(^|\/)(\.env[^/]*|node_modules|\.next[^/]*|artifacts|coverage|test-results|playwright-report)(\/|$)/i.test(name)
  && !/\.(db(?:-(?:wal|shm|journal))?|sqlite3?|log|tsbuildinfo|pem|key|pfx|pdf|png|jpe?g|zip)$/i.test(name)
  && name !== 'next-env.d.ts' && !name.startsWith('scripts/drawing-performance-pass/');
const sourceFiles = [...new Set(git(source, ['ls-files', '-c', '-o', '--exclude-standard', '-z']).split('\0').filter(Boolean))].filter(eligible).sort();
const entries = sourceFiles.flatMap(name => {
  const file = safePath(source, name);
  if (!fs.existsSync(file)) return [];
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Unsupported source entry: ' + name);
  return [{ path: name, bytes: stat.size, sha256: hash(fs.readFileSync(file)) }];
});
const drift = baseline.files.filter(entry => entries.find(current => current.path === entry.path)?.sha256 !== entry.sha256).map(entry => entry.path);
const expectedSourceFingerprint = hash(JSON.stringify(entries.filter(entry => baseline.files.some(old => old.path === entry.path))));
if (process.argv.includes('--verify-original')) {
  const previous = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const changed = entries.filter(entry => previous.files.find(old => old.path === entry.path)?.sha256 !== entry.sha256).map(entry => entry.path);
  const removed = previous.files.filter(entry => !entries.some(current => current.path === entry.path)).map(entry => entry.path);
  const result = { at: new Date().toISOString(), changed, removed, matches: changed.length === 0 && removed.length === 0 };
  fs.writeFileSync(path.join(output, 'original-source-verification.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
  if (!result.matches) process.exitCode = 1;
} else {
  if (fs.existsSync(manifestPath)) throw new Error('Recovery snapshot already captured');
  if (drift.length) throw new Error('Source drift from audited files: ' + drift.join(', '));
  for (const name of git(target, ['ls-files', '-z']).split('\0').filter(eligible)) {
    if (!name || fs.existsSync(safePath(source, name))) continue;
    // Mirror only explicitly tracked files deleted in the source; no recursive deletion.
    const file = safePath(target, name);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
  for (const entry of entries) {
    const file = safePath(target, entry.path);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.copyFileSync(safePath(source, entry.path), file);
    if (hash(fs.readFileSync(file)) !== entry.sha256) throw new Error('Copy verification failed');
  }
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(target, 'artifacts/drawing-performance/.gitignore'), '*\n!.gitignore\n');
  const result = { capturedAt: new Date().toISOString(), source, target, branch: git(source, ['branch', '--show-current']).trim(), sourceCommit: git(source, ['rev-parse', 'HEAD']).trim(), baseMain: git(target, ['rev-parse', 'HEAD']).trim(), dirtyStatus: git(source, ['status', '--porcelain=v1']), auditFingerprint: baseline.sourceFingerprint, copiedAuditedFingerprint: expectedSourceFingerprint, sourceDrift: drift, files: entries, originalLivePid: 31720 };
  fs.writeFileSync(manifestPath, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ capturedAt: result.capturedAt, files: entries.length, sourceDrift: drift, auditedFingerprintMatches: expectedSourceFingerprint === baseline.sourceFingerprint }));
}
