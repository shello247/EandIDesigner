# PLAN-002-TASK-008 — Accurate bounded action and rendering metrics

PlanId: PLAN-002
TaskId: PLAN-002-TASK-008
Stage: 2
Priority: P1
Status: done
Test impact: add
Started: 2026-08-26 14:32
Completed: 2026-08-26 14:43
Duration: approx 11m
Timezone: America/Port_of_Spain

## Done when

- [x] Stage and settled interaction timing separated; bounded disabled-default counters; diagnostic parity passes.
- [x] Focused tests, affected browser checks and necessary broader gates recorded.
- [x] Compared with verified predecessor; original failures/outliers retained.
- [x] Source-only checkpoint reviewed, pushed and remote SHA verified.

## Execution

1. Confirm source/run identity and isolated test target.
2. Reproduce the stated behavior or measurement; retain negative tests.
3. Make one coherent change within the approved plan; split further if needed to keep reviewable 30–90-minute batches.
4. Verify, measure serially, review the diff and document risks.
5. Complete the task report, checkpoint and continue only when its gates pass.

## Files expected

- drawing performance diagnostics
- scripts/drawing-performance-audit/

## Verification

Use the guarded runner for focused Vitest/Playwright and lint/type/build checks as appropriate. No live database tests. Exact commands, source/fixture hashes and raw results belong in the task report. The stage gate may remain stricter than an individual task gate.

## Report

delivery/reports/PLAN-002-TASK-008-metrics.md
