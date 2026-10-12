"""Apply only the approved module to a workspace EI Designer checkout.

Run --stage first to prepare an isolated copy of current live source. The default
mode applies the same bounded patch to the explicitly named workspace worktree.
Existing files are backed up and every write is recorded in an integrity manifest.
"""
from pathlib import Path
import hashlib
import json
import shutil
import subprocess
import sys
from datetime import datetime, timezone

source = Path(__file__).resolve().parents[2]
workspace = source.parents[2]
target = Path(sys.argv[1]).resolve()
stage = '--stage' in sys.argv[2:]
if target.parent != source.parent or target.name not in ['standards-assurance-integration', 'item-engineering']:
    raise SystemExit('Only the explicitly registered integration or live worktree is allowed.')
for root in [source, target]:
    if json.loads((root/'package.json').read_text())['name'] != 'ei-designer' or not (root/'.git').is_file():
        raise SystemExit('Expected EI Designer linked worktree.')
if stage and target.name != 'standards-assurance-integration':
    raise SystemExit('Staging is restricted to the isolated integration worktree.')
run = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
archive = target/'artifacts'/'standards-assurance'/'integration'/run
archive.mkdir(parents=True)
manifest = {'source':str(source), 'target':str(target), 'createdAt':run, 'files':[], 'liveBaseline':[]}
digest = lambda data: hashlib.sha256(data).hexdigest()

def safe(name):
    path = target/name
    if not path.resolve().is_relative_to(target) or '.git' in Path(name).parts or any(p.startswith('.env') for p in Path(name).parts):
        raise RuntimeError('Unsafe integration path: '+name)
    return path

def write(name, data):
    path = safe(name)
    old = path.read_bytes() if path.is_file() else None
    if old == data: return
    if old is not None:
        backup = archive/'before'/name
        backup.parent.mkdir(parents=True, exist_ok=True)
        backup.write_bytes(old)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    manifest['files'].append({'path':name,'before':digest(old) if old is not None else None,'after':digest(data)})

if stage:
    live = source.parent/'item-engineering'
    tracked = subprocess.check_output(['git','ls-files','-z'],cwd=target).decode().split('\0')
    for name in tracked:
        if name.startswith(('src/','scripts/','tests/','prisma/')) and not (live/name).exists() and safe(name).is_file():
            path = safe(name)
            old = path.read_bytes()
            backup = archive/'before'/name
            backup.parent.mkdir(parents=True, exist_ok=True)
            backup.write_bytes(old)
            path.unlink()
            manifest['files'].append({'path':name,'before':digest(old),'after':None})
    names = subprocess.check_output(['git','-c','safe.directory='+live.as_posix(),'ls-files','-c','-o','--exclude-standard','-z'],cwd=live).decode().split('\0')
    names = sorted(set(name for name in names if name and not name.startswith(('artifacts/','delivery/')) and not any(p.startswith('.env') for p in Path(name).parts) and not name.endswith(('.db','.sqlite','.tsbuildinfo'))))
    for name in names:
        origin = live/name
        if not origin.is_file(): continue
        if origin.is_symlink(): raise RuntimeError('Source links must be reviewed: '+name)
        data = origin.read_bytes()
        write(name,data)
        manifest['liveBaseline'].append({'path':name,'sha256':digest(data)})

for folder in ['src/features/standards_assurance','src/app/standards','scripts/standards-assurance']:
    for file in (source/folder).rglob('*'):
        if file.is_file() and '__pycache__' not in file.parts:
            write(file.relative_to(source).as_posix(),file.read_bytes())
for name in ['scripts/upgrade-standards-storage.ts','tests/e2e/standards-assurance.spec.ts']:
    write(name,(source/name).read_bytes())

name='prisma/schema.prisma'
text=(target/name).read_text(encoding='utf-8')
if 'model StandardReference {' not in text:
    block=(source/name).read_text(encoding='utf-8').split('generator client')[0]
    write(name,(block+text).encode())
name='src/app/app-sidebar.tsx'
text=(target/name).read_text(encoding='utf-8')
if 'href: "/standards"' not in text:
    text=text.replace('  ClipboardList,','  BookOpenCheck,\n  ClipboardList,',1)
    text=text.replace('const navItems = [','const navItems = [\n  { href: "/standards", label: "Standards & Assurance", icon: BookOpenCheck, isActive: (pathname: string) => pathname === "/standards" || pathname.startsWith("/standards/") },',1)
    write(name,text.encode())
name='scripts/bootstrap-sqlite.ts'
text=(target/name).read_text(encoding='utf-8')
if 'ensureStandardsStorage' not in text:
    text='import { ensureStandardsStorage, seedStandards } from "../src/features/standards_assurance/api/server";\n'+text
    text=text.replace('  console.log("SQLite schema is ready.");','  await ensureStandardsStorage(prisma);\n  await seedStandards(prisma);\n  console.log("SQLite schema is ready.");',1)
    write(name,text.encode())
name='scripts/drawing-performance-audit/run-config.mjs'
text=(target/name).read_text(encoding='utf-8')
for worktree in ['standards-assurance','standards-assurance-integration']:
    if "'"+worktree+"':" not in text:
        text=text.replace('const configurations = {',"const configurations = {\n  '"+worktree+"': { run: 'standards-assurance', database: 'test-standards-assurance.db' },",1)
write(name,text.encode())
name='.gitignore'
text=(target/name).read_text(encoding='utf-8')
if 'artifacts/standards-assurance/' not in text:
    write(name,(text+'\nartifacts/standards-assurance/\n').encode())

# The only package change is the reviewed Vitest security patch. Require all
# other package fields to agree before reusing the resolved lockfile.
current=json.loads((target/'package.json').read_text())
updated=json.loads((source/'package.json').read_text())
current['devDependencies']['vitest']=updated['devDependencies']['vitest']
if any(current.get(key) != updated.get(key) for key in ['name','version','dependencies','devDependencies','overrides']):
    (archive/'manifest.json').write_text(json.dumps(manifest,indent=2))
    raise RuntimeError('Dependency inputs diverged; reconcile explicitly before proceeding.')
write('package.json',(json.dumps(current,indent=2)+'\n').encode())
write('package-lock.json',(source/'package-lock.json').read_bytes())
name='tsconfig.json'
config=json.loads((target/name).read_text())
if 'artifacts/standards-assurance' not in config.get('exclude',[]):
    config.setdefault('exclude',[]).append('artifacts/standards-assurance')
    write(name,(json.dumps(config,indent=2)+'\n').encode())
name='eslint.config.mjs'
text=(target/name).read_text()
if '"artifacts/standards-assurance/**"' not in text:
    write(name,text.replace('      ".next/**",','      ".next/**",\n      "artifacts/standards-assurance/**",',1).encode())
(archive/'manifest.json').write_text(json.dumps(manifest,indent=2))
print(json.dumps({'archive':str(archive),'changedFiles':len(manifest['files']),'liveBaselineFiles':len(manifest['liveBaseline'])}))
