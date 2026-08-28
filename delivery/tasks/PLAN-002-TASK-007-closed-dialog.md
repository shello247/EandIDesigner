# PLAN-002-TASK-007 — Remove closed Wire Catalog mounting overhead

PlanId: PLAN-002
TaskId: PLAN-002-TASK-007
Stage: 2
Priority: P1
Status: done
Test impact: add
Started: 2026-08-26 14:23
Completed: 2026-08-26 14:32
Duration: approx 9m
Timezone: America/Port_of_Spain

## Done when

- [x] No closed loading overlay/request; first-open/error/retry/close/focus behavior preserved.
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

- src/features/drawing_canvas/ui/components/drawing-canvas-shell.tsx
- drawing UI tests

## Verification

Use the guarded runner for focused Vitest/Playwright and lint/type/build checks as appropriate. No live database tests. Exact commands, source/fixture hashes and raw results belong in the task report. The stage gate may remain stricter than an individual task gate.

## Report

delivery/reports/PLAN-002-TASK-007-closed-dialog.md
