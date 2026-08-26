# PLAN-002-TASK-003 — Repair standalone test typing

PlanId: PLAN-002
TaskId: PLAN-002-TASK-003
Stage: 1
Priority: P1
Status: done
Test impact: update
Started: 2026-08-26 13:33
Completed: 2026-08-26 13:36
Duration: approximately 3m
Timezone: America/Port_of_Spain

## Done when

- [x] Standalone application and real-test type check passes without weakened types or unrelated runtime changes.
- [x] Full704 tests, lint and production build pass; runtime browser regression belongs to resumed002A (no runtime changes in this task).
- [x] Compared with predecessor39 diagnostics; first repair attempt's remaining metadata diagnostic retained.
- [ ] Source-only checkpoint reviewed, pushed and remote SHA verified (record in following recovery report).

## Execution

1. Confirm source/run identity and isolated test target.
2. Reproduce the stated behavior or measurement; retain negative tests.
3. Make one coherent change within the approved plan; split further if needed to keep reviewable 30–90-minute batches.
4. Verify, measure serially, review the diff and document risks.
5. Complete the task report, checkpoint and continue only when its gates pass.

## Files expected

- package.json
- tests/
- src/features/*/tests/

## Verification

Use the guarded runner for focused Vitest/Playwright and lint/type/build checks as appropriate. No live database tests. Exact commands, source/fixture hashes and raw results belong in the task report. The stage gate may remain stricter than an individual task gate.

## Report

delivery/reports/PLAN-002-TASK-003-test-types.md
