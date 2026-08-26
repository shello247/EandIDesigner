# PLAN-002-TASK-002A — Dependency-security prerequisite

PlanId: PLAN-002
TaskId: PLAN-002-TASK-002A
Stage: 0 prerequisite
Priority: P0 verification blocker
Status: todo
Started: 2026-08-26 13:21
Completed: pending
Duration: pending
Prerequisite update: security audit/704 units/lint pass; Next16.3 build surfaces the known39 test-type diagnostics. Bring forward already-approved Task003, then finish002A browser/build verification. No new scope needed.
Timezone: America/Port_of_Spain

## Authorization and scope

User authorized narrowly scoped repairs before resuming the performance plan. Verify installed-version/advisory applicability, make smallest compatible existing dependency updates, and retain security policy strength. No new application dependency, database/schema/format change, major framework upgrade, live promotion or main merge. Stop for broader changes. No exception extension, forced audit fix, or unsupported downgrade.

## Done when

- [ ] Current audit, dependency paths and upstream compatibility evidence recorded.
- [ ] Minimal candidate resolves findings without introducing exceptions; remove obsolete exceptions only after verified fixes.
- [ ] Focused security/compatibility tests, full unit/lint/build and production drawing checks recorded; distinguish known baseline failures.
- [ ] Public-safe source checkpoint pushed and exact remote SHA verified.
- [ ] Task002 baseline work resumed only when required gates pass.

## Files and verification

Expected: package.json/package-lock.json, dependency audit policy/tests and focused compatibility tests if necessary. Delivery state and reports. Use existing guarded runner and unique security labels; no product diagnostics or canonical DB reads. Preserve failed attempts, including initial Windows npm.cmd spawn EINVAL. npm audit exit code alone is not a pass; use the existing strict policy evaluator.

## Report

delivery/reports/PLAN-002-TASK-002A-security.md
