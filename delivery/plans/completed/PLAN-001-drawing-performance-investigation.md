# PLAN-001 — Drawing performance investigation

Status: completed with documented limitations on 26 August 2026. Evidence transferred and source/ports verified at 16:41:55 UTC / 12:41:55 America/Port_of_Spain. No optimization implementation was started.

## Assumptions

Approved user plan governs this audit. SQLite and single-editor drawing workflows only. UTC evidence timestamps; local summaries America/Port_of_Spain; calendar-month aggregation not applicable. No production data or secrets are copied. No product optimizations are authorized.

## A) Feature capsule

Goal: establish reproducible evidence and a prioritized next-pass backlog for the existing drawing application. Audience: application owner and implementing engineers. Surfaces: drawing list/editor, sheet loader, properties/assets, wiring/schedules, preview/print/PDF. No new UI; empty/loading/error behaviour is observed, not redesigned. UI consistency: preserve the current product and compare output parity.

Data/API: no database schema, public API, saved JSON, permissions or integration changes. Only fixture CRUD in a guarded isolated database; no production records. Diagnostic records contain operation names, durations, counts, bytes and SQL fingerprints, never sensitive parameters. Inputs and fixtures validated with existing Zod contracts.

Acceptance: each included workflow has measured evidence or an explicit limitation, source/fixture identity and reproduction instructions; failures remain visible; recommendations include risk and verification; live source and database remain unchanged.

## B) Scaffold

Reusable harness: scripts/drawing-performance-audit/; task specs: delivery/tasks/; report: delivery/reports/PLAN-001-drawing-performance-assessment.md; raw evidence: artifacts/drawing-performance/20260826-baseline/. Product instrumentation exists only in a disposable linked audit worktree. No new feature folder or data layer.

## C) Execution chunks

1. Baseline and architecture map (30–90-minute evidence batches): Record exact source, environment, execution paths, safeguards, and hypotheses. Verification: task report plus referenced machine-readable evidence.
2. Audit harness and fixtures (30–90-minute evidence batches): Create deterministic schema-valid fixtures, bounded timing/query capture and safe isolated launch. Verification: task report plus referenced machine-readable evidence.
3. Drawing correctness baseline (30–90-minute evidence batches): Run focused drawing unit and active-workflow browser tests; preserve failures. Verification: task report plus referenced machine-readable evidence.
4. Loading and SQLite (30–90-minute evidence batches): Measure list/catalogue scaling, payloads, SQL shapes/plans and open/save processing. Verification: task report plus referenced machine-readable evidence.
5. Canvas and engineering processing (30–90-minute evidence batches): Measure selection, sheet changes, graph stages, routes and geometry invalidations. Verification: task report plus referenced machine-readable evidence.
6. Save, preview, print and PDF (30–90-minute evidence batches): Measure sequential exports, saved acknowledgments, output parity and cleanup. Verification: task report plus referenced machine-readable evidence.
7. Memory and modularity (30–90-minute evidence batches): Exercise repeated UI cycles and inspect retained state and feature boundaries. Verification: task report plus referenced machine-readable evidence.
8. Evidence report and prioritized backlog (30–90-minute evidence batches): Deliver reproducible measurements, limitations, risk-ranked recommendations, and next-pass acceptance tests. Verification: task report plus referenced machine-readable evidence.

## Quality gates

- [x] Exact dirty-source snapshot and path guards verified.
- [x] Synthetic models and diagnostic output validated.
- [x] Correctness tests and negative paths recorded without suppressed failures.
- [x] Baseline/diagnostic measurements separated; no parallel timed workload.
- [x] Existing performance budgets retained.
- [x] Source integrity, output parity and live runtime safeguards checked.
- [x] Report, raw evidence and reproduction guide delivered.

Completion is evidence-based, not an all-green release declaration. A reproduced hydration error, 39 existing test TypeScript diagnostics, unassigned per-request SQL events, synthetic-artwork limits and finite memory/interaction coverage remain visible in the assessment.

Report: delivery/reports/PLAN-001-drawing-performance-assessment.md. Recommendations: delivery/reports/PLAN-001-improvement-backlog.md. The next improvement pass is not authorized by completion of this audit.

## Risk register

- P0 wrong database: reject targets outside isolated audit root before importing Prisma/bootstrap.
- P1 source drift: fingerprint batches and never combine different revisions.
- P1 observer overhead: separate baseline and diagnostic runs.
- P1 fixture invalidity: schema plus reference/terminal-capacity checks.
- P1 build/runtime collision: independent linked worktree, dependencies and port 3100.
- P2 stale tests: classify separately, do not restore removed interfaces or weaken assertions.

## Verification

Use isolated npm run lint/build, scoped Vitest, serial Playwright with explicit test database, audit CPU/query/browser harnesses. Persist all failures and limitations. Failed budgets do not invalidate a correctly executed investigation.

## Confirmations needed

None; approved instrumented-audit scope is sufficient.
