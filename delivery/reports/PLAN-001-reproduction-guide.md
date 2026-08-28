# Drawing performance audit — reproduction guide

Run: `20260826-baseline`. This is an investigation, not an optimization patch.

## Safety and source identity

Working repository: `C:/Web_Applications/EI_Engineering_Workspace/Application Folders/Working Branches/reliability-hardening`.

Isolated audit: `C:/Web_Applications/EI_Engineering_Workspace/Application Folders/Working Branches/drawing-performance-audit-20260826`.

Baseline commit: `cfe8897146f231fc49bd0bdfeb8d871762858087`, plus the dirty source recorded in `source-manifest.json`. The manifest fingerprint, including file sizes, is `3d6ecb492fdeacf98887a56db7bdff8277c35c5b2794a44a228666213fd9c845`. The command runner hashes the path/hash pairs instead and reports `1a5f07e57419ee1fb073e1edaba8a8008f142d58b7ab82e3e2042c14c53bcde4` for the same uninstrumented source. These are different digest definitions, not different product revisions.

The isolated database is exactly `file:C:/Web_Applications/EI_Engineering_Workspace/Application Folders/Working Branches/drawing-performance-audit-20260826/prisma/test-drawing-performance-20260826.db`. Do not substitute `file:./dev.db`. Do not copy, query, or inspect the canonical database. Port 3000 belongs to the working application and must not be stopped or reused.

`snapshot.mjs` creates a detached linked worktree using the canonical repository only for Git administration, copies eligible current tracked/untracked source, mirrors source deletions, and excludes environment files, databases, secrets, dependencies, build output and evidence. It refuses to overwrite an existing audit directory. `run-command.mjs` verifies source hashes and sets the exact isolated database before spawning commands. Product instrumentation and test-locator adapters have separate before/after manifests.

The harness is intentionally pinned to this run's directory and database. For another audit, review and change the guarded run identifiers together; do not bypass the guards. Existing result labels are not append-only: use new batch labels and `AUDIT_PHASE` values when rerunning, so original failures remain available.

## Environment

Windows 10.0.26200 x64; Intel Core i7-10710U, 12 logical CPUs; approximately 32 GiB RAM; Node 24.11.1; Next 16.2.11; React 19.2.7; Prisma 6.19.3; TypeScript 6.0.3; Playwright 1.61.1. Browser version is recorded in navigation evidence. Performance viewport is 1440×900; existing correctness tests use Desktop Chrome defaults, 1280×720.

Authoritative browser runs use a production build. One browser worker, zero automatic retries, serial workloads, no simultaneous audit builds/tests. The user's live development application remains running: background workstation activity, thermal conditions and OS caches are not controlled. Results are a local baseline, not cloud capacity estimates.

## Initial setup

Run from the working repository only when the named audit target does not already exist:

```powershell
git status --short --branch
node scripts/drawing-performance-audit/snapshot.mjs
```

Copy only `scripts/drawing-performance-audit/` into the new audit source. Run all following setup and workloads from the isolated audit directory. Independent `npm ci` and Prisma generation are required. Inspect the repository's isolated test-database bootstrap script before running it with the guarded database; never use the development bootstrap against fixture data.

Check that port 3100 is free before starting a server:

```powershell
Get-NetTCPConnection -LocalPort 3100 -State Listen -ErrorAction SilentlyContinue
```

If it is occupied, stop and identify the owner. Do not terminate an unrelated process. The original run's setup/build commands and output are retained in the raw evidence directory.

## Reusable commands

The examples below assume an already bootstrapped isolated database. Command labels should be unique for additional runs.

```powershell
node scripts/drawing-performance-audit/run-command.mjs fixtures-repeat node --import tsx scripts/drawing-performance-audit/fixtures.ts
node scripts/drawing-performance-audit/run-command.mjs harness-repeat node node_modules/vitest/vitest.mjs run --config scripts/drawing-performance-audit/vitest.audit.config.ts
node scripts/drawing-performance-audit/run-command.mjs types-repeat node node_modules/typescript/bin/tsc --project scripts/drawing-performance-audit/tsconfig.audit.json --noEmit
$env:AUDIT_METRIC_SUFFIX='repeat-01'
node scripts/drawing-performance-audit/run-command.mjs cpu-repeat node --import tsx scripts/drawing-performance-audit/cpu.ts
node scripts/drawing-performance-audit/run-command.mjs sqlite-repeat node --import tsx scripts/drawing-performance-audit/sqlite.ts
node scripts/drawing-performance-audit/run-command.mjs dependency-probe-repeat node --import tsx scripts/drawing-performance-audit/dependency-probe.ts
node scripts/drawing-performance-audit/run-command.mjs build-repeat node node_modules/next/dist/bin/next build
node scripts/drawing-performance-audit/run-command.mjs server-repeat node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3100
```

Use a separate terminal for the server and retain its PID. Run browser workloads serially:

```powershell
$env:AUDIT_PHASE='baseline-repeat'
node scripts/drawing-performance-audit/run-command.mjs browser-repeat node node_modules/@playwright/test/cli.js test --config scripts/drawing-performance-audit/playwright.audit.config.ts --grep 'navigation|interactions|geometry|history limit|memory|exports'
```

The complete browser suite is slow by design. Its fixtures are reset before each test. Do not run SQL scaling concurrently: it temporarily alters only synthetic records and restores the catalogue/list state in cleanup.

CPU/SQL scripts refuse to replace an existing metric file; choose a unique `AUDIT_METRIC_SUFFIX` for each repeat. Baseline browser commands require an uninstrumented build. The retained audit worktree finishes in the instrumented state; a new baseline requires a new guarded source snapshot, not copying instrumented source back to the working application. Archived harness source uses `.source.txt` extensions so the application compiler does not discover it as live TypeScript.

## Diagnostic runs

Stop only the identified audit server, verify port 3100 is free, then apply the mechanical instrumentation in the audit copy. This changes existing product files **only there** and records their hashes. It cannot be reapplied to an already instrumented copy.

```powershell
node scripts/drawing-performance-audit/run-command.mjs instrument-repeat node scripts/drawing-performance-audit/instrument.mjs
node scripts/drawing-performance-audit/run-command.mjs diagnostic-build-repeat node node_modules/next/dist/bin/next build
$env:AUDIT_SERVER_PHASE='repeat-01'
node scripts/drawing-performance-audit/run-command.mjs diagnostic-server-repeat node --require ./scripts/drawing-performance-audit/server-diagnostics.cjs node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3100
```

```powershell
$env:AUDIT_PHASE='diagnostic-repeat'
node scripts/drawing-performance-audit/run-command.mjs diagnostic-browser-repeat node node_modules/@playwright/test/cli.js test --config scripts/drawing-performance-audit/playwright.audit.config.ts --grep 'interactions|geometry|diagnostic CPU profile|instrumentation overhead|exports'
```

Diagnostic operation times are nested/inclusive; do not add them together. Query event durations have millisecond quantization. The final server preload uses AsyncLocalStorage for request-scoped operation counters; the five-save probe confirmed these counters, but Prisma query events did not retain that context. Exact per-request SQL attribution is unavailable: use the separate direct-query benchmark for query counts and timings. The earlier server log used global counters and can overlap background prefetches. SQL logs include parameterized statements, not parameter values. Browser samples and server logs are bounded. Diagnostic traces and ABBA observer-overhead blocks must remain separate from baseline timing claims.

Use a fresh `AUDIT_PHASE` and the browser grep `save response payload` for the five-save request/response-size probe; the exact command is recorded in `save-payload-probe-start.json`. Do not mix this diagnostic sample with the thirty baseline save observations.

## Fixtures and statistics

`fixtures.ts` creates 10/40/120-sheet drawable mixed packages and a dense 200-placement, 500-route sheet. It uses current drawing factories and Zod schemas, then validates anchors, identities and endpoint capacity. Symbols have deliberately simple synthetic SVGs. These are not copies of the user's WTP project or a benchmark of detailed manufacturer artwork.

The separate existing 120-sheet engineering source fixture has 500 assets, 1,000 occurrences, 2,000 connections, 2,000 terminals and 1,000 internal wires. It is not interchangeable with the drawable 120-sheet model. Fixture dimensions and SHA-256 hashes are in `fixtures.json` and `source-only-fixture.json`.

CPU/SQL/warm interactions: five warmups, thirty retained samples, nearest-rank p95. Ten fresh-browser-context navigations are reported separately, without a p95 or claims about cold OS/database caches. PDFs: five sequential exports per size, individual samples, median and range, no p95. Outliers and failures are retained. The summary tool recomputes even-sample medians correctly from raw data; some early raw metric objects used the upper middle value.

Canvas readiness checks hydration, absence of lazy-loading status overlays and two animation frames. Interaction times include browser automation/assertion overhead and two-frame settling; they are not field INP measurements. The internal `canvas.sheet-load` metric stops at a state setter, so it is not used as the painted-sheet navigation result.

## Output inspection and handoff

```powershell
node scripts/drawing-performance-audit/static-audit.mjs
node scripts/drawing-performance-audit/summarize-results.mjs
```

Run `pdf-qa.py` with the bundled Python/pypdf runtime. It reads synthetic PDFs, checks page count/order and expected visible route labels (including explicit label overrides), compares page text/size to baseline, and renders representative pages with Poppler. Visually inspect those PNGs; text parity alone is not sufficient layout assurance. Some punctuation in schedule/stub text extracts as private-use characters despite correct glyph rendering; PDF search/copy compatibility needs a separate check. Poppler `pdftoppm` was available, but `pdftotext` was not; the failed second-extractor attempt remains in evidence.

Finally, from the original working repository:

```powershell
node scripts/drawing-performance-audit/snapshot.mjs --verify
git status --short --branch
```

Transfer raw evidence and reusable tooling/docs only. Never transfer the instrumented `src/` files, adapted product tests, database, generated Prisma client, dependencies or `.next` output. Evidence is ignored under `artifacts/drawing-performance/`; the report links to it locally. Preserve the isolated worktree for reproduction until cleanup is explicitly agreed.

`node scripts/drawing-performance-audit/handoff-evidence.mjs` runs only from the original repository, copies the guarded raw-evidence subtree, verifies every copied hash, rechecks original source and records port ownership. It does not delete the retained audit worktree or overwrite product source. The original port-3000 PID check is specific to this audit session; a later intentional application restart should be documented rather than misreported as source drift.
