# PLAN-002-TASK-002 — Guarded run configuration and clean isolated baseline

PlanId: PLAN-002
TaskId: PLAN-002-TASK-002
Stage: 0
Priority: P1
Status: doing
Test impact: add
Started: 2026-08-26 13:00
Completed: pending
Duration: pending
Blocker: existing dependency-security gate fails; scope decision required before progression.
Timezone: America/Port_of_Spain

## Done when

- [ ] Unique run paths; target guards; independent install/build/bootstrap; baseline failures preserved.
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

- scripts/drawing-performance-audit/
- scripts/drawing-performance-pass/

## Verification

Use the guarded runner for focused Vitest/Playwright and lint/type/build checks as appropriate. No live database tests. Exact commands, source/fixture hashes and raw results belong in the task report. The stage gate may remain stricter than an individual task gate.

## Report

delivery/reports/PLAN-002-TASK-002-harness.md
