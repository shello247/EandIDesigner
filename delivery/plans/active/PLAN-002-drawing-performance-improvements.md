# PLAN-002 — Drawing Performance Improvements

Status: active
Progress: Stage0 recovery/isolation and Stage1 verification complete. CI32998854844 passes full lint/types/714units/build and27production workflows at c63a0ef5db295103a2d0a9ecc9f9e161aacb9b83. Stage2 begins with007closed Wire Catalog mounting. No measured optimization gain claimed yet.
Started: 2026-08-26 12:55
Completed: pending
Duration: pending
Timezone: America/Port_of_Spain; evidence timestamps UTC. Calendar-month aggregation not applicable.

## Assumptions and authorization

Approved user execution plan governs this work. Continue automatically when gates pass. Source-only backups to public shello247/EandIDesigner are explicitly authorized. No merge/PR/live promotion authorized. SQLite stays; no new schema/migrations/dependencies/formats/identities. Existing source snapshot contains earlier changes, which are preserved, not introduced as new schema work.

## A) Feature capsule

Scope amendment (2026-08-26): user authorized the smallest compatible existing-dependency security updates and applicability verification. Do not add new application dependencies, extend exceptions or suppress findings; stop for a major framework upgrade or broader changes. Record before/after audit and compatibility tests separately from performance optimization.

Goal: faster existing engineering drawing workflows with measured, reversible changes. Audience: drawing engineers. Preserve appearance and engineering behavior; only list pagination and necessary lazy-load status/retry states change UI. Surfaces: drawing list/editor/sheets/assets/properties/wiring/schedules/save/preview/print/PDF.

Inputs use existing Zod contracts. New internal interfaces: paginated list summaries; exact-version bundle/catalogue summaries; save acknowledgment {id,updatedAt}; model/source preparation; bounded diagnostic correlation. Existing errors and conflict semantics remain. Data reads/writes stay in feature data layers; no public authorization, tenancy, concurrent-editor, AI/approval or provider changes.

Acceptance: gates below; unchanged wire/terminal identities, pinned versions, drawing JSON and save semantics; 1 gesture history commit, history coalescing/50-entry limit, no pointer database calls; preview maximum 12 full SVGs; output parity. Engineering services retained. Broad rewrite/export-worker redesign deferred.

## B) Scaffold/file map

Extend existing src/features/{drawing_canvas,drawing_panel_wiring,symbol_registry}/ boundaries, existing UI and tests. No new product feature folder. Audit tooling: scripts/drawing-performance-audit/ plus guarded pass support scripts/drawing-performance-pass/. Delivery: this plan, 23 task specifications/reports, CURRENT/PROJECT/TASKS. Raw evidence: artifacts/drawing-performance/pass-1/<unique-batch>/, ignored by Git. Frozen PLAN-001 raw evidence remains local and unchanged.

## C) Ordered execution chunks

1. Stage 0 — Reviewed source recovery and verified GitHub snapshot. Gate: Exact audited source reproduced; publication review passes; commit pushed and remote SHA verified.

2. Stage 0 — Guarded run configuration and clean isolated baseline. Gate: Unique run paths; target guards; independent install/build/bootstrap; baseline failures preserved.

3. Stage 1 — Repair standalone test typing. Gate: Standalone application and real-test type check passes without weakened types or unrelated runtime changes.

4. Stage 1 — Reproduce and fix production hydration mismatch. Gate: Demonstrated SSR/client cause fixed; production pageErrors remain empty; no suppression or blanket SSR disable.

5. Stage 1 — Refresh stale drawing browser locators. Gate: Collapsed sections/category controls handled; original engineering assertions retained; affected workflows pass.

6. Stage 1 — Establish production drawing release gates. Gate: Branch CI, Chromium install, serial production browser gate, lint/types/unit/build pass.

7. Stage 2 — Remove closed Wire Catalog mounting overhead. Gate: No closed loading overlay; first-open/error/retry/close/focus behavior preserved.

8. Stage 2 — Accurate bounded action and rendering metrics. Gate: Stage and settled interaction timing separated; bounded disabled-default counters; diagnostic parity passes.

9. Stage 3 — Reuse engineering snapshots across view changes. Gate: Unchanged source is not rebuilt on selection/sheet/card/preview changes; mutation invalidation and cache lifetime correct.

10. Stage 3 — Index endpoint and topology resolution. Gate: First-match/ambiguity/unresolved semantics preserved; adversarial graph/index parity passes.

11. Stage 3 — Benchmark equivalent reusable numeric ordering. Gate: Equivalent ordering and repeatable benefit; otherwise retain existing comparator and report rejected experiment.

12. Stage 3 — Share normalized model and final derived source. Gate: Final model/source agree after wire-ID reconciliation; normal duplicate adaptations eliminated; undo/save invariants pass.

13. Stage 3 — Reuse exact-version and generated render preparation. Gate: Complete dependency identity; occurrence labels/anchors/transforms preserved; bounded/reclaimable caches.

14. Stage 4 — Complete pinned render dependency collection. Gate: Assets/placements/components/strip members/module templates included; generated pseudo IDs excluded; no latest fallback.

15. Stage 4 — Batched render bundle and catalogue summaries. Gate: Required exact versions only; lightweight catalogue contract; unrelated full-catalogue callers preserved.

16. Stage 4 — Load catalogue details on demand. Gate: Deduplicated full-record loads; explicit error/retry; no partial insertion; summary loads do not invalidate graph.

17. Stage 4 — Migrate drawing consumers and save validation. Gate: All drawing operations work with split data; catalogue scaling does not enlarge initial full-symbol bundle.

18. Stage 5 — Paginate exact drawing summaries without migration. Gate: 25 per page; count + bounded rows; stable updatedAt desc/ID asc; invalid/out-of-range pages handled; BOM options unchanged.

19. Stage 6 — Compact revision-consistent save acknowledgment. Gate: {id,updatedAt}; guarded persisted revision; no full detail reparse; conflict/dirty/in-flight/retry behavior unchanged.

20. Stage 6 — Control drawing-scoped unrelated prefetch. Gate: No automatic unrelated destination fan-out during saves; list freshness/navigation preserved; measure RSC plus action bytes.

21. Stage 7 — Integrated regression and repeated performance comparison. Gate: Full regression; baseline/predecessor paired timing; 20 UI cycles; 50-entry history; failed budgets reported honestly.

22. Stage 7 — PDF/print verification and text compatibility check. Gate: Five PDFs per size; page/order/text/wire/schedule/layout parity; search/copy caveats verified or explicitly retained.

23. Stage 7 — Clean-checkout recovery and final verified checkpoint. Gate: Restored checkpoint builds/runs synthetic data; final report/recovery map pushed; original source/port unchanged; no merge/live promotion.

## Recovery and publication

Implementation branch codex/drawing-performance-pass-1 starts from current local main; initial reviewed source snapshot imports current reliability-hardening working source and provenance. Original worktree/upstream remain unchanged. Checkpoint after verified tasks and before session end; unfinished work >90 minutes gets clearly marked WIP recovery, never a verified-stage tag. Verify remote SHA. No force push/rebase/reset. Corrective commits or targeted revert preserve recovery history. A failed remote backup stops progression before the next major stage. GitHub is source recovery, not a database backup.

Exclude env/secrets/database/sidecars/user exports/clipboard imagery/dependencies/generated clients/builds/bulky raw evidence/temporary product profiling hooks. Review staged file manifest and publication scan before each push. Confidential findings stop publication and require direction.

## Runtime and measurement

Port3000/live canonical DB untouched. Independent worktree/deps/Prisma/build; guarded synthetic SQLite and free port3100. No simultaneous timed workloads/builds. Production uninstrumented timing; separate bounded diagnostics/parity. Five warmups+30 samples; fresh contexts n10 distinct from OS cold cache; PDFs n5 median/range. Exact source/harness/fixture fingerprints, unique labels, failures/outliers preserved. Reversed-order repeat for noise. Existing 100ms source/graph and display, 250ms switch, 16.7ms preview and 50ms long-task budgets unchanged. Stage metrics are not painted readiness.

## Gates and stop conditions

- [x] Stage0 reviewed source recovery remote verified; isolated clean install/build/runtime baseline. Tag drawing-perf-pass-1-stage-0-20260826; known baseline failures retained.
- [x] Stage1 full lint/types/unit/build and audited production browsers pass; no hydration suppression/weakened assertions. Tag drawing-perf-pass-1-stage-1-20260826 targets c63a0ef5db295103a2d0a9ecc9f9e161aacb9b83.
- [ ] Stage2 closed dialog absent and accurate bounded metrics/parity.
- [ ] Stage3 graph/invalidation/parity/history/requests counts improve without confirmed regression.
- [ ] Stage4 dependency closure, lazy catalogue and all render/export/validation consumers correct.
- [ ] Stage5 at most25 document parses/page, exact counts, stable pages and no migration.
- [ ] Stage6 consistent compact acknowledgment; save/conflict/in-flight/list/navigation behavior preserved; full response/fan-out measured.
- [ ] Stage7 complete regression/measurements/export/memory/recovery rehearsal and final remote checkpoint.

Stop for unresolved reproducible correctness regressions, scope expansion, source drift, unavailable verified backup, confidential publication material, or required final performance failures after planned work and confirming reruns. Known baseline budget failures remain visible while earlier stages address them. No falsely green completion.

## Verification and quality

Focused Vitest/negative paths first, affected production Playwright (one worker, no masking retries), lint/new standalone types/full units/build at milestones. CI installs Chromium and retains sanitized failure artifacts. Performance timings compare the same hardware/environment, not local Windows against shared Linux CI. Regression matrix includes geometry/arrangement/copy/labels/dimensions/guides, panel ownership/generated+structured terminals, route-only removal/occupancy/restore/hit testing, four display modes/schedules/continuations, history/save/conflict/reload and all output surfaces.

## Risks

- P0 wrong DB: absolute path/run guards before imports/bootstrap/writes.
- P0 source publication: allowlisted file review and redacted secret-pattern scan, no engineering exports.
- P1 stale cache: immutable complete dependency identity, adversarial invalidation/output parity.
- P1 missing pinned symbols: dependency closure before narrowing data.
- P1 save regression: persisted revision and existing conflict/dirty/in-flight tests.
- P1 timing noise: serial paired runs and preserved failures/overhead records.
- P1 workflow drift: original fingerprints/ports checked; no automatic live restart/main merge.

## Reporting

Task reports require Start/End/Duration (local), summary, files, commands/results, measurements, risks and remote checkpoint SHA. Each stage reports changes, tests, paired results and next task. Final comparison is not a cloud multi-user certification. Planned effort 45–75 engineering hours, not a deadline.

## Confirmations needed

None unless a stated stop condition is reached.
