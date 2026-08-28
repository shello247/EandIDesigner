# PLAN-002-TASK-018 — Paginate exact drawing summaries without migration

PlanId: PLAN-002
TaskId: PLAN-002-TASK-018
Stage: 5
Priority: P1
Status: done
Test impact: add
Started: 2026-08-26 17:07
Completed: 2026-08-26 17:27
Duration: approximately 20 minutes
Timezone: America/Port_of_Spain

## Done when

- [x] 25 per page; count + bounded rows; stable updatedAt desc/ID asc; invalid/out-of-range pages handled; BOM options unchanged.
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

- drawing queries/schema/types
- drawings page/table
- tests

## Verification

Use the guarded runner for focused Vitest/Playwright and lint/type/build checks as appropriate. No live database tests. Exact commands, source/fixture hashes and raw results belong in the task report. The stage gate may remain stricter than an individual task gate.

## Report

delivery/reports/PLAN-002-TASK-018-drawing-list.md
