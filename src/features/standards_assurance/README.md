# Standards & Assurance

Requirements-first local engineering register at `/standards`. PLAN-009 implements source → requirement → implementation → evidence → recorded review, with frozen client dossiers. It does not convert drawings or grant IEC certification.

## Workflow

1. Maintain exact source editions in **Standards Register**. Classify international standards, client specifications, manufacturer instructions and company procedures separately.
2. Add a requirement, pin its source revision and record applicability, interpretation and expected behavior. A **Candidate** can lack a clause. **Source Checked** requires a locator and authoritative material examined on the pinned source; catalogue access is insufficient.
3. Add a versioned implementation explanation, controls, limitations and optional technical references.
4. Record manual checks, test-result descriptors or reviewed examples. All evidence is **declared**, not trusted CI ingestion. External files and URLs are references only; the server never fetches them.
5. Record local reviews against exact revisions. Reviewer names are self-declared and never treated as authenticated approvals.
6. Create a company or named client profile with exact requirement and implementation revisions. Give reasons for exclusions/unresolved applicability; conflicts remain unresolved.
7. Review scoped counts and gaps, then freeze a report snapshot. A changed profile, evidence, review or build invalidates the assessment used by the snapshot request. Refresh before retrying. Gaps do not prevent a snapshot, but are retained in it.
8. Open the HTML dossier and use browser Print / Save as PDF, or download its JSON. Both render one immutable snapshot and its SHA-256 manifest; a digest is not a digital signature.

## Data and boundaries

- `data/`: Zod payload contracts, revision queries, transactional mutations, seeding and guarded storage maintenance. Thirteen additive Prisma tables; no Drawing/Project schema change.
- `logic/`: scoped coverage, evidence freshness, stable hashes, build identity and escaped HTML/JSON output.
- `api/actions.ts`: validated server actions with typed errors and idempotent operation identifiers.
- `api/public.ts`: `getStandardsProfile`, `getRequirementTrace`, `getImplementationCoverage`, `getStandardsContext`; no compliant boolean.
- `ui/`: register, structured editors, exact-revision pickers, traces, reviews and profile/report history.
- SQLite triggers prevent updates/deletion of accepted historical records. Current entity pointers change only through revision-safe transactions which include audit records.
- Timestamps persist in UTC. General UI timestamps use America/Port_of_Spain; date-entry controls explicitly use the browser timezone.

The starter register has five IEC bibliographic sources and six candidate research topics. It includes no invented normative clauses or licensed source documents. Engineering source review and technical content acceptance remain pending.

## Isolated verification

Run from a registered linked worktree. The runner enforces a synthetic `prisma/test-standards-assurance.db`, a guarded workspace path and port 3120; it refuses an occupied test port.

```text
npm run test -- src/features/standards_assurance/tests
npm run lint
npm run typecheck
npm run audit:dependencies
node scripts/standards-assurance/run.mjs bootstrap
node scripts/standards-assurance/run.mjs build
node scripts/standards-assurance/run.mjs browser
```

The browser suite covers the source-to-export journey, printing, validation, cancellation, concurrent edit conflict, historical views and evidence-tab navigation. Tests use synthetic records only. Failure traces and run logs remain under `artifacts/standards-assurance/`; those recovery/test artifacts are excluded from TypeScript and ESLint input.

The dependency audit exposed inherited vulnerabilities. Vitest is patched to 4.1.11 and the resolved js-yaml dependency to 4.3.2, with compatible test-tool transitive updates. No new application library was introduced.

## Local integration and recovery

The planning base predates unpublished live application changes. `scripts/standards-assurance/integrate.py` stages current live source into the dedicated integration checkout, then applies only this module and its bounded integration changes. It preserves current sidebar entries, Prisma definitions, package scripts and other feature code. Every changed file is copied into a dated recovery archive with before/after hashes. `--stage` is forbidden for the live worktree.

Before canonical storage maintenance, stop the verified EI Designer listener on port 3000. Run `node --import tsx scripts/upgrade-standards-storage.ts` for a dry run and add `--apply` for the authorized upgrade. The script resolves canonical main via Git, refuses other databases and an occupied port, locks a single SQLite connection, creates a `VACUUM INTO` backup, checks integrity and fingerprints, and installs only additive standards tables/triggers. Existing tables are fingerprinted before and after; mismatch rolls the schema transaction back. Seeding follows the successful upgrade and is idempotent. Never run the general test bootstrap against canonical storage.

Restart with `npm run dev:webpack`, which resolves canonical storage. Code rollback should restore only unchanged files recorded in the integration manifest (check their current hashes first), regenerate Prisma, and restart the previous code. Keep additive standards data. Database restoration is exceptional: stop all writers, verify backup hash/integrity and review intervening data before restoring; never blindly overwrite a newer database.

## Deliberate limits

No authenticated sign-off, file uploads, remote fetching, trusted CI ingestion, automatic standards interpretation, automatic precedence selection or schematic conversion. Profiles have descriptive client/project references; they are not attached to Drawing/Project records. Full authoritative standards review and the subsequent Outline / IEC Schematic View phase are separate work.
