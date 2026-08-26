# PLAN-002-TASK-004 — Reproduce and fix production hydration mismatch

PlanId: PLAN-002
TaskId: PLAN-002-TASK-004
Stage: 1
Priority: P1
Status: done
Test impact: add
Started: 2026-08-26 13:48
Completed: 2026-08-26 13:56
Duration: approximately8m
Timezone: America/Port_of_Spain

## Done when

- [x] Demonstrated SSR/client cause fixed; production pageErrors remain empty; no suppression or blanket SSR disable.
- [x] Focused tests, affected browser checks and necessary broader gates recorded.
- [x] Compared with verified predecessor; original failures/outliers retained.
- [ ] Source-only checkpoint reviewed, pushed and remote SHA verified (record exact SHA in next recovery update).

## Execution

1. Confirm source/run identity and isolated test target.
2. Reproduce the stated behavior or measurement; retain negative tests.
3. Make one coherent change within the approved plan; split further if needed to keep reviewable 30–90-minute batches.
4. Verify, measure serially, review the diff and document risks.
5. Complete the task report, checkpoint and continue only when its gates pass.

## Files expected

- tests/e2e/drawing-panel-assignment.spec.ts
- affected drawing UI/service

## Verification

Use the guarded runner for focused Vitest/Playwright and lint/type/build checks as appropriate. No live database tests. Exact commands, source/fixture hashes and raw results belong in the task report. The stage gate may remain stricter than an individual task gate.

## Report

delivery/reports/PLAN-002-TASK-004-hydration.md
