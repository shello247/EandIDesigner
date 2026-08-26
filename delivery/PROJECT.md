# EI Designer drawing performance pass

Active: PLAN-002 — controlled performance improvement, 23 tasks, public source recovery checkpoints authorized.
Stage0 recovery/isolation and Stage1 verification complete. CI32998854844 passes audit0/types0/full lint/714units/build/27production drawing workflows with no retries or page errors. Stage1 tag drawing-perf-pass-1-stage-1-20260826 targets tested commit c63a0ef5db295103a2d0a9ecc9f9e161aacb9b83. Stage2 Task007 removes unopened Wire Catalog request/overlay while preserving draft/error/retry/focus behavior; Task008 metrics next. No live promotion; performance and broader Stage7 gates remain.
Completed: PLAN-001 — evidence audit; original 524 engineering tests pass, hydration/stale-locator/type-test failures documented.

Implementation: linked drawing-performance-pass-1 worktree; codex/drawing-performance-pass-1 branch. Original reliability-hardening stays live and unchanged. Canonical main used only for Git administration; no data inspection. No schema/provider/dependency/engineering identity changes, no main merge/live promotion.

Task and stage reports are the recovery map. Stop conditions and test gates are in the active plan. Do not start deferred features after this plan completes.
