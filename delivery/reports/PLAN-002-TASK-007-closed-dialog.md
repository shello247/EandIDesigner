# PLAN-002-TASK-007 — On-demand Wire Catalog mounting

Start: 2026-08-26 14:23 America/Port_of_Spain
End: 2026-08-26 14:32 America/Port_of_Spain
Duration: approx 9m
Status: done

## Change and compatibility

The drawing shell delays the dynamic Wire Catalog component's first mount until one of its three existing entry points requests it. After first use the component instance remains available with `open=false`, preserving its existing unsaved draft and validation message on close/reopen. Its closed return is null and its keyboard listener is removed. This intentionally uses a first-request latch rather than unmounting and silently discarding drafts on every close. No new application dependency or engineering-data change.

The existing local-dialog focus-return helper now applies to Wire Catalog. The workbench's collapsing More menu focuses its visible summary before opening the catalog so closing does not attempt to focus a hidden menu item. The manager's loading component, handled server errors and retry behavior remain unchanged.

Files: drawing-canvas-shell.tsx; drawing_panel_wiring/panel-discovery-dialog.tsx; tests/e2e/drawing-panel-internal-wiring.spec.ts; this report/task/state.

## Evidence and reproduction

Predecessor: Stage1 tagged code `c63a0ef5db295103a2d0a9ecc9f9e161aacb9b83`, documentation `07387b294f9e897571bb4d86d4731691471525fd`; both remotely verified.

New production regression test resolves the actual catalog JavaScript chunk from build content, then holds its request. It asserts the unopened catalog has no request/loading overlay, checks loading only after the user's request, releases the chunk, preserves an unsaved draft across close/reopen, verifies focus restoration, creates a synthetic specification, exercises a duplicate-name validation failure and successful retry, and closes by Escape. Existing internal wire/route-only removal/occupancy/restore/save/reload assertions remain unchanged.

`task007-unopened-red`: fails on predecessor production build `mH-0YXKpCcYOFUWsqFWqh`, exactly because the unopened loading overlay count is1 rather than0. Trace retained. Test-source fingerprint `b3bc900bfa8bd43c3b4d71b7e2f11d6bcc220ab0ac95027313ce8c39375ceb7e`; no drift. No artificial timing threshold is introduced; held-download test measures the structural request/overlay invariant.

`task007-candidate`:14focused catalog/CI-contract unit tests, full typecheck and full lint pass; production build/browser acceptance pending. Candidate fingerprint `d83b8f8435fad995da823a84eb5afd2e3e06f1afc7df895a5ede72b9355defdf`.

Commands: unique `AUDIT_PHASE`, guarded `run-command.mjs` focused Vitest/types/lint/build, then `npm run test:drawing -- drawing-panel-internal-wiring.spec.ts`. All writes target the guarded synthetic database; original source/port3000 remain outside testing.

## Limits

First candidate browser attempt (`task007-browser-01`) found that holding the catalog-containing chunk also held initial hydration: the manager and always-used picker were grouped through their shared public barrel. The pre-hydration sheet-loader click therefore did not open the dialog. The unchanged full internal-wire workflow passed. Revised request observation lets initial loading complete, then delays the actual first-open request; `task007-browser-02` confirms the candidate still downloaded the catalog chunk before use. Both failures are preserved, not treated as passing retries.

Build manifest confirms `2h3-c2_622amd.js` (manager content) was an initial shell dependency. The lazy import now names the manager component directly, matching the existing Asset Manager import pattern; other consumers/public exports remain unchanged. This separates the lazy boundary from the static picker import, rather than weakening the no-initial-request assertion.

This removes unwanted initial module loading and its blocking overlay; it does not yet narrow the initial wire catalog data query. Chunk-download transport failure behavior is unchanged; tested retry is the existing handled server-validation path. No arbitrary promise-error suppression or broad error-boundary redesign. CPU/loading-time savings require later repeated measurements; no milliseconds improvement is claimed here.

## Final verification

`task007-escape-red`:2new component tests both fail before the modal owns Escape, reproducing workbench dismissal. Final focused batch:8catalog/component tests pass. Full typecheck, full lint and production build pass. Build manifest now separates the catalog manager into its own lazy chunk. `task007-browser-05`: both production workflows pass in13.7s—new held-chunk request/overlay/draft/focus/error/retry/Escape coverage and the unchanged full internal-wire engineering workflow. One worker, zero retries, no page errors, no source drift. Final fingerprint `816fd8c9f38d97f05e86fbe88e222017c2aa7730a56243e6718f4b15a7a2c4f8`, browser build `vDMLRFtpOWf2OGlrTK227`. Original audited source matches at18:31:00Z; only live port3000 remains after managed server closure.

GitHub checkpoint: pending publication line replaced after exact remote verification. The passing documentation-only CI for `07387b294f9e897571bb4d86d4731691471525fd` is retained but does not test this later source change. Stage2 remains open through Task008.
