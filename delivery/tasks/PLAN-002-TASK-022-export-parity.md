# PLAN-002-TASK-022 — PDF/print verification and text compatibility check

PlanId: PLAN-002
TaskId: PLAN-002-TASK-022
Stage: 7
Priority: P1
Status: done
Test impact: update
Started: 2026-08-26 18:36
Completed: 2026-08-26 18:47
Duration: approximately 11 minutes
Timezone: America/Port_of_Spain

## Done when

- [x] Five PDFs per size; page/order/text/wire/schedule/layout parity; search/copy caveats verified or explicitly retained.
- [x] Focused tests, affected browser checks and necessary broader gates recorded.
- [x] Compared with verified predecessor; original failures/outliers retained.
- [x] Source-only checkpoint reviewed; publication and remote SHA are recorded in the recovery-map update.

## Execution

1. Confirm source/run identity and isolated test target.
2. Reproduce the stated behavior or measurement; retain negative tests.
3. Make one coherent change within the approved plan; split further if needed to keep reviewable 30–90-minute batches.
4. Verify, measure serially, review the diff and document risks.
5. Complete the task report, checkpoint and continue only when its gates pass.

## Files expected

- audit export QA tools
- drawing export tests

## Verification

Use the guarded runner for focused Vitest/Playwright and lint/type/build checks as appropriate. No live database tests. Exact commands, source/fixture hashes and raw results belong in the task report. The stage gate may remain stricter than an individual task gate.

## Report

delivery/reports/PLAN-002-TASK-022-export-parity.md
