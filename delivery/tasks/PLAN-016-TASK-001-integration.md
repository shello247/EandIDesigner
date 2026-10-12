# Baseline and bounded integration

PlanId: PLAN-016
TaskId: PLAN-016-TASK-001
Priority: P1
Status: todo
Test impact: update

## Done-When

- Reviewed PLAN-014 changes integrated without replacing current classification or component persistence.

## Execution Steps

1. Preserve current state and review bounded scope.
2. Execute this plan chunk with the recorded safeguards.
3. Verify and retain evidence; report failures rather than weakening checks.

## Files expected

src/features/drawing_canvas/logic/services/drawing-sheet-destination.ts; src/features/drawing_canvas/ui/components/{add-sheet-dialog,sheet-loader-dialog,move-sheet-to-section-dialog,drawing-canvas-shell,svg-drawing-surface}.tsx; docs/application/features/drawing-packages/README.md

## Verification

Focused destination, section, loader and Title Sheet Vitest; diff review

## Report

delivery/reports/PLAN-016-release.md

