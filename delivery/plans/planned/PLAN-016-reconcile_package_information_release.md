# PLAN-016 — Reconcile Package Information and publish the qualified application

Status: active bounded release; wider PLAN-006 and PLAN-015 manufacturer review remain open.
Authorized: 12 October 2026. Saved-draft maintenance permission confirmed.

## Assumptions

- The current reconciled worktree is authoritative for newer classification, security, Item engineering and chassis work.
- PLAN-014 in item-engineering is the donor for the missing Sheet Loader UI only.
- No live drawing correction or migration is needed. Month convention: calendar months in America/Port_of_Spain (not a feature calculation).
- Public GitHub publication means reviewed application source, tests and generic documentation; never local databases, customer record reports, attachments or source-backup artifacts.

## A) Feature Capsule

Goal/user story: engineers see the completed Package Information/Add Section workflow in the same application as current engineering features, locally and on GitHub main.
Acceptance: expanded Package Information, Needs section for legacy working sheets without mutation, named Add Section and validated Add Sheet destination, current classification/identity protections retained, qualified local runtime, reviewed squash PR.
UI: existing Sheet Loader, Add Sheet and compact EngineeringDialog. Retain loading/error/dirty confirmation, read-only and focus behavior; no unrelated redesign.
Logic: prepareWorkingSheetDestination/newDrawingSectionSchema validate current destination with Zod; section plus working sheet commits once. Cancel/stale target does not change the drawing.
Data: no new DB change; retain existing additive classification migration and immutable engineering data. Audit evidence remains local.
CRUD/API/permissions: reuse existing commands and save boundaries; no new endpoints or permission changes.
Tests: destination/loader/section/title unit coverage; Chromium/Firefox guarded 3121 section, drawing and classification regressions.
Definition of done: relevant and full units, lint, types, dependency audit, guarded webpack build/browser tests, read-only live review, sanitized source publication through squash PR and fast-forward canonical main.

## Quality Gates

- [ ] Zod and actionable errors retained.
- [ ] No live data changes or historical revision rewrites.
- [ ] Time convention explicit.
- [ ] No secrets/customer evidence in public source.
- [ ] Empty/error/dirty/focus/undo paths verified.
- [ ] Existing SCS UI reused.
- [ ] Unit and browser positive/negative coverage retained.
- [ ] Commands and evidence recorded against qualified source.
- [ ] Runtime ownership and release identity recorded.

## Risks

- Newer work overwritten (P1): integrate only reviewed donor hunks; retain classification/chassis regression checks.
- Shared build invalidates live runtime (P1): saved-draft permission; stop verified owned port 3000 only.
- Public release exposes local evidence (P1): clean publication branch from main with explicit source allowlist and content review; do not push unsanitized local history.
- Tests touch catalogue (P1): guarded synthetic DB, port 3121; refuse occupied port.
- Wrong checkout serves live (P1): verify listener command, canonical startup and visible new loader.
- Catalogue audit mistaken for complete (P1): retain unfinished manufacturer-review limitations.

## B) File Map

Existing drawing_canvas service, loader/add/move dialogs, shell, surface, focused unit tests and E2E fixtures/specs; module README and feature 4 catalogue. No new feature module/data layer required.
scripts/package-information/playwright.config.ts integrates existing guarded runner and classification fixture setup.
delivery/PLAN-016 plan/tasks/report; release source preparation and receipts retained locally, outside published customer evidence.

## C) Implementation Chunks

1. Baseline and bounded integration (30–90 min): source preservation, review donor diff, integrate owned files, update feature docs. Verify focused units and change scope.
2. Qualification and local rollout (30–90 min): static/full unit/security gates, guarded build/browser suite, canonical restart and read-only live inspection.
3. Public release and handoff (30–90 min): reviewed clean release snapshot, content/secret scan, source equivalence, same-name branch push, PR/checks/squash, canonical ff-only update. Preserve dirty original checkouts and separate recovery evidence.

## Confirmations

Saved drafts and safe restart confirmed. Publication explicitly authorized. No further implementation-choice confirmation needed.

