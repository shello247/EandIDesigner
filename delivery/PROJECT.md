# PROJECT — EI Designer drawing performance

## Current application context — 12 October 2026

The application has progressed beyond this historical performance milestone.
The [numbered feature register](../docs/application/REGISTER.md) owns the current
capability inventory; [release runbook](../docs/application/releases/2026-10-12.md)
owns consolidated verification and rollout guidance. Feature modules remain under
src/features, public contracts preserve engineering identities, Prisma uses SQLite,
and Vitest/Playwright operate on isolated synthetic data.

PLAN-016 started 12 October 2026 (America/Port_of_Spain); release work is in
progress. Timing and final checks are recorded in its release receipt. Wider
engineering and manufacturer-review programmes are not implicitly completed.
Preserve all uncommitted local work; no public checkpoint includes customer data.

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
- Implementation: current local rollout from the reconciled linked worktree. Publication uses a clean release branch from main to exclude unpublished customer-report history. Recheck runtime ownership before maintenance; historical checkout names below are not startup instructions.

## 3) Feature inventory

### Completed

- PLAN-001 — Drawing performance investigation — `delivery/plans/completed/PLAN-001-drawing-performance-investigation.md` — completed 2026-08-26.
- PLAN-002 — Drawing performance improvements — `delivery/plans/completed/PLAN-002-drawing-performance-improvements.md` — completed 2026-08-26 in approximately 6 hours elapsed across 23 tasks.
- Production-readiness baseline — `delivery/reports/PRODUCTION-READINESS-ASSESSMENT-2026-08-28.md` — drawing core approved as an integration candidate; unrestricted cloud production not yet approved.

### In progress (Active plan)

- PLAN-016 — [Package Information reconciliation and release](plans/planned/PLAN-016-reconcile_package_information_release.md). Current task: PLAN-016-TASK-003 publication; independent engineering-audit closure is outside this release.

### Planned / queued

- Wider engineering-record review and office-server production readiness remain separate programmes. This release does not complete either.

Time summary: PLAN-016 started 12 October 2026; exact plan/task elapsed time was not captured. Current gate durations are retained in the release receipt. Historical PLAN-002-TASK-023 took approximately 8 minutes; CI `33021358639` qualified that older checkpoint only.

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
- Guarded build/browser checks: follow [current release runbook](../docs/application/releases/2026-10-12.md). Never bootstrap canonical storage.
- Env notes: do not read, print, copy, or commit `.env.local`; port 3000 is the shared live editor and current release tests use guarded port 3121.
