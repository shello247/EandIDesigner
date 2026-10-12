# Qualification and local rollout

PlanId: PLAN-016
TaskId: PLAN-016-TASK-002
Priority: P1
Status: todo
Test impact: add

## Done-When

- Combined source verified and running locally against unchanged canonical data.

## Execution Steps

1. Preserve current state and review bounded scope.
2. Execute this plan chunk with the recorded safeguards.
3. Verify and retain evidence; report failures rather than weakening checks.

## Files expected

scripts/package-information/playwright.config.ts; tests/e2e/drawing-package-information.spec.ts; affected section/drawing specs

## Verification

lint; typecheck; full units; audit:dependencies; guarded webpack build and 3121 Chromium/Firefox; read-only live UI

## Report

delivery/reports/PLAN-016-release.md

