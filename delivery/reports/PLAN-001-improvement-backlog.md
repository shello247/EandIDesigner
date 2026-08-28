# Drawing performance — proposed implementation backlog

These are recommendations, **not implemented changes**. They retain SQLite, single-editor semantics, canonical engineering identities and the shared renderer. No authentication, tenancy, collaborative editing, AI, analysis interface, approval feature or database-provider migration is included.

Evidence belongs to run `20260826-baseline`; see the assessment and reproduction guide. Estimates are engineering effort, not elapsed promises. Split work into reviewable 30–90-minute changes with tests. Performance gains remain unmeasured until an implementation is compared against the frozen baseline.

## Recommended order

| Order | Item | Priority | Effort | Dependency / principal risk |
|---|---|---|---|---|
| 1 | PF-01 Reliable regression gates and hydration diagnosis | P1 | 6–10 hours | Establish trustworthy failures before optimization |
| 2 | PF-02 Do not mount the closed Wire Catalog dialog | P1 | 1–2 hours | Preserve first-open loading and focus behaviour |
| 3 | PF-03 Stable engineering snapshot for selection-only changes | P1 | 3–5 hours | Exact invalidation; never reuse stale engineering data |
| 4 | PF-04 Electrical-network endpoint and ordering costs | P1 | 4–8 hours | Preserve endpoint and natural-order semantics |
| 5 | PF-05 Reduce repeated model normalization/source adaptation | P1 | 4–8 hours | Asset reconciliation and derived wire labels |
| 6 | PF-06 Complete pinned dependency closure, then split catalogue loading | P1 | 6–12 hours | Generated modules and structured/nested components |
| 7 | PF-07 Lightweight, paginated drawing summaries | P1 | 4–8 hours plus storage decision | Exact sheet counts and cache/summary consistency |
| 8 | PF-08 Smaller save acknowledgment and controlled prefetch invalidation | P2 | 4–8 hours | Revision conflicts and navigation freshness |
| 9 | PF-09 Shared export preparation and deployable PDF runtime | P2 | 4–8 hours | Output parity and browser cleanup |
| 10 | PF-10 Incremental module-boundary improvements | P2 | 6–12 hours, alongside the above | Avoid a large rewrite or circular barrel imports |
| 11 | PF-11 Accurate performance metrics and serial regression checks | P1 enabler | 3–6 hours | Do not change thresholds to manufacture passes |

PF-11 measurement changes should accompany PF-01–03; its numbering is not a reason to postpone measurement. No evidence supports prioritizing a memory-leak rewrite or database-provider change in this pass.

## PF-01 — Regression gates and hydration

- **Workflow / evidence:** reproduced production hydration errors in `drawing-panel-assignment.spec.ts`, three React #418 events per run, even though ownership/representation assertions finish. Four other original failures came from stale Sheet Loader/category/collapsible-section locators; all four pass after audit-only locator adaptation. Standalone TypeScript exposes 39 pre-existing test diagnostics not caught by the production build.
- **Reproduction:** original `e2e-baseline` and `e2e-adapted-v2` results/traces; `harness-typecheck` logs. Use synthetic structured-strip fixtures on port 3100, not the user's package.
- **Cause / code:** hydration root cause remains unverified. Inspect deterministic server/client generated SVG/IDs and initial state around `drawing-canvas-shell.tsx`, `drawing-generated-symbols.ts` and `svg-drawing-surface.tsx`. Next's type-check runner filters test files; current test files therefore need their own gate.
- **Smallest change:** first reproduce the hydration mismatch with useful server/client diagnostics, fix only the established cause, refresh stale test navigation without weakening engineering assertions, and correct the existing test typing errors.
- **Expected benefit:** trustworthy release checks and removal of hydration recovery work; latency benefit not yet quantified.
- **Acceptance:** original scoped 524-test suite passes; affected browser workflows pass with `pageErrors=[]`; standalone source/test type checks pass; save/reload and terminal identities remain unchanged. Keep the original failed evidence for comparison.

## PF-02 — Closed Wire Catalog loading overlay

- **Workflow / evidence:** reproduced initial blocking “Loading Wire Catalog” overlay while the dialog is closed; retained first-run screenshot. Code confirms an unconditional dynamic-dialog mount.
- **Reproduction:** fresh context, `/drawings/audit_mixed_10`; compare canvas visibility with actual usable readiness. See `audit_mixed_10-baseline.png` and baseline-v2 readiness logic.
- **Cause / code:** `drawing-canvas-shell.tsx`, dynamic `WireCatalogManager` loading fallback and unconditional mount near line 4701. Other dialogs already mount conditionally.
- **Smallest change:** use the established conditional-mount pattern for this dialog. Do not remove the useful loading indicator when the user actually opens it.
- **Expected benefit:** avoids fetching/mounting a closed dialog on initial open and removes an unrelated blocking overlay. Exact milliseconds saved are unmeasured.
- **Risk / acceptance:** first-open load, empty/error states, close/reopen, keyboard focus and catalogue editing must work; no overlay when closed; repeat ten fresh contexts and compare resource bytes/readiness.

## PF-03 — Selection should not rebuild unchanged engineering state

- **Workflow / evidence:** measured alternating equipment selections rebuild the graph, electrical-network index, placement-wire context and connected-schedule projection despite no model edit. Source adaptation is already memoized and is not repeated by selection.
- **Reproduction:** `browser-baseline-v2.json` selection samples, `browser-diagnostic.json` invocation counts, browser CPU profile. Baseline selection p95 is 131 ms on the 40-sheet fixture.
- **Cause / code:** shell `panelEngineeringSnapshot` memo includes `selectedPlacementId`, presentation conditions and revision dependencies. A new graph object invalidates dependent projections and SVG preparation.
- **Smallest change:** separate “engineering state is needed” from the cache identity of that state. Cache the graph/snapshot by validated source/engineering revision, derive the selected view from it, and retain lazy first construction where useful.
- **Expected benefit:** remove one unnecessary graph/index/context/schedule pass per selection; whole-interaction gain is not yet measured. Avoid claiming that inclusive function timings can be added together.
- **Risk / acceptance:** change wires, terminal mappings, component selections, topology, tags and display modes and verify immediate correct invalidation; selecting/deselecting or collapsing a local card must not rebuild the graph for unchanged source. Compare all graph outputs, schedules, occupancy and SVGs; rerun 30 selections and sheet switches at 40/120 sheets.

## PF-04 — Electrical-network lookup indexes and ordering

- **Workflow / evidence:** measured source-only 120-sheet network indexing p95 around 441 ms; validated graph p95 around 693 ms. Code uses repeated materialization/search of terminal and external-termination collections inside endpoint/topology loops.
- **Reproduction:** `cpu-metrics.json`, `source-only-fixture.json`, `source120.cpuprofile`. Keep this fixture separate from the drawable 120-sheet model.
- **Cause / code:** `electrical-network-index.ts`, `resolveEndpointNodeId` and topology-terminal resolution; `connectivity-graph.ts` builds the index. The retained Node CPU profile also places repeated `naturalCompare` calls among the largest self-time consumers (about 1.7 seconds across its listed entries); this helper calls `localeCompare` with numeric options on every comparison.
- **Smallest change:** construct explicit endpoint/terminal lookup maps once per graph/index build and reuse them. Separately benchmark reuse of an equivalent numeric collator and removal of redundant sorts. Preserve current first-match, unresolved, bridge, bond, factory-continuity, numeric/case/locale ordering and tie-breaking semantics.
- **Expected benefit:** reduce repeated scans and temporary allocations; magnitude must be measured after implementation. This is not a proposal to remove engineering connectivity because its UI card was removed.
- **Risk / acceptance:** high semantic sensitivity. Deep-compare complete graph/index results on ordinary, ambiguous, missing-anchor, bridge/bond, sided and single-sided fixtures; retain electrical-network tests. Run five warmups/thirty samples against the unchanged 100 ms source/connectivity budget.

## PF-05 — Repeated source adaptation during small edits

- **Workflow / evidence:** measured full-package adaptation and normalization costs; 120-sheet source adaptation p95 around 581 ms in the CPU batch. The edit path normalizes/reconciles and adapts source to derive wire identities, then the memoized source path adapts the new model again.
- **Reproduction:** CPU adapter/reconcile/parse/stringify metrics; diagnostic title, nudge, geometry and display-mode counts. Baseline 40-sheet title-edit p95 is 602 ms and nudge p95 540 ms, including UI settling.
- **Cause / code:** shell `normalizeCanvasModel`, `commitModel`, `panelWiringSource` and save handler; `drawing-panel-wiring-source.ts`; asset reconciliation use cases.
- **Smallest change:** first share a single normalized result/derived source within a committed revision. Then classify genuinely presentation-only commands where safe; keep validation at untrusted input and persistence boundaries.
- **Expected benefit:** eliminate demonstrably duplicate passes, not engineering validation. No precise speedup estimate yet.
- **Risk / acceptance:** a tag edit can affect derived wire labels while a title edit may not; do not assume all text edits are equivalent. Verify identity, canonical wire IDs, source references, mappings, copy/paste and save/reload. Gestures still commit one history entry; rapid same-field edits retain intentional 900 ms history coalescing; pointer movement still makes no network requests.

## PF-06 — Pinned dependency closure before catalogue reduction

- **Workflow / evidence:** measured catalogue growth from 94,550 to 2,850,875 returned JSON bytes when synthetic catalogue size grows 25→1,000 with one referenced version. A pure-service probe reproduces omission of a generated terminal module's pinned `moduleTemplate.versionId`; supplying the omitted version changes its SVG.
- **Reproduction:** SQLite catalogue samples and `pinned-module-dependency-probe.json`; source fixture is validated. The pinned-module result is not a reproduction against a saved user package.
- **Cause / code:** `drawing-symbol-version-references.ts` collects placement, component-selection and structured-member versions but omits generated module templates; `symbol_registry/data/queries.ts` loads latest approved catalogue content plus collected pinned versions; generated-terminal module resolver requires the exact template version.
- **Smallest change:** add a tested dependency-closure service for all render-relevant references. Separate the editor's required pinned render bundle from searchable/selectable library summaries and load full unused SVG/metadata only when needed.
- **Expected benefit:** avoid transferring and processing unrelated symbol payloads; the exact reduction depends on real library artwork. Correct dependency closure is a prerequisite, not an optional follow-up.
- **Risk / acceptance:** old approved versions, generated module templates on both asset and placement, nested component selections, structured strip members, unplaced managed assets and shared occurrences must resolve correctly. Compare edit/preview/print/PDF output, save validation and symbol insertion. Repeat catalogue scaling with fixed referenced symbols; no missing-version fallback may be introduced by the optimization.

## PF-07 — Drawing-list summaries and pagination

- **Workflow / evidence:** measured 10/100/500-package list medians about 39/437/3,228 ms. At 500 packages one list operation reads 41.2 MB of stored document JSON to return about 63.8 KB of summaries; SQL median is 117.5 ms.
- **Reproduction:** corrected `sqlite-metrics.json`, query fingerprints and query plans. All packages are equal 10-sheet synthetic models.
- **Cause / code:** `drawing_canvas/data/queries.ts:listDrawings` reads and parses every non-archived `modelJson` to derive sheet counts; `app/drawings/page.tsx` has no paging boundary. Existing updated-time index is used; this is not an N+1 query finding.
- **Smallest change:** design a lightweight summary projection and bounded pagination. Decide explicitly between transactionally maintained summary fields and a revision-keyed summary cache. A persisted sheet-count column would require a separately approved SQLite schema/data-backfill change; no such migration is included in this audit.
- **Expected benefit:** remove full-document reads/normalization from ordinary listing; exact response-time improvement unmeasured.
- **Risk / acceptance:** sheet counts remain correct after create, import, add/remove/reorder, save and archive; stable ordering/page boundaries; no stale summaries after failed saves. Repeat 10/100/500-package SQL and end-to-end browser listing, including bytes and query plans.

## PF-08 — Save response and background request fan-out

- **Workflow / evidence:** baseline 40-sheet save acknowledgment median 480 ms, p95 785 ms. Thirty saves produced 30 drawing POSTs plus 400 observed GETs to sidebar destinations; these are not 430 drawing writes. The direct save mutation returns approximately 182 KB although the editor primarily consumes the updated revision timestamp. Five diagnostic browser saves each sent 203,977 body bytes and received 464,541 decoded response bytes, including framework response overhead.
- **Reproduction:** baseline save request arrays, correlated save-payload probe, server diagnostic request records, direct mutation SQL samples.
- **Cause / code:** `saveDrawingAction` returns full `DrawingDetail` after symbol validation/update/reread and revalidates `/drawings`; shell save handler consumes acknowledgment/revision; shared navigation prefetch interacts with invalidation. The precise cause of repeated GET counts requires a focused framework/cache trace, not an assumption that every GET executes a new SQL query.
- **Smallest change:** audit all action callers before introducing a minimal save acknowledgment. Independently constrain unnecessary sidebar prefetch/invalidation work while preserving fresh drawing lists and responsive navigation.
- **Expected benefit:** fewer response bytes and unnecessary background requests; measured end-to-end benefit pending. Preserve the existing protection against revalidating the active editor route during save.
- **Risk / acceptance:** retain save-conflict/error semantics, revision handling, dirty-state behavior, unsaved changes, reload equivalence and list freshness. Repeat thirty saves, compare POST/GET counts separately from SQL counts and check follow-on navigation latency. No concurrent-editor feature work.

## PF-09 — Shared export preparation and PDF deployment

- **Workflow / evidence:** baseline PDFs all succeeded: medians 3.70/7.19/16.28 seconds for 10/40/120 sheets; five observations each. Print/PDF routes repeat source/graph/projection preparation while already sharing the SVG renderer. Each PDF request launches and closes Chromium.
- **Reproduction:** individual baseline PDF samples, diagnostic stage log, representative PDFs/PNGs, print HTML and PDF QA output. Use text/page-size/layout parity, not binary PDF equality alone.
- **Cause / code:** `app/drawings/[id]/print/route.ts`, `pdf/route.ts`, `drawing-pdf-export.ts`; explicit per-request Chromium lifecycle. `playwright` is reached through a development test dependency in the current package manifest, so production-only packaging needs verification.
- **Smallest change:** extract one immutable saved-package export-preparation service with equivalent inputs/outputs and reuse validated source where safe. Add a deployment smoke test for browser executable availability, runtime dependencies, memory and cleanup. Optimize specific measured stages before considering a different export architecture.
- **Expected benefit:** fewer repeated preparation paths and safer maintenance; export speedup remains unmeasured. Do not treat Chromium startup as the whole 120-sheet cost or promise a worker/pool redesign.
- **Risk / acceptance:** exact page count/order, labels, wire identities, schedules, generated geometry and print sizing; five sequential exports per size; no remaining browser processes after cleanup. No concurrent-export load test in this pass.
- **Additional QA follow-up:** pypdf extracts some schedule/stub punctuation as private-use codepoints even though rendered labels look correct. Verify literal wire-ID search/copy in real PDF viewers before diagnosing a font/ToUnicode defect; do not silently normalize the extraction result and call it a pass. The second text extractor was unavailable in the bundled tools. This is a compatibility investigation, not a proven performance cause.

## PF-10 — Modularize along existing responsibilities

- **Workflow / evidence:** static inventory: 246 drawing production files, 68,778 lines, 178 explicit cross-feature imports, 37 runtime imports outside the chosen public-boundary convention. Largest orchestrators include a 5,283-line shell, 3,910-line inspector and 2,590-line SVG surface.
- **Reproduction:** `modularity.json`. Counts describe the source, not automatically defects or measured latency.
- **Cause / code:** shell combines history/commands, engineering derivations, dialogs and navigation; inspector combines many domain editors. Some deep imports deliberately reuse good pure services.
- **Smallest change:** extract revision-scoped engineering selectors, command/history orchestration and export preparation when touching those areas for measured improvements. Keep leaf services pure and contracts explicit; add import-boundary checks only after documenting intended exceptions.
- **Expected benefit:** easier targeted testing and safer invalidation changes; no direct speedup claimed for file splitting alone.
- **Risk / acceptance:** no circular imports, accidental server code in client bundles, changed history semantics or changed public drawing contracts. Keep existing feature/data/logic/UI boundaries and rendering parity tests. Do not introduce a new state library or rewrite the canvas.

## PF-11 — Metrics that measure what engineers experience

- **Workflow / evidence:** code-derived metric gap: `canvas.sheet-load` ends at a state setter, while actual 40-sheet click-to-settled sheet p95 is 388 ms against the existing 250 ms budget. Gesture-preview function time is not full frame latency.
- **Reproduction:** baseline-v2 sheet samples, diagnostic operation/frame/long-task samples, `drawing-performance-diagnostics.ts` and the shell's sheet-load handler.
- **Smallest change:** retain the cheap internal stage metrics but add explicit commit/paint boundaries and revision/action correlation. Add a stable serial CI benchmark job, standalone test type checking and a small drawing-browser gate; keep large/local benchmarks separate from noisy parallel CI jobs.
- **Expected benefit:** detect regressions and prevent misleading “green” performance claims; not itself a speed optimization.
- **Risk / acceptance:** bounded diagnostics, disabled by default, no document/SQL parameter logging, observer-overhead comparison, exact source/fixture fingerprints. Existing 100/100/250/16.7 ms and 12-SVG budgets are unchanged. Agree new loading/save/PDF budgets prospectively for named hardware/fixtures; never derive a pass threshold after seeing a result.

## Work not justified by this evidence

No confirmed unbounded preview mounting, sustained UI DOM/listener leak, per-pointer database request, duplicated saved engineering data, or general N+1 list-query pattern was found in the measured workloads. Preserve the bounded preview cache, transient gesture drafts, single gesture history commit, fifty-entry history limit, intentional asset occurrences, batched queries and shared SVG renderer.

This backlog prepares the drawing core for a later cloud-readiness effort. It does not certify multi-user production operation while access control, tenancy, concurrency and deployment capacity remain explicitly deferred.
