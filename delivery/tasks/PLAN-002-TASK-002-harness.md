# PLAN-002-TASK-002 — Guarded run configuration and clean isolated baseline

PlanId: PLAN-002
TaskId: PLAN-002-TASK-002
Stage: 0
Priority: P1
Status: done
Test impact: add
Started: 2026-08-26 13:00
Completed: 2026-08-26 13:47
Duration: approximately10m active across13:00-13:05 and13:42-13:47; intervening002A/003 tracked separately
Prerequisite: Task002A completed13:41 with exact baseline browser failures retained; Task003 types fixed. Resume clean recovery build/runtime and audit runner checks.
Timezone: America/Port_of_Spain

## Done when

- [x] Unique run paths; target guards; independent install/build/bootstrap; baseline failures preserved.
- [x] Harness14 tests, scoped lint and standalone types pass; clean recovery browser create/save/reload passes.
- [x] Baseline failures/outliers retained; config worker-reimport failure and corrected rerun retained.
- [x] Initial recovery and security/type source checkpoints verified remotely; completedStage0 tag recorded with this task report.

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
