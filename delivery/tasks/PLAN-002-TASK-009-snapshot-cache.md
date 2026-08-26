# PLAN-002-TASK-009 — Reuse engineering snapshots across view changes

PlanId: PLAN-002
TaskId: PLAN-002-TASK-009
Stage: 3
Priority: P1
Status: done
Test impact: add
Started: 2026-08-26 14:48
Completed: 2026-08-26 14:56
Duration: approximately 8 minutes
Timezone: America/Port_of_Spain

## Done when

- [x] Unchanged source is not rebuilt on selection/sheet/card/preview changes; mutation invalidation and cache lifetime correct.
- [x] Focused tests, affected browser checks and necessary broader gates recorded.
- [x] Compared with verified predecessor; original failures/outliers retained.
- [x] Source-only checkpoint reviewed for publication; push and remote verification are the task-closing operation.

## Execution

1. Confirm source/run identity and isolated test target.
2. Reproduce the stated behavior or measurement; retain negative tests.
3. Make one coherent change within the approved plan; split further if needed to keep reviewable 30–90-minute batches.
4. Verify, measure serially, review the diff and document risks.
5. Complete the task report, checkpoint and continue only when its gates pass.

## Files expected

- drawing canvas snapshot services/hooks
- shell
- tests

## Verification

Use the guarded runner for focused Vitest/Playwright and lint/type/build checks as appropriate. No live database tests. Exact commands, source/fixture hashes and raw results belong in the task report. The stage gate may remain stricter than an individual task gate.

## Report

delivery/reports/PLAN-002-TASK-009-snapshot-cache.md
