import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = process.cwd();
if (path.basename(root) !== 'drawing-performance-pass-1') throw new Error('Implementation worktree required');
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const changed = git(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z']).split('\0').filter(Boolean);
const findings = [];
const entries = [];
const rules = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['github-token', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/],
  ['openai-token', /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{35,}\b/],
  ['aws-key', /\bAKIA[0-9A-Z]{16}\b/],
  ['credential-url', /https?:\/\/[^\s/:'"<>]+:[^\s/@'"<>]+@/],
  ['embedded-image', /data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]{300,}/]
];
for (const name of changed) {
  if (/(^|\/)(\.env[^/]*|node_modules|\.next[^/]*|playwright-report|test-results)(\/|$)|\.(?:db(?:-wal|-shm|-journal)?|sqlite3?|pdf|png|jpe?g|zip|pem|key|pfx)$/i.test(name) || name.startsWith('artifacts/') && name !== 'artifacts/drawing-performance/.gitignore') {
    findings.push({ path: name, rule: 'excluded-publication-path' });
    continue; // Never inspect env/database/secret file contents.
  }
  const content = git(['show', ':' + name]);
  for (const [rule, pattern] of rules) if (pattern.test(content)) findings.push({ path: name, rule });
  entries.push({ path: name, bytes: Buffer.byteLength(content), sha256: createHash('sha256').update(content).digest('hex') });
}
const diffStatus = git(['diff', '--cached', '--name-status']);
const report = { at: new Date().toISOString(), checkedFiles: entries.length, findings, entries, diffStatus, note: 'Pattern scan and complete staged path/hash review; not a guarantee of absence of every possible confidential datum. No values emitted for findings.' };
const output = path.join(root, 'artifacts/drawing-performance/pass-1');
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, 'publication-check-' + Date.now() + '.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ checkedFiles: entries.length, findings }, null, 2));
if (findings.length) process.exitCode = 1;
