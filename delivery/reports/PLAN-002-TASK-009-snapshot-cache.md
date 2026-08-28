# PLAN-002-TASK-009 — Editor-scoped engineering snapshot reuse

Start: 2026-08-26 14:48 America/Port_of_Spain
End: 2026-08-26 14:56 America/Port_of_Spain
Duration: approximately 8 minutes
Status: complete

## Problem and measured baseline

Task008's controlled 40-sheet selection evidence records exactly one `panel.graph`, one placement-context projection and one connected-schedule projection on every selection. A representative sample took14.5ms for the graph plus3.9ms for the two projections, while the source itself remained stable. Selection identity—not engineering identity—was invalidating the snapshot. Sheet workspace/preview transitions could likewise switch the required state off/on and lose React's last memo value.

## Change

The editor now keeps snapshots in an editor-instance `WeakMap` keyed by the immutable validated source object. The graph remains lazy: ordinary drawings do not build it until a wiring consumer, equipment selection or preview needs it. Selection, sheet/card and preview presentation changes reuse the same snapshot/source. A committed model or symbol dependency creates a new source identity and therefore rebuilds conservatively. Weak keys make abandoned revisions naturally reclaimable; there is no process/global package cache and no manual eviction lifecycle.

Snapshot revision metadata remains the revision of its source construction. It is not used for engineering invalidation anywhere; diagnostics carry current action revision separately. Engineering services and electrical-network APIs remain intact.

The React immutability lint correctly rejected mutating a `WeakMap` directly inside `useMemo`. Cache ownership therefore lives in a small pure service with a closure-private weak map; the shell only calls `getOrCreate`. This follows the React performance skill's narrow-dependency/memoization guidance without hiding a lint rule or using a module-global map.

Files: snapshot-cache service/unit test; drawing-canvas-shell.tsx; browser-audit structural test; Delivery records. No model, database, wire/terminal, ordering, rendering, save or public API change.

## Verification

New production diagnostic workflow warms one lazy snapshot, then asserts zero source/graph/projection rebuilds for a different equipment selection, a sheet switch and entering preview. A real ArrowRight model mutation must produce exactly one history commit, one source build and one graph build, with zero network requests. Output is persisted with action/revision correlation.

Verification on the candidate source:

- Cache contract: 1 focused test passed. Full regression: 122 files and 720 tests passed.
- Standalone TypeScript, full lint and the guarded production build passed. Build ID: `InnECVQFcT7RK-iLCfZ7c`.
- Production diagnostic `diagnostic-task009-snapshot-v3` passed with stable source fingerprint `4774a2115bd9098eac1ccb8d54c8c9b41d6001bba7a0d3a7f6703018c4d12e7d`.
- After one warm construction, selection, sheet navigation and Package Preview each recorded zero `panel.source` and zero `panel.graph` calls. Selection also recorded zero placement-context and schedule projections.
- The real ArrowRight mutation recorded exactly one normalize, history commit, source, graph, placement-context and schedule projection; it made zero network requests. Its graph was 17.5 ms and source adaptation 55.4 ms in this diagnostic sample. These single observations prove invalidation shape, not a timing distribution or speedup.
- Production workflows for selection/arrangement and internal-wire author/remove/restore/reload passed: 3 tests, one worker, no retry.
- Port 3100 was released. The existing live port-3000 process remained PID 31720 and was not restarted. Task008 evidence remains frozen and was not overwritten.

First focused test attempt is retained: the cache contract referenced a nonexistent fixture helper name and failed before exercising product code. It now uses the existing validated generic panel fixture; no product change was made for that test setup error.

`diagnostic-task009-snapshot` confirms the selection, sheet and preview zero-rebuild assertions, then fails before mutation because the test retained the Field-sheet ID `g0_device_0` after navigating to Detail 1, whose corresponding occurrence is `g0_device_0_detail`. `diagnostic-task009-snapshot-v2` retains a second audit-only failure: a suffix match still excluded that Detail occurrence. The final substring selector follows the fixture's shared equipment identity and v3 passes. No application code changed to obtain either audit-fixture correction.

The first implementation attempted to mutate a `WeakMap` directly in a React memo and was rejected by the repository's immutability lint rule. The accepted closure-private cache service preserves ownership without disabling the rule. The earlier invalid fixture-helper test attempt is also retained. These are failed attempts, not suppressed evidence.

## Risk and recovery

Invalidation is deliberately conservative: every new validated source identity gets a new graph. This task does not attempt structural equality or presentation-only model shortcuts. Cache scope is one mounted editor; weak keys allow superseded sources to be reclaimed. Terminal/wire identities, drawing JSON, database access, save behavior, ordering and rendering are unchanged.

Source checkpoint: commit containing this report; publication review, push and exact remote verification recorded at task close and in the next Delivery state update.
