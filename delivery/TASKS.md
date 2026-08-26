# Drawing performance investigation

## Active plan

PLAN-002 — [Drawing Performance Improvements](plans/active/PLAN-002-drawing-performance-improvements.md), active.

## Queue

- [x] PLAN-002-TASK-001 — Reviewed source recovery and verified GitHub snapshot
- [x] PLAN-002-TASK-002A — Authorized dependency-security prerequisite (known baseline browser failures retained)
- [x] PLAN-002-TASK-002 — Guarded run configuration and clean isolated baseline
- [x] PLAN-002-TASK-003 — Repair standalone test typing (brought forward for security build)
- [x] PLAN-002-TASK-004 — Reproduce and fix production hydration mismatch
- [x] PLAN-002-TASK-005 — Refresh stale drawing browser locators
- [x] PLAN-002-TASK-006 — Establish production drawing release gates
- [x] PLAN-002-TASK-007 — Remove closed Wire Catalog mounting overhead
- [x] PLAN-002-TASK-008 — Accurate bounded action and rendering metrics
- [x] PLAN-002-TASK-009 — Reuse engineering snapshots across view changes
- [x] PLAN-002-TASK-010 — Index endpoint and topology resolution
- [x] PLAN-002-TASK-011 — Benchmark equivalent reusable numeric ordering
- [x] PLAN-002-TASK-012 — Share normalized model and final derived source
- [x] PLAN-002-TASK-013 — Reuse exact-version and generated render preparation
- [x] PLAN-002-TASK-014 — Complete pinned render dependency collection
- [x] PLAN-002-TASK-015 — Batched render bundle and catalogue summaries
- [x] PLAN-002-TASK-016 — Load catalogue details on demand
- [x] PLAN-002-TASK-017 — Migrate drawing consumers and save validation
- [x] PLAN-002-TASK-018 — Paginate exact drawing summaries without migration
- [x] PLAN-002-TASK-019 — Compact revision-consistent save acknowledgment
- [x] PLAN-002-TASK-020 — Control drawing-scoped unrelated prefetch
- [x] PLAN-002-TASK-021 — Integrated regression and repeated performance comparison
- [ ] PLAN-002-TASK-022 — PDF/print verification and text compatibility check (active)
- [ ] PLAN-002-TASK-023 — Clean-checkout recovery and final verified checkpoint

## Planned plans

None.

## Completed

PLAN-001 — [Drawing performance investigation](plans/completed/PLAN-001-drawing-performance-investigation.md), 26 August 2026. Complete with documented test failures and coverage limitations; no product optimization.

- [x] PLAN-001-TASK-001 — Baseline and architecture map
- [x] PLAN-001-TASK-002 — Audit harness and fixtures
- [x] PLAN-001-TASK-003 — Drawing correctness baseline
- [x] PLAN-001-TASK-004 — Loading and SQLite
- [x] PLAN-001-TASK-005 — Canvas and engineering processing
- [x] PLAN-001-TASK-006 — Save, preview, print and PDF
- [x] PLAN-001-TASK-007 — Memory and modularity
- [x] PLAN-001-TASK-008 — Evidence report and prioritized backlog

[Assessment](reports/PLAN-001-drawing-performance-assessment.md) · [Backlog](reports/PLAN-001-improvement-backlog.md) · [Reproduction](reports/PLAN-001-reproduction-guide.md)

## Rules

Isolated synthetic SQLite only. Do not touch port 3000, canonical data, or unrelated changes. Preserve failed tests and raw samples. No access-control, concurrent-editor, PostgreSQL or new-feature work.
