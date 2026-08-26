# PLAN-002-TASK-020 — Drawing-scoped prefetch and save transport report

Start: 2026-08-26 17:40 America/Port_of_Spain

End: 2026-08-26 18:00 America/Port_of_Spain

Duration: approximately 20 minutes

## Result

Automatic sidebar prefetch is now disabled only while a concrete drawing editor route is active. Explicit navigation remains unchanged. This prevents unrelated Symbols, Networking, and BOM destinations from issuing background React Server Component requests while an engineer opens or saves a drawing.

Normal save no longer calls `revalidatePath("/drawings")`. The drawing list is force-dynamic and the editor-scoped navigation policy prevents a stale prefetched copy, so an explicit visit queries current SQLite state. The browser test renames the 40-sheet fixture, saves it, follows the Drawings link, observes the new title, reopens the drawing, and observes the same title in the editor.

The transport probe uses Chromium network-protocol byte events because React Server Action streams do not provide a reliable Playwright `response.finished()` boundary after React has consumed the acknowledgment. Measurements are correlated to the action request, the visible saved acknowledgment, and a stable-byte window. Both decoded response-body bytes and encoded transfer bytes are retained.

## Verification

- Eight policy contracts pass: concrete editor routes disable prefetch; drawing list/new and all ordinary application routes retain the framework default.
- Dedicated production transport workflow passed with five warmups and 30 measured saves, plus fresh explicit list/editor navigation.
- Full result: 130 unit files and 770 tests passed.
- Full lint, standalone application-plus-test type-check, and guarded production build passed.
- Complete local production drawing gate: 30/30 workflows passed, one worker, no retries.
- GitHub CI `33017558582` passed audit, lint, types, 770 units, isolated audit contracts, synthetic bootstrap, build, and all 30 production workflows for exact source SHA `e8b406811a9dffa666a9bb9a10c569ab5d4dfd01`.

Retained negative evidence:

- Baseline correctly failed with ten unrelated load prefetches and 226 unrelated requests across the measured saves.
- Candidate v1 called `response.body()` before Chromium exposed the stream body and failed with `Protocol error: No data found`.
- Candidate v2 used `response.finished()` and timed out after the UI had already acknowledged the save, proving that API was not a valid Server Action completion boundary.
- Candidate v3 was intentionally interrupted after reproducing the same invalid wait against the no-revalidation product candidate; the probe was corrected rather than the application being changed to satisfy it.

## Measurements

Same production build method, guarded 40-sheet fixture, five warmups and 30 samples:

| Complete editor save | Median | p95 | Decoded response | Encoded transfer | Save request records | Unrelated records |
|---|---:|---:|---:|---:|---:|---:|
| Stage 5/Task 019 predecessor | 254.49 ms | 298.87 ms | 212,609 bytes | not captured | 311 | 226 |
| Stage 6 candidate | 215.52 ms | 245.43 ms | 150 bytes | 186-byte median | 30 | 0 |

The request body remains 204,041 bytes because the saved drawing model is intentionally unchanged. The response-body reduction is approximately 99.93%; median elapsed time improved approximately 15%, and p95 approximately 18%. These values include the complete client-visible save transition and do not substitute the earlier mutation-only timing.

## Recovery and risks

- Source checkpoint `e8b406811a9dffa666a9bb9a10c569ab5d4dfd01` was publication-reviewed, pushed, exact remote branch SHA verified, and clean-checkout CI verified.
- Annotated tag `drawing-perf-pass-1-stage-6-20260826` is remotely verified and peels to that exact source.
- Prefetch remains enabled everywhere except concrete drawing editor routes, preserving normal behavior elsewhere.
- Explicit drawing-list navigation is the freshness boundary; future changes that make the list static must add an appropriate invalidation strategy.
- Port 3000, the canonical database, the original worktree, drawing JSON, save-conflict semantics, and application dependencies remain unchanged.
