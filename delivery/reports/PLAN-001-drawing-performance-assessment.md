# Drawing performance investigation and evidence report

Run `20260826-baseline` · 26 August 2026 · UTC evidence, America/Port_of_Spain local summaries.

## Executive assessment

The drawing application has a useful, tested engineering foundation. The evidence supports **targeted improvements to repeated computation, payload boundaries and verification**, not a canvas rewrite or a database-provider change.

The most valuable next steps are:

1. Establish reliable release checks: resolve the reproduced production hydration error, refresh stale UI tests and correct test-code typing debt.
2. Stop rebuilding unchanged engineering graphs when equipment is selected; avoid adapting the same package twice during a small edit.
3. Address measured electrical-network ordering/lookup costs at large package sizes.
4. Complete pinned symbol dependency collection, then separate required drawing symbols from the unused catalogue.
5. Stop reading/parsing every complete drawing document merely to list packages; add a bounded summary/pagination path while retaining SQLite.
6. Reduce save-response/background-prefetch work and consolidate export preparation after the higher-value editor work.

The strongest measured examples are a **3.23-second median list operation for 500 small packages**, **2.85 MB of returned symbol data with only one referenced version**, and graph/context/schedule reconstruction on every measured equipment selection. The 40-sheet warm sheet-switch p95 was **388 ms**, above the existing 250 ms target. These are specific, reproducible opportunities.

Important strengths were confirmed: the engineering unit suite passes; gestures commit one history entry; dragging makes no network requests; preview mounting is bounded; repeated UI cycles did not demonstrate a sustained DOM/listener leak; and instrumentation preserved engineering output and print/PDF rendering.

**No optimization was implemented.** The investigation is complete with the limitations below. This is not a certification for multi-user cloud production: access control, tenancy, concurrent editing, provider migration and capacity testing remain explicitly deferred.

Related documents: [prioritized backlog](PLAN-001-improvement-backlog.md), [reproduction guide](PLAN-001-reproduction-guide.md), [execution-path map](PLAN-001-architecture-and-hypotheses.md). Raw evidence is under `artifacts/drawing-performance/20260826-baseline/` in the working repository; `derived-summary.json` and `derived-server-summary.json` summarize, but do not replace, the original samples. `scaling-charts.png` provides three measured scaling charts.

## 1. Scope, isolation and reproducibility

The audit covers existing drawing loading/listing, sheet/canvas operations, symbols/terminals/assets/Properties, wiring/schedules, save/history, preview/print/PDF, SQLite access, memory and module boundaries. No separate Networking/BOM workflows were exercised; requests to their navigation destinations were observed only as background work initiated while using drawings.

The dirty `codex/reliability-hardening` worktree was preserved. A detached linked audit worktree reproduced 655 eligible current source files, including uncommitted changes and deletions, rather than testing only the last commit. Environment files, secrets, databases, dependencies and generated output were excluded. Independent dependencies, Prisma client and production output were created there. All fixture writes and SQL reads used the uniquely named audit SQLite database; the canonical database was neither copied nor queried. Port 3100 was checked before each test-server launch; port 3000 was not stopped or replaced.

| Identity | Recorded value |
|---|---|
| Source commit plus dirty manifest | `cfe8897146f231fc49bd0bdfeb8d871762858087` + `source-manifest.json` |
| Source manifest SHA-256 | `3d6ecb492fdeacf98887a56db7bdff8277c35c5b2794a44a228666213fd9c845` |
| Baseline command path/hash digest | `1a5f07e57419ee1fb073e1edaba8a8008f142d58b7ab82e3e2042c14c53bcde4` |
| Diagnostic digest, including audit-only test adapters/hooks | `f861ca957a5a934557c82a9f21277d26e6c0a21286a581e4ef349a3619f5883f` |
| Baseline / diagnostic production build IDs | `nOja_jno1jqs91BH7GJot` / `LZign0llYm30eFx4v3kVn` |
| OS / hardware | Windows 10.0.26200 x64; i7-10710U; 12 logical CPUs; about 32 GiB RAM |
| Runtime | Node 24.11.1; Next 16.2.11; React 19.2.7; Prisma 6.19.3; SQLite 3.46.0; TypeScript 6.0.3 |
| Browser | Playwright 1.61.1; Chromium 149.0.7827.55; 1440×900 performance viewport |

The two baseline digest formats hash different manifest structures; they identify the same source. Per-file instrumentation/test-adapter manifests explain the diagnostic changes. Newer batch records include harness hashes and before/after source verification; earlier batches were checked before execution and at subsequent batch boundaries. Original source verification is retained separately.

Timed workloads ran serially, one browser worker, no automatic retries or concurrent audit builds/test suites. CPU/SQL/warm interaction batches use five warmups and thirty measured samples. Fresh-browser-context navigation uses ten observations, **not cold OS/database caches**. PDF export uses five sequential observations per size, with median/range and no p95. Percentiles are nearest rank; even-sample medians in this report are recomputed from raw samples as the average of the two middle observations.

The Delivery OS/Feature Cadence skills structured the audit tasks and evidence gates. The React/Next.js performance skill guided checks of serialization, memo invalidation and indexed lookups; these patterns were treated as hypotheses to verify, not automatic refactoring instructions. The PDF skill required rendered visual checks in addition to extracted-text comparisons.

The workstation and its live development application remained in use. Thermal/background conditions and OS caches were not controlled. Baseline and diagnostic runs are not mixed, and faster later diagnostic results are not presented as an optimization gain.

## 2. Fixture coverage

| Fixture | Sheets | Assets | Placements | Graphical routes | Canonical internal wires | Stored model bytes |
|---|---:|---:|---:|---:|---:|---:|
| Mixed small | 10 | 36 | 96 | 25 | 15 | 82,369 |
| Mixed representative | 40 | 120 | 360 | 100 | 50 | 304,420 |
| Mixed large, drawable | 120 | 360 | 1,080 | 300 | 150 | 916,712 |
| Dense sheet | 1 | 200 | 200 | 500 | 0 | 246,751 |

Mixed packages exercise field, physical-layout, detailed-wiring and connected-schedule sheets. Current factories and Zod schemas validate the models; additional checks enforce endpoint/anchor references and terminal capacity. The 10-sheet package intentionally ends mid four-sheet group, so not every canonical wire has a graphical representation.

The existing **source-only** 120-sheet engineering fixture has 500 assets, 1,000 occurrences, 2,000 connections, 2,000 terminals and 1,000 internal wires. It is not the drawable 120-sheet package. Catalogue sizes 25/250/1,000 synthetic symbols, plus unchanged seeded symbols, and list sizes 10/100/500 equal small packages were varied independently.

Hashes and complete fixture dimensions are in `fixtures.json` and `source-only-fixture.json`. SVG artwork is deliberately simple and synthetic, not manufacturer-grade imagery or a copy of the current WTP package. The layouts are workload fixtures, not polished issuing drawings; some deliberately generic auto-routes/labels overlap. Their unchanged appearance is a parity result, not a claim of professional layout quality.

## 3. Correctness and verification status

| Check | Outcome | Evidence / qualification |
|---|---|---|
| Drawing/engineering unit baseline | **89 files, 524 tests passed** | `unit-baseline.json`; same 524 pass after instrumentation in `unit-diagnostic.json` |
| Audit harness and pure output parity | **9 tests passed** | `harness-parity`; graph/source/context/SVG identical with diagnostics disabled/enabled |
| Original production browser suite | **22 passed, 5 failed** | `e2e-baseline.json` and retained traces; original failures not overwritten |
| Adapted stale-locator browser checks | **4 passed, 1 failed** | `e2e-adapted-v2.json`; only audit-copy navigation/category/section locators changed |
| Loading/editing benchmark | **3 benchmark tests passed** | baseline-v2 navigation, interactions and geometry/title tests; 30 samples/action |
| Undo-history limit | **Passed after harness correction** | 60 alternating-asset edits, 50 undo, extra undo unchanged, 50 redo; `browser-history-v3` |
| Diagnostic browser batch | **5 passed** | interactions, CPU profile, ABBA observer comparison, geometry and exports |
| Save-payload probe | **Passed, 5 observations** | `save-payload-probe` |
| Production build / full lint | **Passed on baseline** | retained build/lint logs; diagnostic production build also passes |
| Final audit tooling lint/type check | **Passed** | `final-tooling-lint`, `final-tooling-types` |
| Full standalone repository TypeScript check | **Failed: 39 existing test diagnostics** | `typecheck-final.log`; includes some unrelated test files, not newly introduced product errors |
| Export parity | **Passed within checked scope** | all print HTML identical; all PDF page counts/order/text/sizes match; 9 representative page pairs pixel-identical |

The remaining browser failure is **reproduced React hydration error #418** in panel ownership/layout→detail/save/reload. The ownership and representation assertions complete, but the test's `pageErrors=[]` assertion correctly fails with three events. Root cause is not established; do not waive the console error because the drawing appears usable.

The other original failures are stale tests for collapsed Sheet Loader sections, category-button accessible names, already-open category state and newly collapsed Asset Manager sections. Audit-only adaptations preserve all original engineering assertions. The first adaptation was incomplete and also remains in evidence. Removed interfaces were not restored.

The production build filters test-file TypeScript diagnostics; a passing build therefore does not prove the tests type-check. The full standalone check confirms the existing debt. Preview unit tests also emit existing `act(...)` environment warnings; these are retained, not hidden.

### Workflow coverage and gaps

| Included workflow | Evidence | Limitation |
|---|---|---|
| List / open package | SQL scaling, production navigation/resource samples | List scaling was measured at the query/use-case boundary, not 30 browser list-page loads |
| Select/deselect / Properties / sheets | Unit selection tests, browser selection/switch/card samples | Repeated card timing covers Asset Identity, not every Properties card independently |
| Move, rotate, resize | Unit geometry, 30 browser gestures each, commit/request counters | Repeated gestures use the 40-sheet fixture; dense-sheet gesture latency not separately benchmarked |
| Alignment/distribution | Existing production browser workflow and units pass | No dedicated repeated latency series |
| Copy/paste, annotations, labels, dimensions, guides | Clipboard/model/geometry units; label, guide, arrangement, rail/tray browser checks | No single browser scenario exhausts every annotation/dimension/copy combination |
| Panel layout / generated and structured terminals | Units plus adapted creation/reuse/mapping/member-attribute browser tests | Hydration failure remains; pinned old generated-module probe is pure-service only |
| Internal/field wiring and hit testing | Existing create/remove-route/occupancy/restore/save/reload, routing/segment/hit-test workflows pass | Detailed per-action CPU counts for new-wire authoring were not collected |
| Connection display / schedules / continuations | Four-mode browser agreement plus schedule/export/pagination/continuation tests | No benchmark of every continuation topology |
| Save / undo / redo / reload | 30 saves, original save-conflict units, history-limit browser test | Main save timing is 40 sheets, not a full size-by-size save matrix |
| Preview / print / PDF | 20 UI cycles, 10/40/120 export batches, parity checks | Preview/print first-entry timings are single observations per size; later-page scrolling latency not repeatedly timed |
| Memory / modularity | Post-GC browser samples, bounded preview unit, import inventory | No heap-retainer graph proof, long soak test or Chromium-child peak-RSS measurement |

## 4. Loading and payloads

| Fixture | Fresh-context median, n=10 | Warm reload median / p95, n=30 | Decoded HTML/RSC body | Compressed HTML body, last fresh sample | DOM nodes |
|---|---:|---:|---:|---:|---:|
| 10 sheets | 1,190 ms | 475 / 737 ms | 329,447 B | 25,522 B | 1,297 |
| 40 sheets | 1,502 ms | 767 / 967 ms | 483,408 B | 32,473 B | 1,297 |
| 120 sheets | 2,988 ms | 2,050 / 5,673 ms | 909,150 B | 51,300 B | 1,297 |
| Dense single sheet | 1,736 ms | 1,348 / 1,756 ms | 2,278,561 B | 108,908 B | 15,058 |

The initial encoded JavaScript resource bodies total approximately **471,823 bytes** in each last fresh-context sample; total encoded resources are about 526 KB. These are resource/body sizes, not all-inclusive network transfer totals. Dense-sheet HTML/DOM growth differs from package-size growth: 500 routes increase active-sheet markup dramatically, while the first sheet of each mixed package has the same density.

Readiness waits for canvas hydration, absence of lazy-loading overlays and two animation frames. It is a test heuristic, not a field INP measurement. The first harness exposed a closed Wire Catalog's blocking loading fallback: `WireCatalogManager` mounts unconditionally although `open=false`. A retained screenshot and the shell's mount/fallback code confirm this; actual time saved by conditional mounting has not been measured.

## 5. SQLite and JSON processing

Thirty measurements per operation, after five warmups. SQL event durations are integer milliseconds; **0 ms is quantized, not zero work**. Returned JSON sizes are decoded/minified result sizes, not stored pretty-printed model sizes or HTTP wire bytes.

| Operation | Total median / p95 | SQL median / p95 | Observed query count | Returned JSON |
|---|---:|---:|---:|---:|
| List 10 packages | 38.6 / 52.2 ms | 1 / 3 ms | 1 | 1,241 B |
| List 100 packages | 436.8 / 508.3 ms | 17.5 / 27 ms | 1–2 | 12,581 B |
| List 500 packages | 3,227.7 / 4,611.4 ms | 117.5 / 199 ms | 1–2 | 63,781 B |
| Catalogue +25 symbols, one reference | 6.7 / 8.3 ms | 0 / 0 ms | 3 | 94,550 B |
| Catalogue +250, one reference | 42.4 / 50.4 ms | 4.5 / 10 ms | 3–4 | 730,625 B |
| Catalogue +1,000, one reference | 232.9 / 377.4 ms | 25.5 / 39 ms | 4–5 | 2,850,875 B |
| Detail 10 sheets | 5.1 / 7.4 ms | 0 / 0 ms | 1 | 49,371 B |
| Detail 40 sheets | 14.7 / 17.7 ms | 0 / 1 ms | 1 | 182,083 B |
| Detail 120 sheets | 68.8 / 109.0 ms | 2 / 4 ms | 1 | 549,518 B |
| Detail dense sheet | 22.4 / 33.5 ms | 0 / 1 ms | 1 | 135,556 B |
| Save mutation, 40 sheets | 81.9 / 142.8 ms | 8 / 17 ms | 4 | 182,083 B |

At 500 packages the list reads **41,184,500 stored document bytes** to derive summaries. Code confirms full `modelJson` parsing for sheet counts. The query uses `Drawing_updatedAt_idx`; detail/revision-update plans use the ID index. A general N+1 list/detail query pattern was **not confirmed**. Counts include housekeeping and batched relation/chunk queries; they are not a query per rendered occurrence.

Catalogue overfetch **is confirmed**: latest approved full SVG/metadata is loaded regardless of the one referenced version. However, blindly narrowing the catalogue is unsafe. A validated synthetic probe shows that the dependency collector omits a generated terminal group's pinned `moduleTemplate.versionId`; its resolver succeeds only when that old version is supplied, and its SVG changes. This is a reproduced service-level compatibility gap, not evidence that the user's current terminal block is wrong.

The direct save-mutation benchmark excludes action-level symbol/configuration validation and network/UI work. The five correlated browser probes each sent **203,977 request bytes** and received **464,541 decoded response bytes**. Server response durations were 100.9–158.8 ms; request-scoped counters show one stringify and two model parses per POST. Async-local operation correlation worked, but Prisma query events did **not** retain request context (76 unassigned events); exact per-POST SQL attribution remains unavailable. Use the dedicated SQL benchmark for precise SQL counts, not a guessed allocation of those events.

Across thirty baseline saves, the browser observed **30 drawing POSTs plus 400 GETs** to `/symbols/new`, `/symbols`, `/drawings`, `/bom`, `/bom/items` and `/networking`. These are background navigation/prefetch requests, not 430 writes or proof of 430 SQL queries. Cache invalidation/prefetch fan-out needs focused diagnosis. The existing deliberate avoidance of active-editor route revalidation during save is worth preserving.

## 6. Canvas and engineering calculations

### Uninstrumented browser interaction baseline, 40 sheets

| Action, 30 observations | Median | p95 |
|---|---:|---:|
| Select equipment | 90.8 ms | 131.1 ms |
| Load another sheet, loader already open | 219.7 ms | 387.8 ms |
| Toggle Asset Identity | 61.5 ms | 170.1 ms |
| Keyboard nudge | 316.9 ms | 539.6 ms |
| Save to saved acknowledgment | 479.8 ms | 784.6 ms |
| Change connection-display mode, mixed modes | 366.8 ms | 482.1 ms |
| Move gesture, eight pointer steps | 622.1 ms | 940.8 ms |
| Resize gesture, eight steps | 379.7 ms | 512.0 ms |
| Rotate gesture, eight steps | 541.0 ms | 917.4 ms |
| Commit title edit | 320.9 ms | 602.1 ms |

Gesture values are whole scripted gestures plus settling, not per-frame work. Automation/assertion overhead is included. All measured selection, sheet, card, nudge, display and geometry actions made no network requests; saves are intentionally different.

### Diagnostic invalidation matrix

Counts describe the same fixture with hooks enabled, not baseline latency. Nested times are inclusive and must not be added together.

| Action | Source adaptations | Graph / electrical index | Wire context / schedule index | SVG generations | History entries |
|---|---:|---:|---:|---:|---:|
| Equipment selection | 0 | 1 / 1 | 1 / 1 | 4 | 0 |
| Sheet change | 0 | 1 / 1 | 1 / 1 | 1–4 | 0 |
| Asset Identity collapse/expand | 0 | 0 / 0 | 0 / 0 | usually 0, one observed transition 1 | 0 |
| Nudge | 2 | 1 / 1 | 1 / 1 | 2 | 1 |
| Display-mode change | 2 | 1 / 1 | 1 / 1 | 1–2 | 1 |
| Move/resize/rotate completion, including previews | 2 | 1 / 1 | 1 / 1 | 11–12 | **1** |
| Title edit | 2 | 1 / 1 | 1 / 1 | 2–3 | coalesced rapid same-field edits |

Selection performs 499 renderable-symbol lookups; nudge performs 3,188; title edits perform about 4,589–4,626. These are function invocations, not distinct assets, database reads or duplicated engineering records. Repeated lookups and whole-package adaptation are candidates for revision-scoped indexes, not evidence that every lookup is expensive.

The shell's graph memo depends on `selectedPlacementId`. Its normalization path adapts source to reconcile derived wire identities; the new model then invalidates the source memo, producing another adaptation. These causes are code-backed and confirmed by counts. By contrast, the measured local collapsed card does not rebuild the graph; a blanket claim that all collapsed cards are expensive is unsupported.

### CPU measurements: median / p95 milliseconds

| Stage | 10 drawable sheets | 40 drawable sheets | 120 drawable sheets | Dense sheet |
|---|---:|---:|---:|---:|
| Parse/normalize JSON | 3.4 / 5.6 | 9.3 / 16.4 | 32.4 / 44.9 | 8.8 / 21.7 |
| Stringify/normalize | 6.1 / 9.9 | 13.7 / 23.2 | 45.4 / 63.5 | 8.0 / 14.3 |
| Reconcile assets | 6.7 / 10.5 | 14.5 / 24.6 | 45.8 / 57.8 | 3.7 / 6.4 |
| Build validated source adapter | 20.7 / 37.0 | 68.5 / 89.6 | 327.6 / 581.4 | 95.1 / 131.3 |
| Graph from validated source | 11.5 / 18.8 | 36.1 / 48.7 | 247.5 / 490.5 | 76.9 / 202.5 |
| Connection-display projection | 1.7 / 2.8 | 6.1 / 12.7 | 26.9 / 33.2 | no relevant requests |
| Schedule projection | 0.5 / 1.1 | 2.0 / 4.6 | 18.7 / 33.0 | no schedules |
| First active-sheet SVG | 1.2 / 3.2 | 1.3 / 2.2 | 1.1 / 2.2 | 26.4 / 33.5 |

For the separate source-only fixture: validation+graph **564.6 / 1,228.4 ms**; validation **40.3 / 65.2**; validated graph **403.0 / 692.6**; electrical-network index **262.4 / 440.6**; connection-display projection **59.7 / 328.0**. The projection's high tail is retained; its exact cause was not isolated by a projection-specific profile.

The Node CPU profile identifies `naturalCompare` as a major self-time consumer, alongside `resolveEndpointNodeId`, network construction and garbage collection. The comparator repeatedly uses numeric `localeCompare`; endpoint/topology resolution repeatedly expands and searches collections. Equivalent reusable ordering and endpoint indexes are worth testing, with exact semantic parity. The browser profile is retained but production-minified function names limit direct attribution; explicit function counters provide the reliable mapping. Do not use profile self-time as an end-to-end speedup prediction.

### Existing budgets — unchanged

| Budget | Audit result |
|---|---|
| Source/connectivity 100 ms p95 | **Exceeded** on the source-only fixture; large drawable source/graph stages also individually exceed it |
| Connection display 100 ms p95 | Drawable 120-sheet projection passes at 33.2 ms; source-only fixture exceeds it at 328.0 ms |
| Warm sheet switch 250 ms p95 | **Exceeded** at 387.8 ms in the uninstrumented 40-sheet baseline |
| Pointer-preview work 16.7 ms p95 | Instrumented callback metric is 0.1–0.2 ms, but this is not full paint/frame cost; complete frame-budget compliance is **not established** |
| Long tasks over 50 ms recorded | Yes; diagnostic geometry actions each show long tasks, with task p95 around 160–223 ms, largely around commit work |
| At most 12 full preview SVGs mounted | Pass in existing bound test and measured entry/exit cycles; first-entry samples mounted one |
| One history/model commit per completed gesture | Pass, measured for all three geometry gestures |
| No database requests on pointer movement | Stronger observed condition: zero HTTP requests throughout measured gestures |

`canvas.sheet-load` itself reports only 0.2 ms p95 in diagnostics because it stops at a state setter. It must not be used to claim the 250 ms perceived-navigation budget passes. Similarly, full gesture frame intervals include commit stalls and cannot be equated with the inexpensive preview callback. The dense-sheet SVG stage alone exceeds a 16.7 ms frame interval; dense dragging therefore deserves a dedicated next-pass benchmark, not an assumed pass.

Observer ABBA selection block medians were **82.9 ms disabled, 77.8 enabled, 75.4 enabled, 71.4 disabled**, thirty samples each. Time/warm-state drift exceeds any clear positive overhead signal. This does not prove zero-cost instrumentation. No correction is subtracted from baseline timings; diagnostic timings, profiles and inclusive counters remain a separate dataset.

## 7. Preview, print, PDF and memory

| Size | First preview observation | Print observation / HTML bytes | Baseline PDF median | PDF range, n=5 | PDF bytes |
|---|---:|---:|---:|---:|---:|
| 10 sheets | 564 ms | 1,435 ms / 441,420 B | 3.70 s | 3.61–3.78 s | 1,049,312 |
| 40 sheets | 333 ms | 1,716 ms / 1,805,248 B | 7.19 s | 6.95–8.39 s | 3,308,141 |
| 120 sheets | 548 ms | 1,825 ms / 5,416,251 B | 16.28 s | 13.54–25.05 s | 9,332,918 |

All fifteen baseline exports succeeded, as did the separate fifteen diagnostic exports. The diagnostic stage medians for 120 sheets were approximately **114 ms Chromium launch, 972 ms setContent/readiness, 7,693 ms PDF generation, 68 ms close**. Its complete server response median was 9,520 ms. These later diagnostic results were faster than the earlier baseline without optimization; environment/cache drift prevents treating that difference as a gain. Chromium printing dominates that diagnostic export, not launch alone. Separate stage medians are not an exact additive decomposition of the median request.

Fifteen launches have fifteen recorded closes. Server RSS at diagnostic 120-sheet response completion ranged roughly **350–460 MB**; stage samples reached about **513 MB**. These exclude Chromium child-process memory and are not a peak-memory bound or a concurrency capacity estimate. Print and PDF already share SVG rendering but repeat package orchestration. Production-only installation/browser availability also needs a deployment smoke test because the manifest reaches Playwright through its development testing dependency.

All three print HTML files are byte-identical before/after instrumentation. PDF page count/order, text hashes and page sizes match for every page. First, fourth and last pages at all three sizes are pixel-identical (nine pairs); representative pages were visually inspected. Route labels are present. Some schedule/stub punctuation extracts through pypdf as private-use codepoints, so literal wire-ID extraction is not fully reliable. The initial check also incorrectly expected explicit field labels to display their underlying wire IDs; corrected QA honors the existing label override. Both QA outputs are retained. Real viewer search/copy behaviour is unverified; the bundled second text-extraction executable was unavailable.

Over twenty navigation/dialog/preview cycles, post-GC browser heap samples were **14.9, 21.1, 19.1, 21.1 and 21.1 MB** at cycles 0/5/10/15/20. Document count stayed two; listeners stayed around 494–505; DOM counts varied with the active sheet rather than growing continuously. This does not demonstrate an unbounded UI leak. At 10/50/60 non-coalesced history edits, post-GC heap was **20.6/21.0/21.1 MB**; fifty undo/redo entries behaved correctly. Retained warm state is not itself a leak.

No new loading/save/PDF pass thresholds were invented for this audit. For the next pass, agree prospective targets on a named machine and realistic artwork before enforcing them. A reasonable product discussion starts with typical-package opening around two seconds and save acknowledgment below half a second; PDF needs a size/artwork-specific target rather than one global p95. These are proposals, not retroactive audit passes.

## 8. Modularity, duplication and standards

The drawing code is already feature-oriented and has substantial pure-service/command tests. Static inventory finds **246 drawing production files, 68,778 lines, 178 cross-feature imports and 37 runtime imports outside the selected public-boundary convention**. Largest modules include the shell (5,283 lines), inspector (3,910) and SVG surface (2,590). Size/import counts identify review targets, not automatic defects or measured latency.

Distinguish three things:

- **Duplicated computation:** measured graph/projection rebuilds and two source adaptations per small edit.
- **Duplicated orchestration:** print/PDF preparation and large UI orchestrators coordinating multiple responsibilities.
- **Intentional repeated occurrences:** one engineering asset appears on several sheets. No duplicated saved engineering data was demonstrated.

Use existing conventions more precisely: single-responsibility selectors/commands, explicit dependency and revision boundaries, public cross-feature contracts, Zod at trust boundaries, deterministic engineering fixtures, output-parity tests, and serial reproducible performance gates. Prefer small extractions when addressing measured costs. No new dependency, state-management library, feature folder or broad architecture rewrite is justified by this audit.

The planning skills structured the audit/task evidence; React/Next performance guidance directed review toward serialization boundaries, stable memo dependencies and indexed lookup reuse. They did not justify bypassing engineering validation or silently changing behavior.

## 9. Hypothesis disposition and limitations

| Hypothesis | Disposition |
|---|---|
| H01 Whole-document list overfetch | **Confirmed: measured + code** |
| H02 Unused catalogue overhead | **Confirmed: measured + code**, with pinned-module safety gap |
| H03 Selection rebuilds unchanged graph | **Confirmed: invocation counts + memo dependencies** |
| H04 Small edits repeat package adaptation | **Confirmed: two source passes per measured edit/gesture** |
| H05 Scale-sensitive network lookup/ordering | **Confirmed hotspot**; proposed replacement benefit unmeasured |
| H06 General N+1 list/detail querying | **Not confirmed**; batched queries observed |
| H07 Unopened/collapsed UI overhead | Closed Wire Catalog mount confirmed; blanket collapsed-card claim **not confirmed** |
| H08 Unbounded preview SVG mounting | **Rejected within tested scope**; bound preserved |
| H09 Sustained UI memory leak | **Not demonstrated** in twenty cycles; not a long-soak proof |
| H10 Export preparation/lifecycle overhead | **Confirmed**; printing is the dominant measured Chromium stage |
| H11 Modularity improvements possible | **Code-derived assessment**, not a file-size-based performance claim |
| H12 Existing metrics equal user-visible time | **Rejected** for sheet-load and preview-callback metrics |

Preserved harness problems: initial SQL observer captured zero queries and then failed BigInt serialization; corrected observer results are separate. Initial browser readiness ignored a lazy overlay, and worker restart overwrote some first-run navigation/action samples; those lost samples are not used, and the complete baseline-v2 replaces them for analysis. An initial history test ignored intentional 900 ms edit coalescing. Audit build attempts discovered archived TypeScript files and audit-tool typing errors; both were corrected without product fixes. Original logs/failures remain. These are not reclassified as application performance regressions.

Additional limits: no canonical project/database inspection, no manufacturer-heavy SVG fixture, no cloud/latency/load/capacity test, no exhaustive editing matrix at every package size, no active browser source-map attribution, no true cold-cache test, no complete heap-retainer analysis, and no perfect per-request Prisma trace. Each limits the strength of a conclusion; none is concealed by an invented green threshold.

## 10. Handoff

Deliverables are the assessment, ranked implementation backlog, reproduction guide, architecture/hypothesis map, eight task reports, reusable guarded audit tooling, and local raw evidence including samples, query plans, traces, CPU profiles, screenshots, PDFs and scaling charts.

The working repository receives tooling/documentation/evidence only. Instrumented product files and adapted UI tests stay in the disposable audit worktree. No migration, dependency addition, product optimization, publication or database-provider change was made. The isolated servers are stopped; the audit worktree/dependencies/database remain available for reproduction and have not been deleted.

Recommended next decision: approve the first small implementation tranche—verification/hydration, closed-dialog mounting, stable graph invalidation and measured lookup/ordering costs—then compare against this baseline before progressing to catalogue/list/save/export changes.
