import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolveAuditConfiguration } from './run-config.mjs';

const configuration = resolveAuditConfiguration();
const { root, output } = configuration;
const [label, command, ...args] = process.argv.slice(2);
if (!/^[a-z0-9-]+$/.test(label ?? '') || !command) throw new Error('Usage: run-command.mjs <unique-label> <executable> [...args]');
fs.mkdirSync(output, { recursive: true });
const resultFile = path.join(output, label + '-result.json');
const startFile = path.join(output, label + '-start.json');
const logFile = path.join(output, label + '.log');
if ([startFile, resultFile, logFile].some(file => fs.existsSync(file))) throw new Error('Evidence label already exists; choose a new label');
const hash = value => createHash('sha256').update(value).digest('hex');
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
function snapshot() {
  return [...new Set(git(['ls-files', '-c', '-o', '--exclude-standard', '-z']).split('\0').filter(Boolean))]
    .filter(name => !/^(artifacts|delivery)\//.test(name) && !/(^|\/)\.env/.test(name) && !/\.(db|sqlite3?|tsbuildinfo)$/.test(name) && name !== 'next-env.d.ts')
    .sort().flatMap(name => {
      const file = path.join(root, name);
      if (!fs.existsSync(file)) return [];
      if (!fs.lstatSync(file).isFile()) throw new Error('Source entry not a regular file');
      return [{ path: name, sha256: hash(fs.readFileSync(file)) }];
    });
}
if (args.includes('start') && args.some(arg => /(?:next|next[\\/]dist[\\/]bin[\\/]next)$/.test(arg))) {
  if (!args.includes('3100') || !args.includes('127.0.0.1')) throw new Error('Isolated server must bind 127.0.0.1:3100 explicitly');
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', () => reject(new Error('Port3100 occupied; do not replace another server')));
    probe.listen(3100, '127.0.0.1', () => probe.close(resolve));
  });
}
const before = snapshot();
const sourceState = { commit: git(['rev-parse', 'HEAD']).trim(), sourceFingerprint: hash(JSON.stringify(before)), buildId: fs.existsSync(path.join(root, '.next/BUILD_ID')) ? fs.readFileSync(path.join(root, '.next/BUILD_ID'), 'utf8').trim() : null };
sourceState.runnerFiles = [import.meta.url, new URL('./run-config.mjs', import.meta.url).href].map(url => {
  const file = fileURLToPath(url);
  return { path: file, sha256: hash(fs.readFileSync(file)) };
});
const log = fs.createWriteStream(logFile, { flags: 'wx' });
const started = Date.now();
const env = { ...process.env, DATABASE_URL: configuration.databaseUrl, NEXT_TELEMETRY_DISABLED: '1', OPENAI_TERMINAL_MAP_MOCK: 'true', OPENAI_BOM_ITEM_EXTRACTION_MOCK: 'true' };
function writeStart(pid) {
  fs.writeFileSync(startFile, JSON.stringify({ label, command, args, pid, startedAt: new Date(started).toISOString(), sourceState, files: before, runId: configuration.runId }, null, 2), { flag: 'wx' });
}
let finished = false;
function finish(exitCode, signal, error) {
  if (finished) return;
  finished = true;
  if (error) log.write(String(error));
  log.end();
  const after = snapshot();
  const drift = hash(JSON.stringify(after)) !== sourceState.sourceFingerprint;
  const result = { label, command, args, startedAt: new Date(started).toISOString(), durationMs: Date.now() - started, exitCode, signal, error: error ? String(error) : undefined, sourceState, afterSourceFingerprint: hash(JSON.stringify(after)), sourceDrift: drift };
  fs.writeFileSync(resultFile, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
  process.exitCode = drift ? 1 : exitCode ?? 1;
}
let child;
try {
  child = spawn(command, args, { cwd: root, env, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
} catch (error) {
  writeStart(null);
  finish(1, null, error);
}
if (child) {
  writeStart(child.pid ?? null);
  process.on('SIGINT', () => child.kill('SIGINT'));
  for (const stream of [child.stdout, child.stderr]) stream?.on('data', chunk => { log.write(chunk); process.stdout.write(chunk); });
  let launchError;
  child.on('error', error => { launchError = error; });
  // close follows stdio draining; exit can occur before the final log chunks.
  child.on('close', (code, signal) => finish(launchError ? 1 : code, signal, launchError));
}
