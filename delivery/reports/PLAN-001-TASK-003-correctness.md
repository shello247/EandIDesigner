# PLAN-001-TASK-003 — Drawing correctness baseline

Status: complete with recorded limitations. Investigation only; not a claim that all tests/budgets pass.

Run: `20260826-baseline`. UTC command timestamps and durations are in the referenced `*-start.json` / `*-result.json` files. Work packages were interleaved; command durations are not exclusive task labor estimates. Local summaries use America/Port_of_Spain (UTC−04:00).

The original drawing/engineering unit baseline passed 524 tests across 89 files; the same 524 passed after diagnostic instrumentation. The original production browser suite passed 22 of 27 tests. Four failures were stale UI locators; audit-only adapters preserved engineering assertions and produced four passes, with one genuine console-error failure remaining.

The remaining panel-assignment workflow reproduces three React hydration #418 events. Root cause is unverified. Original test files were not changed in the working repository. Full lint and baseline/diagnostic production builds pass, but standalone TypeScript reports 39 existing test diagnostics, including some outside drawings. Build-time filtering of test diagnostics is not a clean test-type gate.

Evidence: `unit-baseline.json`, `unit-diagnostic.json`, `e2e-baseline.json`, original failure traces, both `e2e-adapted*.json`, `typecheck-final.log`, lint/build results. All original failures are retained.

Verification: replay exact commands from result JSON in the isolated worktree. The assessment's workflow matrix distinguishes browser evidence, unit-only coverage and gaps.

Limitations: no exhaustive browser editing matrix at every fixture size; some annotation/alignment/dimension paths have unit rather than repeated production-browser coverage. Completion means the outcomes are recorded, not that every test passes.

Raw evidence path: `artifacts/drawing-performance/20260826-baseline/`. Source/fixture definitions and hashes are shared with the main assessment and reproduction guide.

