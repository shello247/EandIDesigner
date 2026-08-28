# PLAN-002-TASK-016 — Load catalogue details on demand

Start: 2026-08-26 16:23 America/Port_of_Spain
End: 2026-08-26 16:30 America/Port_of_Spain
Duration: approximately 7 minutes
Status: complete; recovery checkpoint remotely verified

## Invariants

An editor may fetch one exact immutable symbol version without loading the full
catalogue. Concurrent requests for the same version share one request, only
successful exact matches enter the editor-scoped cache, and a failed request
must remain retryable. Insertion must occur only after the complete requested
record resolves. No global or package cache was introduced.

Predecessor: `0c16ceb21dc54a306332e6c1283f14386a807fb9`, remotely verified.

## Reproduction and test-first evidence

The six loader contracts were written before the implementation existed. The
retained fail-first run failed because the loader module did not exist. The
green contracts prove:

- two concurrent loads return the same Promise and invoke the action once;
- a successful immutable record is reused without another action call;
- failures are not cached and an explicit retry performs another action;
- a response for a different version ID is rejected and not cached;
- insertion is never called after a failed load and receives only the exact
  fully resolved record after success;
- two editor loader instances do not share state.

## Change

`loadDrawingSymbolVersionAction` resolves one exact version through the
Task015 batched exact-version data path and preserves the existing action error
envelope. It reports an absent historical version without substituting the
latest version.

`createDrawingSymbolCatalogLoader` is a small editor-scoped service with
separate resolved and in-flight maps. Successful immutable records are cached;
errors and mismatched records are not. The retry entry point deliberately
evicts a resolved record before loading, and `loadForInsertion` calls its
insertion callback only after exact success.

The service accepts a loader function rather than importing a Server Action,
so it is pure, directly testable and does not couple catalogue-summary browsing
to the engineering snapshot. Task017 mounts one instance in the editor and
migrates actual drawing consumers; this task does not claim a user-visible
loading state before that integration.

## Structural comparison

| Scenario | Action invocations |
|---|---:|
| Two concurrent requests for one version | 1 |
| Repeated request after successful load | 0 additional |
| Failure followed by explicit retry | 2 total |
| Same version requested by two editor instances | 2 total |

The verified predecessor had no on-demand drawing loader and therefore no
equivalent deduplication/cache contract. Catalogue query timing and payload
scaling remain the Task015 baseline; Task017 measures the integrated initial
editor payload after consumer migration.

## Files changed

- `src/features/drawing_canvas/api/actions.ts`
- `src/features/drawing_canvas/logic/services/drawing-symbol-catalog-loader.ts`
- `src/features/drawing_canvas/tests/drawing-symbol-catalog-loader.test.ts`
- Delivery OS task/current/report records

## Verification

- Focused loader and exact-query suites: 2 files, 11 tests passed.
- Full unit suite: 128 files and 746 tests passed.
- Full lint and standalone application/test typecheck passed.
- Guarded synthetic bootstrap and production build passed. Candidate source
  fingerprint: `d5c76d8d3d2a5e605862dba9f360207b59243d28decc6548a749bb43e1e51eb5`;
  build ID: `GuKphkpnFW36sobyq83q4`; source drift: false.
- Three production browser workflows passed serially with one worker and zero
  retries: panel component placement/reload, terminal-strip member attributes
  and PDF preview.
- Port 3100 was released. Live port 3000 remains PID 31720 and was not
  restarted; the canonical database was never targeted.

## Risks and follow-up

The action and loader are intentionally not wired into existing selectors in
this task. Task017 must migrate all editor, save, preview, print and PDF
consumers together so that split data cannot leave partial rendering or
validation behavior. Task017 also adds production UI error/retry coverage and
proves that loading catalogue summaries does not rebuild an unchanged graph.

## Recovery

Raw build and browser evidence remain in ignored unique `task016-build-v1` and
`task016-browser-v1` paths. Publication review scanned the complete three-file
source set with zero findings. Source checkpoint
`5899503f4953c7ea9b8cd63fb5399c36a333279c` was pushed and matched the exact
remote branch SHA.
