# PLAN-002-TASK-021 — Integrated regression and repeated performance comparison

PlanId: PLAN-002
TaskId: PLAN-002-TASK-021
Stage: 7
Priority: P1
Status: todo
Test impact: update
Started: pending
Completed: pending
Duration: pending
Timezone: America/Port_of_Spain

## Done when

- [ ] Full regression; baseline/predecessor paired timing; 20 UI cycles; 50-entry history; failed budgets reported honestly.
- [ ] Focused tests, affected browser checks and necessary broader gates recorded.
- [ ] Compared with verified predecessor; original failures/outliers retained.
- [ ] Source-only checkpoint reviewed, pushed and remote SHA verified.

## Execution

1. Confirm source/run identity and isolated test target.
2. Reproduce the stated behavior or measurement; retain negative tests.
3. Make one coherent change within the approved plan; split further if needed to keep reviewable 30–90-minute batches.
4. Verify, measure serially, review the diff and document risks.
5. Complete the task report, checkpoint and continue only when its gates pass.

## Files expected

- audit tools
- drawing tests
- delivery/reports/

## Verification

Use the guarded runner for focused Vitest/Playwright and lint/type/build checks as appropriate. No live database tests. Exact commands, source/fixture hashes and raw results belong in the task report. The stage gate may remain stricter than an individual task gate.

## Report

delivery/reports/PLAN-002-TASK-021-integrated-measurements.md

