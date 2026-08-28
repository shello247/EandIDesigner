import fs from 'node:fs';
import path from 'node:path';

const configurations = {
  'drawing-performance-audit-20260826': { run: '20260826-baseline', database: 'test-drawing-performance-20260826.db' },
  'drawing-performance-pass-1': { run: 'pass-1', database: 'test-drawing-performance-pass-1.db' },
  'drawing-performance-recovery-check': { run: 'recovery-check', database: 'test-drawing-performance-recovery-check.db' }
};
export function resolveAuditConfiguration(root = process.cwd(), phase = process.env.AUDIT_PHASE, env = process.env) {
  const absoluteRoot = path.resolve(root);
  let configuration;
  if (env.GITHUB_ACTIONS === 'true') {
    if (env.GITHUB_REPOSITORY !== 'shello247/EandIDesigner' ||
        !env.GITHUB_WORKSPACE || absoluteRoot !== path.resolve(env.GITHUB_WORKSPACE) ||
        !/^[1-9][0-9]*$/.test(env.GITHUB_RUN_ID ?? '') ||
        !/^[1-9][0-9]*$/.test(env.GITHUB_RUN_ATTEMPT ?? '')) {
      throw new Error('Explicit GitHub checkout and numeric run identity required');
    }
    const identity = `${env.GITHUB_RUN_ID}-${env.GITHUB_RUN_ATTEMPT}`;
    configuration = { run: `ci/${identity}`, database: `test-drawing-ci-${identity}.db` };
  } else {
    configuration = configurations[path.basename(absoluteRoot)];
    if (!configuration) throw new Error('Explicitly registered isolated worktree required');
    const workspace = path.resolve(absoluteRoot, '../../..');
    const expected = path.join(workspace, 'Application Folders/Working Branches', path.basename(absoluteRoot));
    if (absoluteRoot !== expected || !fs.existsSync(path.join(workspace, '.ei-workspace-root'))) throw new Error('Worktree outside workspace');
  }
  if (!fs.existsSync(path.join(absoluteRoot, '.git')) || fs.realpathSync(absoluteRoot) !== absoluteRoot) throw new Error('Real linked worktree required');
  if (JSON.parse(fs.readFileSync(path.join(absoluteRoot, 'package.json'), 'utf8')).name !== 'ei-designer') throw new Error('Wrong application');
  if (phase && !/^[a-z0-9-]+$/.test(phase)) throw new Error('Invalid audit phase');
  const database = path.join(absoluteRoot, 'prisma', configuration.database);
  const parent = path.dirname(database);
  if (fs.existsSync(parent) && fs.realpathSync(parent) !== parent) throw new Error('Database parent must not be redirected');
  if (fs.existsSync(database) && (fs.lstatSync(database).isSymbolicLink() || fs.realpathSync(database) !== database)) throw new Error('Database must not be redirected');
  const runId = configuration.run === '20260826-baseline' ? configuration.run : configuration.run + '/' + (phase || 'baseline');
  return { root: absoluteRoot, runId, database, databaseUrl: 'file:' + database.replaceAll('\\', '/'), output: path.join(absoluteRoot, 'artifacts/drawing-performance', runId) };
}
export function assertAuditDatabase(configuration = resolveAuditConfiguration(), databaseUrl = process.env.DATABASE_URL) {
  if (databaseUrl !== configuration.databaseUrl) throw new Error('Refusing non-isolated database target');
}
