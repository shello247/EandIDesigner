# PLAN-002-TASK-006 — Establish production drawing release gates

PlanId: PLAN-002
TaskId: PLAN-002-TASK-006
Stage: 1
Priority: P1
Status: done
Test impact: add
Started: 2026-08-26 14:00
Completed: 2026-08-26 14:23
Duration: approx 23m
Timezone: America/Port_of_Spain

## Done when

- [x] Branch CI, Chromium install, serial production browser gate, lint/types/unit/build pass.
- [x] Focused tests, affected browser checks and necessary broader gates recorded.
- [x] Compared with verified predecessor; original failures/outliers retained.
- [x] Source-only checkpoint c63a0ef5db295103a2d0a9ecc9f9e161aacb9b83 reviewed, pushed and remote SHA verified.

## Execution

1. Confirm source/run identity and isolated test target.
2. Reproduce the stated behavior or measurement; retain negative tests.
3. Make one coherent change within the approved plan; split further if needed to keep reviewable 30–90-minute batches.
4. Verify, measure serially, review the diff and document risks.
5. Complete the task report, checkpoint and continue only when its gates pass.

## Files expected

- .github/workflows/ci.yml
- package.json
- drawing Playwright configuration

## Verification

Use the guarded runner for focused Vitest/Playwright and lint/type/build checks as appropriate. No live database tests. Exact commands, source/fixture hashes and raw results belong in the task report. The stage gate may remain stricter than an individual task gate.

## Report

delivery/reports/PLAN-002-TASK-006-ci-gates.md
