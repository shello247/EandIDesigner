# PLAN-012 — Compact Drawing Settings

Approved for implementation: 2026-09-29. Existing drawing_canvas presentation/local-draft refactor; wider PLAN-006 remains unchanged.

## Assumptions

- Follow the user's approved two-tab plan: General / Printed Title Block, project-copy review before replacement, unchanged Apply then Save workflow.
- Active worktree: item-engineering. No dependencies, database changes, permissions changes, publication or live drawing edits.
- Month definition: calendar month; reporting timezone America/Port_of_Spain (UTC-04:00). No date conversion; existing Date remains free text.

## A) Feature Capsule

- Goal/story: engineers edit the relevant drawing information directly without scrolling through unrelated settings.
- Acceptance: shared compact EngineeringDialog (640px maximum width / 520px viewport-constrained height), fixed tabs/actions, responsive fields, accessible tab navigation and safe dismissal. Default General; all edits remain in one local draft.
- UI: existing Drawing Settings entry point. General contains title, linked project, three-row description and units. Printed Title Block contains existing seven fields plus Use project details. Inline current/proposed copy review replaces the grid; Cancel copy / Use these values. Main Apply disabled while unchanged or reviewing.
- UI Consistency Note: reuse shared dialog, buttons, fields, typography and native focus behavior. No global restyling or separate wizard.
- Logic: normalizeDrawingSettingsDraft, isDrawingSettingsDirty, mapDrawingSettingsIssues, buildProjectCopyProposal and project-copy source comparison are pure functions. Existing drawingSettingsDraftSchema validates the entire draft, including inactive fields; errors select/focus the relevant field and mark affected tabs.
- Data: no DB changes. Existing drawing/titleBlock and project public contract only; no new persistence or retention. No hidden writes; Apply changes local state through existing onApply(settings, selectedProject).
- CRUD/API: no new actions or endpoints. Existing loading/retry, archived linkage and project resolution retained. Missing copy source values never erase entries; refreshed source invalidates stale review.
- Safety: Cancel/Close/Escape confirm dirty discard once. Outside clicks do not dismiss. Title Sheet editor unchanged. No canvas geometry/history work per keystroke, tab or review.
- Tests: extend settings unit tests; add drawing-settings-dialog browser suite; update affected existing title-sheet/project/canvas assertions without dropping coverage.
- Done: focused and full units, lint, standalone types, guarded webpack build, Chromium/Firefox synthetic SQLite on3121 with one worker, screenshots, read-only live handoff and documented limitations.

## Quality Gates

- [ ] Correctness: existing Zod validation and field/tab errors tested.
- [ ] Data integrity: local draft only; save/print/Title Sheet consistency tested.
- [ ] Time: reporting timezone explicit; Date contract unchanged.
- [ ] Security: existing permissions and public feature boundaries preserved.
- [ ] UX: loading/error/archived/empty/copy/dirty states tested.
- [ ] UI consistency: shared compact dialog and focus styles reused.
- [ ] Testing: pure Vitest helpers and positive/negative browser flows.
- [ ] Verification: commands and evidence tied to acceptance.
- [ ] Observability: retained runner logs/screenshots, no production telemetry additions.

## Risk Register

- Risk: project copy overwrites reviewed text; impact P1; mitigation explicit before/after review, source invalidation, no clearing missing values.
- Risk: inactive tab hides errors/loses draft; impact P1; mitigation one local draft and issue-to-tab focus mapping.
- Risk: dialog shortcuts reach canvas; impact P1; mitigation native modal and keyboard event isolation, browser regression.
- Risk: changing shared styles affects unrelated editors; impact P2; mitigation shared component API/styles unchanged.
- Risk: shared .next build interrupts live app; impact P1; mitigation approved saved-draft maintenance and verified owned process only.

## B) Scaffold Plan

- Refactor src/features/drawing_canvas/ui/components/drawing-settings-dialog.tsx.
- Add src/features/drawing_canvas/logic/services/drawing-settings-draft.ts.
- Extend src/features/drawing_canvas/tests/drawing-settings-organization.test.ts and existing settings/Title Sheet coverage.
- Add tests/e2e/drawing-settings-dialog.spec.ts; update existing settings callers in browser tests.
- Extend scripts/canvas-toolbar/playwright.config.ts test selection; retain existing isolation guards.
- Document in src/features/drawing_canvas/README.md and Delivery OS reports. No new feature folder/data/API layer.

## C) Implementation Plan

1. TASK001 baseline/records (30–45min): preserve dirty tree, current behavior/screenshots and focused tests.
2. TASK002 draft services/dialog (45–90min): pure helpers and shared compact two-tab presentation; verify unit/static/accessibility behavior.
3. TASK003 project-copy/integration (45–90min): reviewed copy, validation, dirty dismissal and unchanged public callback; verify state/error protections.
4. TASK004 regression/handoff (60–90min): browser/static/full tests, cleanup, shared runtime restart and read-only review.

## Confirmations needed (non-blocking)

Obtain a current saved-draft maintenance window before the shared .next build/browser stage. Port3121 must be free; never stop another application to claim it.
