# PLAN-002 — Final drawing performance assessment

Completed 26 August 2026. Evidence timestamps are UTC; task summaries use America/Port_of_Spain.

## Executive outcome

The drawing core is materially faster, more predictable, and better protected by release verification than the audited starting point. The work was completed through small checkpoints without changing engineering identities, drawing JSON, terminal or wire records, SQLite schema/provider, save-conflict semantics, or the established drawing experience.

The strongest user-visible results on the representative 40-sheet package are:

| Workflow | Frozen baseline median / p95 | Final median / p95 |
|---|---:|---:|
| Select equipment | 90.90 / 131.10 ms | 46.60 / 54.80 ms |
| Switch sheet | 223.20 / 387.80 ms | 94.75 / 129.60 ms |
| Open/collapse Properties | 61.60 / 170.10 ms | 34.20 / 35.40 ms |
| Nudge equipment | 319.70 / 539.60 ms | 133.80 / 147.70 ms |
| Save | 485.80 / 784.60 ms | 151.00 / 173.30 ms |
| Change connection display | 367.04 / 482.10 ms | 183.87 / 207.88 ms |

Warm sheet switching now passes the existing 250 ms p95 budget. Internal gesture-preview work passes the 16.7 ms p95 budget at 0.10 ms; every completed gesture still creates one history commit and pointer movement makes no database request.

This is a verified single-editor drawing-core improvement, not cloud multi-user certification. Access control, concurrent editing, managed PostgreSQL, deployment capacity, and AI remain separate programmes as explicitly agreed.

## Improvements delivered

1. **Trustworthy verification.** Hydration mismatch fixed at its demonstrated source; stale browser locators and 39 test-type diagnostics corrected; production drawing CI now runs lint, standalone types, units, guarded bootstrap/build, Chromium, and serial browser workflows without hidden retries.
2. **Lower unopened-interface work.** Wire Catalog mounts only when requested with first-open, retry, focus-return, and reopen behavior preserved.
3. **Accurate measurements.** Bounded disabled-default action/revision counters separate internal calculation, settled interaction, rendering, requests, and history commits.
4. **Stable engineering computation.** Presentation changes reuse one engineering snapshot; endpoint resolution, topology lookup, numeric ordering, normalized source preparation, exact symbol indexes, and generated rendering avoid repeated whole-package work.
5. **Bounded history memory.** The final integrated test found and corrected history-retained derived graphs/render bundles. Forced-GC heap remains near 22 MB through 60 edits instead of reaching 135.30 MB.
6. **Drawing dependencies separated from catalogue browsing.** Exact pinned closure includes managed assets, component selections, structured strips, and module templates; generated pseudo IDs are excluded; immutable details load on demand with retry and no latest-version substitution.
7. **Bounded drawing list.** Exactly 25 documents are parsed per page. At 500 packages, median/p95 fell from 1,352.99/1,879.40 ms to 77.37/90.73 ms and response bytes from 63,781 to 3,267 without a migration.
8. **Compact save path.** Normal save returns the persisted `{id, updatedAt}` without a full-document reread. Save background navigation requests fell from 226 to zero across 30 measurements, and decoded response body from 212,609 to 150 bytes.
9. **Output compatibility.** Print HTML is byte-identical to baseline for 10/40/120 sheets; every PDF page text hash, page size, and order matches; nine representative pages are pixel-identical. PDF median improved about 40–42% across all sizes.

## Final verification state

- Product fingerprint for integrated acceptance: `528deaa754e93b5da5a1873ef3714c4febef4630821465902a2325b1a1eecb02`.
- 130 unit files and 771 tests pass.
- Full lint, standalone type-check, and guarded production build pass.
- Complete maintained production drawing browser gate passes 30/30, one worker, no retries.
- GitHub CI run `33020798725` passes exact Task 22 source `d93c29f2f782e2e93a4e9671082b5f04de62e4ae`.
- Twenty UI cycles, 50 undo/50 redo, save-in-flight, conflict, reload, internal/field wiring, schedules/continuations, hit testing, preview, print, and PDF checks pass.
- A detached recovery worktree restored exact `d93c29f…`, completed a clean `npm ci` with zero audit findings, bootstrapped a fresh guarded SQLite database, built, and passed create/save/reload in production mode.
- Original source manifest still matches; live port 3000 remains PID 31720; port 3100 is clear.

## Remaining risks and deferred work

| Risk / limitation | Current evidence and disposition |
|---|---|
| Combined validation + graph p95 | 108.27 ms in the designated source-only fixture, slightly above a strict combined 100 ms interpretation. Validated graph and electrical-network stages separately pass. Retain as a future narrow profiling target; no false pass. |
| Committed-gesture browser long tasks | Automated gestures still record roughly one rendering long task despite pointer-preview calculation passing. A later rendering/DOM pass may address it; no pointer-work regression is implied. |
| PDF copy/paste punctuation | Same private-use punctuation and non-contiguous literal wire-ID extraction as baseline. Expected route labels, page text hashes, and pixels match. Requires a separate font/text-layer change. |
| Synthetic fixture appearance | Some generic labels overlap by design. Pixel parity proves no regression; it does not certify the synthetic package as a polished issued drawing. |
| SQLite and single-editor operation | Intentionally retained. Managed PostgreSQL optimization, access control, tenancy, concurrent editing, and capacity tests are prerequisites for cloud multi-user production. |
| Deployment and observability | No production hosting, runtime alerting, backup/restore for the canonical database, or load testing was authorized in this pass. |

## Recommended next programme

Keep this branch as the reviewed recovery candidate. Make live promotion a separate decision through the authorized squash-PR workflow. After a stable acceptance period, the next production-readiness programme should address deployment architecture, access control/tenancy, managed PostgreSQL, canonical-data backup/recovery, operational telemetry, and capacity testing. Do not mix those concerns into the verified drawing-core checkpoint.

Detailed evidence: [Task 21 integrated measurements](PLAN-002-TASK-021-integrated-measurements.md), [Task 22 export parity](PLAN-002-TASK-022-export-parity.md), and [recovery map](PLAN-002-recovery-map.md).

