# PLAN-002-TASK-019 — Compact revision-consistent save acknowledgment

PlanId: PLAN-002
TaskId: PLAN-002-TASK-019
Stage: 6
Priority: P1
Status: todo
Test impact: add
Started: pending
Completed: pending
Duration: pending
Timezone: America/Port_of_Spain

## Done when

- [ ] {id,updatedAt}; guarded persisted revision; no full detail reparse; conflict/dirty/in-flight/retry behavior unchanged.
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

- drawing mutations/actions/types
- shell
- tests

## Verification

Use the guarded runner for focused Vitest/Playwright and lint/type/build checks as appropriate. No live database tests. Exact commands, source/fixture hashes and raw results belong in the task report. The stage gate may remain stricter than an individual task gate.

## Report

delivery/reports/PLAN-002-TASK-019-save-ack.md

