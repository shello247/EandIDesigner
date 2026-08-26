# EI Designer drawing performance pass

Active: PLAN-002 — controlled performance improvement, 23 tasks, public source recovery checkpoints authorized.
Stage0–2 verified. Task009 snapshot reuse is remotely recoverable at5dfadf66d244978c9751712cc2d17ce5aeaadb08. Task010 endpoint/topology indexing passes correctness and measurement gates; its checkpoint is being published. Task011 numeric-ordering equivalence benchmark is next. No live promotion; performance and broader Stage7 gates remain.
Completed: PLAN-001 — evidence audit; original 524 engineering tests pass, hydration/stale-locator/type-test failures documented.

Implementation: linked drawing-performance-pass-1 worktree; codex/drawing-performance-pass-1 branch. Original reliability-hardening stays live and unchanged. Canonical main used only for Git administration; no data inspection. No schema/provider/dependency/engineering identity changes, no main merge/live promotion.

Task and stage reports are the recovery map. Stop conditions and test gates are in the active plan. Do not start deferred features after this plan completes.
