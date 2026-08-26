# PLAN-002-TASK-017 — Drawing consumer catalogue migration report

Start: 2026-08-26 16:30 America/Port_of_Spain

End: 2026-08-26 17:07 America/Port_of_Spain

Duration: approximately 37 minutes

## Result

All drawing edit, save-validation, preview, print, PDF, panel-report, symbol-insertion, asset-manager, and structured-terminal consumers now separate immutable drawing render dependencies from lightweight catalogue summaries. Exact pinned versions remain authoritative; generated pseudo-version identifiers never reach persistence queries; recursive component dependencies are loaded atomically and failures never partially mutate the drawing.

The editor's engineering preparation depends only on full records referenced by the model. Browsing or loading an unrelated catalogue item therefore does not rebuild the engineering graph. No schema, migration, dependency, saved-model format, wire identity, terminal identity, or historical-version fallback changed.

## Files and boundaries

- Drawing entry, output, and validation consumers: `src/app/drawings/[id]/**`, `src/features/drawing_canvas/api/actions.ts`, and `src/features/drawing_panel_reports/data/queries.ts`.
- Catalogue loading and dependency closure: `drawing-symbol-catalog-loader.ts`, `drawing-symbol-version-references.ts`, and `symbol-library-context.ts`.
- Editor/library/asset-manager integration: `drawing-canvas-shell.tsx`, `symbol-library-panel.tsx`, and `asset-manager-dialog.tsx`.
- Contracts, documentation, unit tests, production browser tests, and catalogue payload diagnostics were updated with the implementation.

## Correctness evidence

- Test-first recursive-closure cases initially failed because the closure loader did not exist, then passed after implementation.
- Focused final result: 4 files, 20 tests passed.
- Full unit result: 128 files, 750 tests passed.
- Lint and standalone application-plus-test type-check passed.
- Guarded production build `task017-build-v2` passed with source fingerprint `30fee2f23a1226bb0f2c2f8502695758def0757e07ca45b76cffc66c06a6af79` and build ID `FFo3-eT2MIHna0H4qv_n3`; source drift was false.
- Complete local production drawing gate: 28/28 workflows passed with one worker and no retries (`task017-stage4-browser-v1`).
- Final dependency-key rerun passed the catalogue diagnostic plus drawing-canvas, terminal-block-group, and PDF-preview workflows.
- Asset Manager exact-load workflow passed after correcting a test assertion to inspect the actual selector value rather than text the UI does not display.
- GitHub CI run `33013450318` passed lint, types, 750 units, isolated audit contracts, synthetic bootstrap, production build, and the full production drawing browser gate for exact source SHA `25bc359e183329ed07217d946ea127feada3d9c9`.

Retained negative evidence: the first diagnostic fixture used a panel-layout-capable synthetic symbol and correctly entered the backplane workflow instead of direct insertion. The fixture was corrected to wiring usage. An intermediate Asset Manager assertion expected a symbol name in a pane that intentionally does not render it; the engineering assertion was moved to the selector rather than weakening creation checks.

## Measurements

Initial document response with one referenced exact symbol:

| Unused catalogue size | Candidate response | Unused SVG present | Unused summary present |
|---:|---:|---|---|
| 25 | 238,226 bytes | no | yes |
| 250 | 361,301 bytes | no | yes |
| 1,000 | 771,551 bytes | no | yes |

Task 015 measured the legacy 1,000-record full-catalogue JSON query at 2,850,875 bytes. That figure and the candidate whole-document response are different measurement layers, so no false percentage comparison is claimed. The result proves that unused full SVG records no longer enlarge the initial full-symbol bundle; lightweight summaries intentionally still scale with catalogue size.

Selecting one previously unloaded wiring symbol caused one exact-load POST and zero source adaptations, graph builds, placement projections, or schedule projections. It caused one SVG preparation (0.9 ms). Diagnostic settled time was 331.1 ms and is retained as an unbudgeted first-load observation, not presented as a warm-interaction pass.

## Recovery and risks

- Source checkpoint: `25bc359e183329ed07217d946ea127feada3d9c9`, publication-reviewed, pushed, and exact remote branch SHA verified.
- Verified-stage tag: `drawing-perf-pass-1-stage-4-20260826`, annotated tag peeled and remotely verified to the source checkpoint.
- Remaining catalogue cost is the deliberate all-summary response and server metadata preparation, particularly at 1,000 records.
- First lazy loads include a Server Action round trip; in-flight deduplication and immutable success caching are present, but this is not claimed to meet a warm budget.
- Drawing-list work is still unbounded and belongs to Task 018. Unrelated route prefetch remains visible and belongs to Task 020.
