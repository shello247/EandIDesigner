# EI Designer production-readiness assessment

Assessment date: 28 August 2026

Timezone: America/Port_of_Spain

Scope: EI Designer drawing application and the completed drawing-performance programme

Assessment source: `codex/drawing-performance-pass-1` at `0c1e43216008d72fd6f22d7cb87df8d0e18848cc`

## Executive verdict

The EI Designer drawing core is a verified release candidate and is suitable for integration into `main` and a controlled internal, single-editor pilot. The overall application is not yet ready for unrestricted multi-engineer cloud production.

This distinction is important:

- **Drawing-core readiness: GO.** Drawing correctness, performance, save/reload behavior, output parity, automated verification, and source recovery have sufficient evidence to proceed.
- **Controlled internal pilot: CONDITIONAL GO.** First integrate the verified branch, rerun acceptance checks against the canonical SQLite application, and enforce one active editor per drawing.
- **General cloud production: NO-GO.** Managed PostgreSQL, authentication and authorization, operational backups, observability, deployment recovery, and capacity verification remain incomplete or explicitly deferred.

Moving into the managed PostgreSQL programme is recommended. A database migration must not be presented as completing production readiness by itself.

## Assessment snapshot

| Item | Captured state |
|---|---|
| Verified feature branch | `codex/drawing-performance-pass-1` |
| Assessed branch commit | `0c1e43216008d72fd6f22d7cb87df8d0e18848cc` |
| Remote `main` at capture | `d8f7c4d96d5dfab1e381f9b2e332acd4c5fc984a` |
| Integration state | Assessed branch is 38 commits ahead of `main`; no pull request or merge completed |
| Final branch CI | GitHub Actions run `33021810371`, successful |
| Tested product candidate | `d93c29f2f782e2e93a4e9671082b5f04de62e4ae` |
| Recovery tag | `drawing-perf-pass-1-stage-7-20260826` |
| Database provider | Prisma with SQLite |
| Intended next data platform | Managed cloud PostgreSQL; provider not yet selected |

This is a source and engineering assessment. It is not certification of a deployed production environment.

## Evidence supporting drawing-core readiness

The completed programme provides the following evidence:

- 771 unit tests across 130 files passed.
- The maintained production drawing browser gate passed 30 of 30 workflows with one worker and no hidden retries.
- Dependency audit, lint, standalone type-check, guarded database bootstrap, and production build passed in GitHub CI.
- A detached recovery worktree completed a clean `npm ci`, fresh synthetic SQLite bootstrap, production build, and create/save/reload workflow.
- Selection, movement, rotation, resize, wiring, hit testing, route editing, connection-display modes, schedules, continuations, undo/redo, save conflicts, preview, print, and PDF were exercised.
- Print HTML remained byte-identical to the frozen baseline for 10-, 40-, and 120-sheet packages.
- PDF page order, sizes, text hashes, and representative rendered pixels matched the baseline.
- Engineering identities, drawing JSON, terminal and wire records, pinned versions, SQLite schema, and save-conflict semantics were preserved.
- Forced-garbage-collection measurements remained near 22 MB through 60 edits while preserving the 50-entry undo/redo contract.

Representative 40-sheet interaction measurements:

| Workflow | Frozen baseline median / p95 | Final median / p95 |
|---|---:|---:|
| Select equipment | 90.90 / 131.10 ms | 46.60 / 54.80 ms |
| Switch sheet | 223.20 / 387.80 ms | 94.75 / 129.60 ms |
| Open or collapse Properties | 61.60 / 170.10 ms | 34.20 / 35.40 ms |
| Nudge equipment | 319.70 / 539.60 ms | 133.80 / 147.70 ms |
| Save | 485.80 / 784.60 ms | 151.00 / 173.30 ms |
| Change connection display | 367.04 / 482.10 ms | 183.87 / 207.88 ms |

At 500 packages, drawing-list median/p95 processing fell from 1,352.99/1,879.40 ms to 77.37/90.73 ms. Normal save now returns the persisted revision acknowledgment without rereading the full document, and unrelated editor-prefetch requests fell to zero across the measured save workload.

## Readiness by area

| Area | Verdict | Basis and remaining condition |
|---|---|---|
| Drawing correctness | Ready | Broad unit and production-browser regression coverage passed. |
| Drawing interaction performance | Ready | User-visible measurements improved materially; warm sheet switching and pointer-preview budgets pass. |
| Save and reload behavior | Ready | Save, edit-during-save, conflict, retry, reload, and compact acknowledgment behavior are covered. |
| Preview, print, and PDF | Ready with known limitation | Visual and structural parity pass. Existing private-use punctuation and literal wire-ID copy/extraction behavior remains unchanged. |
| Source recovery | Ready | Remote checkpoints, annotated stage tag, and clean-checkout recovery rehearsal pass. |
| Branch integration | Not completed | The verified branch must be squash-merged through the authorized pull-request workflow before it becomes `main`. |
| Controlled single-editor pilot | Conditional | Integrate the branch, run canonical-data smoke tests, document pilot ownership, and maintain one editor per drawing. |
| Managed PostgreSQL | Not ready | Target provider, topology, schema migration, connection management, query plans, data rehearsal, and rollback are not yet implemented. |
| Authentication and authorization | Not ready | Explicitly deferred; required before unrestricted production access. |
| Tenancy and data isolation | Not ready | No verified cloud tenant boundary exists. |
| Concurrent editing | Deferred | Existing conflict semantics protect revisions, but real-time or multi-editor workflow is not certified. |
| Deployment and rollback | Not ready | No production hosting topology, immutable release procedure, health gates, or application rollback rehearsal was included. |
| Database backup and restore | Not ready | Source recovery exists; canonical production-data backup, point-in-time recovery, and restore verification do not. |
| Observability | Not ready | Production logs, metrics, traces, alerting, error reporting, and service-level objectives are not established. |
| Capacity and resilience | Not ready | No representative cloud concurrency, sustained load, failover, or recovery-time test has been completed. |
| Secrets and environment management | Not certified | Secrets were kept out of source, but a managed production secret lifecycle has not been verified. |

## Known technical risks retained

1. **Combined validation and graph construction:** p95 is 108.27 ms in the designated source-only fixture, slightly above a strict combined 100 ms interpretation. The validated graph and electrical-network stages pass separately. This is a narrow future profiling target, not a demonstrated user-visible regression.
2. **Committed-gesture rendering:** automated gestures still record approximately one rendering long task even though pointer-preview calculation passes its 16.7 ms budget.
3. **PDF text extraction:** private-use punctuation and non-contiguous literal wire-ID extraction remain equal to the baseline. Visual output and expected route labels are preserved.
4. **Synthetic fixture presentation:** some generic labels overlap by design. Pixel parity confirms no regression but does not certify fixture aesthetics as issued-drawing quality.
5. **Single-editor operating model:** SQLite and the existing conflict workflow were intentionally retained. Multi-user capacity and collaborative editing remain unverified.

## Required sequence before the database programme

1. Create and review a squash pull request from `codex/drawing-performance-pass-1` into `main`.
2. Rerun the release gate on the squash candidate.
3. Fast-forward the canonical `main` only after the GitHub merge completes.
4. Run a controlled smoke test against the canonical SQLite application without rewriting existing records.
5. Preserve the Stage 7 tag and recovery map as the pre-PostgreSQL reference point.

Beginning PostgreSQL work from the older `main` would mix the performance integration and provider migration later, increasing diagnosis and rollback risk.

## Recommended managed PostgreSQL programme

### Phase 1 — Architecture and compatibility audit

- Select the managed PostgreSQL provider and hosting region based on the eventual application host, recovery objectives, cost, operational controls, and connection model.
- Catalogue every Prisma model, migration assumption, raw query, transaction, uniqueness rule, date/time behavior, JSON field, collation dependency, and SQLite-specific behavior.
- Define environments for local development, isolated tests, cloud development, staging, and production.
- Define authentication, TLS, secret rotation, connection pooling, and least-privilege database roles.

### Phase 2 — Staging implementation

- Introduce PostgreSQL through a dedicated migration branch and Delivery OS plan.
- Generate and review migrations rather than using uncontrolled schema synchronization.
- Provision an empty managed development/staging database first.
- Run the full unit, browser, build, export, and performance suites against PostgreSQL.
- Use PostgreSQL `EXPLAIN (ANALYZE, BUFFERS)` on measured query shapes before adding or changing indexes.
- Preserve SQLite as the known recovery reference until PostgreSQL acceptance completes.

### Phase 3 — Data migration rehearsal

- Create a managed backup of the source data before every rehearsal.
- Migrate a controlled copy and validate table counts, identifiers, relationships, drawing-document hashes, timestamps, and representative engineering records.
- Exercise migration failure, retry, rollback, and restore procedures.
- Record expected downtime or define a controlled write freeze for final cutover.

### Phase 4 — Operational readiness

- Establish automated backups and perform a real restore test.
- Add application and database health checks, structured logging, error reporting, latency and saturation metrics, and actionable alerts.
- Define recovery-point and recovery-time objectives.
- Run representative package, drawing-list, save, preview, and PDF workloads under expected pilot concurrency.
- Document deployment, rollback, incident response, ownership, and escalation.

### Phase 5 — Production access readiness

- Add authentication and role-based authorization before unrestricted access.
- Establish tenant/data isolation if more than one organization will use the system.
- If concurrent editing remains deferred, enforce and communicate one active editor per drawing and verify conflict recovery behavior operationally.
- Complete security review, user-acceptance testing, and final production-readiness reassessment.

## Production entry gates

The application should not be declared generally production-ready until all of the following have evidence:

- The verified drawing-performance branch is integrated into `main` and release CI passes.
- Managed PostgreSQL schema and code compatibility are verified in staging.
- A representative migration rehearsal and rollback rehearsal pass.
- Automated backups exist and a restore has been proven.
- Authentication, authorization, and required data-isolation controls pass.
- Secrets are centrally managed and rotatable.
- Deployment, health checks, observability, alerts, and application rollback are operational.
- Representative load and sustained-use tests pass agreed budgets.
- Preview, print, PDF, engineering identities, and save-conflict behavior remain equivalent.
- A controlled pilot completes without unresolved data-integrity or operational defects.

## Reassessment triggers

Revisit this assessment when any of the following occurs:

- The performance branch is merged or materially changed.
- The Prisma provider or database schema changes.
- A managed PostgreSQL provider is selected or provisioned.
- Authentication, tenancy, deployment, backups, or observability are implemented.
- Concurrent-editor behavior is introduced.
- A pilot, load test, incident, data migration, or restore rehearsal produces new evidence.
- More than three months pass without reassessment.

A future assessment should compare its source commit, environment, workload, and evidence directly with this snapshot rather than treating the word “ready” as permanent.

## Decision record

As of 28 August 2026:

- **Proceed with integration of the verified drawing-core candidate:** recommended.
- **Proceed with a separately planned managed PostgreSQL programme after integration:** recommended.
- **Launch a controlled internal single-editor pilot:** acceptable after the stated integration and smoke-test conditions.
- **Declare unrestricted cloud production readiness:** not approved.

## Supporting records

- [PLAN-002 final drawing performance assessment](PLAN-002-final-assessment.md)
- [PLAN-002 recovery map](PLAN-002-recovery-map.md)
- [PLAN-002 clean-checkout recovery rehearsal](PLAN-002-TASK-023-recovery-rehearsal.md)
- [PLAN-002 integrated measurements](PLAN-002-TASK-021-integrated-measurements.md)
- [PLAN-002 export parity](PLAN-002-TASK-022-export-parity.md)
- [Session handoff](HANDOFF-2026-08-26.md)
