# PLAN-001-TASK-002 — Audit harness and fixtures

Status: complete with recorded limitations. Investigation only; not a claim that all tests/budgets pass.

Run: `20260826-baseline`. UTC command timestamps and durations are in the referenced `*-start.json` / `*-result.json` files. Work packages were interleaved; command durations are not exclusive task labor estimates. Local summaries use America/Port_of_Spain (UTC−04:00).

Added guarded audit-only tooling for fixture creation, CPU/SQLite/browser measurement, mechanical instrumentation, profiles, parity, charts and evidence handoff. Public APIs, normal response payloads, drawing JSON and Prisma schema remain unchanged. Product hooks exist only in the audit copy.

Built validated 10/40/120-sheet drawable fixtures, a 200-placement/500-route sheet, independent catalogue/list scaling and the separate source-only 120-sheet fixture. Nine audit tests passed, including source/graph/context/SVG parity with diagnostics on/off.

Evidence: `fixtures.json`, `source-only-fixture.json`, `harness-parity-result.json`, `diagnostic-parity.json`, `instrumentation-manifest.json`, `final-tooling-lint-result.json`, `final-tooling-types-result.json`.

Verification: audit Vitest config and scoped TypeScript config; exact commands in their start/result records and the [reproduction guide](PLAN-001-reproduction-guide.md).

Limitations: initial observer, archive-TypeScript and harness typing failures remain in logs. AsyncLocalStorage correlates operation counters, but Prisma query events remain unassigned; do not infer exact per-request SQL from them. ABBA overhead blocks show warm/time drift, not a proven zero-cost observer.

Raw evidence path: `artifacts/drawing-performance/20260826-baseline/`. Source/fixture definitions and hashes are shared with the main assessment and reproduction guide.

