# PROJECT — EI Designer drawing performance

## 1) What we’re building (purpose)

- Problem: make the existing electrical-engineering drawing core fast, predictable, and recoverable without changing engineering meaning.
- Users: engineers creating and revising detailed electrical drawing packages.
- Success criteria: verified drawing correctness, lower load/edit/save/export cost, bounded memory/history behavior, and reproducible checkpoints.
- Non-goals for this completed pass: access control, tenancy, concurrent editing, managed PostgreSQL, AI, approval workflows, deployment capacity, and live promotion.

## 2) Current architecture (snapshot)

- Stack: Next.js 16 App Router, React 19, TypeScript, Zod, Prisma, SQLite, SVG drawing surfaces.
- Repo layout: application routes in `src/app`; feature modules in `src/features/<snake_case>`; Delivery OS under `delivery/`.
- Data: Prisma with SQLite retained for this pass; a managed PostgreSQL programme is deferred. Schema and provider were unchanged.
- Validation: public/domain contracts are Zod-backed; engineering calculations stay in testable services.
- Testing: Vitest unit suites and Playwright production workflows; guarded synthetic databases and serial performance harnesses.
- Env: local secrets remain in uncommitted environment files; no environment file or database is published.
- Boundaries: UI does not call the database directly; data access remains in feature layers; terminal/wire/symbol identities and pinned versions are preserved.
- Implementation: linked `drawing-performance-pass-1` worktree on `codex/drawing-performance-pass-1`; original `reliability-hardening` remains live and unchanged.

## 3) Feature inventory

### Completed

- PLAN-001 — Drawing performance investigation — `delivery/plans/completed/PLAN-001-drawing-performance-investigation.md` — completed 2026-08-26.
- PLAN-002 — Drawing performance improvements — `delivery/plans/completed/PLAN-002-drawing-performance-improvements.md` — completed 2026-08-26 in approximately 6 hours elapsed across 23 tasks.
- Production-readiness baseline — `delivery/reports/PRODUCTION-READINESS-ASSESSMENT-2026-08-28.md` — drawing core approved as an integration candidate; unrestricted cloud production not yet approved.

### In progress (Active plan)

- None. Current task: none.

### Planned / queued

- None. Squash-PR/live promotion and the production-readiness programme require a separate user decision.

Time summary: no active plan/task; most recent completed task PLAN-002-TASK-023 took approximately 8 minutes. Final branch CI `33021358639` passed exact remote tip `01337ef7acc33d063ad1167411141be8a54a67c9`.

## 4) Delivery OS workflow

- Plan → promote to active → execute one task → verify/report/checkpoint → complete plan.
- Task naming: `PLAN-002-TASK-001-*`; every completed task has a report under `delivery/reports/`.
- GitHub checkpoints are source recovery only, not database backups or authority to merge.
- Current recovery candidate: Stage 7 tag peels to `d93c29f2f782e2e93a4e9671082b5f04de62e4ae`; see `delivery/reports/PLAN-002-recovery-map.md`.

## 5) Dev runbook (commands)

- Install: `npm ci`
- Shared local development: `npm run dev:webpack` from the active linked worktree; it resolves the canonical development database and fails closed if unavailable.
- Test: `npm run test`
- Drawing E2E: `npm run test:drawing -- --reporter=line`
- Lint: `npm run lint`
- Type-check: `npm run typecheck`
- Guarded build: `$env:DATABASE_URL='file:./dev.db'; npm run build` only for the standard isolated verification convention; development worktrees must never be started against that path.
- Env notes: do not read, print, copy, or commit `.env.local`; port 3000 remains the shared live editor and port 3100 is reserved for guarded synthetic tests.
